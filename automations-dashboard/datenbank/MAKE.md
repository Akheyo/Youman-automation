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
Auslöser  →  [Variable szenario]  →  [lauf_start_make]  →  deine Arbeit  →  [lauf_ende_make]
                                                                          ↘  Fehlerzweig → [lauf_ende_make]
```

### Die Nummer des Szenarios einmal ablegen

Make stellt die eigene Szenario-Nummer nicht als Baustein-Wert bereit,
`{{scenario.id}}` gibt es also nicht. Damit du die Nummer trotzdem nur an
einer Stelle pflegst, legst du sie ganz vorne in einer Variablen ab:

- Baustein: **Tools → Set variable**, direkt hinter den Auslöser
- Variable name: `szenario`
- Variable value: die Nummer aus der Adresszeile, zum Beispiel bei
  `.../scenarios/4776890/edit` die `4776890`

Ab hier benutzen alle drei HTTP-Bausteine `{{szenario}}`. Für ein weiteres
Szenario änderst du später nur diesen einen Wert.

### Ganz am Anfang, direkt hinter der Variablen

- URL: `https://cmijgibhncndxipfrtxl.supabase.co/rest/v1/rpc/lauf_start_make`
- Request content:

```json
{
  "szenario": "{{szenario}}",
  "wie_heisst_es": "Automation Fotostudio PC 1",
  "bereich": "Stammdaten"
}
```

Die Nummer kommt aus der Variablen. `wie_heisst_es` tippst du einmal aus,
diesen Namen zeigt das Dashboard an. Er wird nur beim allerersten Durchlauf
verwendet: kennt das Dashboard das Szenario noch nicht, trägt es die
Automation damit selbst ein. Benennst du sie später im Dashboard um, bleibt
der neue Name erhalten.

Zurück kommt die Nummer des Durchlaufs. Die brauchst du gleich wieder.

### Ganz am Ende jedes Zweigs

- URL: `https://cmijgibhncndxipfrtxl.supabase.co/rest/v1/rpc/lauf_ende_make`
- Request content:

```json
{
  "szenario": "{{szenario}}",
  "erfolg": true,
  "gesamt": 120,
  "in_ordnung": 118,
  "nicht_geklappt": 2
}
```

**Auch dieser Block greift wieder auf `{{szenario}}` zu.** Er schließt den
Durchlauf ab, der für dieses Szenario gerade offen ist. Du musst also nirgends
eine Modulnummer heraussuchen und nichts von einem Baustein zum anderen
durchreichen.

Die Zahlen kommen aus deinem Szenario. Hast du keine, lass sie einfach weg.

Hat ein Zweig mehrere Enden, kommt der Baustein an jedes Ende. Sonst bleibt
der Durchlauf bei diesem Weg auf "läuft gerade" stehen.

### Wenn etwas schiefgeht

Rechtsklick auf den Baustein, der abbrechen kann → **Add error handler** →
dort derselbe Aufruf auf `lauf_ende_make`, nur mit `"erfolg": false` und einer
Erklärung:

```json
{
  "szenario": "{{szenario}}",
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

Gib auch im Fehlerfall die Zahlen mit, wenn dein Szenario sie kennt. Ist ein
Teil durchgelaufen, stuft das Dashboard den Fehler als "mittel" ein statt als
"hoch".

---

## Ein weiteres Szenario anschließen

1. Das ganze Szenario kopieren, oder die Bausteine markieren, **Strg + C**,
   in ein neues Szenario **Strg + V**
2. Den Variablen-Baustein hinter den Auslöser, `lauf_start_make` dahinter,
   `lauf_ende_make` ans Ende, Fehlerzweig anhängen
3. Im Variablen-Baustein die Nummer auf die des neuen Szenarios ändern
4. In `lauf_start_make` den Namen bei `wie_heisst_es` anpassen

**Das ist alles.** Kein SQL, keine Modulnummer, kein Eintrag im Dashboard. Die
drei HTTP-Bausteine bleiben unangetastet, weil sie nur `{{szenario}}` lesen.
Angefasst wird pro Szenario nur die eine Variable und der Name.

So unterscheiden sich zwei Szenarien für dieselbe Sache, etwa PC 1 und PC 2,
allein durch ihre Nummer und tauchen im Dashboard als zwei getrennte
Automationen auf.

Beim ersten Durchlauf taucht die neue Automation von selbst im Dashboard auf.
Beschreibung, Bereich und Zeitplan kannst du danach in Ruhe nachtragen.

### Wenn ein Szenario mehrfach gleichzeitig läuft

`lauf_ende_make` schließt den Durchlauf ab, der für das Szenario gerade offen
ist. Laufen mehrere Ausführungen desselben Szenarios zur selben Zeit, sind
auch mehrere Durchläufe offen und der Aufruf kann den falschen erwischen.

Make arbeitet ein Szenario normalerweise nacheinander ab, dann kann das nicht
passieren. Lässt du bewusst parallel laufen, nimm stattdessen `lauf_ende` und
gib die Nummer aus dem ersten Baustein mit, zum Beispiel `{{1.data}}`. Dann
ist es eindeutig, dafür musst du die Modulnummer pro Szenario anpassen.

---

## Liegengebliebene Durchläufe

Bricht ein Szenario ab, ohne dass der Fehlerzweig greift, etwa weil Make selbst
ausfällt, bleibt ein Durchlauf auf "läuft gerade" stehen. Im Dashboard sieht
das dann so aus, als würde die Automation ewig arbeiten.

Dagegen gibt es:

```sql
select liegengebliebene_aufraeumen(60);
```

Das schließt alles ab, was länger als 60 Minuten offen ist, mit einer
verständlichen Begründung. Zurück kommt die Anzahl.

Am besten hängst du das in ein kleines Make-Szenario, das stündlich läuft:

- URL: `https://cmijgibhncndxipfrtxl.supabase.co/rest/v1/rpc/liegengebliebene_aufraeumen`
- Request content: `{ "nach_minuten": 60 }`

Die Zahl an deine längste Automation anpassen. Läuft eine davon regelmäßig
zwei Stunden, nimm 180 statt 60, sonst reißt der Aufruf ihr den Durchlauf
unter den Füßen weg.

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
