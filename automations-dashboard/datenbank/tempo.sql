-- ===========================================================================
-- Tempo für die Artikelsuche
--
-- Ohne passende Indexe muss Postgres bei jeder Suche knapp 40.000 Varianten
-- und 65.000 Texte durchgehen. Mit ihnen dauert dieselbe Suche Millisekunden.
--
-- Einmal im SQL Editor ausführen. Das Anlegen selbst dauert bei dieser
-- Datenmenge wenige Sekunden.
-- ===========================================================================


-- Trigramme erlauben es, auch mitten im Text schnell zu suchen, nicht nur
-- am Anfang. Genau das braucht die Titelsuche.
create extension if not exists pg_trgm;


-- ---------------------------------------------------------------------------
-- Vorher nachsehen, wie die Spalten in den Grundtabellen wirklich heißen.
-- Weichen sie ab, die Namen unten entsprechend anpassen.
-- ---------------------------------------------------------------------------

-- select table_name, column_name, data_type
-- from information_schema.columns
-- where table_name in ('plenty_variationen', 'plenty_artikeltexte')
-- order by table_name, ordinal_position;


-- ---------------------------------------------------------------------------
-- Artikelnummer und EAN: gesucht wird von vorne, gefunden über Trigramme.
-- ---------------------------------------------------------------------------

create index if not exists idx_variationen_artikelnummer_trgm
  on plenty_variationen using gin (artikelnummer gin_trgm_ops);

create index if not exists idx_variationen_ean_trgm
  on plenty_variationen using gin (ean gin_trgm_ops);


-- ---------------------------------------------------------------------------
-- Titel: gesucht wird überall im Text, deshalb hier besonders wichtig.
-- ---------------------------------------------------------------------------

create index if not exists idx_artikeltexte_titel_trgm
  on plenty_artikeltexte using gin (titel gin_trgm_ops);


-- ---------------------------------------------------------------------------
-- Verbindung zwischen beiden Tabellen, damit die View flott zusammenführt.
-- Falls die Spalte anders heißt, hier anpassen.
-- ---------------------------------------------------------------------------

-- create index if not exists idx_artikeltexte_artikel_id
--   on plenty_artikeltexte (artikel_id);


-- ---------------------------------------------------------------------------
-- Danach dem Planer sagen, dass sich etwas geändert hat.
-- ---------------------------------------------------------------------------

analyze plenty_variationen;
analyze plenty_artikeltexte;


-- ---------------------------------------------------------------------------
-- Zur Kontrolle: welche Indexe stehen jetzt auf den beiden Tabellen
-- ---------------------------------------------------------------------------

select tablename, indexname
from pg_indexes
where tablename in ('plenty_variationen', 'plenty_artikeltexte')
order by tablename, indexname;
