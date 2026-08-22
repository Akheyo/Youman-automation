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

Führe `make-anbinden.sql` im SQL-Editor von Supabase aus. Das ist alles. Danach
brauchst du für kein weiteres Szenario mehr eine einzige Zeile SQL.

---

## Die Verbindung in Make

In jedem Szenario zwei HTTP-Bausteine, beide mit denselben Einstellungen:

- Modul: **HTTP → Make a request**
- Method: `POST`
- Body content type: `application/json`
- Parse response: `Yes`
- Return error if HTTP request fails: `Yes`
- Headers:
  | Name | Wert |
  |---|---|
  | `apikey` | dein **secret** Schlüssel aus Supabase |
  | `Authorization` | `Bearer ` und derselbe Schlüssel |

**Der secret Schlüssel gehört ausschließlich hierher.** Nicht ins Dashboard,
nicht in GitHub, nicht in eine Nachricht. Make läuft auf einem Server, dort ist
er richtig aufgehoben.

---

## Melden

Der Aufbau ist in jedem Szenario derselbe:

```
Auslöser  →  [lauf_start_make]  →  deine Arbeit  →  [lauf_ende]
                                                 ↘  Fehlerzweig → [lauf_ende]
```

### Ganz am Anfang, direkt hinter den Auslöser

- URL: `https://cmijgibhncndxipfrtxl.supabase.co/rest/v1/rpc/lauf_start_make`
- Request content:

```json
{
  "szenario": "{{scenario.id}}",
  "wie_heisst_es": "{{scenario.name}}",
  "bereich": "Stammdaten"
}
```

**Dieser Block ist in jedem Szenario gleich.** `{{scenario.id}}` und
`{{scenario.name}}` füllt Make selbst aus. Du musst also nichts heraussuchen
und nichts anpassen, außer dem Bereich, falls du einen anderen willst.

Kennt das Dashboard das Szenario noch nicht, trägt es die Automation beim
ersten Durchlauf selbst ein. Beschreibung und Zeitplan kannst du danach in
Ruhe nachtragen. Benennst du die Automation im Dashboard um, bleibt der neue
Name erhalten, auch wenn das Szenario in Make weiter anders heißt.

Zurück kommt die Nummer des Durchlaufs. Die brauchst du gleich wieder.

### Ganz am Ende jedes Zweigs

- URL: `https://cmijgibhncndxipfrtxl.supabase.co/rest/v1/rpc/lauf_ende`
- Request content:

```json
{
  "lauf": "{{1.data}}",
  "erfolg": true,
  "gesamt": 120,
  "in_ordnung": 118,
  "nicht_geklappt": 2
}
```

`{{1.data}}` ist die Ausgabe des ersten Bausteins, die Nummer musst du an die
deines Szenarios anpassen. Lass das Szenario einmal laufen, dann erscheint das
Feld in der Zuordnungsliste und du kannst es dort anklicken.

Die Zahlen kommen aus deinem Szenario. Hast du keine, lass sie einfach weg.

### Wenn etwas schiefgeht

Rechtsklick auf den ersten Baustein → **Add error handler** → dort derselbe
Aufruf auf `lauf_ende`, nur mit `"erfolg": false` und einer Erklärung:

```json
{
  "lauf": "{{1.data}}",
  "erfolg": false,
  "gesamt": 120,
  "in_ordnung": 40,
  "nicht_geklappt": 80,
  "klartext": "Amazon hat die Anmeldung abgelehnt. Der Zugangsschlüssel ist abgelaufen und muss im Seller Central neu erzeugt werden.",
  "technisch": "{{error.message}}"
}
```

`klartext` ist der Satz, den deine Kollegen im Dashboard lesen. Also auf
Deutsch und so, dass daraus hervorgeht, was jetzt zu tun ist. `technisch` ist
die Meldung von Make selbst, die steht im Dashboard nur zum Aufklappen.

Bei `"erfolg": false` legt das Dashboard automatisch einen Eintrag im
Fehlerbereich an, den jemand übernehmen und abhaken kann.

**Ohne diesen Zweig bleibt bei jedem Abbruch ein Durchlauf für immer auf
"läuft gerade" stehen.** Er ist keine Kür.

---

## Ein weiteres Szenario anschließen

1. Die beiden HTTP-Bausteine aus einem fertigen Szenario kopieren
2. Im neuen Szenario einfügen, den ersten hinter den Auslöser, den zweiten
   ans Ende
3. Beim zweiten Baustein die Nummer in `{{1.data}}` auf den ersten Baustein
   des neuen Szenarios anpassen
4. Fehlerzweig anhängen

Kein SQL, keine ID, kein Eintrag im Dashboard. Beim ersten Durchlauf taucht
die neue Automation von selbst auf.

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
