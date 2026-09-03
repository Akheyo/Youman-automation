# SEO-Befund ab-solarenergy.de

> Der Prüfbericht unten stammt aus `npm run wp:audit -- https://ab-solarenergy.de`,
> die Einordnung darüber ist von Hand ergänzt. Zum Neuprüfen in eine eigene
> Datei schreiben (`--out neuer-bericht.md`) und dieses Dokument dann von Hand
> nachziehen — sonst überschreibt der Lauf die Kurzfassung.

## Kurzfassung

Der Sichtbarkeitsindex 0,0000 kommt **nicht** von einem technischen Defekt.
Titel, Meta-Beschreibungen, `robots`, Canonicals und Sitemap sind sauber
(Rank Math macht seinen Job). Das Problem ist der Inhalt:

1. **Über die Hälfte der Seite ist Theme-Demo-Müll.** 46 von 87 URLs sind
   englische Platzhalter aus dem gekauften r-energy-Theme — Blogbeiträge von
   2019 über Windparks, Demo-Produkte, Referenzprojekte mit Fischnamen
   (`canthigaster-rostrata-spikefish`), Bausteinseiten wie `/buttons/`,
   `/charts/`, `/progress-bars/`. Alles auf `index`. Für Google ist das das
   Profil einer verlassenen Baustelle, nicht das eines Fachbetriebs.

2. **Die 12 Ortsseiten sind zu über 90 % wortgleich.** `/photovoltaik-borken/`,
   `/photovoltaik-ahaus/`, `/photovoltaik-dorsten/` usw. haben exakt denselben
   Text, es wurde nur der Stadtname getauscht. Genau dieses Muster stuft Google
   als Doorway Pages ein. Im besten Fall rankt eine davon, im schlechteren keine.

3. **Die echten Leistungsseiten sind zu dünn.** `/photovoltaik/` hat 228 Wörter,
   `/wallbox/` 157, `/stromspeicher/` 172, `/gewerbe-photovoltaik/` 159. Zu
   wenig, um bei umkämpften Begriffen wie „Photovoltaik Borken" mitzuspielen.

4. **Kein Messwerkzeug sichtbar.** Weder Google-Site-Verification noch
   Analytics/Tag Manager im Quelltext der Startseite. Ohne Search Console ist
   nicht feststellbar, wie viele der 87 URLs überhaupt im Index sind.

### Reihenfolge der Arbeit

| Schritt | Aufwand | Wirkung |
|---|---|---|
| 1. Demo-Inhalte löschen oder auf `noindex` setzen | klein | groß |
| 2. Search Console einrichten und Indexbericht ziehen | klein | Diagnose |
| 3. Ortsseiten je Stadt eigenständig texten (Projekte, Anfahrt, lokale Förderung) — oder auf eine starke Seite reduzieren | groß | groß |
| 4. Leistungsseiten auf 800–1200 Wörter ausbauen | mittel | mittel |
| 5. Google Unternehmensprofil + lokale Verzeichnisse | mittel | groß lokal |

Schritt 1 und 2 kann ich übernehmen, sobald der Zugang steht
(siehe [VERBINDUNG.md](./VERBINDUNG.md)). Schritt 3 und 4 sind Textarbeit, die
wir zusammen machen sollten — echte Projektbeispiele aus Borken, Ahaus usw.
kann kein Skript erfinden.

---

## Vollständiger Prüfbericht

Stand: 2026-09-03 · 87 URLs aus der Sitemap geprueft.

| | Anzahl |
|---|---|
| URLs gesamt | 87 |
| davon echte Inhaltsseiten | 38 |
| davon Theme-Demo-Reste | 46 |
| davon Shop-Funktionsseiten | 3 |

## [HOCH] Theme-Demo-Inhalte im Index

46 von 87 URLs sind uebrig gebliebene Demo-Seiten/-Beitraege des gekauften Themes. Das sind 53 % der Sitemap. Google bewertet damit die halbe Seite als leeren Platzhalter.

<details><summary>Betroffen</summary>

