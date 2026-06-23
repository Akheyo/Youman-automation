-- ============================================================================
--  Youman Automation — SaaS schema (Supabase / Postgres)
--  Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user (plan, billing, monthly usage counters)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  email                  text,
  full_name              text,
  plan                   text not null default 'free',
  subscription_status    text,
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  search_count           integer not null default 0,
  email_count            integer not null default 0,
  call_count             integer not null default 0,
  usage_period           text,                 -- 'YYYY-MM'
  created_at             timestamptz not null default now()
);

-- Backfill for existing installs.
alter table public.profiles add column if not exists call_count integer not null default 0;

alter table public.profiles enable row level security;

drop policy if exists "profiles read own"   on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles read own"   on public.profiles for select using (auth.uid() = id);
create policy "profiles update own" on public.profiles for update using (auth.uid() = id);

-- Create a profile row automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- consume_quota: atomically reset monthly counters + check/charge a credit.
-- Returns true when allowed (and increments), false when the limit is hit.
-- ---------------------------------------------------------------------------
create or replace function public.consume_quota(p_kind text, p_limit integer)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  cur_period text := to_char(now(), 'YYYY-MM');
  used integer;
begin
  -- Reset counters at the start of a new month.
  update public.profiles
     set search_count = case when usage_period is distinct from cur_period then 0 else search_count end,
         email_count  = case when usage_period is distinct from cur_period then 0 else email_count  end,
         call_count   = case when usage_period is distinct from cur_period then 0 else call_count   end,
         usage_period = cur_period
   where id = auth.uid();

  if p_kind = 'search' then
    select search_count into used from public.profiles where id = auth.uid();
    if used >= p_limit then return false; end if;
    update public.profiles set search_count = search_count + 1 where id = auth.uid();
  elsif p_kind = 'email' then
    select email_count into used from public.profiles where id = auth.uid();
    if used >= p_limit then return false; end if;
    update public.profiles set email_count = email_count + 1 where id = auth.uid();
  elsif p_kind = 'call' then
    select call_count into used from public.profiles where id = auth.uid();
    if used >= p_limit then return false; end if;
    update public.profiles set call_count = call_count + 1 where id = auth.uid();
  else
    return false;
  end if;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- leads: companies the user saved from Felix's results
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null,
  address      text,
  phone        text,
  website      text,
  has_website  boolean,
  descriptors  text[],
  email        text,
  status       text default 'neu',
  created_at   timestamptz not null default now()
);

alter table public.leads enable row level security;
drop policy if exists "leads own" on public.leads;
create policy "leads own" on public.leads for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- sent_emails: log of pitch e-mails Paul sent
-- ---------------------------------------------------------------------------
create table if not exists public.sent_emails (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  to_email    text not null,
  subject     text,
  company     text,
  created_at  timestamptz not null default now()
);

alter table public.sent_emails enable row level security;
drop policy if exists "sent_emails own" on public.sent_emails;
create policy "sent_emails own" on public.sent_emails for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
--  Lina — AI phone agent (outbound sales calling)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- agent_config: the "Soul" of Lina — one row per user. Tone, goal, guidelines.
-- ---------------------------------------------------------------------------
create table if not exists public.agent_config (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  agent_name     text    not null default 'Lina',
  language       text    not null default 'de',
  voice          text    not null default 'sarah',
  goal           text    not null default 'Ein unverbindliches Kennenlern-Telefonat mit dem Geschäftsinhaber vereinbaren.',
  opening_line   text    not null default 'Hallo, hier ist Lina von Youman Automation. Habe ich Sie gerade kurz erwischt?',
  persona        text    not null default 'Freundlich, professionell und respektvoll. Du klingst menschlich, nicht wie ein Verkäufer. Du hörst zu und gehst auf Antworten ein.',
  guidelines     text    not null default 'Stelle dich kurz vor. Erkläre in einem Satz den Nutzen. Frage nach Interesse an einem kurzen Termin. Sei nie aufdringlich.',
  dos            text    not null default 'Höflich bleiben, Gesprächspartner ausreden lassen, Termin anbieten, Buchungslink anbieten.',
  donts          text    not null default 'Nicht drängen, nicht lügen, bei klarem Nein höflich verabschieden, keine Preise erfinden.',
  booking_link   text,
  max_duration   integer not null default 240,
  updated_at     timestamptz not null default now()
);

alter table public.agent_config enable row level security;
drop policy if exists "agent_config own" on public.agent_config;
create policy "agent_config own" on public.agent_config for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Compliance settings (backfill-safe): call recording on/off + a forced AI
-- disclosure ("this is a digital assistant") spoken at the start of each call.
alter table public.agent_config add column if not exists record_calls    boolean not null default true;
alter table public.agent_config add column if not exists ai_disclosure   boolean not null default true;
alter table public.agent_config add column if not exists disclosure_text text;

