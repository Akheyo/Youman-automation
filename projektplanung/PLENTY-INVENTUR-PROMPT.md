# Auftrag: vollständige Inventur des PlentyONE-Mandanten (nur lesend)

Du hast Zugriff auf PlentyONE über die REST-API. Bitte sieh im System nach und
erstelle daraus einen vollständigen Auszug. Das Ergebnis wird in die technische
Dokumentation eines bestehenden Projekts übernommen — es muss deshalb belegbar
sein, nicht geschätzt.

## Mandant

- plentyId **14443**, Shop `besttra.de`
- REST-Basis: `https://p14443.my.plentysystems.com` (die Pfade unten daran hängen,
  das `/rest` ist in den Pfaden schon enthalten)

## Harte Regeln

1. **Nur lesend.** Kein POST, kein PUT, kein DELETE — kein einziger. Diese
   Inventur darf im Live-System nichts verändern.
2. **Keine personenbezogenen Daten ausgeben.** Bei Aufträgen, Kontakten und
   Zahlungen interessieren mich Anzahl, Feldnamen und Statuswerte — **keine**
   Kundennamen, Adressen, E-Mails, Telefonnummern oder Zahlungsdaten. Schreib
   statt eines Beispieldatensatzes die Liste der Feldnamen.
3. **Nicht raten.** Wenn ein Pfad 404 liefert, schreib „gibt es nicht" hin. Wenn
   er 403 liefert, schreib „Benutzer hat kein Recht". Beides ist ein brauchbares
   Ergebnis. Erfinde keine Endpunkte und keine Zahlen, und verschweige keinen
   Fehlschlag.
4. Gib zu **jeder** Zeile den tatsächlich aufgerufenen Pfad und den
   HTTP-Statuscode an.

## Was ich wissen will

### Teil A — Welche Bereiche der API sind überhaupt da?

Ruf der Reihe nach diese Pfade auf (ein GET je Zeile, kleine `itemsPerPage`) und
protokolliere Status, Anzahl (`totalsCount`, falls vorhanden) und die Feldnamen
des ersten Eintrags:

```
/rest/stockmanagement/warehouses?itemsPerPage=50
/rest/stockmanagement/stock?itemsPerPage=1
/rest/items/variations?itemsPerPage=1
/rest/items?itemsPerPage=1
/rest/categories?type=item&itemsPerPage=1
/rest/properties?itemsPerPage=50
/rest/items/barcodes?itemsPerPage=20

/rest/orders?itemsPerPage=1
/rest/orders/status?itemsPerPage=50
/rest/orders/referrers
/rest/orders/types
/rest/orders/documents?itemsPerPage=1
/rest/payments?itemsPerPage=1
/rest/payments/methods
/rest/orders/shipping/presets
/rest/orders/shipping/serviceProviders
/rest/accounts/contacts?itemsPerPage=1

/rest/items/sales_prices?itemsPerPage=20
/rest/items/manufacturers?itemsPerPage=20
/rest/items/units?itemsPerPage=20
/rest/items/attributes?itemsPerPage=20
/rest/items/item_sets?itemsPerPage=5
/rest/availabilities
/rest/properties/groups?itemsPerPage=20

/rest/redistributions?itemsPerPage=1
/rest/reorders?itemsPerPage=1
/rest/stockmanagement/buffer?itemsPerPage=5
/rest/stockmanagement/stock/movements?itemsPerPage=1

/rest/webstores
/rest/markets/orders/referrers
/rest/listings?itemsPerPage=1

/rest/plugins?itemsPerPage=5
/rest/users?itemsPerPage=5
/rest/roles?itemsPerPage=5
/rest/vat
/rest/logs?itemsPerPage=1
```

Ergebnis als Tabelle:

| Bereich | Pfad | HTTP | Anzahl | Feldnamen des ersten Eintrags |

Falls dir weitere Bereiche bekannt sind, die in dieser Liste fehlen: häng sie
unten an, ebenfalls mit Pfad und Status. Die Liste ist nicht als vollständig
behauptet.

### Teil B — Die konkreten IDs, die wir brauchen

Ein bestehendes Projekt schreibt Artikel nach Plenty und braucht dafür feste
IDs. Bitte such sie heraus und nenne sie **einzeln mit Fundstelle**:

1. **Lager:** alle Lager mit `id` und `name`. Welches ist das Hauptlager (Burlo)?
2. **Kategorie „Projekte":** die `id` der Kategorie mit dem Namen „Projekte"
   (`/rest/categories?type=item&...`). Welche direkten Unterkategorien hat sie
   und wie viele?