```
/2024/10/17/hello-world/
/2019/12/31/wind-farms-now-more-affordable-2-2/
/2019/12/31/wind-farms-now-more-affordable/
/2019/12/31/modern-and-quality-solar-panels/
/2019/12/31/modern-and-quality-solar-panels-2/
/2019/12/31/the-power-of-solar-energy-in-the-future/
/2019/12/31/solar-energy-what-you-need-to-know/
/2019/12/31/how-you-can-earn-with-solar-energy/
/2019/12/31/ferc-takes-a-firm-stand-in-pge/
/2019/12/31/surviving-sustainably-on-solar-2/
/2019/12/31/clean-energy-without-co2/
/2019/12/27/clean-energy-leadership/
/2019/12/21/renewable-energy-for-business/
/product-details/
/home-onepage/
/cases-2/
/home-2/
/home-3/
/yith-compare/
/sample-page/
/wishlist/
/progress-bars/
/counters/
/charts/
/alerts/
/buttons/
/tabs/
/team/
/accordions/
/testimonials/
/pricing-tables/
/products-gallery/
/cart-2/
/checkout-2/
/my-account-2/
/our-contacts/
/services-details/
/our-gallery/
/our-services/
/about/
/cases/solar-factory-in-ny/
/cases/solar-field-in-los-angeles/
/cases/renewable-energy-station/
/cases/canthigaster-rostrata-spikefish/
/cases/slickhead-grunion-lake-trout/
/cases/streamer-fish-california-halibut-pacific/
```

</details>

## [HOCH] Seiten auf noindex

6 URLs sind vom Index ausgeschlossen, stehen aber in der Sitemap.

<details><summary>Betroffen</summary>

```
/cart/
/checkout/
/my-account/
/cart-2/
/checkout-2/
/my-account-2/
```

</details>

## [HOCH] Nahezu identische Seiten (Doorway-Muster)

102 Seitenpaare stimmen zu ueber 90 % im Wortschatz ueberein — typischerweise Ortsseiten, bei denen nur der Stadtname getauscht wurde. Google waehlt daraus hoechstens eine Seite aus und ignoriert den Rest.

<details><summary>Betroffen</summary>

```
/photovoltaik-dorsten/  ≈  /photovoltaik-heiden/, /photovoltaik-reken/, /photovoltaik-raesfeld/, /photovoltaik-velen/, /photovoltaik-rhede/, /photovoltaik-stadtlohn/, /photovoltaik-gescher/, /photovoltaik-ahaus/, /photovoltaik-bocholt/, /photovoltaik-coesfeld/, /photovoltaik-borken/
/photovoltaik-heiden/  ≈  /photovoltaik-reken/, /photovoltaik-raesfeld/, /photovoltaik-velen/, /photovoltaik-rhede/, /photovoltaik-stadtlohn/, /photovoltaik-gescher/, /photovoltaik-ahaus/, /photovoltaik-bocholt/, /photovoltaik-coesfeld/, /photovoltaik-borken/
/photovoltaik-reken/  ≈  /photovoltaik-raesfeld/, /photovoltaik-velen/, /photovoltaik-rhede/, /photovoltaik-stadtlohn/, /photovoltaik-gescher/, /photovoltaik-ahaus/, /photovoltaik-bocholt/, /photovoltaik-coesfeld/, /photovoltaik-borken/
/photovoltaik-raesfeld/  ≈  /photovoltaik-velen/, /photovoltaik-rhede/, /photovoltaik-stadtlohn/, /photovoltaik-gescher/, /photovoltaik-ahaus/, /photovoltaik-bocholt/, /photovoltaik-coesfeld/, /photovoltaik-borken/
/photovoltaik-velen/  ≈  /photovoltaik-rhede/, /photovoltaik-stadtlohn/, /photovoltaik-gescher/, /photovoltaik-ahaus/, /photovoltaik-bocholt/, /photovoltaik-coesfeld/, /photovoltaik-borken/
/photovoltaik-rhede/  ≈  /photovoltaik-stadtlohn/, /photovoltaik-gescher/, /photovoltaik-ahaus/, /photovoltaik-bocholt/, /photovoltaik-coesfeld/, /photovoltaik-borken/
/photovoltaik-stadtlohn/  ≈  /photovoltaik-gescher/, /photovoltaik-ahaus/, /photovoltaik-bocholt/, /photovoltaik-coesfeld/, /photovoltaik-borken/
/photovoltaik-gescher/  ≈  /photovoltaik-ahaus/, /photovoltaik-bocholt/, /photovoltaik-coesfeld/, /photovoltaik-borken/
/photovoltaik-ahaus/  ≈  /photovoltaik-bocholt/, /photovoltaik-coesfeld/, /photovoltaik-borken/
/photovoltaik-bocholt/  ≈  /photovoltaik-coesfeld/, /photovoltaik-borken/
/photovoltaik-coesfeld/  ≈  /photovoltaik-borken/
/product/sun-power-light-device-2020-z141/  ≈  /product/sun-power-light-device-n12/, /product/duomax-m-plus-deg13/, /product/duomax-m-plus-deg12-3/, /product/duomax-m-plus-deg12-3-2/, /product/duomax-m-plus-deg22/, /product/duomax-m-plus-deg12/, /product/duomax-m-plus-deg12-2/, /product/duomax-m-plus-deg12-2-2/
/product/sun-power-light-device-n12/  ≈  /product/duomax-m-plus-deg13/, /product/duomax-m-plus-deg12-3/, /product/duomax-m-plus-deg12-3-2/, /product/duomax-m-plus-deg22/, /product/duomax-m-plus-deg12/, /product/duomax-m-plus-deg12-2/, /product/duomax-m-plus-deg12-2-2/
/product/duomax-m-plus-deg13/  ≈  /product/duomax-m-plus-deg12-3/, /product/duomax-m-plus-deg12-3-2/, /product/duomax-m-plus-deg22/, /product/duomax-m-plus-deg12/, /product/duomax-m-plus-deg12-2/, /product/duomax-m-plus-deg12-2-2/
/product/duomax-m-plus-deg12-3/  ≈  /product/duomax-m-plus-deg12-3-2/, /product/duomax-m-plus-deg22/, /product/duomax-m-plus-deg12/, /product/duomax-m-plus-deg12-2/, /product/duomax-m-plus-deg12-2-2/
/product/duomax-m-plus-deg12-3-2/  ≈  /product/duomax-m-plus-deg22/, /product/duomax-m-plus-deg12/, /product/duomax-m-plus-deg12-2/, /product/duomax-m-plus-deg12-2-2/
/product/duomax-m-plus-deg22/  ≈  /product/duomax-m-plus-deg12/, /product/duomax-m-plus-deg12-2/, /product/duomax-m-plus-deg12-2-2/
/product/duomax-m-plus-deg12/  ≈  /product/duomax-m-plus-deg12-2/, /product/duomax-m-plus-deg12-2-2/
/product/duomax-m-plus-deg12-2/  ≈  /product/duomax-m-plus-deg12-2-2/
```

