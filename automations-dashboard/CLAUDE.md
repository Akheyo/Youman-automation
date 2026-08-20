# Automations-Dashboard – Komplett Konzept

Interne Software, mit der Amanuel Kheyo und rund 25 Kolleginnen und Kollegen alle
Automationen des Unternehmens an einer Stelle im Blick haben.

Alles auf Deutsch, mit Umlauten. Keine englischen Fachbegriffe in der Oberfläche.
In Texten und Nachrichten keine Gedankenstriche als Satztrenner verwenden.

---

## Was schon fertig ist

Die Datenbank steht komplett in Supabase und wird alle 10 Minuten automatisch
mit PlentyONE abgeglichen. Das Dashboard ist der letzte fehlende Baustein.

**Supabase Projekt:** `cmijgibhncndxipfrtxl`
**URL:** `https://cmijgibhncndxipfrtxl.supabase.co`

Schlüssel liegen NICHT in diesem Dokument. Der publishable Key gehört in
`.env.local` als `VITE_SUPABASE_ANON_KEY`, der secret Key darf niemals ins
Frontend.

---

## Datenmodell

### Dashboard-Tabellen

**`profiles`** – Mitarbeiter mit Zugang. Hängt an `auth.users`.
| Spalte | Typ | Bedeutung |
|---|---|---|
| id | uuid | = auth.users.id |
| full_name | text | Anzeigename |
| email | text | |
| role | enum | `viewer` (schaut zu), `operator` (darf steuern), `admin` (darf alles) |
| active | boolean | |

**`automations`** – eine Zeile pro Automation.
| Spalte | Typ | Bedeutung |
|---|---|---|
| id | uuid | |
| name | text | |
| description | text | |
| category | text | z.B. Marktplätze, Versand, Stammdaten |
| status | enum | `running`, `stopped`, `error`, `paused` |
| responsible_id | uuid → profiles | wer ist zuständig |
| schedule_cron | text | Cron-Ausdruck |
| next_run_at / last_run_at | timestamptz | |
| n8n_workflow_id, n8n_instance | text | für spätere Anbindung |
| is_active | boolean | |

**`automation_runs`** – ein Eintrag pro Durchlauf.
| Spalte | Typ | Bedeutung |
|---|---|---|
| id | uuid | |
| automation_id | uuid → automations | |
| status | enum | `running`, `success`, `error`, `cancelled` |
| started_at / finished_at | timestamptz | |
| duration_seconds | int | wird automatisch berechnet |
| items_total / items_success / items_failed | int | was verarbeitet wurde |
| triggered_by | uuid → profiles | null = automatisch |
| trigger_type | text | `schedule`, `manual`, `retry` |
| error_message_readable | text | **Klartext auf Deutsch, das zeigt das Dashboard** |
| error_message_raw | text | technische Meldung, nur aufklappbar zeigen |
| raw_log_url | text | Sprung zurück nach n8n / PlentyONE |

**`automation_errors`** – gesammelte Fehleransicht.
| Spalte | Typ | Bedeutung |
|---|---|---|
| id | uuid | |
| automation_id, run_id | uuid | |
| severity | enum | `kritisch`, `hoch`, `mittel`, `niedrig` |
| status | enum | `open`, `in_progress`, `resolved` |
| title | text | kurze Zusammenfassung |
| message_readable | text | Klartext |
| assigned_to | uuid → profiles | |
| acknowledged_at / acknowledged_by | | „kümmere ich mich drum" |
| resolved_at / resolved_by | | „abgehakt" |

**`control_commands`** – jeder Klick auf einen Steuerknopf landet hier.
| Spalte | Typ | Bedeutung |
|---|---|---|
| automation_id, run_id | uuid | |
| action | enum | `start`, `stop`, `run_now`, `retry`, `cancel` |
| status | enum | `pending`, `accepted`, `done`, `failed` |
| requested_by | uuid → profiles | |
| requested_at / processed_at | timestamptz | |

**Wichtig:** Die Automationen selbst sind noch nicht angebunden. Die Knöpfe im
Dashboard schreiben nur eine Zeile in `control_commands`. Ein späterer Worker
arbeitet die ab. Die Knöpfe sollen aber schon jetzt wirken und ihre Wirkung in
der Oberfläche zeigen, damit später nur noch angeschlossen werden muss.

**`audit_log`** – wer hat wem Zugang gegeben oder entzogen.

### Fertige Views

- `v_dashboard_summary_24h` – Durchläufe gesamt / erfolgreich / fehlerhaft / laufend
- `v_reliability_trend_14d` – Erfolgsquote pro Tag, letzte 14 Tage
- `v_open_errors_ranked` – offene Fehler, schlimmste zuerst
- `v_automation_overview` – pro Automation: Zuverlässigkeit 14 Tage, offene Fehler, Zuständiger

**Diese Views benutzen, nicht selbst zusammenrechnen.**

### Plenty-Artikeldaten (bereits befüllt und laufend aktuell)

- `plenty_variationen` – 39.930 Zeilen, nur Artikel mit Bestand. Artikelnummer,
  EAN, Bestand netto/physisch/reserviert, Bestand je Lager, Preise, Gewicht.
