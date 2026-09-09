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

-- ---------------------------------------------------------------------------
-- einstellungen: betriebsweite Konfiguration, in der Oberflaeche pflegbar
--
-- Genau EINE Zeile (id = 1). Die Werte gelten fuer alle Nutzer, weil alle am
-- selben Lager und am selben PlentyONE arbeiten — es ist keine Einstellung
-- "je Nutzer", sondern eine des Betriebs.
--
-- SICHERHEIT: RLS ist an, aber es gibt ABSICHTLICH KEINE POLICY. Damit kommt
-- ueber den normalen Anon-/User-Key niemand an die Tabelle heran, auch nicht
-- lesend. Der Zugriff laeuft ausschliesslich serverseitig ueber den
-- Service-Role-Key, der RLS umgeht. Das Plenty-Passwort liegt zusaetzlich
-- verschluesselt (AES-256-GCM, siehe lib/einstellungen/tresor.ts) und wird
-- nie an den Browser ausgeliefert.
-- ---------------------------------------------------------------------------
create table if not exists public.einstellungen (
  id                    smallint primary key default 1,

  -- PlentyONE-Zugang
  plenty_base_url       text,
  plenty_user           text,
  plenty_passwort_enc   text,   -- verschluesselt, nie im Klartext
  plenty_id             integer,

  -- Auf welchem Lager die Lagerwerkzeuge standardmaessig arbeiten.
  plenty_warehouse_id   integer,

  -- Wer zuletzt gespeichert hat — bei geteilten Zugaengen die einzige Spur.
  geaendert_von         text,
  geaendert_am          timestamptz not null default now(),

  -- Erzwingt die Einzelzeile: ein zweiter Datensatz ist nicht einfuegbar.
  constraint einstellungen_nur_eine_zeile check (id = 1)
);

alter table public.einstellungen enable row level security;
-- Keine Policy — nur der Service-Role-Key kommt heran (siehe Kommentar oben).

-- Falls die Tabelle schon existiert: Spalten nachruesten (Migration).
alter table public.einstellungen add column if not exists plenty_warehouse_id integer;
alter table public.einstellungen add column if not exists geaendert_von text;

-- ---------------------------------------------------------------------------
-- Erfassung: Artikel am Regal fotografieren
--
-- Ein Datensatz je Artikel, der am Handy erfasst wird, plus eine Zeile je Foto.
-- Der Artikel entsteht in dem Moment, in dem jemand am Regal auf "Neuer
-- Artikel" tippt — nicht erst, wenn irgendwo ein Ordner abgefragt wird.
--
-- SICHTBARKEIT: Anders als bei "projekte" sieht hier JEDER angemeldete Nutzer
-- ALLE Artikel. Das ist Absicht: Mario fotografiert im Lager, das Büro prüft
-- und gibt frei. Wären die Artikel je Nutzer abgeschottet, könnte niemand die
-- Arbeit eines anderen weiterführen — und genau darum geht es. Anlegen darf
-- man aber nur auf den eigenen Namen (check auth.uid() = user_id), damit die
-- Spur, wer fotografiert hat, stimmt.
-- ---------------------------------------------------------------------------

-- Laufende, menschenlesbare Nummer. Am Regal ruft man sich "Artikel 4711" zu,
-- keine UUID.
create sequence if not exists public.erfassung_nummer_seq;

create table if not exists public.erfassung_artikel (
  id             uuid primary key default gen_random_uuid(),
  nummer         bigint not null unique default nextval('public.erfassung_nummer_seq'),
  user_id        uuid not null references auth.users (id) on delete cascade,
  erfasst_von    text,                    -- E-Mail, damit die Liste ohne Join lesbar ist

  -- offen        → wird gerade fotografiert
  -- bereit       → "fertig" getippt, wartet auf die Verarbeitung
  -- erkannt      → Merkmale aus den Bildern gelesen (Schritt 2)
  -- bepreist     → Preisvorschlag liegt vor (Schritt 3)
  -- listing      → Texte erzeugt (Schritt 4)
  -- freigabe     → wartet auf einen Menschen
  -- veroeffentlicht → in Plenty angelegt und aktiv
  -- fehler       → hängt, mit Meldung in "fehler"
  status         text not null default 'offen',

  notiz          text,                    -- was das Handy nicht sieht: "Kabel fehlt"
  fertig_am      timestamptz,
  plenty_item_id bigint,
  fehler         text,
  created_at     timestamptz not null default now()
);

create table if not exists public.erfassung_bilder (
  id           uuid primary key default gen_random_uuid(),
  artikel_id   uuid not null references public.erfassung_artikel (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,

  -- uebersicht | typenschild | schaden | detail — die Aufnahme-Reihenfolge.
  -- Das Typenschild ist bei Gebrauchtware der wertvollste Datenpunkt: daraus
  -- fallen Hersteller und Modellnummer und damit die Vergleichspreise.
  rolle        text not null default 'detail',
  position     integer not null default 0,
  pfad         text not null,             -- Pfad im Storage-Bucket "artikelfotos"
  dateiname    text,
  bytes        bigint,

  -- Erst true, wenn der Browser den Upload bestätigt hat. Ohne diese Spalte
  -- fällt ein abgebrochener Upload niemandem auf — genau der Fehler, den die
  -- alte WhatsApp-Strecke hatte.
  hochgeladen  boolean not null default false,

  created_at   timestamptz not null default now()
);

alter table public.erfassung_artikel enable row level security;
alter table public.erfassung_bilder  enable row level security;

drop policy if exists "erfassung_artikel lesen"   on public.erfassung_artikel;
drop policy if exists "erfassung_artikel anlegen" on public.erfassung_artikel;
drop policy if exists "erfassung_artikel aendern" on public.erfassung_artikel;
drop policy if exists "erfassung_artikel loeschen" on public.erfassung_artikel;

create policy "erfassung_artikel lesen" on public.erfassung_artikel
  for select to authenticated using (true);
create policy "erfassung_artikel anlegen" on public.erfassung_artikel
  for insert to authenticated with check (auth.uid() = user_id);
create policy "erfassung_artikel aendern" on public.erfassung_artikel
  for update to authenticated using (true) with check (true);
create policy "erfassung_artikel loeschen" on public.erfassung_artikel
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "erfassung_bilder lesen"   on public.erfassung_bilder;
drop policy if exists "erfassung_bilder anlegen" on public.erfassung_bilder;
drop policy if exists "erfassung_bilder aendern" on public.erfassung_bilder;
drop policy if exists "erfassung_bilder loeschen" on public.erfassung_bilder;

create policy "erfassung_bilder lesen" on public.erfassung_bilder
  for select to authenticated using (true);
create policy "erfassung_bilder anlegen" on public.erfassung_bilder
  for insert to authenticated with check (auth.uid() = user_id);
create policy "erfassung_bilder aendern" on public.erfassung_bilder
  for update to authenticated using (true) with check (true);
create policy "erfassung_bilder loeschen" on public.erfassung_bilder
  for delete to authenticated using (true);

-- Arbeitsliste: was wartet auf Verarbeitung? Neueste zuerst.
create index if not exists erfassung_artikel_status_idx
  on public.erfassung_artikel (status, created_at desc);
create index if not exists erfassung_bilder_artikel_idx
  on public.erfassung_bilder (artikel_id, position);

-- Privater Bucket für die Artikelfotos (die App legt ihn sonst automatisch an).
insert into storage.buckets (id, name, public)
  values ('artikelfotos', 'artikelfotos', false)
  on conflict (id) do nothing;
