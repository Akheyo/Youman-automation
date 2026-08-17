# Prompt für neuen Chat — Website adept&

Baue die neue Unternehmens-Website für **adept&**. Lies erst den ganzen Auftrag, dann stelle mir
die offenen Fragen am Ende gesammelt — fang nicht an zu coden, bevor die Assets da sind.

## 0. Setup zuerst

**Anhänge dieses Chats** — arbeite damit, nicht nur mit meiner Zusammenfassung unten:
- `Wie die Website aussehen soll.pdf` — enthält die McKinsey-Screenshots als Bilder. **Öffne sie
  und schau sie dir an**, die Bilder sind die eigentliche Design-Vorgabe. Sag mir, falls du sie
  nicht rendern kannst.
- `Überblick wer wir sind.pdf` — Unternehmensprofil
- `Case Study Draht Müller.adept.pdf` — Referenzprojekt
- adept&-Logo (Bilddatei)

**Design-Skill:** Im Repo `Akheyo/youman-automation` liegt der Skill `ui-ux-pro-max` unter
`.claude/skills/ui-ux-pro-max/` (MIT, gevendort — Quelle in `VENDORED.md`). Arbeitest du in einem
anderen Repo, kopier ihn dort hin:

```bash
git clone https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git /tmp/uiux
mkdir -p .claude/skills
cp -r /tmp/uiux/.claude/skills/ui-ux-pro-max .claude/skills/
```

Prüfe mit `ls .claude/skills/ui-ux-pro-max`, dass `SKILL.md`, `data/`, `references/` und `scripts/`
da sind. **Nutze den Skill verbindlich** für alle Design-Entscheidungen — siehe Abschnitt 6.

---

## 1. Wer adept& ist (Faktenbasis für alle Texte)

adept& ist ein **Beratungs- und Softwareunternehmen** für den Mittelstand. Positionierung:
Managementberatung **plus** individuelle Softwareentwicklung aus einer Hand.

Kernclaim: „Beratung. Software. Integration. — Maßgeschneiderte ERP- & SAP-Lösungen für den Mittelstand."

Leitsätze (wörtlich verwendbar):
- „Wir sind kein reines Beratungshaus, das Empfehlungen ausspricht. Und kein klassisches
  Softwareunternehmen, das ein Standardprodukt verkauft. Wir tun beides: Wir analysieren das
  Problem und wir bauen die Lösung."
- „Wir beraten, wo andere nur liefern und wir bauen, was andere nur empfehlen."
- „Kein Systemwechsel. Keine Medienbrüche. Eine Oberfläche."

**Was das Produkt ist:** adept& ist eine modulare Softwareplattform, die als einheitliches
Arbeitsgerüst dient — Analogie: „wie ein Betriebssystem". Je nach Kundenanforderung wird eine
spezifische Lösung (Logistiksoftware, Produktionsplanung, Reporting-Tool) als **Modul** in dieses
Gerüst eingebettet. Der Mitarbeiter beim Kunden sieht nur **eine** Oberfläche; Datenabruf,
Berechnung und Synchronisation mit dem ERP laufen vollautomatisch im Hintergrund.

Technische Leistungen:
- Saubere, intuitive Benutzeroberfläche für den Endanwender
- Vollständige Integration mit ERP/SAP via API-Schnittstelle
- Automatisierter, bidirektionaler Datenaustausch in Echtzeit
- Modularität: jede Kundenlösung als eigenständiges Modul in der bestehenden Plattform
- Kompatibel mit allen gängigen ERP-Systemen (SAP, Microsoft Dynamics, infor u. v. m.)

Kernleistungen (4):
| Leistung | Beschreibung |
|---|---|
| Prozessberatung | Analyse und Strukturierung operativer Herausforderungen — von der Produktionsplanung bis zur Logistik |
| Custom Software Development | Entwicklung einer maßgeschneiderten Lösung, eingebettet in adept& |
| ERP- & SAP-Integration | Nahtlose Anbindung an das bestehende System des Kunden, vollautomatischer Datenaustausch |
| Implementierung & Rollout | Begleitung der Einführung direkt im Betrieb — von der Anforderung bis zum produktiven Einsatz |

