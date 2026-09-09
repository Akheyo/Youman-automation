# Komplett Konzept — Automations-Dashboard

Alle Automationen an einer Stelle: was läuft, was steht, was fehlgeschlagen ist —
und die Knöpfe, um einzugreifen.

> **Stand:** Das Dashboard ist die Hülle. Die Automationen selbst sind noch nicht
> angebunden. „Jetzt ausführen“ reiht einen Lauf ein, ausgeführt wird er, sobald
> die Ausführungsschicht steht. Was die Software leisten soll, steht in
> [AUFTRAG.md](./AUFTRAG.md).

## Wie es aufgebaut ist

```
Vercel                                  Supabase (Frankfurt)
┌─────────────────────────┐             ┌──────────────────┐
│  App (Next.js)          │ ──────────► │   Postgres       │
└─────────────────────────┘             └──────────────────┘
```

Kein eigener Server nötig. Vercel hält keinen Zustand — alles Wichtige liegt im
Git-Repo und bei Supabase. Ein Umzug auf einen anderen Vercel-Account oder
später auf einen eigenen Server ist deshalb jederzeit möglich.

---

## Auf Vercel deployen

### 1. Projekt anlegen

Auf [vercel.com](https://vercel.com) → **Add New** → **Project** → dieses Repo
auswählen.

Dann **unbedingt** diese beiden Einstellungen prüfen, sonst baut Vercel das
falsche Projekt:

| Einstellung | Wert |
|---|---|
| **Root Directory** | `komplett-konzept` |
| **Framework Preset** | Next.js |

> Das Repo enthält mehrere Projekte. Ohne das gesetzte Root Directory landet
> Vercel im übergeordneten Ordner und deployt eine andere Anwendung.

### 2. Umgebungsvariablen setzen

Unter **Environment Variables** drei Werte eintragen:

| Name | Wert |
|---|---|
| `DATABASE_URL` | Supabase → **Connect** → **Pooler** (Port 6543), Passwort einsetzen |
| `SESSION_SECRET` | 64 zufällige Zeichen. Erzeugen z. B. auf [generate-secret.vercel.app/64](https://generate-secret.vercel.app/64) |
| `APP_URL` | Die spätere Adresse, z. B. `https://dein-projekt.vercel.app` |

`APP_URL` muss mit `https://` beginnen — davon hängt ab, ob das Login-Cookie
als sicher markiert wird.

### 3. Deployen

**Deploy** klicken. Der Build legt die Datenbanktabellen selbst an.

### 4. Ersten Zugang anlegen

Die Adresse im Browser öffnen. Solange es noch keinen Nutzer gibt, landest du
automatisch auf der **Ersteinrichtung** und legst dort den ersten
Administrator an. Danach ist diese Seite geschlossen; weitere Nutzer kommen
über **Nutzer** im Dashboard dazu.

### Auf einen anderen Vercel-Account umziehen

Auf dem neuen Account **Add New → Project** mit demselben Repo, dieselben
Einstellungen und Variablen. Nichts geht verloren — die Daten liegen bei
Supabase, nicht bei Vercel. Nur eine eigene Domain muss man umhängen.

---

## Alternative: auf einem eigenen Server

Nur nötig, wenn ihr Vercel nicht nutzen wollt. Läuft dann als zwei Container
(App und Caddy als HTTPS-Proxy) per Docker Compose.

### Auf einem frischen Server aufsetzen

Gedacht für einen leeren Hetzner-Server mit Ubuntu. Wenn du noch nie einen
Server aufgesetzt hast: die Befehle einfach der Reihe nach eintippen.

### 0. Auf den Server verbinden

**Alle folgenden Befehle laufen auf dem Server, nicht auf dem eigenen Rechner.**
Zuerst also dorthin verbinden — unter Windows in der PowerShell, auf Mac und
Linux im Terminal:

```powershell
ssh root@DEINE-SERVER-IP
```

Die IP steht in der [Hetzner Cloud Console](https://console.hetzner.cloud).
Beim ersten Mal kommt die Rückfrage `Are you sure you want to continue
connecting?` — mit `yes` bestätigen. Danach das Root-Passwort aus der
Hetzner-Mail eingeben; beim Tippen bleibt es unsichtbar, das ist normal.

Wenn die Eingabezeile so aussieht, bist du auf dem Server:

```
root@ubuntu-2gb-nbg1-1:~#
```

> **Noch kein Server?** Hetzner Cloud Console → *Server hinzufügen* →
> Standort **Nürnberg** oder **Falkenstein**, Image **Ubuntu 24.04**,
> Typ **CX22** (2 vCPU, 4 GB). Reicht für das Dashboard mit Luft nach oben.

### 1. Docker installieren

```bash
curl -fsSL https://get.docker.com | sh
```

Läuft ein paar Minuten. Fehlermeldungen wie `sh: Die Benennung "sh" wurde nicht
erkannt` bedeuten, dass der Befehl versehentlich auf dem eigenen Windows-Rechner
gelandet ist statt auf dem Server — dann Schritt 0 nachholen.

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

### 5. Aufrufen und ersten Zugang anlegen

Im Browser die Domain öffnen — oder, ohne Domain, `http://<Server-IP>`.
Solange es noch keinen Nutzer gibt, landest du auf der Ersteinrichtung.

Alternativ auf der Kommandozeile:

```bash
docker compose exec app node scripts/create-admin.mjs \
  "deine@adresse.de" "Dein Name" admin
```

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

### Wie Automationen andocken

Automationen melden ihre Läufe an eine Adresse. Sie brauchen dafür keinen
Datenbankzugang — nur den Schlüssel aus `INGEST_TOKEN`.

```
POST /api/ingest/execution
Authorization: Bearer <INGEST_TOKEN>
Content-Type: application/json
```

```json
{
  "automation": {
    "key": "lager-scan",
    "name": "Lagerplatz-Scan",
    "description": "Liest Lagerplätze aus Plenty.",
    "category": "Lager",
    "source": "n8n",
    "schedule_label": "täglich 06:00"
  },
  "status": "success",
  "items_processed": 412,
  "duration_ms": 8300,
  "output": { "gefunden": 412, "unklar": 17 },
  "logs": [{ "level": "info", "message": "412 Artikel gelesen." }]
}
```

Bei einer Störung stattdessen `"status": "failed"` und ein `error`-Block:

```json
{
  "automation": { "key": "lager-scan" },
  "status": "failed",
  "error": {
    "code": "AUTH_401",
    "message": "Plenty-Zugang abgelaufen.",
    "severity": "critical"
  }
}
```

Was dabei passiert: Die Automation wird beim ersten Mal automatisch angelegt,
danach nur noch aktualisiert. Ein fehlgeschlagener Lauf setzt sie auf
*gestört*, der nächste erfolgreiche wieder auf *aktiv*. Fehler erscheinen im
Fehlerbereich, Logzeilen im Zeitstrahl der Ausführung.

`status` kennt `queued`, `running`, `success`, `failed`, `cancelled` —
eine lang laufende Automation kann sich also zuerst als `running` melden.

### Fertiger n8n-Workflow

Unter `n8n/dashboard-erreichbarkeit.json` liegt ein Workflow zum Einspielen:
er fragt alle fünf Minuten das Dashboard ab und meldet das Ergebnis zurück.
Damit siehst du im Dashboard, ob das Dashboard läuft — und hast gleichzeitig
ein Beispiel, an dem sich weitere Automationen orientieren können.

Einspielen: in n8n auf **Import from File**, danach im Knoten
**Einstellungen** die Adresse des Dashboards und den `INGEST_TOKEN`
eintragen. Sonst nichts ändern.

### Die Tabellen dahinter

Wer lieber direkt in die Datenbank schreibt, kann das auch:

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
