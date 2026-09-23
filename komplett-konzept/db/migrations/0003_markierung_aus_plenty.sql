-- ---------------------------------------------------------------------------
-- Die Markierung kommt aus Plenty
--
-- Bisher wurde im Dashboard angehakt, was auf den Marktplatz soll. Die
-- Entscheidung fällt aber dort, wo ohnehin am Artikel gearbeitet wird: in
-- PlentyONE, über die Markierung „Maschinensucher" (Einrichtung → Artikel →
-- Markierungen, Markierung 1, ID 27).
--
-- Damit gibt es nur noch EINE Wahrheit. Zwei Schalter für dieselbe Sache —
-- einer hier, einer in Plenty — hätten sich gegenseitig überschrieben: Der
-- nächste Abgleich hätte den Haken im Dashboard wieder gerade gebogen, und
-- niemand hätte verstanden, warum ein Gerät zurück auf den Markt geht.
--
-- Die beiden Markierungsfelder werden mitgeschrieben, damit an der Zeile
-- nachvollziehbar ist, warum ein Artikel drin ist oder fehlt.
-- ---------------------------------------------------------------------------
alter table artikel
  add column if not exists plenty_flag_one integer,
  add column if not exists plenty_flag_two integer;

-- Wer zuletzt markiert hat, ist ab jetzt Plenty. Die Spalte bleibt, weil sie
-- genau das trägt — nur steht künftig die Markierung drin, nicht ein Name.
comment on column artikel.ms_markiert_von is
  'Herkunft der Markierung — seit 0003 die Plenty-Markierung, davor der Name des Bedieners.';

-- Der Abgleich sucht "hat sich die Markierung geändert?" über alle Artikel.
create index if not exists artikel_flag_idx on artikel (plenty_flag_one);
