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

-- ============================================================================
--  Phase C — Kampagnen, Anruf-Queue & Scheduler
-- ============================================================================

-- ---------------------------------------------------------------------------
-- campaigns: a named outbound run over a list of leads with one agent profile,
--   call window, intensity and rate/attempt limits. One row per campaign.
-- ---------------------------------------------------------------------------
create table if not exists public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  status        text not null default 'entwurf',   -- entwurf | aktiv | pausiert | fertig
  intensity     text not null default 'moderat',   -- aggressiv | moderat | konservativ
  window_start  integer not null default 9,         -- erlaubtes Anruffenster: Start-Stunde (lokal)
  window_end    integer not null default 17,        -- End-Stunde (lokal)
  timezone      text not null default 'Europe/Berlin',
  max_attempts  integer not null default 3,         -- max. Anrufversuche pro Lead
  max_per_day   integer not null default 50,        -- Rate-Limit: Anrufe/Tag in dieser Kampagne
  created_at    timestamptz not null default now()
);

alter table public.campaigns enable row level security;
drop policy if exists "campaigns own" on public.campaigns;
create policy "campaigns own" on public.campaigns for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Queue fields on each lead (backfill-safe).
alter table public.call_leads add column if not exists campaign_id     uuid references public.campaigns (id) on delete set null;
alter table public.call_leads add column if not exists attempts        integer not null default 0;
alter table public.call_leads add column if not exists next_attempt_at timestamptz;

-- Index to let the scheduler find due leads quickly.
create index if not exists call_leads_queue_idx on public.call_leads (campaign_id, next_attempt_at);

-- ---------------------------------------------------------------------------
-- consume_call_quota_for: service-role variant of the call quota check, keyed
-- by an explicit user id (the campaign scheduler/cron runs without a session).
-- ---------------------------------------------------------------------------
create or replace function public.consume_call_quota_for(p_user uuid, p_limit integer)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  cur_period text := to_char(now(), 'YYYY-MM');
  used integer;
begin
  update public.profiles
     set search_count = case when usage_period is distinct from cur_period then 0 else search_count end,
         email_count  = case when usage_period is distinct from cur_period then 0 else email_count  end,
         call_count   = case when usage_period is distinct from cur_period then 0 else call_count   end,
         usage_period = cur_period
   where id = p_user;

  select call_count into used from public.profiles where id = p_user;
  if used is null then return false; end if;
  if used >= p_limit then return false; end if;
  update public.profiles set call_count = call_count + 1 where id = p_user;
  return true;
end;
$$;

-- ============================================================================
--  Phase E — Warm Transfer & Voicemail
-- ============================================================================
-- transfer_number: echte Telefonnummer (E.164), an die Lina einen heißen Lead
--   live weiterleitet. Leer = Weiterleitung deaktiviert.
-- voicemail_detection: erkennt Anrufbeantworter; voicemail_message = Ansage,
--   die Lina dann hinterlässt (leer = Standardansage).
alter table public.agent_config add column if not exists transfer_number    text;
alter table public.agent_config add column if not exists voicemail_detection boolean not null default true;
alter table public.agent_config add column if not exists voicemail_message   text;

-- ============================================================================
--  Phase F — Integrationen (Webhooks rein/raus)
-- ============================================================================
-- lead_webhook_token: geheimer Token für den Lead-Eingang-Webhook (extern POSTet
--   Leads rein → /api/ingest/leads?token=...). post_call_webhook_url: nach jedem
--   Anruf wird das Ergebnis als JSON dorthin geschickt (n8n/Make/Zapier/CRM).
alter table public.profiles add column if not exists lead_webhook_token   text;
alter table public.profiles add column if not exists post_call_webhook_url text;
create index if not exists profiles_lead_webhook_token_idx on public.profiles (lead_webhook_token);

-- ============================================================================
--  Phase G — Paul: Cold-Outreach per E-Mail (Sequenzen, Queue, Opt-out)
-- ============================================================================
-- Lina ruft an, Paul schreibt. Eine Outreach-Kampagne ist eine benannte
-- Sequenz aus mehreren Mail-Schritten (Erstmail + Follow-ups), die pro Kontakt
-- nacheinander abgearbeitet wird, bis der Kontakt antwortet, sich abmeldet
-- oder die Sequenz durch ist.

-- ---------------------------------------------------------------------------
-- outreach_campaigns: eine Sequenz mit Absender, Versandfenster und Limits.
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_campaigns (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  status         text not null default 'entwurf',   -- entwurf | aktiv | pausiert | fertig
  from_name      text,                               -- Absendername ("Max von Youman")
  from_email     text,                               -- Absenderadresse
  reply_to       text,                               -- abweichende Antwortadresse
  signature      text,                               -- wird unter jede Mail gehaengt
  window_start   integer not null default 8,         -- Versandfenster: Start-Stunde (lokal)
  window_end     integer not null default 18,        -- End-Stunde (lokal)
  timezone       text    not null default 'Europe/Berlin',
  send_on_weekend boolean not null default false,    -- Sa/So versenden?
  max_per_day    integer not null default 40,        -- Rate-Limit: Mails/Tag in dieser Kampagne
  stop_on_reply  boolean not null default true,      -- Antwort stoppt die restliche Sequenz
  created_at     timestamptz not null default now()
);

