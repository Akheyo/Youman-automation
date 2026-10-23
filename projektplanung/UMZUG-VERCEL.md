# Umzug: Projektplanung → Vercel-Konto info@komplett-konzept.de

Stand: 23.10.2026 · betrifft nur die **Projektplanung** (`projektplanung/`),
nicht die anderen Apps im Repo.

Die App selbst speichert auf Vercel **nichts**. Alle Daten liegen in Supabase
(Login, Suchverlauf, Einstellungen, Rechnungsdateien) und in PlentyONE
(Kategorien, Artikel). Vercel hostet nur den Code. Ein Umzug ist deshalb
unkritisch — es geht im Kern um die Umgebungsvariablen und die URL.

---

## Welcher Weg?

| | Weg | Kosten | Aufwand | URL bleibt |
|---|---|---|---|---|
| **1** | E-Mail des bestehenden Vercel-Kontos ändern | 0 € | 2 Min. | ✅ |
| **2** | Pro-Team anlegen + Projekt übertragen | 20 $/Monat | 15 Min. | ✅ |
| **3** | Neues Projekt im neuen Konto anlegen | 0 € | ~20 Min. | ⚠️ siehe 3.3 |

**Empfehlung:** Weg 1, wenn das heutige Vercel-Konto nur für diese App benutzt
wird — der einfachste und sauberste Schnitt. Sonst Weg 3.

---

## Weg 1 — E-Mail des Kontos umstellen

Nur sinnvoll, wenn in dem Konto **keine anderen Projekte** liegen, die beim
bisherigen Inhaber bleiben sollen (sie würden mitwandern).

1. Vercel → oben rechts Avatar → **Settings** → **General**
2. Feld **Email** auf `info@komplett-konzept.de` ändern, Bestätigungsmail in
   diesem Postfach anklicken.
3. Falls der Login über GitHub läuft: unter **Settings → Authentication**
   zusätzlich Login per E-Mail/Passwort einrichten, damit der Zugang nicht am
   alten GitHub-Konto hängt.

Danach ist alles unverändert: URL, Umgebungsvariablen, Git-Anbindung,
Deployment-Historie. Kein Downtime, kein Neu-Deploy.

---

## Weg 2 — Projekt übertragen (Vercel-Transfer)

Vercel überträgt Projekte **ohne Downtime** und nimmt Deployments,
Umgebungsvariablen, Domains/Aliasse, Git-Anbindung und Einstellungen mit.
Nicht mit übertragen werden Integrations, Logs und Monitoring-Daten.

Voraussetzung laut Vercel: man muss **Owner** des abgebenden Teams **und
Mitglied** des Zielteams sein. Mitglieder gibt es erst ab **Pro**
(20 $/Nutzer/Monat) — ein kostenloses Hobby-Konto kann keine Mitglieder
aufnehmen, der Transfer funktioniert also nur in ein Pro-Team.

1. `info@komplett-konzept.de` legt bei Vercel ein Konto an, erstellt ein
   **Team** (z. B. `komplett-konzept`) und geht auf **Settings → Billing →
   Upgrade** (Pro-Trial reicht zum Testen).
2. Im neuen Team: **Settings → Members** → das bisherige Konto als **Member**
   einladen.
3. Im bisherigen Konto: Projekt öffnen → **Settings → General** → ganz unten
   **Transfer Project** → Zielteam wählen → Liste der mitwandernden
   Domains/Variablen prüfen → **Transfer**. Dauert 10 Sekunden bis 10 Minuten.

Hinweis: Vercels **Hobby**-Tarif ist laut Nutzungsbedingungen auf
nicht-kommerzielle Nutzung beschränkt. Für ein Firmenwerkzeug ist Pro der
formal richtige Tarif — das gilt auch für Weg 1 und 3.

---

## Weg 3 — Neues Projekt im neuen Konto (kostenlos)

### 3.1 GitHub-Zugriff klären
Das Repo ist `akheyo/youman-automation`. Das Vercel-Konto von
`info@komplett-konzept.de` braucht Leserechte darauf, sonst lässt sich das
Projekt nicht verbinden. Zwei Möglichkeiten:
- den GitHub-Account des neuen Vercel-Logins als **Collaborator** im Repo
  hinzufügen (GitHub → Repo → Settings → Collaborators), **oder**
