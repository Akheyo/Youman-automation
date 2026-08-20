---
name: seo-adept
description: Prüfregeln und Prüfskripte für die Suchmaschinentauglichkeit, Auszeichnung und Barrierefreiheit der adept&-Website. Immer verwenden, sobald an dieser Website etwas geändert wird, das im ausgelieferten HTML landet, also bei neuen oder geänderten Seiten, Texten, Überschriften, Titeln, Beschreibungen, Bildern, Verweisen, strukturierten Daten, robots-Angaben oder der Sitemap. Auch verwenden, wenn nach SEO, Indexierung, Google, Sichtbarkeit, Meta-Angaben, Rich Results, Barrierefreiheit oder Ladeverhalten gefragt wird, und vor jedem Commit, der Seiteninhalte betrifft.
---

# SEO und Auslieferungsqualität der adept&-Website

Diese Website hat eine Eigenart, die den Umgang mit ihr bestimmt: Fast alles
Sichtbare entsteht aus Daten. Titel, Beschreibungen, strukturierte Daten,
Bilder und die Navigation werden aus `src/data/*.ts` erzeugt. Ein Tippfehler
in einer Datendatei schlägt deshalb auf mehreren Seiten gleichzeitig durch,
und eine Prüfung gegen den Quelltext übersieht ihn. **Geprüft wird immer
gegen das gebaute HTML in `adept-website/dist`, nie gegen die Quelle.**

## Der Ablauf

```bash
cd adept-website && npm run build && cd ..
node .claude/skills/seo-adept/scripts/statisch.mjs adept-website/dist
```

Das Skript gibt eine Übersicht aller Seiten mit Titel- und
Beschreibungslängen aus, darunter die Befunde. Rückgabewert 0 heißt sauber,
1 heißt es gibt etwas zu tun. Es braucht keinen Vorschauserver und keine
zusätzlichen Pakete.

Für die Prüfungen, die einen Browser brauchen, siehe `references/browser.md`:
waagerechter Überlauf, axe-core und die Kontrolle, dass die Seite nichts von
Dritten nachlädt.

## Die Falle, in die diese Prüfung selbst zweimal getappt ist

Ältere Fassungen bekamen die Seitenliste als Argument. Lief der Aufruf im
falschen Verzeichnis oder war die Liste leer, meldeten sie **"keine
Befunde" bei null geprüften Seiten**. Das sieht aus wie ein bestandener
Test und ist keiner.

Das Skript sucht die Seiten deshalb selbst und bricht mit einem Fehler ab,
wenn es keine findet. Beim Lesen der Ausgabe gilt trotzdem: **zuerst auf die
Zahl der geprüften Seiten schauen, dann auf die Befunde.** Dieselbe Skepsis
gehört zu jedem Prüfwerkzeug, das hier dazukommt.

## Was geprüft wird und warum

**Titel, höchstens 60 Zeichen.** Google schneidet in der Ergebnisliste etwa
dort ab, und was zuerst wegfällt, ist das Ende, also der Firmenname. Der
Titel im Browser-Tab darf kürzer sein als die Überschrift auf der Seite;
`Base.astro` nimmt dafür die Eigenschaft `title`, die Überschrift steht im
`PageHeader`. Diese Trennung ist Absicht und kein Versehen.

**Beschreibung, 70 bis 165 Zeichen.** Unter 70 wertet Google sie oft als zu
dünn und schreibt sich lieber selbst eine aus dem Seitentext. Über 165 wird
abgeschnitten. Beim Kürzen also nicht einfach Wörter streichen, sondern
umformulieren.

**Keine doppelten Titel, Beschreibungen oder h1.** Zwei Seiten, die sich für
eine Suchmaschine gleich anhören, konkurrieren miteinander. Verglichen wird
nur unter den indexierbaren Seiten; was auf noindex steht, darf sich ähneln.

