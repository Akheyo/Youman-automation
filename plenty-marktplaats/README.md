# Marktplaats-Plugin für plentymarkets

Stellt Artikel aus plentymarkets als Anzeigen auf **Marktplaats.nl** ein, hält sie
aktuell (Titel, Text, Preis, Bilder) und nimmt sie wieder herunter, sobald ein
Artikel ausverkauft, inaktiv oder nicht mehr für Marktplaats freigegeben ist.

Grundlage ist die offizielle [Marktplaats-API v2](https://api.marktplaats.nl/docs/v2/index.html)
(REST, OAuth 2.0).

## So funktioniert es

```
Plenty-Variante  ──(aktiv + Markt „Marktplaats“ + Bestand)──►  Anzeige auf Marktplaats
   Texte (nl, sonst de)                                         Titel (max. 60 Zeichen), Beschreibung
   Verkaufspreis (ID aus Konfiguration)                         Festpreis / Bieten / „siehe Beschreibung“
   Standardkategorie ──(Kategoriezuordnung)──►                  Marktplaats-L2-Kategorie
   Artikelzustand, Hersteller (GPSR)                            Attribute condition, manufacturer…
   Artikelbilder (URL)                                          Bilder (Marktplaats lädt sie selbst herunter)
```

- **Welche Artikel?** Alle aktiven Varianten, die unter *Artikel » Variante »
  Verfügbarkeit » Märkte* für die Herkunft **Marktplaats** freigegeben sind (die
  Herkunft legt das Plugin bei der Installation selbst an). Optional nur mit Bestand.
- **Wann?** Stündlich automatisch (abschaltbar) und jederzeit per Knopf.
- **Was wird übertragen?** Nur, was sich geändert hat. Das Plugin merkt sich einen
  Fingerabdruck je Anzeige. Bei geänderten Bildern werden nur die Bilder neu geschickt.
- **Entfernen:** Varianten, die nicht mehr freigegeben, inaktiv oder ausverkauft
  sind, werden von Marktplaats genommen. Schutz: Liefert Plenty auf einmal *gar
  keine* Variante, obwohl mehr als 5 Anzeigen online sind, wird nichts gelöscht.
- **Fehler** stehen je Anzeige in der Übersicht, in Klartext mit dem Feld, das
  Marktplaats bemängelt (z. B. `condition: invalid-field-value (Nieuw|Gebruikt)`).
  Datenfehler werden erst nach einer Änderung am Artikel erneut versucht.
  Server- und Verbindungsfehler werden beim nächsten Lauf wiederholt.

## Voraussetzungen

1. **API-Zugang bei Marktplaats.** Den gibt es nicht per Selbstbedienung: Die
   Anwendung muss bei Marktplaats registriert werden (Kontakt über den
   Zakelijk-/Partner-Support). Dafür brauchen Sie
   - ein **zakelijk** (gewerbliches) Marktplaats-Konto,
   - die **Rückruf-Adresse** (Redirect URI). Das Plugin zeigt sie nach der
     Installation unter *Einrichtung » Märkte » Marktplaats* an, normalerweise
     `https://<Ihre-Shop-Domain>/markets/marktplaats/auth/callback`.

   Sie bekommen **Client-ID** und **Client-Secret**, auf Wunsch auch einen
   Sandbox-Zugang zum Testen.
2. plentymarkets mit Plugin-Set (PlentyONE).

## Installation

Plenty lädt Plugins aus einem Git-Repository, in dem `plugin.json` **im
Wurzelverzeichnis** liegt. Dieses Plugin liegt hier im Unterordner
`plenty-marktplaats/`. Zwei Wege:

**A) Eigenes Repository (empfohlen).** Den Inhalt von `plenty-marktplaats/` in ein
eigenes (privates) GitHub-Repository legen, z. B. `plenty-marktplaats`.

**B) Eigener Branch in diesem Repository.**

```bash
git subtree split --prefix plenty-marktplaats -b plenty-marktplaats-plugin
git push origin plenty-marktplaats-plugin
```

Danach in Plenty:

1. *Plugins » Plugin-Set-Übersicht* → Plugin-Set öffnen → *Plugin hinzufügen* →
   **Git** → Repository-URL eintragen. Bei privatem Repo: GitHub-Benutzer und ein
   Personal Access Token mit Leserecht. Branch wählen (bei Weg B
   `plenty-marktplaats-plugin`).
