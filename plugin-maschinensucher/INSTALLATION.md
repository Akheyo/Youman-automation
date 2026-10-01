# MaschinensucherMarkt – Installation in einem neuen PlentyONE-System

Das Plugin hält die Inserate auf Maschinensucher.de automatisch auf dem Stand von Plenty: anlegen, ändern, pausieren (verkauft), löschen (verschickt), verlängern (Laufzeit < 7 Tage).

## 1. Voraussetzungen

- **PlentyONE-System** mit Zugang zu „Plugins“ und „Einrichtung“.
- **Maschinensucher-Händlerkonto** mit Echtzeit-API: im Maschinensucher-Kundenbereich unter *Nützliche Funktionen → Datenimport → Echtzeit-API* einen **API-Token** erzeugen. Das Feld „IP-Freigabe“ dort **leer lassen**.
- Ein **Git-Repository**, z. B. bei GitHub, GitLab oder Bitbucket, privat. Plenty installiert eigene Plugins über Git.

## 2. Plugin in ein eigenes Git-Repository legen

1. Neues, leeres **privates** Repository anlegen, z. B. `maschinensucher-plugin`.
2. Den **Inhalt** dieses Ordners (`plugin.json`, `config.json`, `src/`, `resources/` …) in die **oberste Ebene** des Repositorys legen, nicht in einen Unterordner.
3. Committen und auf den Branch `main` pushen.
4. Einen **Zugangstoken** für das Repository erzeugen, der nur Lesezugriff braucht. Plenty braucht ihn zum Abholen.

## 3. In Plenty einbinden

1. *Plugins → Plugin-Set-Übersicht*. **Wichtig:** Das Plugin-Set nehmen, das mit dem **Mandanten mit Webstore-ID 0** verknüpft ist. Die Zeitpläne des Plugins laufen **nur** in diesem Set. In einem anderen Set passiert sonst einfach nichts.
2. Im Set: *Plugin hinzufügen → Git* → Repository-URL, Benutzername, Token, Branch `main` → Speichern.
3. Plugin im Set **aktivieren** und das Set **bereitstellen**.

## 4. Protokoll einschalten

*Daten → Log → Zahnrad (Einstellungen) → MaschinensucherMarkt*: **Aktiv**, Stufe **Info**.
Beim Filtern im Log nur nach *Integration: MaschinensucherMarkt* filtern, nicht nach Mandant.

## 5. Kategorie-Eigenschaft anlegen

1. *Einrichtung → Einstellungen → Eigenschaften → Konfiguration → Eigenschaft erstellen*
   - Bereich: **Artikel**, Typ: **Auswahl**, Name: **Maschinensucher-Kategorie**
   - Gruppe: beliebig, z. B. „keine Gruppe“. Sichtbarkeiten und Optionen leer lassen.
2. Speichern und die **ID** der Eigenschaft notieren.
3. Die rund 2000 Maschinensucher-Rubriken legt das Plugin selbst als Auswahlwerte an (siehe Schritt 6). Im Log steht danach „Ergebnis der Rubrikenpflege“.

## 6. Konfiguration (im Plugin-Set → MaschinensucherMarkt → Konfiguration)

| Einstellung | Wert |
|---|---|
| **Probelauf** | **ja**, bis alles geprüft ist |
| API-Token | Token aus Schritt 1 (nicht weitergeben, nicht in Screenshots) |
| Markierung (ID) / Feld | Die Markierung, mit der Artikel für Maschinensucher gekennzeichnet werden, z. B. Markierung 1 = ID xy |
| Preisliste / Ersatzpreisliste | IDs der Verkaufspreise, aus denen der Preis kommt |
| Preis ist netto/brutto, MwSt. | passend zur Preisliste |
| Rubrik-Eigenschaft | ID aus Schritt 5 |
| Rubriken anlegen | ja |
| Auffangrubrik | optional: Rubrik für Artikel ohne eigene Kategorie |
| Ort / Land | Standort der Maschinen |
| Verschickte Artikel löschen | ja (bei Warenbestand 0 wird das Inserat gelöscht) |
| Verlängern ab Restlaufzeit (Tage) | 7 |
| Verlängern um (Monate) | eure übliche Laufzeit, 1–12 |
| Alte Inserate ändern (Test) | leer; erst testen, siehe unten |

Speichern. Ein erneutes Bereitstellen ist für Konfigurationsänderungen nicht nötig.

## 7. Erster Start (Probelauf)

1. Das Plugin liest zuerst alle Inserate, die schon bei Maschinensucher stehen, und ordnet sie über die **Referenznummer = Plenty-Artikel-ID** zu. Im Log steht dann **„Der Bestand bei Maschinensucher wurde gelesen“** mit der Zahl zugeordneter Inserate. Bevor das vollständig ist, schreibt das Plugin nichts. So entstehen keine Doppel-Inserate.
2. Alle 5 Minuten erscheint **„PROBELAUF – das wäre passiert“**. Diese Liste prüfen, vor allem die Einträge **pausieren** und **loeschen**.
3. Wenn alles stimmt: **Probelauf = nein**. Danach im Log **„Der Abgleich … ist gelaufen“** kontrollieren.

**Wichtig:** Kein zweites System, z. B. ein Testsystem, darf mit demselben API-Token schreiben.

## 8. Optional

- **Sofort beim Auftrag:** *Aufträge → Ereignisaktionen* → Ereignis z. B. „Neuer Auftrag“ → Aktion **„Maschinensucher: Inserate dieses Auftrags abgleichen“**. Ohne diese Aktion übernimmt der 5-Minuten-Abgleich.
- **Alte Inserate inhaltlich ändern:** Maschinensucher muss alte, nicht per API angelegte Inserate erst für die API freischalten (Support fragen). Danach in „Alte Inserate ändern (Test)“ zuerst 1–2 Artikel-IDs testen, dann `alle`.

## Was das Plugin wann tut (Kurzfassung)

- **Alle 5 Min.:** markierte Artikel abgleichen.
  - Neu → anlegen.
  - Geändert → senden.
  - Netto 0 (verkauft) → pausieren.
  - Warenbestand 0 (verschickt) → löschen.
  - Markierung entfernt → pausieren.
  - Wieder Bestand → aktivieren bzw. neu anlegen.
  - Laufzeit ≤ 7 Tage → verlängern.
- **Alle 15 Min.:** Bestand bei Maschinensucher lesen (Zuordnung, Status, Ablaufdatum).
- **Täglich:** Kategorien als Auswahlwerte prüfen.
- Pro Lauf höchstens 60 Änderungen, der Rest folgt im nächsten Lauf.
- Alles steht im Log unter *MaschinensucherMarkt*.
