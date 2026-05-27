-- 011 — model_versions + FK additions
-- registry for every ml / llm artefact (classifiers, prompts). modal writes,
-- the app only reads status='active'. partial unique index enforces "exactly
-- one active per kind" without per-row trigger logic.
--
-- this migration also adds the FK constraints that briefings (007),
-- event_metrics (008), and transcript_analysis (010) deferred — they all
-- declared `model_version_id uuid` without a reference so the schema would
-- still apply in per-tick order.

create table public.model_versions (
  id            uuid primary key default gen_random_uuid(),
  kind          model_kind not null,
  version       text not null,
  storage_path  text,
  sha256        text,
  metrics       jsonb,
  status        model_status not null default 'staged',
  notes         text,
  created_at    timestamptz not null default now(),
  promoted_at   timestamptz,

  constraint model_versions_unique_version unique (kind, version)
);

-- enforces exactly-one-active-row-per-kind without a per-row check. trying to
-- set a second 'active' raises a unique violation; the promotion procedure
-- demotes the prior active to 'retired' in one transaction.
create unique index idx_model_versions_one_active
  on public.model_versions (kind)
  where status = 'active';

alter table public.model_versions enable row level security;

create policy "all auth read model_versions"
  on public.model_versions for select
  to authenticated
  using (status = 'active');

-- bootstrap: two active rows so briefing fan-out + extraction can reference them.
insert into public.model_versions (kind, version, status, notes, promoted_at)
values
  ('briefing_prompt',      '1.0', 'active', 'B9 bootstrap. mvp prompt set authored 2026-05-27.',         now()),
  ('surprise_classifier',  '0.1', 'active', 'B9 bootstrap. placeholder constant-output until B17 train.', now()),
  ('extraction_prompt',    '1.0', 'active', 'B9 bootstrap. 8-K / exhibit 99.1 metric extraction prompt.', now()),
  ('transcript_summary',   '1.0', 'active', 'B9 bootstrap. post-call summary + novelty topic prompt.',     now())
on conflict (kind, version) do nothing;

-- add the deferred FK constraints. validating against existing rows: the
-- prior migrations seeded `model_version_id` NULL throughout, so the
-- constraint validates trivially.
alter table public.briefings
  add constraint briefings_model_version_id_fk
  foreign key (model_version_id) references public.model_versions(id);

alter table public.event_metrics
  add constraint event_metrics_extracted_by_model_id_fk
  foreign key (extracted_by_model_id) references public.model_versions(id);

alter table public.transcript_analysis
  add constraint transcript_analysis_model_version_id_fk
  foreign key (model_version_id) references public.model_versions(id);

-- backfill: now that model_versions exists, point the seeded briefings at the
-- active briefing_prompt row so the prompt_version denormalisation makes sense.
update public.briefings
set
  model_version_id = (select id from public.model_versions where kind = 'briefing_prompt' and status = 'active'),
  prompt_version = (select version from public.model_versions where kind = 'briefing_prompt' and status = 'active')
where model_version_id is null;

update public.transcript_analysis
set model_version_id = (select id from public.model_versions where kind = 'transcript_summary' and status = 'active')
where model_version_id is null;
