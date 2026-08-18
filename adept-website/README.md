# adept& – Unternehmens-Website

Statische Website für **adept&** (Beratung. Software. Integration.), aufgebaut nach dem
Briefing „Wie die Website aussehen soll“ mit der McKinsey-Deutschland-Seite als Strukturvorlage.

**Stack:** Astro 5 · Tailwind CSS 4 (über `@tailwindcss/vite`) · statischer Output · Deployment über
GitHub Pages.

---

## Entwicklung

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # Ausgabe nach dist/
npm run preview  # gebauten Stand lokal ansehen
```

---

## Deployment

Der Workflow liegt unter `.github/workflows/deploy.yml` und baut bei jedem Push auf `main`.

> **Wichtig:** GitHub liest Workflows nur aus dem Repo-Wurzelverzeichnis. Solange dieser Ordner
> Unterordner von `Akheyo/Youman-automation` ist, läuft der Workflow **nicht** – das ist Absicht,
> damit er die Pages-Einstellung des bestehenden Repos nicht überschreibt. Sobald der Ordner das
> Root eines eigenen Repos ist, greift er automatisch.

### Zieladresse

Die Seite ist auf **www.adeptandpartners.de** ausgelegt. `public/CNAME` enthält die Domain und
landet bei jedem Build in `dist/`. Canonical-URLs, OpenGraph und Sitemap zeigen bereits dorthin.

Pfade sind nicht hart kodiert, sondern kommen aus zwei Umgebungsvariablen:

| Variable    | Bedeutung                            | Standard                        |
| ----------- | ------------------------------------ | ------------------------------- |
| `SITE_URL`  | Origin für Canonical/OG/Sitemap      | `https://www.adeptandpartners.de` |
| `SITE_BASE` | Unterpfad, unter dem die Seite läuft | `/`                             |

Im Workflow setzt `actions/configure-pages` beide automatisch. Läuft die Seite übergangsweise
unter `akheyo.github.io/<repo>`, greift das ohne Codeänderung. Alle internen Links laufen über
`withBase()` aus `src/lib/url.ts`.

### Einmalige Schritte zum Livegang

1. Repo unter dem Account `Akheyo` anlegen und diesen Ordner als Repo-Root pushen.
2. **Settings → Pages → Source: GitHub Actions**.
3. **Settings → Pages → Custom domain:** `www.adeptandpartners.de` eintragen.
4. Beim Domain-Anbieter diese DNS-Einträge setzen:

   | Typ   | Name  | Wert                |
   | ----- | ----- | ------------------- |
   | CNAME | `www` | `akheyo.github.io.` |

   Damit auch `adeptandpartners.de` ohne `www` funktioniert, zusätzlich auf der Apex-Domain:

   | Typ | Name | Wert              |
   | --- | ---- | ----------------- |
   | A   | `@`  | `185.199.108.153` |
   | A   | `@`  | `185.199.109.153` |
   | A   | `@`  | `185.199.110.153` |
   | A   | `@`  | `185.199.111.153` |

5. Nach der DNS-Verbreitung (Minuten bis 24 Stunden) in den Pages-Einstellungen
   **Enforce HTTPS** aktivieren – das Zertifikat stellt GitHub automatisch aus.

---

## Live-Vorschau ohne Deployment

Solange die Domain noch nicht steht, erzeugt dieser Befehl eine einzige, vollständig
eigenständige HTML-Datei mit allen 19 Seiten, eingebettetem CSS und eingebetteten Schriften:

```bash
npm run build
python3 scripts/build-preview.py   # -> preview/adept-vorschau.html
```

Die Datei lässt sich per Doppelklick im Browser öffnen oder verschicken – sie braucht keinen
Server. Navigation, Dropdowns und der Umschalter für 375 / 768 / 1024 px funktionieren darin.
`preview/` ist bewusst nicht eingecheckt, die Datei wird bei Bedarf neu erzeugt.

## Design-System

Hergeleitet mit dem Skill `ui-ux-pro-max` (Query
`"corporate consulting enterprise trust authority landing" --design-system`). Übernommen wurden
Pattern **Trust & Authority + Conversion**, Stil **Accessible & Ethical** und das Font-Pairing
**Lexend / Source Sans 3**. Die Tokens stehen im `@theme`-Block in `src/styles/global.css`.

| Token             | Wert      | Verwendung                         |
| ----------------- | --------- | ---------------------------------- |
| `--color-ink`     | `#0F172A` | Überschriften, Fließtext           |
| `--color-ink-deep`| `#051C2C` | Dropdown-Panels, dunkle Sektionen  |
| `--color-ink-soft`| `#334155` | Sekundärtext                       |
| `--color-accent`  | `#0369A1` | Links, CTA (Kontrast auf Weiß 5,1:1) |
| `--color-accent-on-dark` | `#7CC4EC` | Akzent auf dunklem Grund    |
| `--color-brand`   | `#4B5259` | Anthrazit der Wortmarke            |

