# Visuelle Prüfung: youman-automation.de

Geprüft wurde der laufende Vorschauserver unter http://localhost:4321 mit Playwright/Chromium
(`executablePath: /opt/pw-browsers/chromium`). Vor jeder Aufnahme wurden alle Elemente mit
`data-reveal` per Skript auf die Klasse `ist-sichtbar` gesetzt und der Browserkontext mit
`reducedMotion: reduce` gestartet; damit steht der Inhalt sofort fest und die Bildfolge im Hero
läuft nicht unkontrolliert mit.

Geprüfte Seiten: Startseite (`/`), Leistungsseite KI-Automationen (`/leistungen/ki-automationen`),
Branchenseite Produktion & Fertigung (`/branchen/produktion-und-fertigung`), Über uns
(`/ueber-uns`), Kontakt (`/kontakt`), Münsterland (`/muensterland`) und die Referenzseite
Absolar-Warenwirtschaft (`/case-studies/absolar-warenwirtschaft`).

Bildschirmfotos liegen unter `/home/user/Youman-automation/youman-automation.de-audit/screenshots/`,
je Seite und Breite als `<seite>-<breite>.png` (ganze Seite, Breiten 1440, 768, 375). Zusätzlich
zwei Aufnahmen des geöffneten Vollbildmenüs: `startseite-375-menue-offen.png` und
`startseite-768-menue-offen.png`.

Ergänzend wurden zwei automatisierte Messungen über alle sieben Seiten gefahren: waagerechter
Überlauf bei 320/375/768/1024/1440 px sowie die Größe aller Bedienelemente (`a`, `button`, `input`,
`summary`) bei 375/768/1440 px. Rohdaten liegen als `results-visual.json` im Arbeitsverzeichnis der
Prüfung vor.

Aus den übrigen Teilberichten dieser Prüfung sind zwei Werte bekannt und werden hier nur eingeordnet,
nicht selbst nachgemessen: axe-core meldet über alle 23 Seiten null Verstöße gegen WCAG 2.1 A/AA, und
der kumulative Layout-Sprung (CLS) liegt auf allen Seiten bei 0,000. Beides passt zu dem Bild, das
die Bildschirmfotos zeigen: ein sehr ruhiger, absichtsvoll gebauter Seitenaufbau ohne nachladende
Schriften oder Bilder, die den Inhalt verschieben.

## Was gut ist

- **Kein waagerechter Überlauf.** Bei keiner der 35 geprüften Kombinationen aus sieben Seiten und
  fünf Breiten (320, 375, 768, 1024, 1440 px) ist `scrollWidth` größer als `clientWidth`. Auf keiner
  Seite entsteht also ein seitliches Scrollen.
- **Kernaussage steht oben.** Auf allen sieben Seiten ist die H1 innerhalb des ersten Bildschirms
  sichtbar, sowohl bei 1440 als auch bei 375 px, ebenso mindestens eine bedienbare Schaltfläche.
  Auf der Startseite steht binnen des ersten Bildschirms bereits der Satz „Wir automatisieren, was
  in Ihrem Betrieb jeden Tag Zeit kostet.“ mit den zwei Schaltflächen „Gespräch vereinbaren“ und
  „Leistungen ansehen“ (`startseite-1440.png`, `startseite-375.png`). Auf den Unterseiten trägt der
  dunkle Seitenkopf mit Brotkrumen, Kicker, H1 und Unterzeile dieselbe Aufgabe, zum Beispiel
  „KI-Automationen“ (`leistungen-ki-automationen-1440.png`) oder „Automation und
  Softwareentwicklung im Münsterland“ (`muensterland-768.png`).
- **Textlesbarkeit auf dem Hero-Bild.** Der Bildschleier hinter der Wortmarke ist links, wo der Text
  steht, sehr dunkel (bis 93 % Deckung) und wird nach rechts heller, wo kein Text mehr liegt; unter
  1024 px liegt zusätzlich ein durchgehend dunkler Schleier über der ganzen Breite, weil der Text
  dort volle Breite einnimmt. Auf allen Aufnahmen ist die weiße Schrift im Hero klar lesbar, auch auf
  den beiden helleren der fünf Hero-Motive.
- **Kopfleiste und Menü tragen auf schmalen Breiten.** Bei 375 und 768 px öffnet der
  Hamburger-Knopf ein dunkles Vollbildmenü mit klar gruppierten Bereichen (Leistungen, Branchen,
  Unternehmen), großzügigem Zeilenabstand und gut lesbarer weißer Schrift auf Schwarz
  (`startseite-375-menue-offen.png`, `startseite-768-menue-offen.png`). Bei 768 px nutzt das Menü
  zwei Spalten, bei 375 px eine – beides bleibt übersichtlich. Die „Kontakt aufnehmen“-Schaltfläche
  bleibt in der Kopfleiste durchgehend sichtbar.
