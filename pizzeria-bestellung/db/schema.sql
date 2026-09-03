-- ============================================================================
--  Pizzeria Borken — Bestellshop (Supabase / Postgres)
--  Einmalig ausfuehren: Supabase → SQL Editor → New query → einfuegen → Run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- bestellungen: eine Zeile je Bestellung, von der Aufgabe bis zur Auslieferung
--
-- Statuslauf:
--   offen        → angelegt, Gast ist im Stripe-Checkout
--   autorisiert  → bezahlt, Betrag reserviert, Kueche hat noch nicht bestaetigt
--   angenommen   → Kueche kocht, Betrag ist eingezogen
--   abgelehnt    → Kueche kann nicht, Reservierung freigegeben (kein Geldfluss)
--   erstattet    → nach dem Einzug ganz oder teilweise zurueckgezahlt
--   verfallen    → Gast hat den Checkout nie abgeschlossen
-- ---------------------------------------------------------------------------
create table if not exists public.bestellungen (
  id                uuid primary key default gen_random_uuid(),
  nummer            bigint generated always as identity,   -- kurze Nummer fuer den Bon
  status            text not null default 'offen',
  abholart          text not null,                          -- 'lieferung' | 'abholung'

  -- Kontakt und Adresse
  name              text not null,
  telefon           text not null,
  email             text,
  strasse           text,
  plz               text,
  ort               text,
  hinweis           text,                          -- vom Gast
  hinweis_intern    text,                          -- vom System, z. B. fehlgeschlagene Küchenmeldung

  -- Betraege, alles in Cent
  warenwert         integer not null,
  liefergebuehr     integer not null default 0,
  trinkgeld         integer not null default 0,
  summe             integer not null,
  erstattet         integer not null default 0,

  -- Stripe
  stripe_session_id        text unique,
  stripe_payment_intent_id text,

  angelegt_am       timestamptz not null default now(),
  bezahlt_am        timestamptz,
  angenommen_am     timestamptz,
  abgeschlossen_am  timestamptz
);

create index if not exists bestellungen_status_idx on public.bestellungen (status, angelegt_am desc);
create index if not exists bestellungen_pi_idx     on public.bestellungen (stripe_payment_intent_id);

-- ---------------------------------------------------------------------------
-- bestell_posten: die Zeilen des Bons, mit den Preisen zum Bestellzeitpunkt
--
-- Bewusst kopiert statt auf die Speisekarte verwiesen: eine Preisaenderung
-- morgen darf eine Bestellung von heute nicht rueckwirkend veraendern.
-- ---------------------------------------------------------------------------
create table if not exists public.bestell_posten (
  id            uuid primary key default gen_random_uuid(),
  bestellung_id uuid not null references public.bestellungen (id) on delete cascade,
  artikel_id    text not null,
  bezeichnung   text not null,
  menge         integer not null,
  einzelpreis   integer not null,
  gesamt        integer not null,
  mwst_gruppe   text not null,          -- 'speise' | 'getraenk'
  allergene     text[] not null default '{}'
);

create index if not exists bestell_posten_bestellung_idx on public.bestell_posten (bestellung_id);

-- ---------------------------------------------------------------------------
-- Zugriff: ausschliesslich der Server mit dem Service-Role-Key.
-- RLS ist an, es gibt keine Policy — damit ist der oeffentliche Anon-Key blind.
-- ---------------------------------------------------------------------------
alter table public.bestellungen   enable row level security;
alter table public.bestell_posten enable row level security;
