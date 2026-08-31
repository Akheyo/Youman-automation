# Content-Plan & Keyword-Architektur — ab-solarenergy.de

## 1. Site-Architektur (Hub & Spoke)

```
Startseite (/) ── "Photovoltaik Borken"
├── /photovoltaik/        (Hub)  ── "Photovoltaikanlage Borken"
│   ├── /photovoltaik/gewerbe/     "Photovoltaik Gewerbe Münsterland"
│   └── /photovoltaik/eigenheim/   "Solaranlage Einfamilienhaus"
├── /stromspeicher/       "Stromspeicher Photovoltaik"
├── /wallbox/             "Wallbox Borken"
├── /waermepumpe/         "Wärmepumpe Borken"
├── /referenzen/          "Photovoltaik Referenzen Münsterland"
├── /ueber-uns/           "Solar Fachbetrieb Borken"  (E-E-A-T)
├── /faq/                 "Photovoltaik Fragen Kosten"  (+FAQPage-Schema)
├── /kontakt/             "Photovoltaik Beratung Borken"
└── /ratgeber/            (Blog-Hub)
    ├── pv-kosten-borken
    ├── foerderung-photovoltaik-nrw-2026
    ├── lohnt-sich-stromspeicher
    └── pv-anlage-ablauf-planung
```
**Interne Verlinkung:** Jede Spoke verlinkt zum Hub und zu 2–3 verwandten Seiten;
Ratgeber-Artikel verlinken auf die passende Service-Seite (Conversion-Pfad).

## 2. Keyword-Cluster (Intent)

| Cluster | Haupt-KW | Intent | Ziel-Seite |
|---------|----------|--------|-----------|
| PV lokal | photovoltaik borken, solaranlage borken | kommerziell/lokal | `/photovoltaik/` |
| Kosten | photovoltaik kosten, pv anlage preis | informational→komm. | `/ratgeber/pv-kosten-borken` → `/photovoltaik/` |
| Förderung | photovoltaik förderung nrw 2026 | informational | `/ratgeber/foerderung-…` |
| Speicher | stromspeicher nachrüsten, batteriespeicher | komm./info | `/stromspeicher/` |
| Wallbox | wallbox installation, wallbox förderung | komm./lokal | `/wallbox/` |
| Wärmepumpe | wärmepumpe mit photovoltaik | komm./info | `/waermepumpe/` |
| Trust | a&b solarenergy erfahrungen | navigational | `/ueber-uns/`, `/referenzen/` |

> Suchvolumina konnten offline nicht abgerufen werden. Sobald DataForSEO/GSC verfügbar:
> `/seo cluster photovoltaik borken` bzw. `/seo dataforseo` für echte Volumina & Difficulty.

## 3. Service-Landingpage — Pflicht-Bausteine (je Seite)

1. **H1** mit Keyword + Ort („Photovoltaikanlagen in Borken").
2. Einleitung mit lokalem Bezug (2–3 Sätze, Nutzen + Region).
3. **Leistungsumfang** (Bullet-Liste: Beratung → Planung → Montage → Anmeldung → Service).
4. **Ablauf** in Schritten (schafft Vertrauen, gut für AI-Zitate).
5. **Vorteile/USP** (regional, Festpreis, Garantie, Herstellerpartner).
6. **Referenz-/Projektfoto** mit sprechendem Alt-Text.
7. **FAQ-Block** (3–5 Fragen) → FAQPage-Schema.
8. **CTA** (Kontakt/Angebot) + Telefonnummer als klickbarer Link.
9. Interne Links zu Hub + verwandten Services.
10. Mind. **600–900 Wörter** einzigartiger Text, kein dupliziertes Boilerplate.

## 4. Redaktionsplan (Start: 4 Artikel/Quartal)

| Monat | Artikel | Ziel-KW | Verlinkt auf |
|-------|---------|---------|--------------|
| 1 | Was kostet eine PV-Anlage in Borken? (mit Rechenbeispiel) | photovoltaik kosten borken | /photovoltaik/ |
| 1 | Photovoltaik-Förderung NRW 2026: Überblick | förderung photovoltaik nrw | /photovoltaik/ |
| 2 | Lohnt sich ein Stromspeicher? | stromspeicher lohnt sich | /stromspeicher/ |
| 3 | Ablauf: Von der Beratung bis zur Inbetriebnahme | pv anlage ablauf | /kontakt/ |

Jeder Artikel: BreadcrumbList-Schema, Autor-Byline (E-E-A-T), 1 internes Ziel-CTA, Meta aus `02-…`.

## 5. E-E-A-T-Checkliste

- [ ] Über-uns mit echten Personen (Rami Alkhidou, Elias Boulos), Fotos, Rollen.
- [ ] Qualifikationen/Zertifikate (Elektrofachbetrieb, Meister, Herstellerzertifizierungen).
- [ ] Referenzen mit Ort + kWp + Foto.
- [ ] Impressum vollständig (HRB, GF, USt-IdNr.), Datenschutz DSGVO-konform.
- [ ] Echte Bewertungen sichtbar.
- [ ] Klare Kontaktmöglichkeiten (Tel., Mail, Formular, Adresse).
