-- ============================================================================
--  Komplett Konzept Projektplanung — Supabase / Postgres Schema
--  Einmalig im Supabase-Dashboard ausführen: SQL Editor → New query → Run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- projekte: ein Datensatz pro erfasstem Projekt (dient auch als Suchverlauf)
-- ---------------------------------------------------------------------------
create table if not exists public.projekte (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,

  -- Formularfelder
  company            text not null,          -- Firmenname, z. B. "Bosch GmbH"
  location           text not null,          -- Ort, z. B. "Esslingen"
  contact_internal   text,                   -- Ansprechpartner intern
  contact_external   text,                   -- Ansprechpartner extern
  notes              text,                   -- Anmerkungen / Randnotizen
  order_type         text,                   -- Auftragstyp: Demontage | Warenankauf | Auktion
  invoice_name       text,                   -- Rechnung: Original-Dateiname (Upload nach Plenty)

  -- Ergebnis der Plenty-Synchronisation
  category_name      text,                   -- "Firma Ort" (Name der Unterkategorie)
  ean                text,                   -- erzeugte EAN-13
  plenty_category_id bigint,                 -- ID der Plenty-Unterkategorie
  plenty_item_id     bigint,                 -- ID des angelegten Artikels
  plenty_status      text not null default 'pending', -- pending | ok | skipped | error
  plenty_error       text,                   -- Fehlermeldung bei status=error

  created_at         timestamptz not null default now()
);

alter table public.projekte enable row level security;

drop policy if exists "projekte own" on public.projekte;
create policy "projekte own" on public.projekte for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Schneller Zugriff auf die Historie (neueste zuerst) pro Nutzer.
create index if not exists projekte_user_created_idx
  on public.projekte (user_id, created_at desc);

-- Falls die Tabelle schon existiert: Spalten nachrüsten (Migration).
alter table public.projekte add column if not exists notes text;
alter table public.projekte add column if not exists order_type text;   -- Demontage | Warenankauf | Auktion
alter table public.projekte add column if not exists invoice_name text; -- Original-Dateiname der Rechnung
alter table public.projekte add column if not exists invoice_path text; -- Pfad der Rechnung im Supabase Storage

-- Privater Storage-Bucket für Rechnungen (die App legt ihn sonst automatisch an).
insert into storage.buckets (id, name, public)
  values ('rechnungen', 'rechnungen', false)
  on conflict (id) do nothing;

-- Volltext-freundliche Suche über Firma/Ort/Ansprechpartner/Anmerkungen.
drop index if exists projekte_search_idx;
create index if not exists projekte_search_idx
  on public.projekte using gin (
    to_tsvector('simple',
      coalesce(company,'') || ' ' || coalesce(location,'') || ' ' ||
      coalesce(contact_internal,'') || ' ' || coalesce(contact_external,'') || ' ' ||
      coalesce(notes,''))
  );
