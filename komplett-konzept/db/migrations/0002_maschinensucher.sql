-- ---------------------------------------------------------------------------
-- Maschinensucher — die Artikeldatenbank und die Markierung
--
-- Die erste echte Automation im Dashboard. Sie besteht aus zwei Hälften, die
-- sich NICHT gegenseitig aufhalten:
--
--   1. Ein Abgleich holt die Artikelinformationen aus PlentyONE in die
--      Tabelle "artikel". Er läuft nach Zeitplan.
--   2. Maschinensucher holt nachts eine Importdatei bei uns ab. Diese Datei
--      entsteht AUSSCHLIESSLICH aus "artikel" — beim Abholen wird PlentyONE
--      nicht angefasst.
--
-- Warum getrennt: Der Marktplatz wartet sonst auf ein fremdes System. Ist
-- Plenty nachts langsam oder in Wartung, geht trotzdem heraus, was zuletzt
-- bekannt war — statt einer leeren Datei, die den Bestand vom Markt nimmt.
-- Und die Markierung gehört ohnehin uns: Sie ist eine Entscheidung des Büros
-- und hat in Plenty nichts zu suchen.
-- ---------------------------------------------------------------------------

create table if not exists artikel (
  id                  uuid primary key default gen_random_uuid(),

  -- Herkunft. Die Variante ist der Schlüssel: In Plenty hängen Preis, Bestand
  -- und Nummer an ihr, nicht am Artikel.
  plenty_variation_id bigint not null unique,
  plenty_item_id      bigint,

  nummer              text,          -- Variantennummer
  ean                 text,
  titel               text,
  beschreibung        text,
  hersteller          text,
  modell              text,
  baujahr             text,
  zustand             text,

  preis_brutto        numeric(12,2), -- so, wie er in Plenty steht
  waehrung            text not null default 'EUR',
  bestand             integer,
  gewicht_kg          numeric(10,3),
  laenge_cm           numeric(10,1),
  breite_cm           numeric(10,1),
  hoehe_cm            numeric(10,1),

  -- Bild-Adressen aus Plenty, als Liste in der Reihenfolge der Positionen.
  -- Plenty liefert öffentliche Adressen — sie können direkt ins Inserat.
  bilder              jsonb not null default '[]'::jsonb,

  -- Maschinensucher-Kategorie von Hand. Der Abgleich fasst sie NIE an: Wer sie
  -- gesetzt hat, wusste mehr als jede Zuordnung über Suchworte.
  kategorie           text,

  aktiv               boolean,       -- Plenty: ist die Variante aktiv?
  roh                 jsonb,         -- Antwort von Plenty, gekürzt (Spur)

  -- Wann der Artikel zuletzt in einem Abgleich vorkam. Fehlt er länger, ist
  -- er in Plenty gelöscht oder ausgeblendet — sichtbar, statt still veraltet.
  gesehen_am          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- ---- Markierung: der einzige Schalter der Strecke --------------------
  -- Markiert = steht in der Importdatei = ist auf Maschinensucher. Und
  -- andersherum: Wer die Markierung zurücknimmt, nimmt das Inserat vom Markt.
  -- Deshalb steht dabei, wer es war.
  ms_markiert         boolean not null default false,
  ms_markiert_am      timestamptz,
  ms_markiert_von     text,
  ms_inserat          jsonb,         -- was zuletzt wirklich in der Datei stand
  ms_abgeholt_am      timestamptz,   -- erst das heißt "ist draußen"
  ms_fehler           text           -- warum er beim letzten Lauf fehlte
);

create index if not exists artikel_suche_idx
  on artikel using gin (
    to_tsvector('simple',
      coalesce(titel,'') || ' ' || coalesce(hersteller,'') || ' ' ||
      coalesce(modell,'') || ' ' || coalesce(nummer,'') || ' ' || coalesce(ean,''))
  );

-- Die Datei fragt genau eines: "Was ist markiert?" Ohne Teilindex geht sie mit
-- jedem Artikel im Stamm über die ganze Tabelle.
create index if not exists artikel_markiert_idx
  on artikel (ms_markiert_am desc) where ms_markiert;

create index if not exists artikel_gesehen_idx on artikel (gesehen_am desc);

-- ---------------------------------------------------------------------------
-- Die beiden Automationen — damit sie im Dashboard auftauchen wie alle anderen
--
-- Es gibt keine eigene Protokolltabelle für die Abholungen. Jeder Abruf durch
-- Maschinensucher ist ein Lauf in "executions": mit Dauer, Anzahl, Logzeilen
-- und im Fehlerfall einem Eintrag in "errors". Genau dafür ist das Dashboard
-- da — eine zweite Liste daneben würde niemand ansehen.
-- ---------------------------------------------------------------------------
insert into automations (key, name, description, category, source, status, schedule_label, owner)
values
  ('maschinensucher-sync',
   'Plenty-Abgleich (Artikeldaten)',
   'Holt Artikel, Preise, Bestände und Bilder aus PlentyONE in die Artikeldatenbank. Läuft seitenweise; jeder Lauf macht dort weiter, wo der letzte aufgehört hat.',
   'Marktplatz', 'cron', 'paused', 'stündlich', 'Amanuel Kheyo'),
  ('maschinensucher-abholung',
   'Maschinensucher holt die Inserate ab',
   'Maschinensucher zieht nachts die Importdatei mit allen markierten Artikeln. Jeder Abruf steht hier als Lauf — auch ein abgewiesener.',
   'Marktplatz', 'webhook', 'active', 'nächtlich (durch Maschinensucher)', 'Amanuel Kheyo')
on conflict (key) do nothing;
