# Cold Mail adept& — Versand

Anleitung für die Session, die den Versand über den Gmail-Connector macht.
Alles, was gebraucht wird, liegt im Repo.

| Datei | Inhalt |
|---|---|
| `marketing/cold-email-adept.html` | die Mail, zwei Fassungen in einer Datei |
| `marketing/leads-adept.csv` | 233 Kontakte, semikolongetrennt |
| `marketing/versand-log.csv` | was schon raus ist (entsteht beim ersten `--mark`) |
| `marketing/assets/adept-logo*@2x.png` | Wortmarke hell und invers |
| `scripts/render-mail.py` | rendert die Mail pro Lead |
| `scripts/build-mail-preview.py` | baut die Vorschau-Seite |
| `scripts/build-test-eml.py` | baut eine einzelne Testmail als `.eml` |

## Platzhalter

Nur zwei, beide werden aus der Lead-Liste gefüllt:

| Platzhalter | Quelle | Beispiel |
|---|---|---|
| `{{anrede}}` | Spalte `Anrede`, sonst `Name` | `Tim Kaldeuer` |
| `{{firma}}` | `Firmenname`, ohne Rechtsform | `August Schmits` |
| `{{aufhaenger}}` | **du schreibst ihn**, aus Spalte `Beschreibung` | siehe unten |

`{{firma}}` steht nur im Betreff. Rechtsform und Klammerzusätze werden
entfernt — aus `August Schmits GmbH & Co. KG (ASMetal)` wird `August Schmits`,
weil `Frage zu den Planungsprozessen bei August Schmits GmbH & Co. KG (ASMetal)`
in keiner Inbox-Vorschau mehr ankommt.

**Zur Anrede:** Die Liste hat keine Spalte dafür, deshalb wird der volle Name
eingesetzt: „Guten Tag Tim Kaldeuer". Aus Vornamen auf Herr oder Frau zu
schließen wäre geraten — bei 233 Kontakten geht das zwangsläufig ein paar Mal
daneben, und eine falsche Anrede kostet mehr als eine neutrale. Wer „Guten Tag
Herr Kaldeuer" will, ergänzt in der CSV eine Spalte `Anrede`; die hat Vorrang.

## Der individuelle Einstiegssatz

Das ist der einzige Teil, den kein Skript füllt. Alles andere ist bei allen
233 Empfängern gleich — dieser eine Satz ist der Unterschied zwischen einer
Serienmail und einer, die jemand geschrieben hat.

Er steht als erster Absatz über dem Haupttext. Die Quelle ist die Spalte
`Beschreibung` in der Lead-Liste, die zu jeder Firma zwei bis drei Sätze
enthält: was sie herstellt, seit wann, für welche Branchen, wie das Unternehmen
geführt wird.

**Regeln:**

- ein Satz, höchstens zwei, kleingeschrieben beginnen (er folgt auf das Komma
  der Anrede)
- etwas Konkretes aus der Beschreibung nennen — Produkt, Gründungsjahr, Standort,
  Zertifizierung, Kundenkreis
- daraus eine Brücke zum Thema bauen: Variantenvielfalt, Schnittstellen,
  Sonderfälle, Abstimmung zwischen Bereichen
- nichts behaupten, was nicht in der Beschreibung steht — keine erfundenen
  Kennzahlen, keine vermuteten Probleme als Tatsache
- nicht schleimen. „Ihr beeindruckendes Unternehmen" liest sich wie ein Serienbrief

**Gut:**

> seit 1929 fertigen Sie in Mettmann Stanz- und Tiefziehteile für
> Automotive-Kunden – bei Lieferabrufen von OEMs und Tier-1 hängt viel an
> sauberen Schnittstellen.

> als IATF-zertifizierter Hersteller von Präzisionsdrehteilen für Lenkungstechnik
> haben Sie vermutlich eine hohe Teilevielfalt bei enger Toleranz.

**Schlecht:**

> ich bin auf Ihr Unternehmen aufmerksam geworden.  (sagt nichts)

> Sie verlieren sicher viel Zeit durch manuelle Prozesse.  (Behauptung ins Blaue)

So wird er eingesetzt:

```bash
python3 scripts/render-mail.py --email tim.kaldeuer@asmetal.de \
  --aufhaenger "seit 1929 fertigen Sie in Mettmann Stanz- und Tiefziehteile ..."
```

Ohne `--aufhaenger` fällt der Absatz ersatzlos weg — die Mail funktioniert auch
so, ist dann aber für alle gleich.

## Betreffzeilen