-- ---------------------------------------------------------------------------
-- call_leads: phone leads (manual, CSV, or handed over from Felix/Anna/Paul)
--   approved = the owner explicitly cleared this number to be called
--   needs_approval = no clear interest, so a manual go is required first
-- ---------------------------------------------------------------------------
create table if not exists public.call_leads (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text,
  company        text,
  phone          text not null,
  website        text,
  email          text,
  notes          text,
  source         text not null default 'manual',   -- manual | csv | felix
  interest       text not null default 'unknown',   -- high | warm | unknown
  approved       boolean not null default false,
  needs_approval boolean not null default true,
  status         text not null default 'neu',       -- neu | bereit | anruf | erledigt | kein_interesse | nicht_erreicht
  created_at     timestamptz not null default now()
);

alter table public.call_leads enable row level security;
drop policy if exists "call_leads own" on public.call_leads;
create policy "call_leads own" on public.call_leads for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Follow-up scheduling (next action) per lead. Backfill-safe for existing installs.
alter table public.call_leads add column if not exists follow_up_at   timestamptz;
alter table public.call_leads add column if not exists follow_up_note text;

-- Do-Not-Call sperrliste (sofort wirksam): bei "kein Interesse"/Widerspruch
-- gesetzt, blockt jeden weiteren Anruf an diesen Lead dauerhaft (§ 7 UWG).
alter table public.call_leads add column if not exists do_not_call boolean not null default false;

-- Phase B — "Anlass": sachlicher Grund der Kontaktaufnahme (z. B. "veraltete
-- Website ohne SSL", "Branche passt"). Compliance-Beleg + Pitch-Kontext.
alter table public.call_leads add column if not exists anlass text;

-- ---------------------------------------------------------------------------
-- calls: one row per placed call + the full transcript / summary / recording
-- ---------------------------------------------------------------------------
create table if not exists public.calls (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  lead_id       uuid references public.call_leads (id) on delete set null,
  vapi_call_id  text,
  status        text not null default 'gestartet',  -- gestartet | laufend | beendet | fehler
  outcome       text,                                -- termin | rückruf | kein_interesse | nicht_erreicht
  duration_sec  integer,
  recording_url text,
  transcript    text,
  summary       text,
  created_at    timestamptz not null default now(),
  ended_at      timestamptz
);

alter table public.calls enable row level security;
drop policy if exists "calls own" on public.calls;
create policy "calls own" on public.calls for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Compliance audit per call: was recording enabled, was AI disclosure enabled.
alter table public.calls add column if not exists recorded  boolean;
alter table public.calls add column if not exists disclosed boolean;

-- Phase B — structured AI extraction per call (JSON: outcome, budget, bedarf,
-- entscheider, naechster_schritt) derived from the transcript after the call.
alter table public.calls add column if not exists extracted jsonb;

create index if not exists calls_user_created_idx on public.calls (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- meetings: a booked / requested appointment that came out of a call
-- ---------------------------------------------------------------------------
create table if not exists public.meetings (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  lead_id        uuid references public.call_leads (id) on delete set null,
  call_id        uuid references public.calls (id) on delete set null,
  contact_name   text,
  company        text,
  phone          text,
  requested_time text,
  status         text not null default 'angefragt',  -- angefragt | gebucht | abgesagt
  created_at     timestamptz not null default now()
);

alter table public.meetings enable row level security;
drop policy if exists "meetings own" on public.meetings;
create policy "meetings own" on public.meetings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- consume_call_quota: variant of consume_quota usable by the service role
--   (the Vapi webhook runs without a logged-in session). Pass the user id.
-- ---------------------------------------------------------------------------
create or replace function public.touch_lead_status(p_lead uuid, p_status text)
returns void
language sql
security definer set search_path = public
as $$
  update public.call_leads set status = p_status where id = p_lead;
$$;

-- ---------------------------------------------------------------------------
-- google_tokens: stored OAuth refresh token so Lina can read availability and
--   book events in the owner's Google Calendar (one row per user).
-- ---------------------------------------------------------------------------
create table if not exists public.google_tokens (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  calendar_id   text not null default 'primary',
  email         text,
  connected_at  timestamptz not null default now()
);

alter table public.google_tokens enable row level security;
drop policy if exists "google_tokens own" on public.google_tokens;
-- The user may see whether they are connected, but the refresh token itself is
-- only ever read by the service role (webhook). Restrict select to own row.
create policy "google_tokens own" on public.google_tokens for select
  using (auth.uid() = user_id);