3. **Barcode-Konfigurationen:** alle aus `/rest/items/barcodes` mit `id`, `name`,
   `type`. Welche ist die EAN13-Konfiguration (gesucht wird die, die im Projekt
   als `EAN13_2` bezeichnet wird)?
4. **Eigenschaften (Properties):** alle mit `id`, `name` (deutsch) und Typ. Gesucht
   ist besonders die Eigenschaft **vom Typ Datei** mit dem Namen „Dokument 1" —
   ihre `id` brauchen wir, um Rechnungen an Artikel zu hängen. Nenne auch, in
   welcher Gruppe sie liegt.
5. **Einheiten:** `/rest/items/units` — welche `unitId` ist „Stück"? (Das Projekt
   hat `unitId: 1` fest verdrahtet; bitte bestätigen oder korrigieren.)
6. **Lagerort-Struktur des Hauptlagers:**
   - `/rest/warehouses/{warehouseId}/locations/dimensions` → welche Spalten gibt
     es (Halle, Regal, Ebene, Feld …), mit welchem Kürzel und Trennzeichen?
   - `/rest/warehouses/{warehouseId}/locations/levels?itemsPerPage=250` → wie
     viele Knoten insgesamt (`totalsCount`)?
   - `/rest/warehouses/{warehouseId}/locations?itemsPerPage=250` → wie viele
     Lagerorte insgesamt? Wie viele davon haben `statusKey`/`purposeKey` welchen
     Wert (bitte je Wert zählen)?
   - Nenne **drei Beispiel-Lagerorte** mit `id`, `label`, `fullLabel`, `levelId`,
     `purposeKey`, `statusKey` — damit wir die Namensform sehen (erwartet wird
     etwas wie `H1/R6/EA F05-K12`).

### Teil C — Mengengerüst

| Was | Wie viele |
| --- | --- |
| Artikel (items) | |
| Varianten | |
| Bestandszeilen (`/rest/stockmanagement/stock`) | |
| Lagerorte | |
| Struktur-Knoten (levels) | |
| Kategorien gesamt | |
| Aufträge gesamt | |
| Aufträge der letzten 30 Tage | |

Nimm jeweils `totalsCount` aus der Antwort, nicht die Länge der ersten Seite.

### Teil D — Auftragswesen genauer

Das Projekt nutzt bisher **keine** Auftragsdaten. Bevor wir das anschließen, will
ich wissen, was da liegt — ohne personenbezogene Inhalte:

1. Alle **Auftragsstatus** mit `statusId` und Bezeichnung (das ist die Liste, die
   man später beim Automatisieren setzt).
2. Alle **Auftragsherkünfte** (referrer) mit `id` und Name — also über welche
   Kanäle Aufträge hereinkommen (eBay, Shop, manuell …), und wie viele Aufträge
   je Herkunft in den letzten 30 Tagen.
3. Alle **Auftragstypen**.
4. Welche **Belegarten** (documents) gibt es, und lässt sich ein Beleg-PDF über
   die API abrufen? Nenne den Pfad, aber lade keine Kundenrechnung herunter.
5. Alle **Zahlungsarten** und **Versandprofile** mit ID und Name.
6. Die **Feldnamen** eines Auftrags (`/rest/orders?itemsPerPage=1`) und einer
   Auftragsposition — nur die Schlüssel, keine Werte.

### Teil E — Rechte des API-Benutzers

Aus den Statuscodes in Teil A: Welche Bereiche antworten mit **403**? Liste sie
auf. Das ist die Liste der Rechte, die dem API-Benutzer noch fehlen.

Zusätzlich, falls erreichbar: Welche Rolle/Rechte hat der verwendete Benutzer
laut `/rest/users` bzw. `/rest/roles`?

## Format der Antwort

Ein zusammenhängendes Markdown-Dokument mit den Überschriften A–E, Tabellen wie
oben vorgegeben, und am Ende ein kurzer Abschnitt:

- **Erreichbar:** n von m Bereichen
- **Ohne Recht (403):** Liste
- **Nicht vorhanden (404):** Liste
- **Auffälligkeiten:** alles, was du beim Nachsehen bemerkt hast und was für
  jemanden wichtig wäre, der auf diesem System automatisiert — etwa doppelte
  Kategorien, Lagerorte ohne sauberen Namen, leere Pflichtfelder, ungewöhnlich
  viele Aufträge in einem Status, abgelaufene Plugins.

Keine Zusammenfassung „im Großen und Ganzen sieht alles gut aus" — ich brauche
die Zahlen und die IDs.