- das Repo an die Firma übertragen (GitHub → Settings → Transfer ownership) —
  dann hängt auch der Code nicht mehr am Privatkonto.

### 3.2 Projekt anlegen
1. Vercel (neues Konto) → **Add New → Project** → Repo `youman-automation`
   importieren.
2. **Wichtig: Root Directory = `projektplanung`** setzen. Im Repo-Root liegt
   eine andere App (`youman-automation`) mit eigener `vercel.json`; ohne diese
   Einstellung wird die falsche gebaut.
3. Framework Next.js (erkennt Vercel selbst), Build Command und Output auf
   Standard lassen.
4. Die Variablen aus 3.4 für **Production** eintragen (Preview nur, wenn
   Vorschau-Deployments genutzt werden).
5. **Deploy**.

### 3.3 URL `projektplanungkk.vercel.app` übernehmen
**So entschieden:** die Adresse bleibt, die kurze Unterbrechung wird in Kauf
genommen. Eine `*.vercel.app`-Adresse kann nur **ein** Projekt belegen, also:

1. Das neue Projekt zuerst unter einem Zwischennamen anlegen und vollständig
   testen (z. B. `projektplanung-neu` → `projektplanung-neu.vercel.app`).
2. Erst wenn es läuft: im **alten** Konto **Settings → General → Project Name**
   auf `projektplanungkk-alt` ändern.
3. Sofort danach im **neuen** Konto den Namen auf `projektplanungkk` setzen.

Zwischen 2. und 3. ist die gewohnte Adresse ein paar Minuten nicht erreichbar —
deshalb am besten außerhalb der Arbeitszeit umschalten. Das alte Projekt erst
löschen, wenn das neue ein paar Tage sauber läuft; bis dahin ist es die
Rückfalloption.

### 3.4 Umgebungsvariablen
Die aktuellen Werte stehen im alten Konto unter **Settings → Environment
Variables** (Auge-Symbol zum Einblenden) oder lassen sich ziehen:

```bash
npx vercel login          # mit dem ALTEN Konto
npx vercel link           # das alte Projekt wählen
npx vercel env pull .env.umzug.local --environment=production
```

Ins neue Projekt schiebt sie das beiliegende Skript, damit zwei Dutzend
Felder nicht von Hand abgetippt werden müssen:

```bash
npx vercel logout && npx vercel login    # NEUES Konto
npx vercel link                          # neues Projekt wählen
./scripts/env-uebertragen.sh .env.umzug.local production
```

Es legt nur an und löscht nichts; was im Ziel schon existiert, bleibt
unangetastet und wird am Ende aufgelistet. Danach einmal neu deployen.

Die Datei `.env.umzug.local` enthält Klartext-Zugangsdaten — nach dem
Übertragen löschen. Committen kann sie nicht werden (`.env*.local` steht in
`.gitignore`).

**Projektplanung (Kern):**

