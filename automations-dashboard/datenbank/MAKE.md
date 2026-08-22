# Eine Automation aus Make.com anschließen

Das Dashboard und Make reden in zwei Richtungen miteinander:

- **Melden.** Make sagt dem Dashboard, wann ein Durchlauf startet, wie er
  ausgegangen ist und wie viel dabei verarbeitet wurde.
- **Steuern.** Das Dashboard sagt Make, dass jemand auf einen Knopf gedrückt
  hat, zum Beispiel auf "Jetzt sofort starten".

Das Melden ist der wichtigere Teil und in zehn Minuten eingerichtet. Das
Steuern kannst du später nachziehen.

---

## Einmal vorbereiten

Führe `make-anbinden.sql` im SQL-Editor von Supabase aus. Danach gibt es fünf
Aufrufe, die Make benutzen kann, statt selbst in den Tabellen herumzuschreiben.

Dann in derselben Datei den auskommentierten Block ganz oben anpassen (Name,
Beschreibung, Bereich, Zeitplan, Nummer des Szenarios) und ausführen. Du
bekommst eine `id` zurück. **Die brauchst du gleich, schreib sie dir auf.**

---

## Die Verbindung in Make

In Make einmalig eine Verbindung anlegen, die alle Bausteine mitbenutzen:

- Modul: **HTTP → Make a request**
- URL-Anfang: `https://cmijgibhncndxipfrtxl.supabase.co/rest/v1/rpc/`
- Method: `POST`
- Body type: `Raw`, Content type: `application/json`
- Headers:
  | Name | Wert |
  |---|---|
  | `apikey` | dein **secret** Schlüssel aus Supabase |
  | `Authorization` | `Bearer ` und derselbe Schlüssel |
  | `Content-Type` | `application/json` |

**Der secret Schlüssel gehört ausschließlich hierher.** Nicht ins Dashboard,
nicht in GitHub, nicht in eine Nachricht. Make läuft auf einem Server, dort ist
er richtig aufgehoben.

---

## Melden

### Ganz am Anfang des Szenarios

- URL: `.../rpc/lauf_start`
- Body:

```json
{ "automation": "HIER-DIE-ID-VON-OBEN", "ausgeloest_durch": "schedule" }
```

Zurück kommt die Nummer des Durchlaufs. Die musst du dir im Szenario merken,
zum Beispiel über eine Variable namens `lauf`.

### Ganz am Ende des Szenarios

- URL: `.../rpc/lauf_ende`
- Body:

```json
{
  "lauf": "{{ lauf }}",
  "erfolg": true,
  "gesamt": 120,
  "in_ordnung": 118,
  "nicht_geklappt": 2
}
```

Die Zahlen kommen aus deinem Szenario. Hast du keine, lass sie einfach weg.

### Wenn etwas schiefgeht

In Make an das Szenario einen **Error handler** hängen und dort denselben
Aufruf machen, nur mit `"erfolg": false` und einer Erklärung:

```json
{
  "lauf": "{{ lauf }}",
  "erfolg": false,
  "gesamt": 120,
  "in_ordnung": 40,
  "nicht_geklappt": 80,
  "klartext": "Amazon hat die Anmeldung abgelehnt. Der Zugangsschlüssel ist abgelaufen und muss im Seller Central neu erzeugt werden.",
  "technisch": "{{ error.message }}"
}
```

`klartext` ist der Satz, den deine Kollegen im Dashboard lesen. Also auf
Deutsch und so, dass daraus hervorgeht, was jetzt zu tun ist. `technisch` ist
die Meldung von Make selbst, die steht im Dashboard nur zum Aufklappen.

Bei `"erfolg": false` legt das Dashboard automatisch einen Eintrag im
Fehlerbereich an, den jemand übernehmen und abhaken kann.

---

## Steuern

Ein Knopfdruck im Dashboard schreibt eine Zeile nach `control_commands`. Damit
Make davon erfährt, gibt es zwei Wege.

### Der einfache Weg: Make schaut nach

Ein zweites, kleines Szenario, das alle paar Minuten läuft:

1. **HTTP** auf `.../rpc/auftrag_abholen` mit
   `{ "automation": "HIER-DIE-ID" }`
2. **Router**: kommt nichts zurück, ist nichts zu tun und das Szenario endet
3. Kommt etwas zurück, steht in `was` einer dieser Werte:
   `start`, `stop`, `run_now`, `retry`, `cancel`.
   Danach dein Hauptszenario auslösen
4. **HTTP** auf `.../rpc/auftrag_erledigt` mit
   `{ "auftrag": "{{ auftrag_id }}" }`

`auftrag_abholen` gibt jeden Auftrag nur einmal heraus. Zwei Szenarien
gleichzeitig können also nicht denselben Auftrag doppelt ausführen.

Nachteil: bis zu ein paar Minuten Verzögerung. Für "Jetzt sofort starten"
fühlt sich das nicht ganz sofort an, reicht aber im Alltag.

### Der schnelle Weg: Supabase ruft Make

Wenn es wirklich sofort gehen soll:

1. In Make im Hauptszenario als Auslöser ein **Custom webhook** einbauen und
   die Adresse kopieren
2. In Supabase unter **Database → Webhooks** einen neuen Webhook anlegen:
   - Tabelle: `control_commands`
   - Ereignis: `Insert`
   - Typ: `HTTP Request`, Methode `POST`
   - URL: die Adresse aus Make
3. Make bekommt die neue Zeile als Nachricht und legt sofort los
4. Am Ende trotzdem `auftrag_erledigt` aufrufen, sonst steht der Auftrag im
   Protokoll für immer auf "wartet auf Ausführung"

---

## Prüfen, ob es klappt

1. Szenario in Make einmal von Hand starten
2. Im Dashboard unter **Automationen** nachsehen: die Automation sollte auf
   "Läuft gerade" springen und danach einen Durchlauf mit Dauer und Menge
   zeigen
3. Im Fehlerfall sollte der Satz aus `klartext` unter **Fehler** stehen

Kommt von Supabase ein Fehler `permission denied for function`, wurde
`make-anbinden.sql` noch nicht ausgeführt oder Make benutzt den falschen
Schlüssel. Für diese Aufrufe geht ausschließlich der **secret** Schlüssel, der
publishable reicht nicht.