Prozess in 5 Schritten (als eigene Sektion oder Unterseite):
1. **Analyse** — tiefes Verständnis des operativen Problems: Prozesse, Systeme, Schnittstellen, Datenflüsse
2. **Konzept** — Lösungsdesign: UI-Konzept, Integrationsarchitektur, Modulstruktur
3. **Entwicklung** — iterative Entwicklung des Moduls mit direktem Kundenfeedback
4. **Integration** — Einbettung in adept&, Anbindung an das ERP-System des Kunden
5. **Rollout** — Einführung im Betrieb, Mitarbeiterschulung, laufende Optimierung

---

## 2. Design-Referenz: mckinsey.com/de

Die Seite soll sich am Aufbau der **McKinsey-Deutschland-Website** orientieren. Ich schicke dir
Screenshots und ein Handy-Video als Referenz — **frag danach, bevor du mit dem Layout anfängst.**

Abweichungen von der Referenz, verbindlich:
- Wo bei McKinsey das McKinsey-Logo sitzt, kommt **unser adept&-Logo**.
- **Alles Rote entfällt.** Keine roten Flächen, keine rote Akzentfarbe.
- Das **„Germany" über „Home" entfällt** komplett.
- Der Rest der Hauptebene: bitte genauso aufgebaut wie in der Referenz.

**Hero / Video-Ebene:** genau wie im Video, das ich schicke — ein bildschirmfüllendes Video als
Hero. Mittig darauf steht **„adept&"**, direkt darunter, ebenfalls mittig, **„Deutschland"**.

Scroll-Reihenfolge der Startseite:
1. **Hero** (Video, adept& / Deutschland)
2. **„Aktuelles"** bzw. **„Aktuelle Themen"** — 4 klickbare Kacheln/Vierecke
3. **„Über adept&"** — an der Stelle, wo McKinsey „Über McKinsey" hat. McKinsey zeigt dort
   Gesellschaft, Werte, Geschichte, Nachhaltigkeit. **Wir brauchen nur Geschichte und Werte** —
   die anderen zwei entfallen.
4. **Abschluss-/Footer-Sektion** — wieder unser Name usw. **Wichtig: wir haben keinen Newsletter.**
   Also **kein „Subscribe"**, kein Newsletter-Feld und kein Button darunter.

---

## 3. Navigation

Hauptmenü: **Branchen · Funktionen · News · Über uns · Kontakt**

- **Branchen** → Dropdown, optisch genau wie in der Referenz:
  - Fertigung und Maschinenbau
  - Logistik & Versand
  - Konsumgüter und Handel
  - Automobil und Zulieferer

  Das sind alle vier — mehr nicht.

- **Funktionen** → Dropdown. Angezeigt werden **nur die Überschriften**; der Text in Klammern ist
  Kontext für dich, damit du die Inhalte der jeweiligen Unterseite verstehst, und darf im Dropdown
  **nicht** aufgeführt werden:
  - **Produktion & Feinplanung** (Feinplanungstools, Leitstände, automatische Umplanung,
    OEE-Dashboards, KPI-Ansichten für Schichtleitung und Werksleitung)
  - **Logistik & Versandsteuerung** (Paletten- und Verpackungslogik, Versandsteuerung,
    Priorisierungstools, Dispositions-Dashboards, ERP-integrierte Logistikoberflächen)
  - **Supply Chain & Materialsteuerung** (Engpass- und Priorisierungstools, Bedarfs- und
    Verfügbarkeitsübersichten, Szenario-Logiken für Materialverzüge)
  - **Reporting & operative Transparenz** (Produktions- und Logistik-KPI-Cockpits, rollenbasierte
    Reporting-Oberflächen, Drill-downs bis auf Maschinen-, Auftrags- oder Materialebene)
  - **Systemintegration & ERP-Anbindung** (API-basierte Anbindung an ERP-/SAP-/TMS-Systeme,
    Entwicklung kundenspezifischer Module ohne Systemablösung)

- **News** → **kein Dropdown.**
- **Über uns** → **kein Dropdown.**
- **Kontakt** → **kein Dropdown.**

---

