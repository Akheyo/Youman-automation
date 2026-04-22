# Youman – Roadmap

## MVP (aktueller Stand)

✅ Windows Desktop App (Electron + React + TypeScript)  
✅ Login per E-Mail/Passwort mit Tenant-Slug  
✅ Multi-Tenant-Architektur mit Row-Level-Isolation  
✅ Rollen/Rechte-System (6 Rollen)  
✅ Branding pro Tenant (Farben, Logo, App-Name)  
✅ SAP OData Connector + Mock-Adapter  
✅ Config-driven Action Engine (JSON → Formular)  
✅ Kunden- und Artikelsuche (Live, Typeahead)  
✅ Inline-Neuanlage von Kunden, Artikeln, Adressen  
✅ Angebot-erstellen-Flow (inkl. Positionstabelle)  
✅ Offline-Queue (SQLite lokal, PostgreSQL serverseitig)  
✅ Sync-Mechanik mit Retry und Dead-Letter  
✅ Audit-Log für alle Aktionen  
✅ Queue-Status-Anzeige im UI  
✅ Admin-Panel (Einstellungen, Branding, Connector, User)  
✅ Swagger API-Dokumentation  
✅ NSIS-Windows-Installer-Build  

---

## v1.1 – Stabilisierung & SAP-Vertiefung

- [ ] SAP-RFC-Connector (für ältere ECC-Systeme, node-rfc)
- [ ] SAP CSRF-Token-Refresh-Logic verbessern
- [ ] Preisabfrage pro Artikel + Menge in Positionstabelle
- [ ] Lagerbestandsanzeige im Artikel-Suchresultat
- [ ] Adress-Auswahl-Dialog (mehrere Lieferadressen)
- [ ] E-Mail-Entwurf per MAPI/Outlook-Integration
- [ ] PDF-Download und lokale Anzeige
- [ ] Test-Coverage Backend (>80%)

---

## v1.2 – UX & Produktivität

- [ ] Keyboard-Shortcuts (Strg+N, Strg+K Spotlight-Suche)
- [ ] Globale Schnellsuche (Kunden + Artikel + Aktionen)
- [ ] Favoriten / angepinnte Aktionen
- [ ] Zuletzt verwendet / Verlauf
- [ ] Benutzer-Einstellungen (Sprache, Datumsformat)
- [ ] Optimistic UI Updates
- [ ] Formular-Templates / Vorausfüllen

---

## v1.3 – Enterprise-Features

- [ ] OIDC/SAML SSO-Integration (Azure AD, Okta)
- [ ] 2FA (TOTP)
- [ ] Webhook-Support für Folgeaktionen
- [ ] Tenant-Admin-Portal (Web-UI)
- [ ] Billing/Subscription Management
- [ ] White-Labeling (eigener App-Name + Installer)
- [ ] Mehrsprachigkeit (i18n, EN/DE/FR)

---

## v2.0 – Multi-Connector

- [ ] SAP S/4HANA Public Cloud (BAPI REST)
- [ ] Microsoft Dynamics 365
- [ ] Salesforce CRM
- [ ] Connector-Konfiguration per Admin-UI (ohne DB-Direktzugriff)
- [ ] Connector-Health-Dashboard
- [ ] API-Rate-Limiting pro Connector

---

## Known Limitations (v1.0)

- SAP OData Connector erwartet Standard-Entitäts-Set-Namen (konfigurierbar, aber initial SAP ECC-spezifisch)
- Offline-Queue synchronisiert sequentiell, keine parallele Verarbeitung
- Kein echtes WebSocket für Echtzeit-Status-Updates (Polling alle 5-10s)
- Admin-UI ist read-only für Connector-Einstellungen (DB-Direktkonfiguration notwendig)
- Keine automatischen DB-Backups im Produktionsbetrieb (Betreiber-Verantwortung)
- SQLite Offline-Queue wird bei App-Deinstallation gelöscht (Daten ggf. verloren)
