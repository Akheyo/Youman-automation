# Komplett Konzept — Automations-Dashboard

Alle Automationen an einer Stelle: was läuft, was steht, was fehlgeschlagen ist —
und die Knöpfe, um einzugreifen.

> **Stand:** Das Dashboard ist die Hülle. Die Automationen selbst sind noch nicht
> angebunden. „Jetzt ausführen“ reiht einen Lauf ein, ausgeführt wird er, sobald
> die Ausführungsschicht steht. Was die Software leisten soll, steht in
> [AUFTRAG.md](./AUFTRAG.md).

## Wie es aufgebaut ist

```
Hetzner-Server                          Supabase (Frankfurt)
┌─────────────────────────┐             ┌──────────────────┐
│  Caddy   →   App        │ ──────────► │   Postgres       │
│  (HTTPS)     (Next.js)  │             │   (Datenbank)    │
└─────────────────────────┘             └──────────────────┘
```

Auf dem Server laufen nur zwei Container. Die Datenbank liegt bei Supabase.

---

## Auf einem frischen Server aufsetzen

Gedacht für einen leeren Hetzner-Server mit Ubuntu. Wenn du noch nie einen
Server aufgesetzt hast: die Befehle einfach der Reihe nach eintippen.

### 1. Docker installieren

Per SSH auf den Server, dann:

```bash
curl -fsSL https://get.docker.com | sh
```

### 2. Projekt holen

```bash
mkdir -p /opt && cd /opt
git clone https://github.com/Akheyo/Youman-automation.git
cd Youman-automation/komplett-konzept
```

### 3. Zugangsdaten eintragen

```bash
cp .env.example .env
nano .env
```

Drei Dinge müssen ausgefüllt werden:

| Eintrag | Woher |
|---|---|
| `DATABASE_URL` | Supabase-Dashboard → **Connect** → den **Pooler** kopieren (Port 6543), Passwort einsetzen |
| `SESSION_SECRET` | Auf dem Server erzeugen: `openssl rand -hex 32` |
| `DOMAIN` | Deine Subdomain, z. B. `dashboard.komplett-konzept.de`. Noch keine Domain? Dann `:80` stehen lassen — dann läuft es über die Server-IP. |

Speichern mit `Strg+O`, schließen mit `Strg+X`.

> Die `.env` bleibt auf dem Server. Sie ist vom Git ausgenommen und darf nirgends
> anders hin kopiert werden.

### 4. Starten

```bash
docker compose up -d --build
```

Der erste Start dauert ein paar Minuten, weil die App gebaut wird. Die
Datenbanktabellen legt sie beim Start selbst an.

Läuft alles? Prüfen mit:

```bash
docker compose logs -f app
```

### 5. Dich selbst als Administrator anlegen

```bash
docker compose exec app node scripts/create-admin.mjs \
  "deine@adresse.de" "Dein Name" admin
```

Das Passwort wird abgefragt (mindestens 10 Zeichen).

### 6. Aufrufen

Im Browser die Domain öffnen — oder, ohne Domain, `http://<Server-IP>`.
Anmelden mit der eben angelegten Adresse.

---

## Beispieldaten

Damit sofort etwas zu sehen ist, lassen sich Beispiel-Automationen anlegen:

```bash
docker compose exec app node scripts/seed.mjs            # anlegen
docker compose exec app node scripts/seed.mjs --leeren   # wieder entfernen
```

Vor dem echten Betrieb wieder entfernen — sonst stehen erfundene Zahlen neben
richtigen.

---

## Sicherungen einrichten

Der Free-Tarif von Supabase legt **keine** Sicherungen an. Deshalb eine eigene:

```bash
crontab -e
```

Diese Zeile ans Ende:

```
0 3 * * * cd /opt/Youman-automation/komplett-konzept && ./scripts/backup.sh >> backups/backup.log 2>&1
```

Jede Nacht um drei wird gesichert, Sicherungen älter als 14 Tage werden gelöscht.
Einmal von Hand testen, bevor man sich darauf verlässt:

```bash
./scripts/backup.sh
```

---

## Laufender Betrieb

| Was | Befehl |
|---|---|
| Neue Version einspielen | `git pull && docker compose up -d --build` |
| Logs ansehen | `docker compose logs -f app` |
| Neu starten | `docker compose restart app` |
| Anhalten | `docker compose down` |
| Nutzer anlegen | im Dashboard unter **Nutzer** |
| Passwort zurücksetzen | `docker compose exec app node scripts/create-admin.mjs "adresse" "Name" admin` |

Der Zustand liegt vollständig bei Supabase — `docker compose down` löscht nichts.

---

## Rollen

| Rolle | Ansehen | Steuern | Nutzer verwalten |
|---|---|---|---|
| Betrachter | ja | nein | nein |
| Bediener | ja | ja | nein |
| Administrator | ja | ja | ja |

Steuerknöpfe sind für Betrachter sichtbar, aber gesperrt — so ist erkennbar,
dass es sie gibt.

---

## Für Entwickler

```bash
npm install
cp .env.example .env.local     # DATABASE_URL + SESSION_SECRET eintragen
npm run db:migrate
npm run db:seed
npm run dev                    # http://localhost:3000
```

| Befehl | Zweck |
|---|---|
| `npm run typecheck` | TypeScript prüfen |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Offene Migrationen anwenden |
| `npm run db:seed` | Beispieldaten (`--leeren` entfernt sie) |

### Aufbau

```
app/
  (dash)/          Geschützter Bereich: Übersicht, Automationen, Ausführungen,
                   Fehler, Protokoll, Nutzer, Einstellungen
  login/           Anmeldung
components/        Statusanzeigen, Steuerknöpfe, Navigation, Verlauf
lib/               Datenbank, Sitzungen, Rechte, Abfragen, Formatierung
db/migrations/     SQL, wird beim Start der Reihe nach angewendet
scripts/           Migration, Beispieldaten, Admin anlegen, Sicherung
```

### Wie Automationen später andocken

Die Ausführungsschicht braucht das Dashboard nicht zu kennen — sie schreibt
direkt in dieselben Tabellen:

| Tabelle | Wofür |
|---|---|
| `automations` | Eine Zeile je Automation, `status` steuert an/aus |
| `executions` | Ein Lauf. Status `queued` heißt: wartet auf Abholung |
| `execution_logs` | Zeilen für den Zeitstrahl in der Detailansicht |
| `errors` | Was im Fehlerbereich erscheint |
| `audit_log` | Wer hat wann was gesteuert |

Ein Runner holt sich Läufe mit `status = 'queued'`, setzt sie auf `running`,
schreibt Logzeilen und schließt mit `success` oder `failed` ab.

### Migrationen

Neue Datei in `db/migrations/` anlegen, fortlaufend nummeriert
(`0002_...sql`). Beim nächsten Start wird sie automatisch angewendet.
Bereits angewendete Dateien werden nicht verändert — Korrekturen kommen als
neue Migration.
