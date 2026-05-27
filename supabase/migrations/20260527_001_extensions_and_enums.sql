-- 001 — extensions + enums
-- enable all extensions used across the schema, declare every enum type up front
-- so later migrations can reference them in any order.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists moddatetime with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists vector with schema extensions;

-- enums --------------------------------------------------------------------

create type event_source as enum (
  'edgar',
  'wire',
  'manual'
);

create type parse_status as enum (
  'pending',
  'parsed',
  'failed',
  'needs_review'
);

create type briefing_status as enum (
  'pending',
  'ready',
  'needs_review'
);

create type notification_kind as enum (
  'briefing',
  'event',
  'transcript'
);

create type notification_status as enum (
  'pending',
  'sent',
  'delivered',
  'failed',
  'skipped_quiet'
);

create type push_platform as enum ('ios', 'android');

create type model_kind as enum (
  'surprise_classifier',
  'briefing_prompt',
  'extraction_prompt',
  'transcript_summary'
);

create type model_status as enum ('staged', 'active', 'retired');

create type tone as enum ('bullish', 'neutral', 'bearish');

create type guidance_direction as enum (
  'raised',
  'maintained',
  'lowered',
  'withdrawn',
  'none'
);

create type subscription_tier as enum ('free', 'pro');

create type speaker_role as enum (
  'executive',
  'analyst',
  'operator',
  'other'
);