alter table public.outreach_campaigns enable row level security;
drop policy if exists "outreach_campaigns own" on public.outreach_campaigns;
create policy "outreach_campaigns own" on public.outreach_campaigns for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- outreach_steps: die Schritte der Sequenz. step_no 1 ist die Erstmail,
--   delay_days zaehlt ab dem Versand des vorherigen Schritts.
--   Leerer subject ab Schritt 2 = Antwort im selben Thread ("Re: ...").
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_steps (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.outreach_campaigns (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  step_no     integer not null,
  delay_days  integer not null default 0,
  subject     text not null default '',
  body        text not null default '',
  created_at  timestamptz not null default now(),
  unique (campaign_id, step_no)
);

alter table public.outreach_steps enable row level security;
drop policy if exists "outreach_steps own" on public.outreach_steps;
create policy "outreach_steps own" on public.outreach_steps for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- outreach_contacts: Empfaenger einer Kampagne inkl. Sequenz-Fortschritt.
--   status: neu (noch nichts raus) | aktiv (Sequenz laeuft) | geantwortet
--           | fertig (Sequenz durch) | gestoppt (manuell) | abgemeldet | bounce
--   unsubscribe_token: Einmal-Token fuer den Abmeldelink in jeder Mail.
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_contacts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  campaign_id       uuid not null references public.outreach_campaigns (id) on delete cascade,
  email             text not null,
  first_name        text,
  last_name         text,
  company           text,
  website           text,
  anlass            text,                             -- sachlicher Grund der Ansprache
  custom            jsonb not null default '{}'::jsonb, -- freie Platzhalter aus dem CSV
  source            text not null default 'manual',   -- manual | csv | leads
  status            text not null default 'neu',
  current_step      integer not null default 0,       -- zuletzt versendeter Schritt
  next_send_at      timestamptz,                      -- faellig ab
  last_sent_at      timestamptz,
  last_error        text,
  created_at        timestamptz not null default now(),
  unsubscribe_token text not null default replace(gen_random_uuid()::text, '-', ''),
  unique (campaign_id, email)
);

alter table public.outreach_contacts enable row level security;
drop policy if exists "outreach_contacts own" on public.outreach_contacts;
create policy "outreach_contacts own" on public.outreach_contacts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists outreach_contacts_queue_idx on public.outreach_contacts (campaign_id, status, next_send_at);
create index if not exists outreach_contacts_token_idx on public.outreach_contacts (unsubscribe_token);

-- Thread-Anschluss beim Nachfassen: Betreff der Erstmail und deren Message-ID,
-- damit Follow-ups als "Re: ..." im selben Verlauf landen (backfill-sicher).
alter table public.outreach_contacts add column if not exists thread_subject text;
alter table public.outreach_contacts add column if not exists message_id     text;
alter table public.outreach_contacts add column if not exists fails          integer not null default 0;

-- ---------------------------------------------------------------------------
-- outreach_events: Protokoll je Kontakt (Beleg fuer Versand und Widerspruch).
--   kind: gesendet | fehler | geantwortet | bounce | abgemeldet | gestoppt
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  campaign_id uuid references public.outreach_campaigns (id) on delete cascade,
  contact_id  uuid references public.outreach_contacts (id) on delete cascade,
  step_no     integer,
  kind        text not null,
  subject     text,
  detail      text,
  created_at  timestamptz not null default now()
);

alter table public.outreach_events enable row level security;
drop policy if exists "outreach_events own" on public.outreach_events;
create policy "outreach_events own" on public.outreach_events for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists outreach_events_user_created_idx on public.outreach_events (user_id, created_at desc);
create index if not exists outreach_events_campaign_idx on public.outreach_events (campaign_id, created_at desc);

-- ---------------------------------------------------------------------------
-- outreach_suppression: kontoweite Sperrliste (Art. 21 DSGVO / § 7 UWG).
--   Eine Adresse hier bekommt aus KEINER Kampagne mehr Post — auch nicht,
--   wenn sie spaeter erneut importiert wird.
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_suppression (
  user_id    uuid not null references auth.users (id) on delete cascade,
  email      text not null,
  reason     text not null default 'abgemeldet',   -- abgemeldet | bounce | manuell
  created_at timestamptz not null default now(),
  primary key (user_id, email)
);

alter table public.outreach_suppression enable row level security;
drop policy if exists "outreach_suppression own" on public.outreach_suppression;
create policy "outreach_suppression own" on public.outreach_suppression for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- consume_email_quota_for: Service-Role-Variante der Mail-Kontingentpruefung,
--   adressiert ueber eine explizite User-ID (der Versand-Cron laeuft ohne
--   angemeldete Sitzung). Pendant zu consume_call_quota_for.
-- ---------------------------------------------------------------------------
create or replace function public.consume_email_quota_for(p_user uuid, p_limit integer)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  cur_period text := to_char(now(), 'YYYY-MM');
  used integer;
