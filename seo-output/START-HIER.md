# 🚀 START HIER — SEO für ab-solarenergy.de

Kurz und ohne Technik-Kram. Mach die Punkte **von oben nach unten** ab.
Alles Weitere (Details, fertige Texte, Skripte) liegt in den anderen Dateien dieses Ordners.

---

## ✅ Gute Nachricht: Deine Seite IST bei Google

Der Check `site:ab-solarenergy.de` zeigt: Deine Seite **ist indexiert** — Startseite,
Impressum, Datenschutz und weitere Seiten sind bei Google. Die Startseite rankt schon mit
dem Titel *„A&B Solarenergy: Photovoltaik Borken & Münsterland"*. Kein Indexierungsproblem. 👍

**Trotzdem in die Google Search Console (wichtig für Kontrolle & Wachstum):**

1. Öffne **Google Search Console**: https://search.google.com/search-console
2. Mit deinem Google-Konto anmelden → **Property hinzufügen** → `ab-solarenergy.de`.
3. Inhaberschaft bestätigen (DNS-Eintrag oder Datei — dein Hoster/WordPress-Admin hilft).
4. Links **Sitemap** einreichen: `https://ab-solarenergy.de/sitemap_index.xml` (Yoast)
   oder `.../sitemap.xml` (Rank Math).

> Damit siehst du, für welche Suchbegriffe du gefunden wirst und wo du wachsen kannst.

---

## ✅ Schritt 2: Firmendaten (verifiziert aus dem Google-Index ✅)

Diese Daten habe ich aus deinen indexierten Seiten (Impressum/Datenschutz) übernommen und
bereits ins Schema eingetragen:

| Feld | Wert |
|------|------|
| Firma | A&B Solarenergy GmbH |
| **Adresse** | **Heinrich-Hertz-Straße 6a, 46325 Borken** ✅ (klärt die alte Adress-Frage) |
| **Telefon** | **02861 / 9080137** ✅ |
| **E-Mail** | **info@ab-solarenergy.de** ✅ |
| Leistungen | Photovoltaik, Stromspeicher, Wallbox/Ladeinfrastruktur, Wartung/Service (Elektromeisterbetrieb) ✅ |
| Öffnungszeiten | Mo–Fr 08:00–16:00 ✅ |
| Region | Borken & Münsterland ✅ |

**Vom Kunden bestätigt:** keine Wärmepumpen (aus Schema/Metas entfernt) · keine zweite
Niederlassung in Münster · Bewertungs-Schema (Sterne) vorerst ausgelassen, bis echte
Google-Bewertungszahlen vorliegen (werden nie erfunden).

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
(mit 301-Weiterleitungs-Empfehlung) und vermutete ein Indexierungsproblem. **Beides ist
nicht korrekt:** `ab-solarenergie.de` gehört zur **eigenständigen Firma in Visbek**, und
deine Domain `ab-solarenergy.de` **ist bei Google indexiert** (per `site:`-Check bestätigt).
Es ist also **keine** 301-Weiterleitung nötig — der Fokus liegt auf den echten Hebeln:
Schema, Metas, Content-Tiefe, lokale Signale und Google Business Profil.
