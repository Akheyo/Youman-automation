# Kaufland-Produktkategorien DE — Rohliste

5230 Einträge, geholt am 2026-10-12 über Weg B (`POST /rest/login` für ein
Bearer-Token, damit der eine lesende Aufruf
`POST /rest/wizards/kaufland_categories_wizard/formfields/category?optionId=default`
mit `{"storefront":"de"}` — HTTP 200, Antwort unverändert als
`kaufland-kategorien-de.json` abgelegt). Ein Browser war dafür nicht nötig, der
Assistent wurde nicht geöffnet. **Es wurde kein Katalog und keine Konfiguration
angelegt** — keine weiteren schreibenden Aufrufe, nichts gespeichert.