begin
  update public.profiles
     set search_count = case when usage_period is distinct from cur_period then 0 else search_count end,
         email_count  = case when usage_period is distinct from cur_period then 0 else email_count  end,
         call_count   = case when usage_period is distinct from cur_period then 0 else call_count   end,
         usage_period = cur_period
   where id = p_user;

  select email_count into used from public.profiles where id = p_user;
  if used is null then return false; end if;
  if used >= p_limit then return false; end if;
  update public.profiles set email_count = email_count + 1 where id = p_user;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- outreach_unsubscribe: Abmeldung ueber den Link in der Mail. Laeuft ohne
--   Sitzung (der Empfaenger ist nicht eingeloggt), daher security definer und
--   ausschliesslich ueber den Token adressierbar.
-- ---------------------------------------------------------------------------
create or replace function public.outreach_unsubscribe(p_token text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  c record;
begin
  select * into c from public.outreach_contacts where unsubscribe_token = p_token;
  if not found then return null; end if;

  update public.outreach_contacts
     set status = 'abgemeldet', next_send_at = null
   where id = c.id;

  insert into public.outreach_suppression (user_id, email, reason)
  values (c.user_id, lower(c.email), 'abgemeldet')
  on conflict (user_id, email) do nothing;

  insert into public.outreach_events (user_id, campaign_id, contact_id, step_no, kind, detail)
  values (c.user_id, c.campaign_id, c.id, c.current_step, 'abgemeldet', 'Abmeldelink in der E-Mail');

  return c.email;
end;
$$;

-- ============================================================================
--  Phase H — Öffnungsmessung (opt-in je Kampagne)
-- ============================================================================
-- Gemessen wird über ein 1x1-Pixel im HTML-Teil der Mail. Zwei Dinge dazu:
--
--   1. Die Zahl ist eine Tendenz, kein Fakt. Apple Mail laedt Bilder schon
--      beim Empfang vor (jede Mail zaehlt dann als geoeffnet), Firmen-Scanner
--      tun dasselbe, und Clients mit blockierten Bildern melden echte
--      Oeffnungen nie. Deshalb wird jede Abrufmeldung mit `prefetch` markiert,
--      wenn sie nach Maschine aussieht.
--   2. Oeffnungs-Tracking braucht nach Auffassung der Datenschutzkonferenz
--      und § 25 TDDDG eine Einwilligung. Darum ist es je Kampagne
--      abschaltbar und standardmaessig AUS.
alter table public.outreach_campaigns add column if not exists track_opens boolean not null default false;

-- Je versendeter Mail ein Token im zugehoerigen 'gesendet'-Ereignis. Der
-- Pixel-Abruf findet die Zeile darueber und schreibt Zeitpunkt und Zaehler.
alter table public.outreach_events add column if not exists track_token text;
alter table public.outreach_events add column if not exists opened_at    timestamptz;
alter table public.outreach_events add column if not exists open_count   integer not null default 0;

create unique index if not exists outreach_events_track_token_idx on public.outreach_events (track_token) where track_token is not null;

-- Verdichtet am Kontakt, damit die Liste ohne Verknuepfung auskommt.
alter table public.outreach_contacts add column if not exists opens        integer not null default 0;
alter table public.outreach_contacts add column if not exists last_open_at timestamptz;

-- ---------------------------------------------------------------------------
-- outreach_track_open: Pixel-Abruf verbuchen. Laeuft ohne Sitzung (der
--   Empfaenger ist nicht angemeldet), daher security definer und
--   ausschliesslich ueber den Token adressierbar.
--
--   p_prefetch = true kommt vom Aufrufer, wenn der Abruf nach einem Scanner
--   oder Vorablader aussieht. Solche Abrufe zaehlen mit, gelten aber nicht
--   als erste echte Oeffnung.
--
--   Rueckgabe: true, wenn dies die erste gewertete Oeffnung war.
-- ---------------------------------------------------------------------------
create or replace function public.outreach_track_open(p_token text, p_prefetch boolean default false)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  ev record;
  first_open boolean := false;
begin
  select * into ev from public.outreach_events where track_token = p_token and kind = 'gesendet';
  if not found then return false; end if;

  update public.outreach_events
     set open_count = open_count + 1,
         opened_at  = case when p_prefetch then opened_at else coalesce(opened_at, now()) end
   where id = ev.id;

  if not p_prefetch and ev.opened_at is null then
    first_open := true;

    update public.outreach_contacts
       set opens = opens + 1,
           last_open_at = now()
     where id = ev.contact_id;

    insert into public.outreach_events (user_id, campaign_id, contact_id, step_no, kind, subject)
    values (ev.user_id, ev.campaign_id, ev.contact_id, ev.step_no, 'geoeffnet', ev.subject);
  end if;

  return first_open;
end;
$$;
