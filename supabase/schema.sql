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

-- ---------------------------------------------------------------------------
-- Erkennung: was auf den Fotos zu sehen ist
--
-- Ergebnis der Bildauswertung, als JSON am Artikel. Bewusst als jsonb und
-- nicht als 20 Spalten: Welche Merkmale ein Artikel hat, hängt davon ab, was
-- er ist — ein Akkuschrauber trägt andere als ein Rollcontainer. Was fest
-- zugeordnet werden muss (Preis, Plenty-ID), bekommt später eigene Spalten.
-- ---------------------------------------------------------------------------
alter table public.erfassung_artikel
  add column if not exists erkennung        jsonb,     -- Merkmale, Zustand, Schäden
  add column if not exists treffer          jsonb,     -- ähnliche Artikel aus PlentyONE
  add column if not exists erkannt_am       timestamptz,
  add column if not exists erkennung_fehler text;

-- Die Rolle eines Fotos (Übersicht, Typenschild, Schaden, Detail) vergibt seit
-- der Umstellung die Erkennung, nicht mehr der Mensch am Regal. Wer
-- fotografiert, soll fotografieren und nicht sortieren.
alter table public.erfassung_bilder
  add column if not exists rolle_erkannt  text,
  add column if not exists bildbeschreibung text;

-- ---------------------------------------------------------------------------
-- Zustand und Bestand: was der Mensch am Regal weiß und kein Foto zeigt
--
-- Beides geht direkt in die Preisfindung ein. Der Zustand steuert den
-- Umrechnungsfaktor (65 / 60 / 40 / 30 %), der Bestand entscheidet über den
-- Gesamtwert und damit, ob sich ein Listing überhaupt lohnt.
--
-- Die Bilderkennung schätzt den Zustand ebenfalls — ihr Wert bleibt in
-- "erkennung" stehen. Für den Preis zählt der des Menschen: Wer das Teil in
-- der Hand hat, dreht es um, rüttelt daran und sieht, was auf keinem Foto ist.
-- Weichen beide voneinander ab, ist das ein Prüfhinweis, kein Fehler.
-- ---------------------------------------------------------------------------
alter table public.erfassung_artikel
  add column if not exists zustand              text    default 'gebraucht',
  -- Ob jemand den Zustand ausdrücklich angetippt hat oder die Vorauswahl stehen
  -- blieb. Ohne dieses Feld ließe sich später nicht unterscheiden, ob
  -- "gebraucht" eine Aussage war oder nur niemand hingesehen hat.
  add column if not exists zustand_bestaetigt   boolean not null default false,
  -- Nur was den Gebrauchswert angreift: tiefe Kratzer, Risse, fehlende Teile.
  -- Schmutz und normale Gebrauchsspuren gehören NICHT hierher.
  add column if not exists gravierende_schaeden boolean not null default false,
  add column if not exists bestand              integer not null default 1;

-- ---------------------------------------------------------------------------
-- Gewicht und Packklasse: ohne sie kein Versandpreis, ohne Versandpreis kein
-- Verkaufspreis
--
-- eBay sortiert nach Preis PLUS Versand. Unser Versandprofil hängt am Gewicht
-- (7,90 bis 5 kg / 9,90 bis 10 kg / darüber 14,90–29,90 je nach Sperrigkeit),
-- und dieser Betrag geht vom Zielpreis ab. Ein geschätztes Gewicht verschiebt
-- also unmittelbar den Verkaufspreis — deshalb wird es NICHT geschätzt,
-- sondern am Regal eingegeben, wo eine Waage steht.
--
-- Bleibt es leer, wird der Artikel trotzdem angelegt; das Versandprofil steht
-- dann als offener Punkt am Artikel.
-- ---------------------------------------------------------------------------
alter table public.erfassung_artikel
  add column if not exists gewicht_kg  numeric(8,3),
  -- 'normal' | 'sperrig' | 'schwierig' — zählt erst über 10 kg.
  add column if not exists packklasse  text default 'normal';

-- ---------------------------------------------------------------------------
-- Der Durchlauf: Preis → Listing → Plenty
--
-- Jeder Schritt bekommt sein eigenes Ergebnisfeld und seinen eigenen
-- Zeitstempel. Das ist kein Ordnungssinn: Die Schritte laufen einzeln, weil
-- jeder für sich an die 60-Sekunden-Grenze der Serverless-Funktionen stößt.
-- Steht das Zwischenergebnis in der Datenbank, kann der nächste Aufruf dort
-- weitermachen, statt alles noch einmal zu bezahlen.
--
-- "fehler" je Schritt statt eines gemeinsamen Feldes, damit ein
-- fehlgeschlagener Plenty-Aufruf nicht die Begründung des Preises überschreibt.
-- ---------------------------------------------------------------------------
alter table public.erfassung_artikel
  -- Vergleichsangebote, gewählte Quellenstufe, Preise, Herleitung (SOP 8).
  add column if not exists preis           jsonb,
  add column if not exists preis_am        timestamptz,
  add column if not exists preis_fehler    text,
  -- Titel, Beschreibung, Produktkarte, Meta-Angaben, JSON-LD.
  add column if not exists listing         jsonb,
  add column if not exists listing_am      timestamptz,
  add column if not exists listing_fehler  text,
  -- Was in Plenty entstanden ist, samt Protokoll der einzelnen Schritte.
  add column if not exists plenty          jsonb,
  add column if not exists plenty_am       timestamptz,
  add column if not exists plenty_fehler   text,
  add column if not exists plenty_variation_id bigint;

-- Der Durchlauf sucht "was ist als Nächstes dran?" — ohne Index wird das mit
-- jedem erfassten Artikel langsamer.
create index if not exists erfassung_artikel_durchlauf_idx
  on public.erfassung_artikel (status, erkannt_am desc nulls last);

-- ---------------------------------------------------------------------------
-- EAN für erfasste Artikel
--
-- Das SOP verlangt sie ausdrücklich in der Artikelbeschreibung, und Plenty
-- hängt sie als Barcode an die Variante. Erzeugt wird sie aus der laufenden
-- Artikelnummer — also DETERMINISTISCH: Ein zweiter Anlauf nach einem
-- Fehlschlag vergibt dieselbe EAN und nicht eine zweite. Sonst stünde in der
-- Beschreibung eine andere als am Barcode.
-- ---------------------------------------------------------------------------
alter table public.erfassung_artikel
  add column if not exists ean text;

create unique index if not exists erfassung_artikel_ean_idx
  on public.erfassung_artikel (ean) where ean is not null;
