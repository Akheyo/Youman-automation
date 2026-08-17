# Dokumentvorlagen

adept& befüllt Word-Vorlagen (.docx) automatisch mit den Daten einer Aktion – z.B. wird nach
„Angebot erstellen" das fertige Angebot als PDF oder DOCX ausgegeben, auf dem eigenen
Briefpapier mit Logo, Fußzeile und Bankdaten.

## 1. Vorlage in Word erstellen

Grundlage ist eine ganz normale Word-Datei (.docx) – z.B. der bestehende Firmen-Briefkopf.
Überall dort, wo adept& Werte einsetzen soll, schreibt man einen **Platzhalter** in
doppelten geschweiften Klammern:

```
Angebot Nr. An-{{angebotsnummer}}
Datum: {{datum}}

{{anrede}}

Lieferdatum: {{lieferdatum}}    Zahlungsart: {{zahlungsart}}
```

Die Formatierung (Schriftart, Fett, Farbe) des Platzhalters bleibt beim Befüllen erhalten.

### Verfügbare Platzhalter (Angebot)

| Platzhalter | Inhalt |
|---|---|
| `{{angebotsnummer}}` | Angebotsnummer aus dem ERP (z.B. Plentymarkets) |
| `{{datum}}` | Tagesdatum (TT.MM.JJJJ) |
| `{{anrede}}` | Anrede („Sehr geehrte Damen und Herren,") |
| `{{ansprechpartner}}` | Name des angemeldeten Benutzers |
| `{{kunde_name}}` / `{{kunde_adresse}}` | Name und Rechnungsadresse des Kunden |
| `{{zwischensumme}}` / `{{rabatt}}` / `{{endbetrag}}` | Beträge, deutsch formatiert (1.234,56) |
| `{{lieferdatum}}` / `{{zahlungsart}}` / `{{zahlungsziel}}` / `{{versandart}}` | Konditionen |

### Positionstabelle (Wiederholungszeilen)

Für die Artikelpositionen legt man in Word **eine** Tabellenzeile an und markiert sie mit
einer Loop-Syntax. Diese eine Zeile wird beim Befüllen pro Position dupliziert – die
Zeilen-Formatierung (Rahmen, Ausrichtung) bleibt erhalten:

| Pos | Menge | ID | Artikelbezeichnung | Nettopreis EUR |
|---|---|---|---|---|
| `{{#positionen}}{{pos}}` | `{{menge}}` | `{{artikel_id}}` | `{{bezeichnung}}` | `{{nettopreis}}{{/positionen}}` |

Wichtig: `{{#positionen}}` steht **vor dem ersten Wert in der ersten Zelle**,
`{{/positionen}}` **nach dem letzten Wert in der letzten Zelle** derselben Zeile.

Eine fertige Beispiel-Vorlage liegt im Repo unter `configs/templates/beispiel-angebot.docx`
und wird beim Seed automatisch als Standard-Angebotsvorlage des Demo-Mandanten hinterlegt.

## 2. Vorlage hochladen

In der App: **Administration » Dokumentvorlagen** (nur für Admins sichtbar).

1. Dokumenttyp wählen (Angebot, Rechnung, Auftragsbestätigung, Lieferschein, Sonstiges)
2. Optional einen Anzeigenamen vergeben
3. „.docx auswählen" – die Datei wird hochgeladen und geprüft

Nach dem Upload zeigt die App alle **erkannten Platzhalter als Chips** an – so sieht man
sofort, welche Felder die Vorlage erwartet. Die erste Vorlage eines Typs wird automatisch
**Standard**; bei mehreren Vorlagen lässt sich der Standard per Stern-Button umstellen.
Kaputte oder falsche Dateien (kein .docx, fehlerhafte Platzhalter-Syntax) werden mit einer
verständlichen Fehlermeldung abgelehnt.

## 3. Verknüpfung mit Aktionen

Aktions-Konfigurationen (`configs/actions/*.json`) können einen `documentOutput`-Block
enthalten. Er legt fest, welcher Dokumenttyp erzeugt wird und wie Formular- und
ERP-Ergebnisdaten auf die Platzhalter abgebildet werden:

```json
"documentOutput": {
  "documentType": "OFFER",
  "fieldMapping": {
    "angebotsnummer": "$.result.erpQuoteNumber",
    "datum": "$.meta.datum",
    "positionen": "$.result.positionen[*]",
    "zahlungsart": "Rechnung"
  }
}
```

Pfad-Syntax: `$.form.…` (Formularfelder), `$.result.…` (ERP-Ergebnis), `$.meta.…`
(datum, userName, userEmail), `…[*]` für Arrays; alles andere ist ein fester Text.

Nach erfolgreicher Ausführung zeigt die App ein Ergebnis-Panel mit
**„Dokument herunterladen (PDF)"** und **„DOCX herunterladen"**. Ist keine Vorlage für den
Dokumenttyp hinterlegt, wird die Aktion trotzdem erfolgreich abgeschlossen und ein Hinweis
angezeigt. Deckt das Mapping nicht alle Platzhalter der Vorlage ab, warnt die
Vorlagen-Verwaltung bereits beim Upload; beim Rendern antwortet das Backend mit einer
Liste der fehlenden Felder (HTTP 422) – ein Dokument wird nur erzeugt, wenn **alle**
Platzhalter befüllt sind.

**Offline:** Wird eine Aktion offline in die Warteschlange gelegt, entsteht das Dokument
erst nach erfolgreicher Synchronisation (Hinweis erscheint beim Speichern).

## 4. Formatierung

Zahlen werden deutsch formatiert (`1.234,56`), ISO-Datumswerte als `TT.MM.JJJJ`.
Ganzzahlige Mengen bleiben ohne Nachkommastellen („2"), Beträge kommen bereits mit zwei
Nachkommastellen aus dem Backend.

## 5. Deployment: PDF-Ausgabe benötigt LibreOffice

Die DOCX-Ausgabe funktioniert überall. Für die **PDF**-Konvertierung nutzt das Backend
LibreOffice im Headless-Modus:

- **Docker/Render:** bereits im `Dockerfile` enthalten (`libreoffice-writer`,
  `fonts-liberation`, `fonts-dejavu-core`). Nichts weiter zu tun.
- **Lokale Entwicklung (Windows):** LibreOffice installieren und ggf. den Pfad zur
  `soffice.exe` über die Umgebungsvariable `SOFFICE_BIN` setzen. Ohne LibreOffice liefert
  die PDF-Ausgabe eine klare Fehlermeldung; DOCX funktioniert weiterhin.

## 6. AGB-Anhang bei Angeboten

Dokumente vom Typ **Angebot** bekommen die festen AGB automatisch angehängt – in beiden
Formaten, ohne dass sie in der Vorlage stehen müssen:

- **PDF:** `configs/templates/agb-b2b.pdf` wird 1:1 hinter das Angebot gehängt (pdf-lib).
- **DOCX:** `configs/templates/agb-b2b.docx` kommt als eigener Abschnitt dahinter. Der
  Abschnitt bekommt leere Kopf-/Fußzeilen, damit der Briefbogen des Angebots nicht über
  die AGB-Seiten läuft (Abschnitte erben Kopf-/Fußzeilen sonst vom vorherigen).

Beide Pfade sind best-effort: Fehlt oder scheitert der Anhang, wird das Angebot ohne AGB
ausgeliefert und der Fehler protokolliert – die Angebotserstellung schlägt nie deswegen fehl.
Pfade überschreibbar per `AGB_PDF_PATH` bzw. `AGB_DOCX_PATH`.

**Sprache:** Für englische Angebote werden `agb-b2b-en.pdf` und `agb-b2b-en.docx`
gesucht (überschreibbar per `AGB_PDF_PATH_EN` / `AGB_DOCX_PATH_EN`). Fehlen sie,
werden die deutschen AGB angehängt und das protokolliert – ein Angebot ohne AGB
wäre schlechter als eines mit den AGB in der falschen Sprache, weil der Verweis
im Fußtext des Angebots sonst ins Leere liefe.

Wichtig: Die PDF-Wandlung läuft auf dem Angebot **ohne** DOCX-Anhang, sonst kämen die
AGB-Seiten doppelt.

## 7. Sicherheit & Mandantentrennung

- Vorlagen sind strikt pro Mandant gespeichert (Row-Level-Isolation über `tenantId`);
  Mandant A kann Vorlagen von Mandant B weder sehen noch rendern (durch Tests abgesichert).
- Verwalten (Upload, Umbenennen, Standard, Löschen) dürfen nur Admin-Rollen.
- Jeder Dokument-Render wird im Audit-Log protokolliert.