2. Plugin **installieren**, **aktivieren**, Plugin-Set **bereitstellen**.
   Beim Bereitstellen legt das Plugin seine Tabellen und die Herkunft
   „Marktplaats“ an.

## Einrichtung

### 1. Konfiguration (*Plugins » Plugin-Set » Marktplaats » Konfiguration*)

| Reiter | Feld | Hinweis |
| --- | --- | --- |
| Zugang | Umgebung | Erst **Test (Sandbox)**, wenn Marktplaats einen Sandbox-Zugang gibt |
| | Client-ID / Client-Secret | von Marktplaats |
| | API-Adresse | leer lassen, außer Marktplaats nennt für die Sandbox eine andere |
| Anzeigen | Postleitzahl | niederländische PLZ des Abholorts, z. B. `5911AB` |
| | Verkaufspreis-ID | welcher Plenty-Verkaufspreis auf Marktplaats erscheint |
| | Preismodell | Festpreis, Bieten oder „siehe Beschreibung“ |
| | Textsprachen | `nl, de`: niederländischer Text, sonst deutscher (mit Hinweis) |
| | Text unter jeder Beschreibung | z. B. Abholung, Versand, Öffnungszeiten |
| | Höchstzahl Bilder | Basis 24, Plus 35, Premium 99 |
| Kategorien & Attribute | Kategoriezuordnung | eine Zeile je Kategorie, siehe unten |
| | Standard-Kategorie | Rückfall, `0` = ohne Zuordnung nicht hochladen |
| | Attribute (JSON) | Pflichtfelder der Marktplaats-Kategorien, siehe unten |
| | Zustand | Plenty-Artikelzustand → Marktplaats-Wert |
| GPSR / Hersteller | | Pflicht für gewerbliche Verkäufer. Genommen wird der Hersteller aus Plenty (Name, Anschrift, E-Mail), sonst die Rückfallwerte |
| Abgleich | stündlich, nur mit Bestand, automatisch entfernen, Höchstzahl pro Lauf | |

### 2. Verbinden (*Einrichtung » Märkte » Marktplaats*)

**„Mit Marktplaats verbinden“** öffnet die Marktplaats-Anmeldung. Nach der
Zustimmung schließt sich das Fenster und der Status steht auf *Verbunden*. Die
Verbindung bleibt dauerhaft bestehen (das Plugin erneuert den Zugang selbst).
Nach einem Wechsel zwischen Sandbox und Live muss neu verbunden werden.

### 3. Kategorien zuordnen

Marktplaats nimmt Anzeigen nur in **L2-Kategorien** an. Auf der Plugin-Seite unter
*Marktplaats-Kategorien nachschlagen* den Baum laden, suchen (z. B. `gereedschap`)
und die ID in die Kategoriezuordnung eintragen:

```
# Plenty-Kategorie = Marktplaats-Kategorie
112 = 1234     # Akkuschrauber -> Doe-het-zelf en Verbouw | Gereedschap
113 = 1250
```

Gezählt wird zuerst die **Standardkategorie** der Variante, dann ihre weiteren Kategorien.

### 4. Pflicht-Attribute

Viele Marktplaats-Kategorien verlangen Zusatzfelder (Zustand, Lieferung, Marke …).
Welche genau, zeigt der Knopf **Attribute** neben einer Kategorie (Schlüssel,
Pflicht ja/nein, erlaubte Werte). Eintragen als JSON. `"*"` gilt für alle,
eine Kategorie-ID nur dort und hat Vorrang:

```json
{
  "*":    { "delivery": "Ophalen of Verzenden" },
  "1234": { "brand": "Bosch" }
}
```

Den **Zustand** übernimmt das Plugin aus dem Plenty-Artikelzustand
(`{"0":"Nieuw","1":"Gebruikt",...}`). Schlüssel und Werte bitte mit der
Attribut-Anzeige abgleichen, sie können je Kategorie abweichen. Lehnt
Marktplaats ein Attribut in einer Kategorie als unbekannt ab, lässt das Plugin es
dort automatisch weg und vermerkt das als Hinweis an der Anzeige.

### 5. Artikel freigeben und testen

1. Bei einem Testartikel unter *Verfügbarkeit » Märkte* **Marktplaats** hinzufügen.
2. Auf der Plugin-Seite unter *Vorschau & Einzelabgleich* die Varianten-ID eingeben →
   **Vorschau** zeigt genau das JSON, das an Marktplaats ginge, und was noch fehlt.
