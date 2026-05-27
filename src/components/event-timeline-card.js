import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Info, Clock } from 'lucide-react-native';
import { Card } from './card';
import { Pill } from './pill';
import { MonoNumber } from './mono-number';
import { colors, space, text } from '../theme';
import { formatEventTime, formatMarketAnchor, formatRelativePast } from '../lib/dates';

function fmtEPS(n) { return n == null || !Number.isFinite(n) ? '—' : `$${n.toFixed(2)}`; }
function fmtSurprise(p) {
  if (p == null || !Number.isFinite(p)) return '—';
  const sign = p >= 0 ? '+' : '';
  return `${sign}${(p * 100).toFixed(1)}%`;
}
function fmtBeatProb(p) {
  if (p == null || !Number.isFinite(p)) return '—';
  return `${Math.round(p * 100)}%`;
}
function classify(p) {
  if (p > 0.005) return 'beat';
  if (p < -0.005) return 'miss';
  return 'inline';
}

const SURPRISE_VISUAL = {
  beat:   { arrow: '▲', color: colors.signal.positive, label: 'beat' },
  miss:   { arrow: '▼', color: colors.signal.negative, label: 'miss' },
  inline: { arrow: '━', color: colors.signal.neutral,  label: 'in line' },
};

const GUIDANCE_VARIANT = {
  raised:     'positive',
  maintained: 'neutral',
  lowered:    'negative',
};

export function EventTimelineCard(props) {
  const { state, ticker, name, period, onPress, hideIdentity = false } = props;
  return (
    <Card onPress={onPress} accessibilityLabel={a11y(props)}>
      {state === 'upcoming' ? <UpcomingHeader {...props} /> : null}
      {state === 'live'     ? <LiveHeader     {...props} /> : null}
      {state === 'past'     ? <PastHeader     {...props} /> : null}

      {hideIdentity ? null : (
        <View style={styles.identityRow}>
          <Text style={styles.ticker} accessibilityLabel={ticker.split('').join(' ')}>{ticker}</Text>
          {name ? <Text style={styles.name} numberOfLines={1}>{name}</Text> : null}
        </View>
      )}
      <Text style={[styles.verb, hideIdentity && styles.verbStandalone]}>{verbFor(state, period)}</Text>

      <View style={styles.divider} />

      {state === 'upcoming' ? <UpcomingBody {...props} /> : null}
      {state === 'live'     ? <RealizedBody {...props} /> : null}
      {state === 'past'     ? <RealizedBody {...props} /> : null}

      {state === 'past' && props.guidance ? <GuidanceRow guidance={props.guidance} /> : null}

      {ctaFor(props)}
    </Card>
  );
}

function verbFor(state, period) {
  if (state === 'upcoming') return `${period} earnings expected`;
  if (state === 'live')     return `${period} results`;
  return `${period} reported`;
}

function UpcomingHeader({ expectedAt }) {
  const time = formatEventTime(expectedAt);
  const anchor = formatMarketAnchor(expectedAt);
  return (
    <View style={styles.upcomingRow}>
      <Clock size={13} color={colors.text.tertiary} strokeWidth={1.5} />
      <Text style={styles.timeAnchor}>
        {time}
        {anchor ? <Text style={styles.anchorSep}> · {anchor}</Text> : null}
      </Text>
    </View>
  );
}

function LiveHeader({ actualAt, now }) {
  const ago = formatRelativePast(actualAt, now ? { now } : undefined);
  return (
    <View style={styles.liveRow}>
      <Text style={styles.liveGlyph}>◐</Text>
      <Text style={styles.liveLabel}>LIVE</Text>
      <Text style={styles.liveSep}>·</Text>
      <Text style={styles.liveDetail}>filed {ago}</Text>
    </View>
  );
}

function PastHeader({ actualAt }) {
  return (
    <View style={styles.pastRow}>
      <Text style={styles.pastGlyph}>✓</Text>
      <Text style={styles.pastLabel}>Reported · {formatEventTime(actualAt)}</Text>
    </View>
  );
}

