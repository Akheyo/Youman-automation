# Maschinensucher-Marktplatz — PlentyONE-Plugin

Artikel mit der Markierung **„Maschinensucher"** stehen auf
[maschinensucher.de](https://www.maschinensucher.de) — ohne dass jemand sie
dort einzeln einträgt.

```
Markierung am Artikel  ──►  Zeitplan baut die Importdatei  ──►  Maschinensucher holt sie nachts ab
```

Das Plugin läuft **in PlentyONE**. Es braucht keinen eigenen Server, keinen
REST-Benutzer und keine zweite Datenbank: Artikel, Markierung, Preis und
Bestand liest es direkt dort, wo sie ohnehin gepflegt werden.

## Die Markierung ist der ganze Schalter

Der Schalter ist die Markierung am Artikel (**Einrichtung → Artikel →
Markierungen**, Markierung 1, ID **27**). Steht sie, geht das Gerät auf den
Marktplatz. Wird sie entfernt, verschwindet das Inserat beim nächsten
Abgleich — eine entfernte Markierung ist also keine Aufräumarbeit, sondern
eine Rücknahme vom Markt.

Andere ID oder anderes Feld: in der Plugin-Konfiguration. Die beiden
Markierungsfelder in Plenty sind **getrennte Listen** — die 27 in Feld 2 ist
nicht dieselbe Markierung wie die 27 in Feld 1. Deshalb wird standardmäßig
nur Feld 1 gelesen.

## Bestand: was weg ist, geht offline

Der Bestand wird bei jedem Lauf frisch gelesen. Fällt ein Artikel auf **0**
oder wird er in Plenty **inaktiv** geschaltet, fehlt er in der nächsten
Importdatei, und Maschinensucher nimmt das Inserat beim nächsten Abgleich
herunter. Gezählt wird der **Netto**-Bestand: Was reserviert ist, gehört schon
jemandem.

## Was nicht rausgeht

Ein markierter Artikel, dem etwas Wesentliches fehlt, wird **übersprungen und
nicht halb hochgeladen** — mit Grund im Log:

| Fehlt | Warum es aufhält |
| --- | --- |
| Preis | ohne Preis kein Inserat |
| Foto | ein Inserat ohne Bild wird nicht angesehen |
| Titel / Beschreibung | am Artikel steht kein Text |
| Rubrik | Maschinensucher nimmt kein Inserat ohne Kategorie an |
| Standort | Pflichtangabe, steht in der Plugin-Konfiguration |
| kein Bestand / inaktiv | eine Anfrage zu verkaufter Ware kostet Vertrauen |

Alles andere ist ein Hinweis und hält nicht auf: fehlendes Baujahr, fehlendes
Gewicht, Auffangkategorie.

## Der Preis wird netto ausgezeichnet

Auf einem Händlermarktplatz steht der Nettopreis. Führt Plenty brutto
(Voreinstellung), wird mit dem eingestellten Steuersatz heruntergerechnet. Ein
Bruttopreis, der als Netto eingestellt wird, macht uns um den Steuersatz
teurer als gewollt — und niemand sieht es dem Inserat an.

Gibt es mehrere Preislisten, entscheidet die eingestellte ID. Ist sie an einem
Artikel nicht geführt, bekommt er **keinen** Preis und fällt aus der Datei:
lieber kein Inserat als eines mit dem Preis einer fremden Liste.

## Die Spaltenreihenfolge kommt aus ihrer Beispieldatei

Maschinensucher liest die Datei **spaltenweise**; die Reihenfolge ist die
Schnittstelle, nicht die Überschrift. Eine verrutschte Spalte schreibt das
Baujahr in den Preis, und das fällt erst auf, wenn ein Gerät für 1.998 €
online steht.

Verbindlich ist die **Beispieldatei aus dem Maschinensucher-Konto**. Ihre
Kopfzeile wird unverändert in die Plugin-Konfiguration eingetragen;
[`src/Logik/Spaltenplan.php`](src/Logik/Spaltenplan.php) ordnet unsere Felder
darauf zu, unabhängig von der Schreibweise („Bild-URL 1" = `bildurl1`). Fehlt
darin eine Pflichtspalte, wird **gar keine neue Datei gebaut** — statt einer
ohne Preisspalte. Ohne hinterlegte Kopfzeile geht unsere Standardreihenfolge
raus (33 Spalten, die genannte Mindestbreite ist 32).

## Warum der Zeitplan baut und die Abholung nur ausliefert

Maschinensucher wartet beim Abholen nicht minutenlang. Ein Artikelstamm mit
zehntausenden Varianten braucht aber Minuten. Würde der Abruf den Aufbau
anstoßen, liefe er in einen Timeout, und die Gegenstelle sähe einen Fehler
statt einer Datei.

Also baut der Cron im Hintergrund und legt die Datei im Plugin-Storage ab; der
Abruf liefert nur noch aus. Der Nebeneffekt ist der eigentliche Gewinn:
**Geht beim Bauen etwas schief, bleibt die zuletzt gute Datei liegen.** Eine
kaputte Nacht nimmt dann nichts vom Markt.

## Die Notbremse gegen den leeren Feed

Der Import ist ein **Abgleich**: Was fehlt, verschwindet. Eine entfernte
Markierung zu viel, ein leerer Bestand wegen eines fehlenden Lagerrechts — und
die Nacht nimmt den ganzen Bestand vom Markt, lautlos.

Deshalb: Fällt die Zahl der Inserate gegenüber dem letzten erfolgreichen Lauf
**auf weniger als die Hälfte** (erst ab 10 Inseraten — bei sechs ist „nur noch
zwei" ein normaler Dienstag), wird die neue Datei **nicht geschrieben**. Die
alte bleibt liegen, und der Grund steht im Log. Wer den Rückgang will, trägt
in der Konfiguration die Freigabe ein; sie gilt zwölf Stunden und läuft dann
von selbst ab.

## Die Adresse ist das Passwort

Maschinensucher kann sich nirgends anmelden, also steckt das Geheimnis in der
Adresse:

```
https://<shop-domain>/maschinensucher/feed?token=<token>
```

Alternativ `Authorization: Bearer <token>` oder HTTP-Basic. Die Adresse zeigt
den markierten Bestand samt Preisen — wie ein Passwort behandeln. Ein neues
Token macht jede alte Adresse sofort wertlos. Ohne Token ist die Strecke aus,
nicht offen.

Die Fotos brauchen keinen eigenen Weg: Plenty liefert öffentliche
Bild-Adressen, die unverändert ins Inserat gehen.

## In PlentyONE einspielen

### Warum es einen eigenen Zweig gibt

Plenty bekommt beim Einrichten eine **Repository-Adresse** und einen
**Zweignamen** — und verlangt, dass in der Wurzel dieses Zweigs eine gültige
`plugin.json` liegt („The branch must contain a valid plugin JSON"). In diesem
Repo liegt das Plugin aber in einem Unterordner neben den anderen Projekten.

Deshalb gibt es [`deploy-zweig.sh`](deploy-zweig.sh): Es schneidet diesen
Ordner als eigenen Zweig heraus — Historie erhalten, `plugin.json` an der
Wurzel — und lässt vorher die Prüfungen laufen. Ein zweites Repository braucht
es dafür nicht.

```bash
./plugin-maschinensucher/deploy-zweig.sh
git push -f origin plugin/maschinensucher
```

Nach jeder Änderung am Plugin: erneut ausführen, pushen, in Plenty
**bereitstellen** — fertig. Ein Deploy des Plugin-Sets zieht die neueste
Fassung des eingestellten Zweigs von selbst nach (Plugin Build 2), es muss
also nichts von Hand aktualisiert werden.

### Schritt für Schritt

1. **Zweig bauen und hochladen** (siehe oben).
2. In PlentyONE **Plugins » Plugin-Set** öffnen, ein Plugin-Set anlegen oder
   auswählen, dann **Add plugin → Git → +**.
3. Im Dialog *Add new repository*:
   - **Repository**: die HTTPS-Adresse dieses Repositorys.
   - **Branch**: `plugin/maschinensucher` (nicht `master` stehen lassen — dort
     liegt keine `plugin.json` an der Wurzel).
   - Ist das Repository privat, bleibt der Schalter *The repository is public*
     **aus**, und es braucht GitHub-**Benutzernamen** und ein **Token**
     (Personal Access Token mit Leserecht auf den Code). Das Token muss
     während des Bauens gültig sein — ein abgelaufenes ist der häufigste Grund
     für einen fehlgeschlagenen Build.
4. Plugin in der linken Leiste auswählen, **installieren**, danach über den
   Schalter **aktivieren** (nach der Installation ist es zunächst deaktiviert).
5. **Bereitstellen** (Deploy-Symbol oben). Der Build legt dabei die beiden
   Plugin-Tabellen an.
6. **Konfiguration** ausfüllen: Token (`openssl rand -hex 24`), Markierungs-ID,
   Auffangrubrik, Standort und Kontakt, Steuersatz.
7. Beispieldatei im Maschinensucher-Konto herunterladen, deren **Kopfzeile**
   in die Konfiguration eintragen. Danach erneut bereitstellen.
8. Einen Artikel markieren und den Cron abwarten (stündlich).
9. Die Adresse **einmal selbst im Browser aufrufen** und die Datei ansehen,
   **bevor** sie im Maschinensucher-Konto unter *Datenimport → Automatischer
   Import* hinterlegt wird. Die Adresse liegt unter der Shop-Domain des
   Mandanten, genau wie im Tutorial das `/hello-world` — bei uns
   `/maschinensucher/feed?token=…`.

> **Wenn Plenty das Repository nicht annimmt:** Für Plugins, die nicht auf der
> Freigabeliste stehen, kann der Git-Import abgelehnt werden — dann führt der
> Weg über das Freigabeverfahren oder über das **plentyDevTool**, das den
> Ordner direkt in den Plugin-Set-Arbeitsbereich lädt
> (`workspace/<plentyId>/<plugin-set>/MaschinensucherMarkt/`). Der Ordneraufbau
> hier passt zu beidem.

## Was geprüft ist — und was nicht

```bash
php tests/run.php
```

Prüft die reine Logik gegen echte Beispiele: Spaltenzuordnung, CSV-Quoting,
Brutto/Netto, Einheiten (Plenty führt **Gramm** und **Millimeter**), die
Mängel, die einen Artikel zurückhalten, die Notbremse und das Lesen der
Markierung. Kein PHPUnit, keine Abhängigkeit — ein `php` genügt.

**Nicht geprüft**, weil es ein laufendes PlentyONE braucht: die Artikelsuche,
der Plugin-Storage, die Plugin-Datenbank, der Cron und die Route. Diese Teile
fallen erst im Plugin-Set auf — deshalb der erste Lauf auf einem Testsystem
und der Blick in die Datei, bevor die Adresse im Maschinensucher-Konto steht.

## Verhältnis zum Automations-Dashboard

Dieselbe Strecke gibt es im Ordner [`komplett-konzept`](../komplett-konzept)
als externe Anwendung (mit Oberfläche, Laufhistorie und Fehlerliste). Beide
zusammen zu betreiben, hieße **zwei Dateien für denselben Marktplatz** — die
zweite überschriebe die erste bei jeder Abholung. Wenn das Plugin läuft, wird
im Dashboard die Automation *„Maschinensucher holt die Inserate ab"* pausiert.