- `plenty_artikeltexte` – 65.614 Zeilen. Titel, Beschreibung, Meta-Title,
  Meta-Description, Meta-Keywords, Bilder.

  **Bilder ist kein einfaches Array von Adressen.** Es ist ein Array von
  Objekten, eines je Bild, mit drei Größen und einer Reihenfolge:

  ```json
  [{ "gross": "...", "mittel": "...", "vorschau": "...", "position": 0 }]
  ```

  Zum Anzeigen nach `position` sortieren, das Bild mit `position` 0 ist das
  Hauptbild. Je nach Zweck `vorschau`, `mittel` oder `gross` nehmen. Ein
  Eintrag aus dem Array ist nie selbst eine Adresse.
- `v_artikel_komplett` – beides zusammengeführt, **diese View verwenden**.
- `plenty_sync_state` – Fortschritt und letzter Fehler des Abgleichs.

---

## Rechte

Drei Stufen, über `profiles.role`:

| Rolle | darf |
|---|---|
| `viewer` | alles ansehen, nichts steuern. Die meisten. |
| `operator` | zusätzlich steuern und Fehler abhaken |
| `admin` | zusätzlich Zugänge vergeben und entziehen. Nur Amanuel Kheyo. |

Row Level Security ist in Supabase bereits eingerichtet. Im Frontend die
Rolle zusätzlich prüfen, damit Knöpfe für viewer sichtbar aber deaktiviert sind,
mit erklärendem Hinweis statt stiller Sperre.

---

## Gestaltung

**Farben** (aus dem Logo abgeleitet, bei Amanuel gegenprüfen):

```
Hintergrund      #0A111E
Fläche           #121C2D
Fläche erhöht    #18243A
Rand             #243247
Blau  = alles ok #2C7BE5
Gelb  = hinschauen #F5B301
Rot   = kaputt   #E23A2E
Text             #E9EFF7
Text leise       #8698B2
```

**Bewusst kein Grün.** Blau übernimmt die Rolle von „in Ordnung", damit die
Oberfläche in den Firmenfarben bleibt.

**Der Zustandsbalken ganz oben ist das Kernstück.** Ein breiter Streifen, der in
einem deutschen Satz sagt, ob alles in Ordnung ist. Blau: „Alles in Ordnung".
Gelb: „Läuft, aber etwas wartet auf dich". Rot: „Es gibt ein Problem". Auch wer
zum ersten Mal draufschaut, versteht die Lage ohne eine Zahl zu lesen.

Dunkel, ruhig, sachlich. Muss auf dem Handy funktionieren, Amanuel sitzt nicht
immer am Schreibtisch.

---

## Was die Oberfläche zeigen muss

**Sofort beim Öffnen:**
- Welche Automationen laufen, stehen, haben ein Problem
- Was gerade in diesem Moment läuft
- Durchläufe der letzten 24 Stunden und wie viele davon erfolgreich waren
- Wie viele Fehler offen sind
- Ob es in den letzten zwei Wochen besser oder schlechter geworden ist

**Pro Automation aufklappbar:**
wann zuletzt gelaufen, wann das nächste Mal dran, wie zuverlässig, wer zuständig

**Pro Durchlauf:**
Start, Dauer, verarbeitete Menge, und bei Fehlern der Grund in verständlichem
Deutsch. Die technische Meldung nur aufklappbar darunter.

**Fehler:**
Eigener Bereich, schlimmste zuerst. Ein Fehler lässt sich übernehmen
(„Kümmere ich mich drum") und abhaken. Von jedem Fehler direkt zur Automation
springen, wo er entstanden ist.

**Steuern:**
Anhalten, wieder anschalten, sofort starten, fehlgeschlagenen Durchlauf
wiederholen, laufenden abbrechen.

**Nachvollziehbarkeit:**
Wer etwas gesteuert hat, ist sichtbar. Nicht zur Kontrolle, sondern damit man
später sagen kann, woran es lag.

---

## Sprache in der Oberfläche

Knöpfe sagen, was passiert, nicht was das System tut.

| gut | schlecht |
|---|---|
| Anhalten | Deaktivieren |
| Jetzt sofort starten | Manuell triggern |
| Nochmal versuchen | Retry |
| Kümmere ich mich drum | Zuweisen |
| Erledigt | Als resolved markieren |
| Läuft gerade | Running |
| Fehlgeschlagen | Failed |
| Angehalten | Paused |

Fehlermeldungen erklären, was los ist und was hilft. Nicht entschuldigen, nicht
vage bleiben. Beispiel: „Amazon hat die Anmeldung abgelehnt. Der Zugangsschlüssel
ist abgelaufen und muss im Seller Central neu erzeugt werden."

Leere Zustände sind eine Einladung zu handeln, keine Stimmungsbilder.
Beispiel: „Noch nichts gelaufen. Mit ‚Jetzt sofort starten' kannst du den ersten
Durchlauf anstoßen."

---

## Technik

- React mit Vite
- Supabase JS Client (`@supabase/supabase-js`)
- Login über Supabase Auth, Rolle aus `profiles` nachladen
- Deployment auf Vercel
- Realtime von Supabase für laufende Durchläufe ist sinnvoll, aber optional

Es gibt bereits einen Prototyp der Oberfläche als einzelne React-Datei mit
Beispieldaten. Er zeigt Aufbau, Farben und Sprache. Er nutzt bewusst keine
Browser-Speicherung, das kann im echten Projekt ersetzt werden.

---

## Reihenfolge

1. Login und Rollen
2. Übersicht mit Zustandsbalken und Kennzahlen
3. Automationsliste mit Aufklappen
4. Fehlerbereich
5. Steuerknöpfe, die nach `control_commands` schreiben
6. Protokoll
7. Zugangsverwaltung für den Admin

Die Automationen selbst kommen erst danach dran.