## 4. Referenz-Case-Study (Inhalt für News/Referenzen)

**Drahtmüller GmbH / Lichtgitter-Gruppe — Palettenoptimierung & Logistiksoftware via adept&**

*Ausgangssituation:* Drahtmüller produziert Gitterdrähte nach kundenindividuellen Maßen. Weil jeder
Auftrag andere Abmessungen hat, muss jede Versandpalette passgenau gefertigt oder beschafft werden.
Ergebnis: **2.556 verschiedene Palettentypen** im aktiven Einsatz — hohe Beschaffungskosten,
unkalkulierbare Vorlaufzeiten, massiver manueller Planungsaufwand.

*Herausforderung:* Nicht das Fehlen eines ERP-Systems, sondern die fehlende operative Logik
zwischen Auftragseingang und Palettenentscheidung. Wiederkehrende Maße wurden nicht systematisch
als Standardfälle erkannt, jeder Vorgang lief als Einzelfall. Gesucht war keine zusätzliche
Inselsoftware, sondern eine Lösung, die sich in die bestehende Systemlandschaft einfügt.

*Lösung:* Ein **Palettenoptimierungs-Modul**, eingebettet in das adept&-Gerüst und via API an das
ERP-System angebunden. Es liest Auftragsdaten automatisiert aus und berechnet direkt nach
Auftragseingang: welche Standardpaletten verwendbar sind, welche Sonderpaletten gefertigt werden
müssen, wie viele Einheiten pro Typ nötig sind. **Kernlogik:** ab einer Mindestmenge von **fünf
identischen Maßen** klassifiziert die Software die Palette automatisch als Standardpalette und führt
sie dauerhaft im Sortiment; seltenere Maße bleiben Sonderpaletten, werden aber deutlich
strukturierter abgebildet.

*Ergebnis:* Die zuvor manuelle Palettenlogik läuft als klar strukturierter, systemisch
unterstützter Prozess. Wiederkehrende Maße werden automatisiert als Standardfälle erkannt,
Sonderfälle gezielter und nachvollziehbarer gesteuert. Zeigt exemplarisch, wie operative
Sonderlogik digital abbildbar ist, **ohne die bestehende Systemlandschaft abzulösen**.

> Keine Zahlen erfinden, die hier nicht stehen. Es gibt bislang **keine** freigegebene
> Einsparungs-/Prozentangabe und **keine** Kundenstimme — also auch keine Testimonials platzieren.

---

## 5. Technik & Hosting

- **Stack:** Astro + Tailwind CSS 4 (via `@tailwindcss/vite`, **nicht** `@astrojs/tailwind`),
  statischer Output. Islands-Architektur: `.astro` für statisches Markup, JS nur wo wirklich
  interaktiv (Dropdown-Menü, Mobile-Nav, Video-Controls).
- **Hosting:** GitHub Pages, Auto-Deploy per GitHub Action bei jedem Push auf `main`.
- **Repo:** neues, eigenes öffentliches Repo unter dem Account `Akheyo`. Bitte zuerst prüfen, ob es
  schon existiert; falls nicht, sag mir Bescheid — **ich muss es selbst anlegen**, ein Agent hat
  hier keine Rechte zum Repo-Erstellen. Danach `base`-Pfad in `astro.config.mjs` auf den Repo-Namen
  setzen (bzw. auf `/`, falls eine eigene Domain kommt).
- **Fonts selbst hosten** (`@fontsource`-Pakete), **nicht** über die Google-Fonts-CDN — DSGVO.
- **Sprache:** deutsch, `lang="de"`. Siezen.
- **Rechtliches:** Impressum und Datenschutzerklärung als eigene Seiten anlegen, im Footer
  verlinken. Inhalte als klar markierte Platzhalter — **keine erfundenen Rechtstexte, keine
  erfundene Adresse oder Handelsregisternummer.**
- **SEO:** Meta-Tags, OpenGraph, `sitemap`, `robots.txt`, JSON-LD `Organization`.

## 6. Design-System — bitte über den Skill herleiten, nicht raten

