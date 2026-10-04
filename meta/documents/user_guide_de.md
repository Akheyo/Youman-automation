# Maschinensucher-Marktplatz

## Was das Plugin macht

Artikel, die in PlentyONE die Markierung **„Maschinensucher"** tragen, werden
automatisch auf maschinensucher.de eingestellt. Ein Zeitplan baut stündlich
eine Importdatei; Maschinensucher holt sie nachts unter einer Adresse mit
Token ab und gleicht die Inserate damit ab.

## Einrichten

1. **Konfiguration öffnen** (Plugin-Set → Maschinensucher-Marktplatz →
   Konfiguration) und ausfüllen:
   - **Token**: ein langes, zufälliges Wort (mindestens 16 Zeichen). Es ist
     das Passwort der Abholadresse.
   - **Markierung**: ID der Markierung, die einen Artikel auf den Marktplatz
     stellt (Voreinstellung 27, Markierung 1).
   - **Auffangkategorie**, **Standort** (PLZ, Ort, Land) und **E-Mail** für
     Anfragen.
   - **Steuersatz**: Auf dem Marktplatz wird netto ausgezeichnet.
2. **Kopfzeile eintragen**: Im Maschinensucher-Konto unter *Datenimport* die
   Beispieldatei herunterladen und deren erste Zeile unverändert in das Feld
   „Kopfzeile der Beispieldatei" kopieren. Sie bestimmt die Reihenfolge der
   Spalten.
3. **Plugin-Set bereitstellen.**
4. **Adresse hinterlegen**: `https://<shop-domain>/maschinensucher/feed?token=<token>`
   im Maschinensucher-Konto unter *Datenimport → Automatischer Import*.

## Ein Gerät auf den Marktplatz stellen

Am Artikel die Markierung setzen — fertig. Der nächste Lauf nimmt ihn in die
Datei auf.

## Ein Gerät vom Marktplatz nehmen

- **Verkauft** (Warenbestand 1, reserviert 1, netto 0): Das Inserat wird pausiert.
- **Verschickt** (Warenbestand 0): Das Inserat wird bei Maschinensucher gelöscht.
  Abschaltbar über die Einstellung *„Verschickte Artikel löschen“*.
- **Markierung entfernt**: Das Inserat wird pausiert.
- **Storno** (wieder netto > 0): Das Inserat wird wieder aktiviert.

## Warum ein Artikel nicht erscheint

Im Log (Plugin-Log, Eintrag „Markierte Artikel, die nicht rausgehen") steht je
Artikel der Grund. Die häufigsten: kein Preis, kein Foto, keine Rubrik, kein
Bestand.

## Artikel ohne sichtbaren Preis

Artikel mit dem Tag „Preis auf Anfrage“ (Tag-ID in der Konfiguration) gehen
ohne Preis raus. Welche Artikel bei Maschinensucher tatsächlich keinen Preis
zeigen, steht im Log unter „Bericht: Artikel ohne sichtbaren Preis bei
Maschinensucher“ (stündlich, nach dem Lesen des Bestands). Die Liste umfasst
auch alte Inserate, und die Artikel-IDs stehen in Blöcken zu 100 zum Kopieren
in die Artikelsuche.

## Inserate behalten, aber nicht mehr verwalten

Soll ein Inserat bei Maschinensucher bleiben, wie es ist (etwa mit von Hand
gekürzter Beschreibung), die Markierung entfernen und die Artikel-ID in
„Freigeben: Artikel-IDs“ eintragen. Das Plugin pausiert es dann nicht, sondern
aktiviert es bei Bestand einmal wieder und fasst es danach nicht mehr an —
auch nicht zum Verlängern. Wird der Artikel wieder markiert, übernimmt das
Plugin ihn wieder.

Einfacher geht es ohne Einstellung: Ein Inserat, das das Plugin wegen der
entfernten Markierung pausiert hat, bei Maschinensucher von Hand wieder
aktivieren. Das Plugin pausiert es dann nicht erneut, sondern lässt es ab da
in Ruhe.

## Liste aller Inserate

Konfiguration „Liste aller Inserate ins Log“ auf „stündlich“ oder „nach jedem
Lesen“ stellen. Nach dem nächsten vollständigen Lesen des Bestands steht im
Log „Liste aller Inserate bei Maschinensucher“ (Zusammenfassung), danach die
Teile zu je 50 Zeilen: Artikel-ID;Inserat-ID;Referenznummer;Status;läuft
bis;Preis sichtbar;Titel. Nach Gebrauch wieder auf „aus“ stellen.

## Sicherungen

- Fällt die Zahl der Inserate plötzlich auf unter die Hälfte, wird die neue
  Datei **nicht** geschrieben — die alte bleibt liegen. So nimmt ein Irrtum
  nicht den ganzen Bestand vom Markt. Der Grund steht im Log.
- Fehlt in der hinterlegten Kopfzeile eine Pflichtspalte, wird ebenfalls nicht
  gebaut.
- Jeder Abruf der Adresse wird mitgeschrieben, auch ein abgewiesener.
