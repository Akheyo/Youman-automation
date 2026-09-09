# Auftrag — Komplett Konzept Automations-Dashboard

Dieser Text beschreibt das gewünschte Ergebnis in einem Stück. Er lässt sich
als Prompt an einen Entwickler oder eine KI weitergeben.

---

## Der Auftrag

Baue für **Komplett Konzept** eine eigenständige Software mit Web-Dashboard, in
der alle Automationen der Firma an einer Stelle sichtbar und steuerbar sind.

Die Oberfläche ist **auf Deutsch**, mit Umlauten, in den Farben von Komplett
Konzept: Blau `#1B3D9E`, Gelb `#F2C200`, Rot `#D92D20` — auf dunklem Untergrund,
wie man ihn von Betriebs-Dashboards kennt. Statusfarben (grün, rot, amber)
bleiben von den Markenfarben getrennt, damit Marke und Alarm nicht verwechselt
werden. Liegt eine Logodatei unter `public/logo.png`, wird sie automatisch
verwendet.

### Was das Dashboard können muss

**Übersicht** — Kennzahlen auf einen Blick: wie viele Automationen aktiv sind,
was gerade läuft, Erfolgsquote der letzten 24 Stunden, offene Fehler, gestörte
Automationen. Dazu ein Verlauf der letzten 14 Tage, Kacheln je Automation,
die letzten Ausführungen und die offenen Fehler.

**Automationen** — alle Automationen als Liste und als Detailseite: Zeitplan,
Quelle, Verantwortlicher, Laufhistorie, Fehler, Konfiguration.

**Ausführungen** — jeder einzelne Lauf, filterbar nach Automation, Status und
Zeitraum. Die Detailseite zeigt einen Zeitstrahl des Ablaufs, Dauer, Ein- und
Ausgabe sowie die Fehlermeldung im Klartext.

**Fehler** — alle Fehler gesammelt, nach Schweregrad und Status filterbar.
Ein Fehler lässt sich übernehmen und abhaken, mit Sprung zum verursachenden Lauf.

**Steuerung** — pro Automation: aktivieren, pausieren, jetzt ausführen.
Pro Lauf: wiederholen, abbrechen.

**Protokoll** — wer hat wann was gesteuert. Jede Steueraktion wird festgehalten.

**Nutzer** — anlegen, sperren, Rolle ändern.

### Rollen

| Rolle | Ansehen | Steuern | Nutzer verwalten |
|---|---|---|---|
| Betrachter | ja | nein | nein |
| Bediener | ja | ja | nein |
| Administrator | ja | ja | ja |

Rund 25 Nutzer. Erster Administrator: **Amanuel Kheyo**. Steuerknöpfe sind für
Betrachter sichtbar, aber gesperrt — nicht versteckt, damit klar ist, dass es
sie gibt.

### Technischer Rahmen

- Läuft auf einem **eigenen Hetzner-Server**, Betrieb über Docker Compose
- **Next.js 14** (App Router, TypeScript), Serveranbindung ohne externe Dienste
- Datenbank: **Supabase** (Projekt in Frankfurt, EU)
- **Caddy** als Reverse Proxy, HTTPS automatisch; Betrieb auch ohne Domain
  direkt über die Server-IP muss funktionieren
- Login mit E-Mail und Passwort, Sitzungen in der Datenbank, Passwörter per
  scrypt — kein externer Anmeldedienst
- Nächtliches Datenbank-Backup als Skript (der Supabase-Free-Tarif sichert nicht)
- Migrationen laufen beim Start automatisch

### Wichtig für den Zuschnitt

Das Dashboard wird **zuerst allein gebaut**, ohne die Automationen selbst.
Es ist die Hülle, in die sie später hineinwachsen. Konkret heißt das:

- „Jetzt ausführen" legt einen Lauf mit Status *wartet* an, führt aber nichts aus
- Aktiv/Pausiert wird gespeichert und ist später für die Ausführungsschicht
  verbindlich
- Die Tabellen sind so geschnitten, dass n8n, Cronjobs oder Python-Skripte
  direkt hineinschreiben können
- Beispieldaten sind per Skript ein- und ausschaltbar, damit man von der ersten
  Minute an etwas Klickbares sieht

Der Anschluss der echten Automationen ist der **nächste Schritt**, nicht dieser.

### Qualitätsanspruch

- Gegen eine echte Datenbank geprüft, nicht nur kompiliert: Login, alle Seiten,
  Detailseiten, eine echte Steueraktion samt Protokolleintrag, Abmelden
- Auf dem Handy (390 px) ohne Querscrollen bedienbar
- Tastaturbedienung und sichtbarer Fokus
- Aufsetz-Anleitung, die auf einem frischen Server Schritt für Schritt
  funktioniert — ohne Vorwissen

### Zugangsdaten

Passwörter und Verbindungsdaten gehören ausschließlich in die `.env` auf dem
Server. Sie werden nicht in den Code geschrieben, nicht ins Git eingecheckt und
nicht in Chatverläufe kopiert.
