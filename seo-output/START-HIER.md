# 🚀 START HIER — SEO für ab-solarenergy.de

Kurz und ohne Technik-Kram. Mach die Punkte **von oben nach unten** ab.
Alles Weitere (Details, fertige Texte, Skripte) liegt in den anderen Dateien dieses Ordners.

---

## ⚠️ Das WICHTIGSTE zuerst: Ist deine Seite überhaupt bei Google?

Bei der Recherche kam heraus: Wenn man bei Google nach **ab-solarenergy.de** sucht,
**taucht deine Seite nicht auf**. Was auftaucht, ist `ab-solarenerg**ie**.de` — aber das
ist eine **andere Firma** (A&B-Solarenergie GmbH in **Visbek**), NICHT deine.

👉 Das heißt vermutlich: **Deine Seite ist bei Google nicht (richtig) indexiert.**
Solange das so ist, bringt jede weitere Optimierung wenig. Das ist Problem Nummer 1.

**Das machst du zuerst (ca. 15 Min, kein Programmieren):**

1. Geh zu Google und tippe genau das ein: `site:ab-solarenergy.de`
   - **Kommen Ergebnisse?** → gut, Seite ist drin. Weiter zu Schritt 2.
   - **Nichts / kaum was?** → Seite ist nicht indexiert. Dann:
2. Öffne **Google Search Console**: https://search.google.com/search-console
3. Mit deinem Google-Konto anmelden → **Property hinzufügen** → deine Domain `ab-solarenergy.de` eintragen.
4. Inhaberschaft bestätigen (Google zeigt dir, wie — meist ein DNS-Eintrag oder eine Datei; dein Webhoster/WordPress-Admin hilft dabei).
5. In der Search Console links **Sitemap** einreichen: `https://ab-solarenergy.de/sitemap_index.xml`
   (bei Yoast) oder `.../sitemap.xml` (bei Rank Math).
6. Bei den wichtigsten Seiten oben in der **URL-Prüfung** die Adresse eingeben → **Indexierung beantragen**.

> Das ist der Hebel mit der größten Wirkung. Ohne Indexierung findet dich niemand.

---

## ✅ Schritt 2: Firmendaten prüfen (5 Min)

Für lokales SEO müssen deine Daten überall **exakt gleich** sein. Bitte bestätige mir:

- **Adresse:** In den Registern stehen zwei — `Lange Stiege 66` (alte UG) und
  `Heinrich-Hertz-Straße 6a` (GmbH), beide 46325 Borken. **Welche ist heute aktuell?**
- **Telefon, E-Mail, Öffnungszeiten:** (stehen noch als Platzhalter in den Dateien)
- **Eure Leistungen:** Photovoltaik, Speicher, Wallbox, Wärmepumpe, Wartung — stimmt das? Fehlt was?

Sobald du mir das gibst, trage ich es in Schema + Texte ein.

---

## ✅ Schritt 3: Schnelle Gewinne einbauen (30–45 Min, Copy-Paste)

Ganz ohne Skripte, direkt in WordPress:

1. **Titel & Beschreibungen:** Datei **`02-META-COPY-PASTE.md`** öffnen → für jede Seite den
   Titel + die Meta-Description in **Yoast/Rank Math** (unterhalb der Seite) einfügen → Aktualisieren.
2. **Schema-Markup:** Datei **`03-schema/organization-localbusiness.jsonld`** — den Inhalt per
   Plugin „Insert Headers and Footers" (o. ä.) in den `<head>` einfügen, ODER das mitgelieferte
   mu-Plugin nutzen (siehe `implementation/`).
3. **robots.txt:** Inhalt aus **`04-robots.txt`** übernehmen (in Yoast/Rank Math unter
   Werkzeuge → Datei-Editor).

---

## ✅ Schritt 4: Google Business Profil (wichtig für lokale Solar-Kunden)

1. https://business.google.com → dein Profil beanspruchen/erstellen.
2. Kategorie „Solaranlagenanbieter" / „Elektriker", Adresse, Telefon, Öffnungszeiten,
   Fotos, Leistungen eintragen — **identisch** zur Website.
3. **Bewertungen aktiv einsammeln** (zufriedene Kunden um eine Google-Rezension bitten).

---

## 🤖 Schritt 5 (optional): Alles automatisch umsetzen lassen

Wenn die Agenten die Änderungen **selbst live in WordPress** machen sollen, geht das nur aus
einer Umgebung mit offenem Internet-Zugang — am einfachsten das **lokale Claude-Code-CLI**.
Details & fertiges Skript: **`implementation/README.md`** und **`NETWORK-POLICY.md`**.

---

## 📂 Was in diesem Ordner liegt

| Datei | Inhalt |
|-------|--------|
| `START-HIER.md` | **Diese Anleitung** |
| `00-AUDIT-REPORT.md` | Voller Audit + Health-Score |
| `01-ACTION-PLAN.md` | Priorisierte Maßnahmen (Kritisch → Niedrig) |
| `02-META-COPY-PASTE.md` | Fertige Titel & Meta-Descriptions |
| `03-schema/` | Fertige JSON-LD Schema-Bausteine |
| `04-robots.txt` | Empfohlene robots.txt |
| `05-LOCAL-SEO-GEO.md` | Local-SEO- & Bewertungs-Plan |
| `06-CONTENT-PLAN.md` | Content-/Keyword-Plan |
| `implementation/` | Skript + mu-Plugin für automatische Umsetzung |
| `NETWORK-POLICY.md` | Wie eine Live-Session eingerichtet wird |

---

### Korrektur-Hinweis (wichtig)

Ein früherer Report-Teil deutete `ab-solarenergie.de` als „Domain-Dublette" deiner Seite
(mit 301-Weiterleitungs-Empfehlung). **Das ist nicht korrekt** — `ab-solarenergie.de` gehört
zur **eigenständigen Firma in Visbek**. Deine Aufgabe ist deshalb **keine** 301-Weiterleitung,
sondern sicherzustellen, dass **deine** Domain `ab-solarenergy.de` sauber indexiert wird
(Schritt 1 oben).