**Genau eine h1, keine übersprungenen Stufen.** Ein Sprung von h1 auf h3
klingt im Screenreader wie eine Lücke. Steht dieselbe Überschrift schon als
h1 der Seite, gehört die Zwischenstufe trotzdem hin, dann eben mit
`class="sr-only"`.

**canonical absolut und auf https.** Ein relativer Wert wird von manchen
Diensten stillschweigend ignoriert. `configure-pages` meldet solange http,
bis in den GitHub-Einstellungen "Enforce HTTPS" aktiv ist; deshalb erzwingt
`astro.config.mjs` das Schema selbst.

**og:image absolut.** Relative Pfade funktionieren in OpenGraph nicht. Jede
Seite sollte ein eigenes Bild bekommen, das ist deutlich klickstärker als
überall dasselbe.

**Strukturierte Daten müssen gültiges JSON sein und `@type` tragen.** Leere
oder erfundene Felder sind schlechter als fehlende. `datePublished` bleibt
weg, solange kein freigegebenes Datum vorliegt.

**Kein Verweis ins Leere.** Geprüft werden alle `href="/..."` gegen die
tatsächlich gebauten Dateien.

**Sitemap und noindex dürfen sich nicht widersprechen.** Eine Adresse in der
Sitemap bittet um Aufnahme, ein noindex verbietet sie. Die Search Console
meldet das als "Übermittelte URL als noindex gekennzeichnet". Steht die
ganze Seite auf noindex, darf es gar keine Sitemap geben.

**Keine Gedankenstriche im sichtbaren Text.** Das ist eine Vorgabe des
Kunden, keine SEO-Regel, aber sie gehört in dieselbe Prüfung, weil sie sich
beim Schreiben sonst immer wieder einschleicht. Statt `–` einen Doppelpunkt,
ein Komma oder das Wort "und" setzen.

**Bilder brauchen alt.** Die Alternativtexte stehen zentral in
`src/data/images.ts`, damit dasselbe Bild überall gleich beschrieben wird.

## Der Schalter für die Indexierung

`src/data/sichtbarkeit.ts` entscheidet, ob die Seite überhaupt in Suchmaschinen
darf. Steht er auf gesperrt, trägt jede Seite noindex, es entsteht keine
Sitemap, und `robots.txt` nennt keine.

Bewusst steht dort **kein `Disallow: /`**. Ein Disallow verbietet nur das
Abrufen, nicht die Aufnahme in den Index: Google listet eine gesperrte Adresse
trotzdem, wenn irgendwo ein Verweis darauf zeigt, dann eben ohne Inhalt. Und
weil die Seite nicht abgerufen werden darf, bekommt die Suchmaschine das
noindex nie zu sehen. Wer die Sperre "verstärken" will, indem er ein Disallow
ergänzt, erreicht das Gegenteil.

## Beim Schreiben neuer Seiten

Die Reihenfolge, die Arbeit spart: erst den Text schreiben, dann Titel und
Beschreibung daraus ableiten, dann bauen und prüfen. Wer Titel und
Beschreibung zuerst festlegt, formuliert sie meist zweimal.

Ein neuer Beitrag oder eine neue Branche braucht:

- einen Eintrag in der passenden Datei unter `src/data/`
- eine Seite, die `Base` mit `title`, `description`, `bild`, `breadcrumb`
  und bei redaktionellen Beiträgen `artikel` versorgt
- ein Bild im Register, wenn es eines gibt; fehlt es, rendert `<Bild>` eine
  gestaltete Fläche statt eines kaputten Symbols
- einen Eintrag in `src/data/navigation.ts`, falls die Seite in der
  Navigation auftauchen soll

## Nach dem Freischalten

Wird die Seite freigegeben, gehört in die Google Search Console die Sitemap
unter `sitemap-index.xml` eingereicht. Ohne das dauert die Aufnahme Wochen
statt Tage. Der Bericht "Seiten" zeigt danach, welche Adressen Google
tatsächlich aufgenommen hat und welche nicht.
