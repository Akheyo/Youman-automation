# Umzug: Projektplanung → Vercel-Konto info@komplett-konzept.de

Stand: 23.10.2026 · betrifft nur die **Projektplanung** (`projektplanung/`),
nicht die anderen Apps im Repo.

Die App selbst speichert auf Vercel **nichts**. Alle Daten liegen in Supabase
(Login, Suchverlauf, Rechnungsdateien) und in PlentyONE (Kategorien, Artikel).
Vercel hostet nur den Code. Ein Umzug ist deshalb unkritisch — es geht im
Kern um 13 Umgebungsvariablen und die URL.

---

## Welcher Weg?

| | Weg | Kosten | Aufwand | URL bleibt |
|---|---|---|---|---|
| **1** | E-Mail des bestehenden Vercel-Kontos ändern | 0 € | 2 Min. | ✅ |
| **2** | Pro-Team anlegen + Projekt übertragen | 20 $/Monat | 15 Min. | ✅ |
| **3** | Neues Projekt im neuen Konto anlegen | 0 € | ~20 Min. | ⚠️ siehe unten |

**Empfehlung:** Weg 1, wenn das heutige Vercel-Konto nur für diese App benutzt
wird — das ist der einfachste und sauberste Schnitt. Sonst Weg 3.

---

## Weg 1 — E-Mail des Kontos umstellen

Nur sinnvoll, wenn in dem Konto **keine anderen Projekte** liegen, die beim
alten Inhaber bleiben sollen (sie würden mitwandern).

1. Vercel → oben rechts Avatar → **Settings** → **General**
2. Feld **Email** auf `info@komplett-konzept.de` ändern, Bestätigungsmail
   in diesem Postfach anklicken.
3. Falls der Login über GitHub läuft: unter **Settings → Authentication**
   zusätzlich ein Passwort bzw. Login per E-Mail einrichten, damit der Zugang
   nicht am alten GitHub-Konto hängt.

Danach ist alles unverändert: URL, Umgebungsvariablen, Git-Anbindung,
Deployment-Historie. Kein Downtime, kein Neu-Deploy.

---

## Weg 2 — Projekt übertragen (Vercel-Transfer)

Vercel überträgt Projekte **ohne Downtime** und nimmt dabei Deployments,
Umgebungsvariablen, Domains/Aliasse, Git-Anbindung und Einstellungen mit.

Voraussetzung laut Vercel: man muss **Owner** des abgebenden Teams **und
Mitglied** des Zielteams sein. Mitglieder gibt es erst ab **Pro**
(20 $/Nutzer/Monat) — ein kostenloses Hobby-Konto kann keine Mitglieder
aufnehmen, deshalb funktioniert der Transfer nur in ein Pro-Team.

1. `info@komplett-konzept.de` legt bei Vercel ein Konto an und erstellt ein
   **Team** (z. B. `komplett-konzept`), dann **Settings → Billing → Upgrade**
   auf Pro (Pro-Trial geht auch).
2. Im neuen Team: **Settings → Members** → das bisherige Konto als **Member**
   einladen.
3. Im bisherigen Konto: Projekt öffnen → **Settings → General** → ganz unten
   **Transfer Project** → Zielteam auswählen → Liste der mitwandernden
   Domains/Variablen prüfen → **Transfer**.
4. Nach dem Transfer: **Integrations** sind *nicht* mitgekommen — falls welche
   genutzt werden, im neuen Team neu verbinden.

Hinweis: Vercels **Hobby**-Tarif ist laut Nutzungsbedingungen auf nicht-kommerzielle
Nutzung beschränkt. Für ein Firmen-Werkzeug ist Pro der formal richtige Tarif.

---

## Weg 3 — Neues Projekt im neuen Konto (kostenlos)

### 3.1 GitHub-Zugriff klären
Das Repo ist `akheyo/youman-automation`. Das Vercel-Konto von
`info@komplett-konzept.de` braucht Leserechte darauf, sonst lässt sich das
Projekt nicht verbinden. Zwei Möglichkeiten:
- den GitHub-Account des neuen Vercel-Logins als **Collaborator** im Repo
  hinzufügen (GitHub → Repo → Settings → Collaborators), **oder**
- das Repo selbst an die Firma übertragen (GitHub → Settings → Transfer
  ownership) — dann hängt auch der Code nicht mehr am Privatkonto.

### 3.2 Projekt anlegen
1. Vercel (neues Konto) → **Add New → Project** → Repo `youman-automation`
   importieren.
2. **Wichtig: Root Directory = `projektplanung`** setzen. Im Repo-Root liegt
   eine andere App (`youman-automation`); ohne diese Einstellung wird die
   falsche gebaut.
3. Framework: Next.js (erkennt Vercel automatisch). Build Command und Output
   bleiben auf Standard.
