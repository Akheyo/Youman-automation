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

Markierung entfernen, Artikel inaktiv schalten oder Bestand auf 0: Alle drei
Wege führen dazu, dass der Artikel aus der Datei fällt. Beim nächsten Abgleich
verschwindet das Inserat.

## Warum ein Artikel nicht erscheint

Im Log (Plugin-Log, Eintrag „Markierte Artikel, die nicht rausgehen") steht je
Artikel der Grund. Die häufigsten: kein Preis, kein Foto, keine Rubrik, kein
Bestand.

## Sicherungen

- Fällt die Zahl der Inserate plötzlich auf unter die Hälfte, wird die neue
  Datei **nicht** geschrieben — die alte bleibt liegen. So nimmt ein Irrtum
  nicht den ganzen Bestand vom Markt. Der Grund steht im Log.
- Fehlt in der hinterlegten Kopfzeile eine Pflichtspalte, wird ebenfalls nicht
  gebaut.
- Jeder Abruf der Adresse wird mitgeschrieben, auch ein abgewiesener.
