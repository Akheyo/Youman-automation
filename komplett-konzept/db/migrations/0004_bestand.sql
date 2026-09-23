-- ---------------------------------------------------------------------------
-- Bestand: eigene Spur, eigener Zeitstempel
--
-- Ein verkauftes Geraet darf nicht bis zum naechsten vollen Artikelabgleich
-- weiter angeboten werden. Bestaende sind billig zu lesen — eine Zeile je
-- Lager und Variante —, also laufen sie oefter und in einem Rutsch.
--
-- "bestand_am" ist dabei wichtiger, als es aussieht: Ohne diesen Zeitstempel
-- laesst sich einem Bestand von 1 nicht ansehen, ob er von vor zehn Minuten
-- oder von vorletzter Woche stammt. Genau das entscheidet aber, ob man einem
-- Inserat trauen kann.
-- ---------------------------------------------------------------------------
alter table artikel
  add column if not exists bestand_am timestamptz;

-- Der Abgleich fragt "wo ist der Bestand alt?" — und die Seite zeigt es an.
create index if not exists artikel_bestand_am_idx on artikel (bestand_am desc nulls first);

insert into automations (key, name, description, category, source, status, schedule_label, owner)
values
  ('maschinensucher-bestand',
   'Bestandsabgleich',
   'Liest die Bestaende aus PlentyONE und schreibt sie in die Artikeldatenbank. Was keinen Bestand mehr hat, faellt aus der Importdatei und geht damit vom Marktplatz. Laeuft in einem Rutsch und oefter als der volle Artikelabgleich.',
   'Marktplatz', 'cron', 'paused', 'stuendlich', 'Amanuel Kheyo')
on conflict (key) do nothing;