- **Konsistente Anordnung über die Breiten.** Bei allen sieben Seiten fällt der Übergang von
  mehrspaltigen Rastern (Kacheln, Statblöcke, Kartenreihen) bei 1440 px zu einspaltigen Blöcken bei
  375 px sauber aus. Karten, Bilder und Buttons skalieren proportional mit, ohne dass Elemente sich
  überlappen oder abgeschnitten wirken (stichprobenhaft geprüft in `leistungen-ki-automationen-1440.png`,
  `muensterland-768.png`, `kontakt-375.png`).
- **Layout-Stabilität.** CLS 0,000 auf allen Seiten (Wert aus dem Performance-Teilbericht dieser
  Prüfung) deckt sich mit dem Seitenkopf-Konzept ohne Bild: Die dunkle Fläche mit Typografie kann
  beim Laden nicht springen, weil kein Bild nachgeladen wird.

## Befunde

### Medium: Einwilligungs-Checkbox im Kontaktformular unter der Zielgröße von 44×44 px
- **Beleg:** Seite Kontakt, Breite 375/768/1440 px, Messung `results-visual.json` → `touchTargets`,
  Element `INPUT` bei `kontakt-375.png` (Formularausschnitt, ca. auf halber Höhe der Aufnahme).
  Gemessene Größe 20×20 px (Klasse `size-5`).
- **Befund:** Die Pflicht-Checkbox „Ich habe die Datenschutzerklärung gelesen …“ ist mit 20×20 px
  deutlich kleiner als die empfohlene Zielgröße von 44×44 px. Das zugehörige `<label>` ist zwar über
  `for`/`id` korrekt verknüpft und vergrößert die klickbare Fläche auf den Text, das native
  Kästchen selbst bleibt aber auf allen Breiten klein – gerade auf einem Mobilgerät mit dickeren
  Fingern eine der schwerer zu treffenden Stellen im Formular, kurz vor dem Absenden.
- **Empfehlung:** Klickfläche des Kästchens per Padding oder größerem `size-*`-Wert auf mindestens
  44×44 px anheben, oder die gesamte Zeile (Kästchen plus Text) als eine gemeinsame Klickfläche mit
  entsprechendem Innenabstand gestalten.

### Low: Vereinzelte Bedienelemente knapp unter 44 px in einer Achse
- **Beleg:** `results-visual.json` → `touchTargets`. Brotkrumen-Verweis „Home“ auf allen
  Unterseiten außer Startseite: 35×44 px (Höhe passt, Breite knapp darunter, z. B. sichtbar oben
  links in `leistungen-ki-automationen-1440.png`, `kontakt-375.png`). Telefonverweis
  „+49 155 67541365“ in der Fußzeilen-Anschrift auf allen Seiten: 103×20 px (unten in jeder
  Vollseiten-Aufnahme, z. B. `muensterland-1440.png`).
- **Befund:** Der Brotkrumen-Verweis „Home“ erreicht dank `min-h-11` die volle Höhe von 44 px, ist
  aber mit 35 px in der Breite etwas schmaler als das Zielmaß – bei einem einzelnen kurzen Wort
  eng, aber noch treffbar. Der Telefonverweis in der Fußzeile ist als Fließtext innerhalb der
  Adresse gesetzt (`<address>… · <a href="tel:…">…</a></address>`) und fällt damit unter die
  übliche Ausnahme für Verweise inmitten von Fließtext; als eigenständige Handlungsaufforderung
  eignet er sich auf Mobilgeräten trotzdem schlecht, weil er mit 20 px Zeilenhöhe sehr knapp zu
  treffen ist.
- **Empfehlung:** Für den Brotkrumen-Verweis reicht in der Regel schon ein `px-2` mehr Innenabstand.
  Für den Telefonverweis in der Fußzeile keine Formatänderung nötig, wenn Anrufe von dort aus nicht
  die primäre Handlung sein sollen – die Kontaktseite und der Kopfleisten-Button übernehmen diese
  Rolle bereits gut sichtbar.
- **Einordnung:** Weitere, kleinere Text-Verweise wie „Über uns“, „Münsterland“, „Leistungsseiten“,
  „KI-Automation“, „Chatbots“ oder der Fallstudientitel auf der Branchenseite sind ebenfalls unter
  44 px hoch, stehen aber jeweils inmitten von Fließtext-Absätzen (z. B. am Seitenende von
  `startseite-375.png`, `muensterland-1440.png`) – das ist die übliche und akzeptierte Bauweise für
  Verweise im Lesefluss und wird hier nicht als eigener Mangel gezählt.