Im Projekt liegt der Skill **`ui-ux-pro-max`**. Nutze ihn, bevor du Farben, Fonts oder Layout
festlegst, und zeig mir das Ergebnis zur Abnahme:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py \
  "corporate consulting enterprise trust authority landing" --design-system
python3 .claude/skills/ui-ux-pro-max/scripts/search.py \
  "mega menu dropdown navigation keyboard accessible" --domain ux
python3 .claude/skills/ui-ux-pro-max/scripts/search.py \
  "hero video background overlay text contrast" --domain ux
python3 .claude/skills/ui-ux-pro-max/scripts/search.py \
  "astro tailwind static site" --stack astro
```

Erwartete Richtung, gegen die du das Skill-Ergebnis prüfst: **seriös, corporate, „Trust &
Authority"** — viel Weißraum, starke Typo-Hierarchie, dunkles Neutral (Anthrazit/Navy) als
Basis, **eine** Akzentfarbe sparsam und **niemals Rot**. Das Logo ist eine geometrische,
kleingeschriebene Sans in Anthrazit-Grau (`adept&`) — die Website-Typo muss dazu passen.
Wenn der Skill etwas anderes vorschlägt, sag mir warum, statt es stillschweigend zu übernehmen.

Nicht verhandelbar (Pre-Delivery-Checkliste des Skills):
- Textkontrast mindestens 4.5:1 — besonders die Hero-Schrift auf dem Video (Overlay/Scrim einplanen)
- Keine Emojis als Icons — SVG (Lucide/Heroicons)
- Touch-Targets ≥ 44×44 px, ≥ 8 px Abstand
- Sichtbarer Fokus-Ring, volle Tastaturbedienbarkeit inkl. Dropdowns (Esc schließt, Pfeiltasten)
- `prefers-reduced-motion` respektiert; Hero-Video dann statisches Poster-Bild statt Autoplay
- Video: sichtbare Play/Pause-Steuerung, stummgeschaltet, pausiert außerhalb des Viewports
- Responsive geprüft bei 375 / 768 / 1024 / 1440 px, kein horizontales Scrollen
- Layout-Shift vermeiden: Platz für Video/Bilder reservieren (CLS < 0.1)

---

## 7. Was du von mir brauchst — frag danach, bevor du loslegst

1. **Screenshots** der McKinsey-Referenz (Hauptebene, „Aktuelles", „Über McKinsey", Footer, beide
   Dropdowns) und das **Handy-Video** für den Hero.
2. Das **adept&-Logo** als SVG oder hochauflösendes PNG, plus Favicon.
3. Das **Hero-Video** selbst (bzw. Anweisung, womit wir es vorläufig ersetzen).
4. Texte für **„Geschichte"** und **„Werte"** — die liegen noch nicht vor.
5. Inhalte der **4 „Aktuelle Themen"-Kacheln** — außer der Drahtmüller-Case-Study habe ich nichts.
6. **Branchen-Widerspruch klären:** Im Website-Konzept stehen *Fertigung und Maschinenbau, Logistik
   & Versand, Konsumgüter und Handel, Automobil und Zulieferer*. Im Unternehmensüberblick stehen
   *Automobil & Zulieferer, Maschinenbau & Fertigung, Logistik & Supply Chain, **Chemie &
   Prozessindustrie***. Welche Liste gilt? Ich gehe erst mal von der Website-Liste aus.
7. **Konsumgüter & Handel / E-Commerce:** dafür sind mir die Painpoints nicht bekannt und ich
   erfinde sie nicht. Entweder du gibst mir 3–5 konkrete operative Probleme aus euren Projekten,
   oder ich baue die Unterseite vorerst mit klar markierten Platzhaltern.
8. **Kontaktweg:** GitHub Pages kann kein Backend. Soll das Kontaktformular über einen externen
   Dienst laufen (Formspree o. ä.), oder reichen Mail-Adresse, Telefon und ein Terminbuchungs-Link?
9. **Domain:** eigene Domain für GitHub Pages, oder erst mal die `github.io`-Adresse?

Wenn etwas davon noch fehlt, baue trotzdem alles, was nicht davon abhängt — Gerüst, Design-System,
Navigation, Case-Study-Seite — und markiere Platzhalter unmissverständlich als solche.