3. **Jetzt abgleichen** stellt nur diese eine Variante ein. In der Übersicht steht
   danach die Marktplaats-ID mit Link zur Anzeige.
4. Passt alles: weitere Artikel freigeben, der Rest läuft stündlich.

## Programmaufbau

```
plugin.json                 Plugin-Beschreibung, Guzzle als externe Abhängigkeit
config.json                 Einstellungsmaske im Plugin-Set
ui.json, ui/index.html      Seite unter Einrichtung » Märkte » Marktplaats
resources/lib/marktplaats_http.php   einziger HTTP-Weg nach außen (External SDK)
src/
  Providers/                Service- und Routen-Provider, stündlicher Cron
  Controllers/              REST-Endpunkte (/rest/markets/marktplaats/...) + OAuth-Rückruf
  Api/MarktplaatsClient     API-Aufrufe, Token holen und erneuern
  Services/SyncService      der Abgleich: anlegen / ändern / Bilder / entfernen
  Services/VariationSource  liest Varianten, Bestand und Hersteller aus Plenty
  Services/PluginConfig     liest die Konfiguration
  Mapping/                  reine Logik ohne Plenty (lokal getestet):
    AdMapper                Variante → Marktplaats-Anzeige
    SyncPlanner             was ist zu tun, Fehlertexte, Wiederholregeln
    TextCleaner             HTML → Text, Titel kürzen
    SettingsParser          Kategoriezuordnung, JSON-Felder
    Endpoints               Adressen Live/Sandbox
  Models/, Migrations/, Repositories/   Plugin-Datenbank, Herkunft „Marktplaats“
tests/                      PHPUnit-Tests (Mapping + Abgleich mit simulierter API)
```

REST-Endpunkte (mit Plenty-Anmeldung):

| Methode | Pfad | Zweck |
| --- | --- | --- |
| GET | `/rest/markets/marktplaats/status` | Verbindung, Zähler, letzter Lauf |
| GET | `/rest/markets/marktplaats/auth/login-url` | Anmeldeadresse erzeugen |
| DELETE | `/rest/markets/marktplaats/auth` | Verbindung trennen |
| POST | `/rest/markets/marktplaats/sync` | kompletter Abgleich |
| GET | `/rest/markets/marktplaats/listings` | Übersicht (`page`, `perPage`, `status`) |
| GET | `/rest/markets/marktplaats/preview/{variationId}` | Vorschau ohne Upload |
| POST | `/rest/markets/marktplaats/listings/{variationId}/sync` | eine Variante abgleichen |
| DELETE | `/rest/markets/marktplaats/listings/{variationId}` | Anzeige entfernen |
| GET | `/rest/markets/marktplaats/categories[/{l1}/{l2}/attributes]` | Kategorien / Attribute |

## Entwicklung

```bash
cd plenty-marktplaats
composer install
composer test        # PHPUnit
composer lint        # php -l über alle Dateien
```

Der Code ist für die Plenty-Plattform (PHP 7.3–8.0) geschrieben: keine typisierten
Eigenschaften, keine Arrow-Functions, Plugin-Klassen über `pluginApp()`.

## Noch nicht enthalten / bekannte Grenzen

- **Nicht gegen ein Live-System getestet.** Mapping und Abgleich sind mit Tests
  abgedeckt, die Plenty-Aufrufe gegen die offiziellen Schnittstellen-Stubs geprüft.
  Der erste echte Lauf sollte in der Sandbox oder mit einem Testartikel passieren.
- **Sandbox-API-Adresse:** Marktplaats dokumentiert nur die Sandbox-Anmeldung
  (`auth.demo.qa-mp.so`). Als API-Adresse ist `https://api.demo.qa-mp.so`
  voreingestellt. Nennt Marktplaats eine andere, im Feld *API-Adresse* eintragen.
- **Anzeigen verlängern** (Marktplaats schließt Anzeigen nach Ablauf) ist nicht
  eingebaut. Abgelaufene Anzeigen legt das Plugin bei der nächsten Änderung neu an.
- **Nachrichten, Gebote und Bestellungen** von Marktplaats werden nicht nach Plenty
  geholt. Marktplaats ist ein Kleinanzeigenmarkt, verkauft wird meist direkt.
- **Kostenpflichtige Extras** (Topadvertentie, Dagtopper …) werden nicht gebucht.
- Eine Anzeige je **Variante**. Varianten eines Artikels erscheinen als einzelne Anzeigen.