4. Die 13 Umgebungsvariablen aus 3.4 für **Production** (und Preview, falls
   gewünscht) eintragen.
5. **Deploy**.

### 3.3 URL `projektplanungkk.vercel.app` übernehmen
Eine `*.vercel.app`-Adresse kann nur **ein** Projekt belegen. Um sie
weiterzubenutzen:
1. Im alten Konto das Projekt umbenennen (**Settings → General → Project
   Name**, z. B. auf `projektplanungkk-alt`) oder löschen.
2. Im neuen Konto das Projekt auf `projektplanungkk` umbenennen.

Zwischen Schritt 1 und 2 ist die alte URL kurz nicht erreichbar. Wer das nicht
will: das neue Projekt unter einer neuen Adresse laufen lassen
(z. B. `projektplanung-kk.vercel.app`) oder eine eigene Domain
(`projektplanung.komplett-konzept.de`) aufschalten — dann gibt es gar keinen
Bruch.

### 3.4 Umgebungsvariablen
Die aktuellen Werte holt man sich am einfachsten im alten Konto unter
**Settings → Environment Variables** (Auge-Symbol zum Einblenden) oder lokal:

```bash
npx vercel login          # mit dem ALTEN Konto
npx vercel link           # das alte Projekt wählen
npx vercel env pull .env.production.local --environment=production
```

Diese Datei enthält Klartext-Zugangsdaten — nach dem Übertragen löschen und
**nie committen** (`.env*.local` ist in `.gitignore`).

Vollständige Liste (alles, was der Code liest):

| Variable | Pflicht | Bemerkung |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ja | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ja | ebenda |
| `SUPABASE_SERVICE_ROLE_KEY` | ja | **geheim**; nötig für die Rechnungs-Ablage. Im Supabase-Dashboard erst *einblenden*, dann kopieren — maskiert kopierte Schlüssel (`•`) lassen den Upload scheitern |
| `PLENTY_BASE_URL` | ja | Shop-URL ohne Slash am Ende |
| `PLENTY_USER` | ja | Plenty-REST-Benutzer |
| `PLENTY_PASSWORD` | ja | **geheim** |
| `PLENTY_ID` | ja | meist `0` |
| `PLENTY_PROJEKTE_CATEGORY_ID` | ja | ID der Elternkategorie „Projekte“ |
| `PLENTY_EAN_BARCODE_ID` | ja | ID der EAN13-Barcode-Konfiguration |
| `PLENTY_EAN_PREFIX` | nein | Standard `20` |
| `PLENTY_INVOICE_PROPERTY_ID` | ja | ID der Datei-Eigenschaft „Dokument 1“ |
| `PLENTY_INVOICE_PROPERTY_NAME` | nein | Standard `Dokument 1` |
| `PLENTY_UI_UPLOAD` | nein | `1` = an (Standard), `0` = Datei-Upload abschalten |

Der Plenty-Benutzer braucht **Administrator-Rechte** (bzw. mindestens
`setup.property.relation.value.create` / `.update`), sonst wird die Rechnung
nicht an den Artikel gehängt.

### 3.5 Abnahme
1. Alte URL schließen, neue öffnen, **Strg+F5**.
2. Unten muss der Build-Marker stehen (aktuell `v1.7`).
3. Anmelden, Testprojekt mit Rechnung anlegen.
4. In Plenty prüfen: `Projekte → Firma Ort → Firma Ort Datum → Artikel`,
   mit EAN-13 und der Rechnung in „Dokument 1“.
5. Suchverlauf prüfen (zeigt die Supabase-Daten — die sind unverändert).

---

## Was NICHT mitzieht

- **Supabase** (Login-Konten, Suchverlauf, Bucket `rechnungen`) liegt in einem
  eigenen Konto. Solange die drei Supabase-Variablen gleich bleiben, nutzt die
  neue Vercel-Instanz dieselbe Datenbank — das Supabase-Projekt selbst gehört
  aber weiter dem bisherigen Inhaber. Wenn auch das wechseln soll:
  Supabase → Organization Settings → Transfer / Mitglied einladen. Separater
  Schritt, nichts an der App zu ändern.
- **PlentyONE** ist ohnehin das Firmenkonto — hier ändert sich nichts.
- **GitHub**: der Code liegt in `akheyo/youman-automation`. Vercel baut nur von
  dort; wenn der Code ebenfalls der Firma gehören soll, siehe 3.1.

## Zugangsdaten
Beim Umzug werden Plenty-Passwort und Supabase-Service-Key weitergegeben.
Sauber ist, danach beides zu erneuern: in Plenty das Passwort des
REST-Benutzers ändern, in Supabase den Service-Role-Key rotieren — und die
neuen Werte nur im neuen Vercel-Konto eintragen.
