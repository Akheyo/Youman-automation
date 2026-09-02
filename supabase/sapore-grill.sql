-- ============================================================================
--  Sapore Grill — Bestellungen (Supabase / Postgres)
--
--  Einmal im Supabase-Dashboard ausfuehren:
--  SQL Editor → New query → einfuegen → Run.
--
--  Getrennt von schema.sql, weil die Bestellungen nichts mit dem Youman-SaaS
--  zu tun haben und unabhaengig davon eingespielt oder entfernt werden koennen.
-- ============================================================================

create table if not exists public.sapore_orders (
  id             uuid primary key default gen_random_uuid(),
  -- Kurze Nummer zum Vorlesen am Telefon, z. B. "SG-4193".
  order_no       text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- 'liefern' oder 'abholen'.
  mode           text not null check (mode in ('liefern', 'abholen')),
  -- Ablauf im Laden: neu → in_arbeit → fertig → abgeschlossen.
  status         text not null default 'neu'
                 check (status in ('neu', 'in_arbeit', 'fertig', 'abgeschlossen', 'storniert')),

  -- Positionen als JSON: [{ id, name, qty, price, sum }, …]. Preise werden beim
  -- Anlegen serverseitig aus der eigenen Karte berechnet und hier eingefroren,
  -- damit eine spaetere Preisaenderung alte Bestellungen nicht verfaelscht.
  items          jsonb not null,
  subtotal       numeric(10, 2) not null,
  fee            numeric(10, 2) not null default 0,
  total          numeric(10, 2) not null,

  customer_name  text not null,
  customer_phone text not null,
  customer_email text,
  street         text,
  zip            text,
  city           text,

  -- 'sofort' oder eine Uhrzeit wie '19:30'.
  wish_time      text not null default 'sofort',
  note           text,

  -- Wurde die Bestellung an ein externes Ziel weitergereicht (Webhook, Kasse)?
  forwarded_at   timestamptz,
  forward_error  text
);

create index if not exists sapore_orders_created_idx on public.sapore_orders (created_at desc);
create index if not exists sapore_orders_status_idx  on public.sapore_orders (status, created_at desc);
create unique index if not exists sapore_orders_no_idx on public.sapore_orders (order_no, created_at);

-- updated_at bei jeder Aenderung mitziehen.
create or replace function public.sapore_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sapore_orders_touch on public.sapore_orders;
create trigger sapore_orders_touch
  before update on public.sapore_orders
  for each row execute function public.sapore_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Zugriff: Row Level Security ist an, aber es gibt BEWUSST keine Policy.
-- Damit kommt weder der anonyme Schluessel noch ein eingeloggter Youman-Nutzer
-- an die Bestellungen heran. Gelesen und geschrieben wird ausschliesslich
-- serverseitig mit dem Service-Role-Schluessel (lib/supabase/admin.ts), und die
-- Kuechenansicht kommt nur mit dem separaten Kuechen-Token durch.
-- Bestellungen enthalten Namen, Telefonnummern und Adressen — sie duerfen den
-- Server nicht ungeschuetzt verlassen.
-- ---------------------------------------------------------------------------
alter table public.sapore_orders enable row level security;

-- Aufraeumen: Bestellungen aelter als 90 Tage entfernen. Von Hand ausfuehren
-- oder als geplanten Job (pg_cron) einrichten.
--   delete from public.sapore_orders where created_at < now() - interval '90 days';
