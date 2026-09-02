# Entwurfs-Vorschau

`sapore-grill.html` ist eine eigenstaendige Fassung der Seite unter
`/sapore-grill` — eine einzelne Datei ohne Server, damit sich der Entwurf
ansehen und weitergeben laesst, bevor die Anwendung irgendwo laeuft.

Aufrufen laesst sie sich auf drei Wegen:

1. **Im Browser oeffnen** — Datei herunterladen und per Doppelklick oeffnen.
2. **Ueber GitHub rendern** — <https://htmlpreview.github.io/?https://github.com/Akheyo/Youman-automation/blob/claude/website-bauen-gma34d/preview/sapore-grill.html>
3. **Ueber GitHub Pages** — sobald Pages fuer diesen Branch aktiv ist, liegt sie
   unter `<pages-url>/preview/sapore-grill.html`.

## Unterschiede zur echten Seite

Die Gestaltung, die Texte und die Bedienung sind identisch. Zwei Dinge fehlen,
weil die Vorschau ohne Server auskommen muss:

- Abgeschickte Bestellungen werden **nicht uebermittelt**. Die Vorschau zeigt
  nur die Bestaetigung mit einer Beispiel-Bestellnummer.
- Statt der eingebundenen Karte steht ein Feld mit der Adresse und einem Link
  zur Routenplanung.

Die Datei wird **nicht automatisch** aus dem Anwendungscode erzeugt. Wird an der
Seite unter `app/sapore-grill/` etwas geaendert, laeuft die Vorschau irgendwann
auseinander — dann entweder neu erzeugen lassen oder diesen Ordner loeschen,
sobald die Anwendung erreichbar deployt ist.
