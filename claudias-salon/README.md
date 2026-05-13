# Claudia's Salon – Webseite

Statische Webseite für **Claudia's Salon**, Nordring 27, 46325 Borken.
Reines HTML/CSS/JS – keine Build-Tools, kein Server nötig.

## Lokale Vorschau

Einfach `index.html` im Browser öffnen – oder besser mit kleinem Webserver:

```bash
cd claudias-salon
python3 -m http.server 8080
# Browser: http://localhost:8080
```

## Struktur

```
claudias-salon/
├── index.html           # Hauptseite (Hero, Über uns, Leistungen, Team, …)
├── impressum.html       # Pflicht-Impressum
├── datenschutz.html     # Datenschutz-Vorlage
├── styles.css           # Alle Styles (weiß/gold Theme)
├── script.js            # Mobile-Menü, Scroll-Animationen, Kontaktformular
└── images/
    ├── logo.svg         # Platzhalter-Logo (bitte durch echtes Logo ersetzen)
    ├── favicon.svg      # Tab-Icon
    └── (weitere Fotos)  # siehe „Bilder einfügen"
```

## Bilder einfügen

Im HTML stehen überall Platzhalter mit dem gewünschten Dateinamen. Lege die echten Fotos einfach unter `images/` ab:

| Datei                   | Wo es erscheint                       |
|-------------------------|----------------------------------------|
| `images/logo.png`       | **Echtes Logo** – ersetzt `logo.svg` (dann in den HTMLs `.svg` → `.png` ändern) |
| `images/claudia.jpg`    | Portrait Claudia (Abschnitt „Über uns") |
| `images/team-1.jpg` …3  | Teamfotos                              |
| `images/gallery-1.jpg` …6 | Galerie (Saloninnenraum, Frisuren …)  |
| `images/hero.jpg`       | (optional) Hintergrundbild Hero        |

Empfohlene Bildgrößen:
- Hero: ca. 1920×1080 px, JPG, < 400 KB
- Portrait / Team: ca. 800×1000 px (Hochformat)
- Galerie: ca. 1000×1000 px (quadratisch)

## Texte / Daten anpassen

Alle Texte stehen direkt im HTML – einfach mit einem Editor öffnen und ändern. Wichtige Stellen:

- **Telefon / WhatsApp:** überall `4928618053199` (für `wa.me/...`) bzw. `02861 8053199`
- **Adresse:** `Nordring 27, 46325 Borken`
- **Öffnungszeiten:** `index.html` → Abschnitt `#standort`
- **Stylisten-Namen** (Platzhalter "Stylistin 2", "Stylist 3"): `index.html` → Abschnitt `#team`
- **Impressum:** `impressum.html` → fehlende Felder (E-Mail, USt-IdNr.) eintragen

## Deployment

Diese Seite ist 100 % statisch und läuft auf **jedem** Webhosting:

### Option 1: Netlify (kostenlos, am einfachsten)
1. Account auf [netlify.com](https://netlify.com) anlegen
2. „Add new site" → „Deploy manually" → den Ordner `claudias-salon` per Drag & Drop hochladen
3. Eigene Domain (z. B. `claudias-salon-borken.de`) verbinden

### Option 2: Klassisches Webhosting (IONOS, Strato, all-inkl)
- Den Inhalt von `claudias-salon/` per FTP in den `public_html`-Ordner hochladen
- Fertig.

### Option 3: Vercel / GitHub Pages
- Funktioniert genauso – beliebigen statischen Host nehmen.

## Wichtige Hinweise

- **Datenschutz / Impressum:** Beide Seiten sind Vorlagen. Bitte vor Veröffentlichung von Claudia / einem Anwalt prüfen lassen und alle `[bitte ergänzen]`-Stellen ausfüllen.
- **Google Maps / Google Fonts** werden direkt eingebunden – ist in der Datenschutzerklärung erwähnt.
- **WhatsApp-Buttons** öffnen `wa.me/4928618053199` mit vorbefüllter Nachricht je Stylistin.
- **Google-Bewertungen** sind aktuell Platzhalter. Echte Bewertungen können später per [elfsight.com](https://elfsight.com) oder [trustindex.io](https://trustindex.io) eingebunden werden.

## Farben / Branding

Im CSS oben (`:root`) lassen sich alle Farben zentral ändern:

```css
--gold:       #C9A961;   /* Hauptton */
--gold-dark:  #A8893F;   /* Hover-Ton */
--black:      #1A1A1A;   /* Überschriften */
--bg-soft:    #FAF7F1;   /* warmer Hintergrund */
```
