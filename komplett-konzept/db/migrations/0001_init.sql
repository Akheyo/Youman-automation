-- ---------------------------------------------------------------------------
-- Komplett Konzept — Grundschema
-- Nutzer, Sitzungen, Automationen, Ausfuehrungen, Logs, Fehler, Protokoll
-- ---------------------------------------------------------------------------

-- --- Nutzer ---------------------------------------------------------------
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  name          text not null,
  role          text not null default 'viewer' check (role in ('admin', 'operator', 'viewer')),
  password_hash text not null,
  is_active     boolean not null default true,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists sessions (
  id         text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  user_agent text,
  ip         text
);
create index if not exists sessions_user_idx on sessions(user_id);
create index if not exists sessions_expires_idx on sessions(expires_at);

-- --- Automationen ---------------------------------------------------------
-- source: woher die Automation kommt. Wird spaeter von den echten Runnern
-- gefuellt; das Dashboard selbst fuehrt (noch) nichts aus.
create table if not exists automations (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique,
  name           text not null,
  description    text,
  category       text,
  source         text not null default 'manual'
                 check (source in ('n8n', 'cron', 'python', 'webhook', 'extern', 'manual')),
  status         text not null default 'paused'
                 check (status in ('active', 'paused', 'error', 'draft')),
  schedule_cron  text,
  schedule_label text,
  owner          text,
  config         jsonb not null default '{}'::jsonb,
  last_run_at    timestamptz,
  next_run_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists automations_status_idx on automations(status);

-- --- Ausfuehrungen --------------------------------------------------------
create table if not exists executions (
  id              uuid primary key default gen_random_uuid(),
  automation_id   uuid not null references automations(id) on delete cascade,
  status          text not null default 'queued'
                  check (status in ('queued', 'running', 'success', 'failed', 'cancelled')),
  trigger         text not null default 'schedule'
                  check (trigger in ('schedule', 'manual', 'webhook', 'retry')),
  triggered_by    uuid references users(id) on delete set null,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  duration_ms     integer,
  items_processed integer not null default 0,
  input           jsonb not null default '{}'::jsonb,
  output          jsonb not null default '{}'::jsonb,
  error_message   text,
  retry_of        uuid references executions(id) on delete set null,
  external_id     text
);
create index if not exists executions_automation_idx on executions(automation_id, started_at desc);
create index if not exists executions_status_idx on executions(status, started_at desc);
create index if not exists executions_started_idx on executions(started_at desc);

-- --- Log-Zeilen je Ausfuehrung -------------------------------------------
create table if not exists execution_logs (
  id           bigserial primary key,
  execution_id uuid not null references executions(id) on delete cascade,
  ts           timestamptz not null default now(),
  level        text not null default 'info' check (level in ('debug', 'info', 'warn', 'error')),
  message      text not null,
  data         jsonb
);
create index if not exists execution_logs_exec_idx on execution_logs(execution_id, ts);

-- --- Fehler ---------------------------------------------------------------
create table if not exists errors (
  id              uuid primary key default gen_random_uuid(),
  automation_id   uuid references automations(id) on delete cascade,
  execution_id    uuid references executions(id) on delete cascade,
  occurred_at     timestamptz not null default now(),
  severity        text not null default 'error' check (severity in ('warning', 'error', 'critical')),
  code            text,
  message         text not null,
  stack           text,
  context         jsonb not null default '{}'::jsonb,
  status          text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  acknowledged_by uuid references users(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_at     timestamptz,
  note            text
);
create index if not exists errors_status_idx on errors(status, occurred_at desc);
create index if not exists errors_automation_idx on errors(automation_id, occurred_at desc);

-- --- Protokoll der Steuer-Aktionen ---------------------------------------
create table if not exists audit_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  user_id     uuid references users(id) on delete set null,
  user_name   text,
  action      text not null,
  target_type text,
  target_id   text,
  target_name text,
  meta        jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_at_idx on audit_log(at desc);

-- --- Einstellungen (Schluessel/Wert) -------------------------------------
create table if not exists settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