| Variable | Pflicht | Bemerkung |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ja | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ja | ebenda |
| `SUPABASE_SERVICE_ROLE_KEY` | ja | **geheim**; für Rechnungs-Ablage und als Ersatzschlüssel des Einstellungs-Tresors (siehe „Zugangsdaten"). Im Supabase-Dashboard erst *einblenden*, dann kopieren — maskiert kopierte Schlüssel (`•`) lassen den Upload scheitern |
| `PLENTY_BASE_URL` | ja | Shop-URL ohne Slash am Ende |
| `PLENTY_USER` | ja | Plenty-REST-Benutzer |
| `PLENTY_PASSWORD` | ja | **geheim** |
| `PLENTY_ID` | ja | meist `0` |
| `PLENTY_PROJEKTE_CATEGORY_ID` | ja | ID der Elternkategorie „Projekte" |
| `PLENTY_EAN_BARCODE_ID` | ja | ID der EAN13-Barcode-Konfiguration |
| `PLENTY_EAN_PREFIX` | nein | Standard `20` |
| `PLENTY_INVOICE_PROPERTY_ID` | ja | ID der Datei-Eigenschaft „Dokument 1" |
| `PLENTY_INVOICE_PROPERTY_NAME` | nein | Standard `Dokument 1` |
| `PLENTY_UI_UPLOAD` | nein | `1` = an (Standard), `0` = Datei-Upload abschalten |

**Erfassung / Durchlauf bis Plenty** (nur nötig, wenn diese Funktionen genutzt
werden; fehlt etwas, bricht die Kette an der Stelle ab und sagt das):

| Variable | Bemerkung |
|---|---|
| `ANTHROPIC_API_KEY` | **geheim**; Bilderkennung der Fotos |
| `ERFASSUNG_WEBHOOK_URL` | optionaler Anstoß für die Verarbeitung |
| `EINSTELLUNGEN_SCHLUESSEL` | **geheim**; verschlüsselt gespeicherte Passwörter. Fehlt sie, wird der Service-Role-Key benutzt — siehe „Zugangsdaten" |
| `PLENTY_ANLAGE_CLIENT_ID` | Mandant des angelegten Artikels; leer = `PLENTY_ID` |
| `PLENTY_SALES_PRICE_EBAY_ID` | Preisliste eBay |
| `PLENTY_SALES_PRICE_WEBSHOP_ID` | Preisliste Webshop |
| `PLENTY_SAMMEL_CATEGORY_ID` | Auffangkategorie; Pflicht für die Artikelanlage |
| `PLENTY_WAREHOUSE_ID` | Lager für den Bestand |
| `PLENTY_MARKET_IDS` | Referrer-IDs, Standard `103.00,0.00` |
| `PLENTY_VERSANDPROFILE` | Zuordnung Versandkosten → Profil-ID |
| `SHOP_BASIS_URL` | Basis-Adresse für JSON-LD |

Erläuterungen zu jeder Variable stehen in [`.env.example`](./.env.example) —
dort ist der Stand immer aktuell, diese Tabelle ist eine Momentaufnahme.

Der Plenty-Benutzer braucht **Administrator-Rechte** (mindestens
`setup.property.relation.value.create` / `.update`), sonst wird die Rechnung
nicht an den Artikel gehängt.

### 3.5 Abnahme
1. Neue URL öffnen, **Strg+F5**.
2. Unten muss der Build-Marker stehen (aktuell `v1.7`).
3. Anmelden, Testprojekt mit Rechnung anlegen.
4. In Plenty prüfen: `Projekte → Firma Ort → Firma Ort Datum → Artikel`,
   mit EAN-13 und der Rechnung in „Dokument 1".
5. Suchverlauf prüfen — die Einträge kommen aus Supabase und sind unverändert.

---

## Was NICHT mitzieht

- **Supabase** (Login-Konten, Suchverlauf, Einstellungen, Bucket `rechnungen`)
  liegt in einem eigenen Konto. Solange die drei Supabase-Variablen gleich
  bleiben, nutzt die neue Vercel-Instanz dieselbe Datenbank — das
  Supabase-Projekt selbst gehört aber weiter dem bisherigen Inhaber. Soll auch
  das wechseln: Supabase → Organization Settings → Mitglied einladen bzw.
  Transfer. Separater Schritt, an der App ändert sich nichts.
- **PlentyONE** ist ohnehin das Firmenkonto — hier ändert sich nichts.
- **GitHub**: der Code liegt in `akheyo/youman-automation`. Soll er der Firma
  gehören, siehe 3.1.

## Zugangsdaten

Beim Umzug werden Plenty-Passwort, Supabase-Service-Key und ggf. der
Anthropic-Key weitergegeben. Sie danach zu erneuern ist sauber — mit **einer
Ausnahme**:

> Der Einstellungs-Tresor verschlüsselt gespeicherte Passwörter mit
> `EINSTELLUNGEN_SCHLUESSEL`, und **falls die Variable nicht gesetzt ist, mit
> dem Service-Role-Key**. Wird der Service-Role-Key gedreht, während er als
> Schlüssel dient, sind die in der Datenbank gespeicherten Passwörter nicht
> mehr lesbar. Die Oberfläche meldet das verständlich, man muss sie dann
> einmal neu eintragen.

Sauberer Ablauf: zuerst `EINSTELLUNGEN_SCHLUESSEL` setzen (ein langes
Zufallsgeheimnis), Passwörter in den Einstellungen einmal neu speichern, und
erst danach den Supabase-Service-Key rotieren.
