"""
build the russell 1000 seed csv at supabase/seed/russell_1000.csv.

reads:
  - ishares iwb (russell 1000 etf) holdings csv from blackrock
  - sec company_tickers.json for CIK lookup

writes:
  - supabase/seed/russell_1000.csv  with columns matching public.tickers:
      symbol, name, cik, exchange, sector, industry, market_cap_class

usage:
  python scripts/build_ticker_seed.py

requires:
  - python 3.10+, stdlib only (urllib, csv, json)

apply the output to your supabase project either via:
  - `psql "$DB_URL" -c "\\copy public.tickers (...) from 'supabase/seed/russell_1000.csv' csv header"`
  - or supabase db reset (picks up supabase/seed.sql which does the copy)

idempotent: re-running overwrites the csv; the migration's on-conflict-do-nothing
or a future upsert path handles duplicates against the bootstrap rows.
"""

from __future__ import annotations

import csv
import json
import logging
import re
import sys
from io import StringIO
from pathlib import Path
from urllib.request import Request, urlopen

log = logging.getLogger("build_ticker_seed")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT = REPO_ROOT / "supabase" / "seed" / "russell_1000.csv"

# blackrock iwb (russell 1000 etf) holdings — public download.
# url has rotated historically; check https://www.ishares.com/us/products/239726
# if the request fails.
IWB_CSV_URL = (
    "https://www.ishares.com/us/products/239726/ishares-russell-1000-etf/"
    "1467271812596.ajax?fileType=csv&fileName=IWB_holdings&dataType=fund"
)

# sec central index key registry. flat json keyed by integer.
SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"

# polite UA per sec fair-access policy.
USER_AGENT = "Sift earnings research <leroyzzng@gmail.com>"

# tickers we keep when iwb csv has them but they aren't equities (cash, futures).
NON_EQUITY_PATTERNS = re.compile(r"^(USD|XTSLA|MARGIN|CASH)$", re.IGNORECASE)


def fetch(url: str) -> bytes:
    log.info("fetching %s", url)
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    with urlopen(req, timeout=60) as r:
        return r.read()


def parse_iwb_csv(raw: bytes) -> list[dict]:
    """
    ishares csv has ~10 lines of fund-metadata before the actual header row.
    detect the header by looking for the line that contains 'Ticker' and 'Name'.
    """
    text = raw.decode("utf-8", errors="replace")
    lines = text.splitlines()
    start = None
    for i, line in enumerate(lines):
        if "Ticker" in line and "Name" in line and "Sector" in line:
            start = i
            break
    if start is None:
        raise RuntimeError("could not find iwb holdings header row")

    csv_body = "\n".join(lines[start:])
    reader = csv.DictReader(StringIO(csv_body))
    holdings: list[dict] = []
    for row in reader:
        symbol = (row.get("Ticker") or "").strip().upper()
        if not symbol or NON_EQUITY_PATTERNS.match(symbol):
            continue
        name = (row.get("Name") or "").strip()
        sector = (row.get("Sector") or "").strip() or "Unknown"
        # iwb does not include GICS industry; we omit it (column is nullable).
        exchange = (row.get("Exchange") or "").strip()
        market_cap_class = _classify_market_cap(row.get("Market Value") or row.get("Notional Value"))
        holdings.append({
            "symbol": symbol,
            "name": name,
            "sector": sector,
            "industry": "",
            "exchange": _normalize_exchange(exchange),
            "market_cap_class": market_cap_class,
        })
    return holdings


def parse_sec_ticker_map(raw: bytes) -> dict[str, str]:
    """returns {symbol_upper: cik_zero_padded_10_digit}."""
    blob = json.loads(raw)
    out: dict[str, str] = {}
    for entry in blob.values():
        sym = (entry.get("ticker") or "").upper()
        cik = entry.get("cik_str")
        if sym and cik is not None:
            out[sym] = f"{int(cik):010d}"
    return out


def _normalize_exchange(raw: str) -> str:
    # iwb uses 'NASDAQ' or 'New York Stock Exchange Inc.' or similar.
    if not raw:
        return "NYSE"
    upper = raw.upper()
    if "NASDAQ" in upper:
        return "NASDAQ"
    if "AMEX" in upper or "NYSE AMERICAN" in upper:
        return "AMEX"
    return "NYSE"


def _classify_market_cap(value_str: str | None) -> str:
    # iwb reports holding's market value in usd; roughly proportional to mkt cap.
    # this is heuristic — for ranking only, not authoritative.
    try:
        value = float(str(value_str or "0").replace(",", "").replace("$", ""))
    except ValueError:
        return "large"
    if value > 2_000_000_000:  # billions of dollars of holding ≈ mega-cap issuer
        return "mega"
    if value > 100_000_000:
        return "large"
    if value > 10_000_000:
        return "mid"
    return "small"


def merge(holdings: list[dict], cik_map: dict[str, str]) -> list[dict]:
    merged: list[dict] = []
    missing_cik: list[str] = []
    for h in holdings:
        cik = cik_map.get(h["symbol"])
        if not cik:
            missing_cik.append(h["symbol"])
            continue
        merged.append({**h, "cik": cik})
    if missing_cik:
        log.warning("%d tickers without CIK skipped (e.g. %s)", len(missing_cik), missing_cik[:6])
    return merged


def write_csv(rows: list[dict]) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["symbol", "name", "cik", "exchange", "sector", "industry", "market_cap_class"]
    with OUTPUT.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})
    log.info("wrote %d rows to %s", len(rows), OUTPUT)


def main() -> int:
    try:
        iwb_raw = fetch(IWB_CSV_URL)
        sec_raw = fetch(SEC_TICKERS_URL)
    except Exception as exc:
        log.error("download failed: %s", exc)
        return 2

    holdings = parse_iwb_csv(iwb_raw)
    log.info("parsed %d iwb holdings", len(holdings))

    cik_map = parse_sec_ticker_map(sec_raw)
    log.info("parsed %d sec ticker→cik mappings", len(cik_map))

    rows = merge(holdings, cik_map)
    if len(rows) < 800:
        log.warning("only %d rows merged — expected ~1000; sources may have shifted", len(rows))
    write_csv(rows)
    return 0


if __name__ == "__main__":
    sys.exit(main())