Drei Varianten je Fassung, verteilt über die Liste. Immer derselbe Betreff an
233 Empfänger ist das auffälligste Muster einer Serienmail. Welche Zeile ein
Lead bekommt, entscheidet seine Adresse — beim erneuten Rendern bleibt es
dieselbe.

| | Industrie |
|---|---|
| 1 | Frage zu den Planungsprozessen bei {firma} |
| 2 | Kurze Frage zu {firma} |
| 3 | {firma}: manuelle Schritte trotz ERP? |

## Ablauf

```bash
python3 scripts/render-mail.py --status     # Zählstand: gesamt / versendet / offen
python3 scripts/render-mail.py --next 5     # nächste 5 offene Leads als JSON
```

Pro Lead kommt zurück: `an`, `name`, `firma`, `position`, `branche`, `ort`,
`beschreibung`, `von`, `betreff`, `html`, `text`, `fassung`.

`--next` liefert die Mail **ohne** Einstiegssatz. Der richtige Ablauf ist
deshalb zweistufig: mit `--next 5` die Leads samt `beschreibung` holen, für
jeden den Satz schreiben, dann jede Mail einzeln mit `--email … --aufhaenger …`
final rendern. Erst dieses Ergebnis wird verschickt.

Damit über den Gmail-Connector senden — **HTML und Plain Text
zusammen** als `multipart/alternative`. Eine reine HTML-Mail ohne Textteil
wird von Spamfiltern abgewertet.

Nach jeder erfolgreich angenommenen Mail:

```bash
python3 scripts/render-mail.py --mark tim.kaldeuer@asmetal.de
```

Das Protokoll ist der einzige Schutz davor, dass jemand zweimal angeschrieben
wird. Deshalb trägt das Skript nichts von selbst ein — nur was der Connector
bestätigt hat, wird markiert. Nach jeder Charge committen und pushen, sonst
ist der Stand beim nächsten Mal weg.

## Vor der ersten Mail prüfen

1. **Logo hochladen.** Die Mail lädt zwei Bilder:
   `https://www.adeptandpartners.de/mail/adept-logo@2x.png` und
   `…/adept-logo-invers@2x.png`. Die Dateien liegen in `marketing/assets/`.
   Fehlen sie auf dem Server, zeigt die Mail nur den Alt-Text „adept&" —
   funktioniert, sieht aber halb fertig aus.
2. **Datenschutz-Seite.** Der Footer verlinkt
   `https://www.adeptandpartners.de/datenschutz`. Existiert die Seite?
3. **Testmail an sich selbst**, in Gmail und einmal mobil ansehen:
   `python3 scripts/build-test-eml.py info@example.de`
4. **Absender:** `kheyo@adeptandpartners.de`. SPF, DKIM und DMARC für die
   Domain gesetzt? Ohne das landet ein Großteil im Spam.

## Tempo

Nicht 233 Mails an einem Tag. Ein frisches Postfach schafft am Anfang
**20–30 Mails täglich**, nach zwei bis drei Wochen 50. Wer schneller ist,
verbrennt die Domain — und die ist dieselbe, unter der die Firma erreichbar
ist. Bei diesem Tempo läuft die Liste über gut zwei Monate. Das ist kein
Nachteil: Antworten kommen ohnehin verteilt, und jede muss bearbeitet werden.

## Rechtlicher Rahmen

Werbe-E-Mails ohne vorherige Einwilligung sind nach **§ 7 Abs. 2 Nr. 2 UWG**
auch gegenüber Unternehmen unzulässig. Es gibt keine B2B-Ausnahme wie beim
Telefonat. Das Risiko ist real und liegt beim Absender — bewusst entscheiden,
nicht nebenbei.

Praktisch heißt das:

- nur an **Firmenpostfächer mit sachlichem Bezug** zum Angebot
- jede Absage sofort respektieren, Adresse ins Protokoll und nie wieder anschreiben
- kein zweites Nachfassen bei Widerspruch

Die Mail nennt im Footer Herkunft der Daten und Widerspruchsrecht — das
verlangen **DSGVO Art. 14** und **Art. 21 Abs. 4** beim ersten Kontakt.
Ein Abmelde-Link ist bewusst nicht drin: Das ist keine Massenaussendung, und
ein Abmelde-Button lässt sie wie eine aussehen.

Vor einer Kampagne dieser Größe einmal anwaltlich gegenprüfen lassen.

## Hinweis zur Lead-Liste

`marketing/leads-adept.csv` enthält Namen, Positionen, dienstliche
Telefonnummern und E-Mail-Adressen realer Personen — personenbezogene Daten
nach DSGVO. Das Repository muss privat bleiben.
