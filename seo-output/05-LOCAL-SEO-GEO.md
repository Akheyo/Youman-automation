# Local SEO & GEO/AI-Search — A&B Solarenergy GmbH, Borken

## 1. NAP-Standard (überall IDENTISCH verwenden)

> Auf Website (Footer + Impressum + Kontakt), GBP und in **jedem** Verzeichnis exakt gleich.
> Schreibweise/Format nie variieren (das ist der häufigste Local-SEO-Fehler).

```
Name:     A&B Solarenergy GmbH
Straße:   Lange Stiege 66
PLZ/Ort:  46325 Borken
Telefon:  <<+49 … EINHEITLICHES FORMAT, z. B. +49 2861 1234567>>
E-Mail:   <<info@ab-solarenergy.de>>
Web:      https://ab-solarenergy.de   (kanonische Domain!)
```

**⚠️ Abgrenzung:** Nicht mit **A&B-Solarenergie GmbH, Visbek** (Kantstr. 7, 49429 Visbek) vermischen.
Falls Verzeichnisse beide vermengen → korrigieren/melden.

## 2. Google Business Profile (GBP) — höchster lokaler Hebel

- [ ] Profil beanspruchen/verifizieren (falls noch nicht).
- [ ] **Primärkategorie:** „Solaranlagenanbieter" (Solar energy company). Sekundär: „Elektriker".
- [ ] Leistungen anlegen: Photovoltaik, Stromspeicher, Wallbox, Wärmepumpe, Wartung.
- [ ] Servicegebiet: Borken, Kreis Borken, Münsterland (Orte einzeln hinzufügen).
- [ ] ≥ 10 gute Fotos (Team, Referenzanlagen, Firmensitz, Logo).
- [ ] Öffnungszeiten korrekt + Feiertage.
- [ ] Beschreibung (750 Z.) mit Keywords „Photovoltaik Borken" natürlich integriert.
- [ ] Regelmäßig **Beiträge** posten (Projekte, Angebote, Tipps).
- [ ] **Fragen & Antworten** vorbelegen (eigene FAQ als Q&A).
- [ ] Website-Link auf kanonische Domain.

## 3. Bewertungen (Reviews)

- [ ] Nach jedem Projekt aktiv um Google-Bewertung bitten (QR-Karte / Link per Mail/WhatsApp).
- [ ] Auf **alle** Bewertungen antworten (positiv wie negativ, professionell).
- [ ] Ziel: kontinuierliche Review-Velocity (lieber stetig als Stoßweise).
- [ ] Optional ProvenExpert/Trustpilot als zweite Quelle.
- [ ] Echte Bewertungen später in `aggregateRating` (Schema) spiegeln — **nie erfinden**.

## 4. Citations / Branchenverzeichnisse (NAP-Aufbau)

Einträge anlegen/prüfen (überall identische NAP):
- [ ] Google Business Profile
- [ ] Bing Places
- [ ] Apple Business Connect (Apple Maps)
- [ ] Das Örtliche / Gelbe Seiten / 11880
- [ ] meinestadt.de, marktplatz-mittelstand, Cylex
- [ ] Branchenspezifisch: solarfirmen.com, photovoltaik-vergleichsrechner.de, wattfox, DAA
- [ ] Handwerkskammer / Innungs-Verzeichnis (falls Mitglied)
- [ ] Facebook, Instagram, LinkedIn (Unternehmensseite)

## 5. On-Page Local-Signale

- [ ] NAP im Footer (als Text, nicht nur Bild) sitewide.
- [ ] Google-Maps-Einbettung + Anfahrt auf Kontaktseite.
- [ ] `LocalBusiness`-Schema mit `areaServed` (liegt bei, `03-schema/`).
- [ ] Ortsbezug in H1/Content der Service-Seiten („… in Borken und im Münsterland").
- [ ] Ggf. Ortsseiten für Nachbargemeinden (Ahaus, Bocholt, Coesfeld, Stadtlohn) — nur mit
      echtem, einzigartigem Inhalt (kein Doorway-/Thin-Content).

## 6. GEO / AI-Search (AI Overviews, ChatGPT, Perplexity, Copilot)

Ziel: von KI-Systemen als lokale Quelle **zitiert** werden.
- [ ] **Frage-Antwort-Blöcke**: klare, eigenständig verständliche Antworten (2–4 Sätze) mit
      Zahlen/Fakten → maximale „Passage-Zitierfähigkeit". (FAQ-Schema liegt bei.)
- [ ] Konkrete lokale Fakten nennen (Servicegebiet, Ablauf, typische Anlagengrößen, Förderung NRW).
- [ ] Marken-Konsistenz: „A&B Solarenergy" + „Borken" konsequent zusammen nennen (Entity-Bildung).
- [ ] AI-Crawler nicht per robots.txt sperren (siehe `04-robots.txt`), wenn AI-Sichtbarkeit gewünscht.
- [ ] Optional `llms.txt` im Root (von Google ignoriert, andere AI-Tools teils nützlich) — niedrige Prio.
- [ ] Autor/Experten-Bylines (GF/Team) für E-E-A-T → stärkt auch KI-Vertrauen.

## 7. Prüf-/Monitoring-Routine

- Monatlich: GSC (Impressionen/Klicks lokale Keywords), GBP-Insights, neue Bewertungen, NAP-Drift.
- Nach Deployments: `/seo drift` (Baseline vs. aktuell) sobald Live-Zugriff möglich.