### Low: Kleinste Fließtextgrößen bei 375 px erreichen stellenweise nur 12 px
- **Beleg:** `results-visual.json` → `fontSizes`. Kleinster Wert 12 px auf Startseite (Text
  „Leistungsbereiche“, Beschriftung unter einer Kennzahl), Über uns, Kontakt und Referenzseite.
  Auf der Kontaktseite betrifft es den Hinweistext „Die Terminauswahl öffnet Google Kalender. Dabei
  werden Daten an Google übertragen.“ direkt unter der Schaltfläche „Termin auswählen“
  (`kontakt-375.png`, oberes Drittel der Aufnahme).
- **Befund:** Die meisten 12-px-Stellen sind kurze, großgeschriebene Kicker-Beschriftungen mit
  weitem Zeichenabstand (z. B. „LEISTUNGEN“, „BRANCHEN“ über den Abschnittsüberschriften) – ein
  gängiges und hier gut lesbares Gestaltungsmittel. Der Datenschutzhinweis auf der Kontaktseite ist
  dagegen echter, satzförmiger Text mit einer für Endnutzer relevanten Aussage (Datenübertragung an
  Google) und bleibt bei 12 px kleiner, als für einen Hinweis mit dieser Bedeutung wünschenswert
  wäre.
- **Empfehlung:** Kicker-Beschriftungen unverändert lassen. Für den Google-Kalender-Hinweis auf der
  Kontaktseite die Schriftgröße von `text-xs` (12 px) auf mindestens `text-sm` (14 px) anheben, da
  es sich um einen datenschutzrelevanten Hinweistext handelt, der gelesen werden soll, nicht nur um
  Kleingedrucktes.

### Info: Honigtopf-Feld im Kontaktformular technisch korrekt umgesetzt
- **Beleg:** `results-visual.json` → `touchTargets`, Seite Kontakt, `INPUT`-Element bei
  `left: -9816`. Quelle: `kontakt.astro`, Feld `webseite`.
- **Befund:** Die automatische Prüfung meldete zunächst ein Eingabefeld außerhalb des sichtbaren
  Bereichs als potenziellen Treffer unter 44×44 px. Der Blick in den Quelltext zeigt: Das ist ein
  bewusst gesetzter Spam-Honigtopf (`aria-hidden`, `tabindex="-1"`, Positionierung bei
  `left: -9999px`, bewusst ohne `display:none`, damit Bots es nicht erkennen). Kein Mangel, hier
  nur der Vollständigkeit halber vermerkt, damit die Zahl nicht als übersehener Fehler
  missverstanden wird.

### Info: Zielgrößen-Messung überwiegend unauffällig
- **Beleg:** `results-visual.json` → `touchTargets`, alle sieben Seiten bei 375/768/1440 px.
- **Befund:** Über alle geprüften Seiten und Breiten hinweg sind Hauptnavigation, Menü-Knopf,
  Kachel-Verweise, Buttons und Formularfelder (mit Ausnahme der oben genannten Checkbox) bei
  mindestens 44×44 px oder – bei reinen Fließtext-Verweisen – im üblichen und akzeptierten Rahmen.
  Das deckt sich mit dem Befund aus dem Barrierefreiheits-Teilbericht dieser Prüfung (axe-core: null
  Verstöße gegen WCAG 2.1 A/AA über alle 23 Seiten).

## Zur Einordnung eines Hinweises aus einem parallelen Lauf

In einer Zwischennachricht wurde mitgeteilt, Bedienelemente seien in einer früheren Prüfung dieser
Sitzung „durchgängig mindestens 44 mal 44 Pixel“ bestätigt worden. Die eigene, oben dokumentierte
Messung (Skript `measure-visual.mjs`, Rohdaten in `results-visual.json`) zeigt ein sehr ähnliches,
aber nicht ganz deckungsgleiches Bild: Die Fläche ist auf allen sieben Seiten weit überwiegend
konform, mit der oben unter „Medium“ genannten Checkbox als einziger echter Ausnahme und einer
Handvoll Fließtext-Verweisen, die unter der gängigen WCAG-Ausnahme für Verweise im Lesefluss liegen.
Dieser Bericht stützt sich auf die eigene, reproduzierbare Messung.

## Zusammenfassung

Die Seite steht auf allen drei geprüften Breiten (1440, 768, 375 px) sauber, ohne seitlichen
Überlauf und mit der Kernaussage jeweils oberhalb der Falz. Kopfleiste und Vollbildmenü
funktionieren auf schmalen Bildschirmen zuverlässig und sind gut lesbar. Die beiden nennenswerten
Punkte sind die kleine Einwilligungs-Checkbox im Kontaktformular und der unauffällig kleine
Datenschutzhinweis darunter – beides leicht zu beheben und ohne Einfluss auf das übrige, insgesamt
ruhige und konsistente Erscheinungsbild.