</details>

## [MITTEL] Shop-Funktionsseiten in der Sitemap

Warenkorb/Kasse/Konto gehoeren nicht in den Index (kein Suchwert, oft Duplicate Content).

<details><summary>Betroffen</summary>

```
/cart/
/checkout/
/my-account/
```

</details>

## [MITTEL] Ohne Meta-Beschreibung

2 echte Seiten haben keine Meta-Beschreibung — Google textet den Snippet dann selbst.

<details><summary>Betroffen</summary>

```
/blog/
/category/uncategorized/
```

</details>

## [MITTEL] Doppelte Seitentitel

4 Titel kommen mehrfach vor.

<details><summary>Betroffen</summary>

```
/2019/12/31/wind-farms-now-more-affordable-2-2/  ==  /2019/12/31/wind-farms-now-more-affordable/
/2019/12/31/modern-and-quality-solar-panels/  ==  /2019/12/31/modern-and-quality-solar-panels-2/
/cart/  ==  /checkout/  ==  /cart-2/
/my-account/  ==  /my-account-2/
```

</details>

## [MITTEL] Duenne Seiten

14 echte Seiten haben unter 300 Woerter sichtbaren Text.

<details><summary>Betroffen</summary>

```
/kontakt/ (126 Woerter)
/referenzen/ (163 Woerter)
/ueber-uns/ (209 Woerter)
/wallbox/ (157 Woerter)
/stromspeicher/ (172 Woerter)
/photovoltaik/ (228 Woerter)
/gewerbe-photovoltaik/ (159 Woerter)
/mieterstrom/ (163 Woerter)
/service-wartung/ (149 Woerter)
/ratgeber-photovoltaik-kosten-2026/ (245 Woerter)
/shop/ (273 Woerter)
/terms-and-conditions/ (126 Woerter)
/blog/ (43 Woerter)
/category/uncategorized/ (292 Woerter)
```

</details>

## [NIEDRIG] Weiterleitungen in der Sitemap

1 URLs leiten weiter. In die Sitemap gehoert das Ziel.

<details><summary>Betroffen</summary>

```
/checkout/ → https://ab-solarenergy.de/cart/
```

</details>
