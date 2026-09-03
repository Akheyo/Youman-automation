# WordPress mit Claude verbinden

Ziel: Ich soll ab-solarenergy.de nicht nur einmal anschauen, sondern dauerhaft
prüfen und pflegen können — Titel, Meta-Beschreibungen, Seitenstatus, Texte,
aufräumen von Alt-Inhalten.

Die Seite läuft auf WordPress mit Rank Math (SEO), Elementor (Seitenbau),
WooCommerce (Shop) und dem Theme *r-energy*. Die REST-API ist offen und
Anwendungspasswörter sind aktiv — es ist also nichts zu installieren.

---

## Weg 1 — Anwendungspasswort (empfohlen, 3 Minuten)

Ein Anwendungspasswort ist ein zweiter Schlüssel für deinen WordPress-Account.
Es ersetzt **nicht** dein Login-Passwort, gilt nur für die Schnittstelle und
lässt sich jederzeit einzeln widerrufen, ohne dass du dein Passwort änderst.

1. Einloggen unter <https://ab-solarenergy.de/wp-admin>
2. Links **Benutzer → Profil** öffnen, ganz nach unten scrollen bis
   **Anwendungspasswörter**
3. Als Namen `Claude` eintragen → **Neues Anwendungspasswort hinzufügen**
4. WordPress zeigt einmalig einen Code der Form `abcd EFGH 1234 ijkl MNOP qrst`.
   Der ist nur in diesem Moment sichtbar — kopieren.
5. Im Projekt eine Datei `.env.local` anlegen (steht in `.gitignore`, landet
   also nie auf GitHub):

   ```bash
   WP_URL=https://ab-solarenergy.de
   WP_USER=dein-wordpress-benutzername      # der Benutzername, nicht die E-Mail
   WP_APP_PASSWORD=abcd EFGH 1234 ijkl MNOP qrst
   ```

6. Verbindung testen:

   ```bash
   node scripts/wp-verbindung.mjs
   ```

   Das Skript meldet, ob die Anmeldung klappt, welche Rolle der Zugang hat,
   wie viele Seiten/Beiträge/Medien vorhanden sind, und legt zur Probe einen
   Entwurf an, den es sofort wieder löscht.

**Wenn du weniger Rechte vergeben willst:** in WordPress unter *Benutzer →
Neu hinzufügen* einen eigenen Benutzer `claude` mit der Rolle **Redakteur**
anlegen und das Anwendungspasswort dort erzeugen. Dann kann ich Inhalte
bearbeiten, aber keine Plugins, Themes oder Benutzer anfassen.

**Widerrufen:** dieselbe Stelle im Profil, Zeile `Claude` → *Widerrufen*.
Ab dem Moment ist der Zugang tot.

---

## Weg 2 — MCP-Adapter (ist auf der Seite schon installiert)

Auf ab-solarenergy.de läuft bereits ein MCP-Server:

```
https://ab-solarenergy.de/wp-json/mcp/mcp-adapter-default-server
```

Damit kann Claude Code die WordPress-Funktionen direkt als Werkzeuge nutzen,
statt über eigene Skripte zu gehen. Die Anmeldung läuft über dasselbe
Anwendungspasswort aus Weg 1:

```bash
claude mcp add --transport http wordpress \
  https://ab-solarenergy.de/wp-json/mcp/mcp-adapter-default-server \
  --header "Authorization: Basic $(printf '%s:%s' "$WP_USER" "$WP_APP_PASSWORD" | base64 -w0)"
```

Welche Werkzeuge der Adapter freigibt, hängt davon ab, was im WordPress-Backend
für ihn aktiviert wurde. Weg 1 funktioniert unabhängig davon und ist die
verlässlichere Grundlage — Weg 2 ist die Bequemlichkeitsvariante obendrauf.

---

## Weg 3 — Google Search Console (für die Diagnose unverzichtbar)

SISTRIX zeigt nur, was Google *rankt*. Search Console zeigt, was Google
überhaupt *indexiert* hat und warum nicht. Ohne diesen Zugang ist jede
SEO-Arbeit Raten.

Auf der Startseite ist kein `google-site-verification`-Tag und kein
Analytics-/Tag-Manager-Snippet zu finden. Entweder ist die Property über DNS
verifiziert, oder sie existiert nicht. Bitte prüfen unter
<https://search.google.com/search-console>:

* **Property vorhanden?** Falls nicht: Domain-Property `ab-solarenergy.de`
  anlegen und per DNS-TXT-Eintrag verifizieren.
* **Sitemap eingereicht?** `https://ab-solarenergy.de/sitemap_index.xml`
* **Bericht „Seiten"** öffnen und exportieren. Dort steht schwarz auf weiß,
  wie viele der 87 URLs indexiert sind und mit welcher Begründung der Rest
  draußen bleibt. Die CSV kannst du hier ins Projekt legen, dann werte ich sie aus.

---

## Was ich mit dem Zugang mache

| | ohne Zugang | mit Anwendungspasswort |
|---|---|---|
| Seite auditieren (`wp-seo-audit.mjs`) | ✅ | ✅ |
| Titel & Meta-Beschreibungen lesen | ✅ | ✅ |
| Titel & Meta-Beschreibungen ändern | ❌ | ✅ |
| Demo-Seiten auf noindex setzen / löschen | ❌ | ✅ |
| Texte der Ortsseiten unterscheidbar machen | ❌ | ✅ |
| Entwürfe zum Gegenlesen anlegen | ❌ | ✅ |
| Plugins/Theme ändern | ❌ | ❌ (bewusst nicht) |

Änderungen an bestehenden Inhalten mache ich grundsätzlich erst nach Absprache
und, wo möglich, als Entwurf — nichts geht ungefragt live.

---

## Sicherheit

* Das Anwendungspasswort gehört in `.env.local`. Diese Datei ist in
  `.gitignore` und darf **nie** committet werden.
* Schick es nicht per WhatsApp oder E-Mail durch die Gegend.
* Vor jeder größeren Änderung ein Backup der Seite ziehen (UpdraftPlus o.ä.).
* Wenn du den Zugang nicht mehr brauchst: widerrufen. Neu erzeugen dauert
  wieder nur eine Minute.