**Zwei bewusste Abweichungen vom Skill-Ergebnis:**

1. Das Skill schlägt `--color-destructive: #DC2626` vor. Rot entfällt laut Briefing vollständig,
   deshalb ist der Token nicht in der Palette.
2. Die Referenzseite setzt große Überschriften in einer Serifenschrift. Hier stehen sie in Lexend,
   weil die Wortmarke `adept&` eine geometrische, kleingeschriebene Sans ist und eine Serife dazu
   bricht. Das deckt sich mit dem Font-Pairing aus dem Skill.

Fonts werden über `@fontsource-variable` selbst gehostet – **keine Verbindung zur
Google-Fonts-CDN** (DSGVO).

---

## Geprüft

- `axe-core` (WCAG 2.1 A + AA) über alle **19 Seiten** sowie im geöffneten Dropdown- und
  Menü-Zustand: **0 Verstöße**
- Hero-Textkontrast gemessen: 16,3:1 auf dem aktuellen Poster, **7,4:1 im Worst Case** eines rein
  weißen Videobildes (gefordert: 4,5:1)
- Kein horizontales Scrollen und kein überstehendes Element – geprüft über alle 19 Seiten
  × 4 Breiten (375 / 768 / 1024 / 1440 px)
- Touch-Targets ≥ 44 px Höhe; Ausnahmen sind nur die Skip-Links (`sr-only`, wachsen bei Fokus) und
  Kachel-Überschriften, deren Klickfläche über `::after` die ganze Kachel abdeckt
- Dropdowns per Maus, Klick und Tastatur (`↑` `↓` `Home` `End` `Esc`, Fokus-Rückgabe) getestet
- `prefers-reduced-motion`: kein Autoplay, Poster bleibt stehen; Video pausiert außerhalb des
  Viewports
- Lange deutsche Komposita („Datenschutzerklärung“, „Palettenoptimierung“) passen bei 375 px in
  eine Zeile; `overflow-wrap` bleibt als Sicherheitsnetz für künftige längere Wörter

---

## Was noch fehlt

Alle offenen Stellen sind im UI als **Platzhalter** gekennzeichnet (gestrichelter Rahmen bzw.
Badge) und hier gesammelt:

| Thema | Datei | Fehlt |
| --- | --- | --- |
| Logo | `src/components/Logo.astro` | Offizielles SVG. Aktuell als Text in der Display-Schrift gesetzt. |
| Favicon | `public/favicon.svg` | Offizielles Favicon. |
| Hero-Video | `src/components/HeroVideo.astro` | MP4 nach `public/` legen und als `videoSrc` an die Komponente übergeben; Poster in `public/hero-poster.svg` ersetzen. Ohne `videoSrc` wird nur das Poster gezeigt. |
| Geschichte / Werte | `src/pages/ueber-uns.astro` | Texte für beide Abschnitte. |
| „Aktuelle Themen“ | `src/data/news.ts` | 3 der 4 Kacheln. Belastbar ist nur die Case Study Drahtmüller. |
| Konsumgüter und Handel | `src/data/branchen.ts` | 3–5 konkrete operative Painpoints. |
| Kontaktdaten | `src/pages/kontakt.astro` | E-Mail, Telefon, ggf. Terminlink. |
| Kontaktformular | `src/pages/kontakt.astro` | Endpunkt-URL in `FORMULAR_ENDPUNKT` eintragen – das Formular ist fertig implementiert und erscheint dann automatisch. |
| Impressum | `src/pages/impressum.astro` | Vollständiger Rechtstext. |
| Datenschutzerklärung | `src/pages/datenschutz.astro` | Vollständiger Rechtstext. |

**Bewusst nicht erfunden:** Einsparungs- oder Prozentangaben zur Case Study, Kundenstimmen,
Rechtstexte, Adressen und Registernummern.

---

## Struktur

```
src/
  components/   Logo, Header (Nav + Dropdowns), HeroVideo, Footer, TeaserCard, …
  data/         navigation.ts, site.ts, branchen.ts, funktionen.ts, news.ts
  layouts/      Base.astro (SEO, OpenGraph, JSON-LD Organization)
  lib/url.ts    withBase() / isActive() für den konfigurierbaren base-Pfad
  pages/        Startseite, Branchen (4), Funktionen (5), News, Über uns,
                Kontakt, Impressum, Datenschutz, 404
```

Inhalte stehen in `src/data/` – Texte ändern heißt dort ändern, nicht im Markup.