function UpcomingBody({ epsEst, beatProb, onInfoPress }) {
  const beatDisplay = fmtBeatProb(beatProb);
  return (
    <View>
      <View style={styles.metricLine}>
        <Text style={styles.label}>EPS est</Text>
        <View style={styles.spacer} />
        <MonoNumber value={fmtEPS(epsEst)} size="headline" color={colors.text.primary} />
      </View>
      <View style={styles.metricLine}>
        <Text style={styles.label}>Beat probability</Text>
        <View style={styles.spacer} />
        <MonoNumber
          value={beatDisplay}
          size="headline"
          color={colors.text.primary}
          accessibilityLabel={beatProb != null ? `${Math.round(beatProb * 100)} percent predicted beat probability` : 'beat probability unavailable'}
        />
        {onInfoPress ? (
          <Pressable
            onPress={onInfoPress}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="How this prediction works"
            style={({ pressed }) => [styles.infoBtn, pressed && { opacity: 0.6 }]}
          >
            <Info size={14} color={colors.text.tertiary} strokeWidth={1.75} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function RealizedBody({ epsActual, epsEst, surprisePct }) {
  const k = classify(surprisePct);
  const v = SURPRISE_VISUAL[k];
  return (
    <View>
      <View style={styles.metricLine}>
        <Text style={styles.label}>EPS</Text>
        <View style={styles.spacer} />
        <MonoNumber value={fmtEPS(epsActual)} size="headline" color={colors.text.primary} />
        <Text style={styles.vs}> vs </Text>
        <MonoNumber value={fmtEPS(epsEst)} size="subhead" color={colors.text.tertiary} accessibilityLabel={`${fmtEPS(epsEst)} estimate`} />
      </View>
      <View style={styles.metricLine}>
        <Text style={[styles.arrow, { color: v.color }]}>{v.arrow}</Text>
        <MonoNumber value={fmtSurprise(surprisePct)} size="headline" color={v.color} />
        <Text style={[styles.surpriseQual, { color: v.color }]}> surprise ({v.label})</Text>
      </View>
    </View>
  );
}

function GuidanceRow({ guidance }) {
  const variant = GUIDANCE_VARIANT[guidance.direction] ?? 'neutral';
  return (
    <View style={styles.guidanceRow}>
      <Pill variant={variant} size="sm">{`Guidance ${guidance.direction}`}</Pill>
      {guidance.detail ? <Text style={styles.guidanceDetail} numberOfLines={2}>{guidance.detail}</Text> : null}
    </View>
  );
}

function ctaFor({ state, briefingReady, onBriefingPress, onOpenDetail }) {
  if (state === 'upcoming' && briefingReady) {
    if (!onBriefingPress) {
      // informational badge — no destination wired (e.g. ticker detail with no briefing route yet)
      return (
        <View style={styles.ctaRow}>
          <View style={styles.brDot} />
          <Text style={styles.brText}>Briefing ready</Text>
        </View>
      );
    }
    return (
      <Pressable
        onPress={onBriefingPress}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Open briefing"
        style={({ pressed }) => [styles.ctaRow, pressed && { opacity: 0.6 }]}
      >
        <View style={styles.brDot} />
        <Text style={styles.brText}>Briefing ready</Text>
        <View style={styles.spacer} />
        <Text style={styles.ctaArrow}>→</Text>
      </Pressable>
    );
  }
  if (state === 'live' && onBriefingPress) {
    return (
      <Pressable
        onPress={onBriefingPress}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Read briefing"
        style={({ pressed }) => [styles.ctaRow, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.brText}>Read briefing</Text>
        <View style={styles.spacer} />
        <Text style={styles.ctaArrow}>→</Text>
      </Pressable>
    );
  }
  if (state === 'past' && onOpenDetail) {
    return (
      <Pressable
        onPress={onOpenDetail}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Open event detail"
        style={({ pressed }) => [styles.ctaRow, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.brText}>Open event detail</Text>
        <View style={styles.spacer} />
        <Text style={styles.ctaArrow}>→</Text>
      </Pressable>
    );
  }
  return null;
}

function a11y({ state, ticker, name, period, epsActual, epsEst, surprisePct, beatProb }) {
  const base = `${ticker ?? ''}${name ? `, ${name}` : ''}${period ? `, ${period}` : ''}`;
  if (state === 'upcoming') {
    return `${base}, earnings expected, EPS estimate ${fmtEPS(epsEst)}${beatProb != null ? `, predicted beat probability ${Math.round(beatProb * 100)} percent` : ''}`;
  }
  if (state === 'live') {
    return `${base}, live results, EPS ${fmtEPS(epsActual)} versus estimate ${fmtEPS(epsEst)}, ${fmtSurprise(surprisePct).replace('%', ' percent')} surprise`;
  }
  return `${base}, reported, EPS ${fmtEPS(epsActual)} versus estimate ${fmtEPS(epsEst)}, ${fmtSurprise(surprisePct).replace('%', ' percent')} surprise`;
}

const styles = StyleSheet.create({
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: space[2],
  },
  timeAnchor: {
    ...text.subhead,
    color: colors.text.secondary,
  },
  anchorSep: { color: colors.text.tertiary },

  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: space[2],
  },
  liveGlyph: {
    ...text.callout,
    color: colors.accent.default,
  },
  liveLabel: {
    ...text.micro,
    color: colors.accent.default,
    letterSpacing: 0.6,
    marginLeft: 2,
  },
  liveSep: {
    ...text.subhead,
    color: colors.text.tertiary,
    marginHorizontal: 2,
  },
  liveDetail: {
    ...text.subhead,
    color: colors.text.tertiary,
  },

  pastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: space[2],
  },
  pastGlyph: {
    ...text.callout,
    color: colors.text.tertiary,
  },
  pastLabel: {
    ...text.subhead,
    color: colors.text.tertiary,
  },

  identityRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[3],
  },
  ticker: {
    ...text.headlineMono,
    color: colors.text.primary,
  },
  name: {
    ...text.subhead,
    color: colors.text.secondary,
    flex: 1,
  },
  verb: {
    ...text.subhead,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  verbStandalone: {
    ...text.headline,
    color: colors.text.primary,
    marginTop: 0,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.subtle,
    marginVertical: space[3],
  },

  metricLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: space[1],
  },
  label: {
    ...text.subhead,
    color: colors.text.secondary,
  },
  spacer: { flex: 1 },
  vs: {
    ...text.subhead,
    color: colors.text.tertiary,
  },
  arrow: {
    ...text.headlineMono,
    marginRight: 4,
  },
  surpriseQual: {
    ...text.subhead,
  },
  infoBtn: { marginLeft: space[2], padding: 2 },

  guidanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginTop: space[3],
  },
  guidanceDetail: {
    ...text.footnote,
    color: colors.text.tertiary,
    flex: 1,
  },

  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space[3],
    paddingTop: space[2],
  },
  brDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent.default,
    marginRight: space[2],
  },
  brText: {
    ...text.callout,
    color: colors.accent.default,
  },
  ctaArrow: {
    ...text.callout,
    color: colors.accent.default,
  },
});
