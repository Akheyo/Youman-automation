<?php

/**
 * Prüft die reine Logik des Plugins: Spaltenplan, CSV, Inserat, Notbremse,
 * Abbildung der Plenty-Daten.
 *
 *   php tests/run.php
 *
 * Was hier NICHT geprüft wird, weil es ein laufendes Plenty braucht: die
 * Suche, der Storage, die Plugin-Datenbank und die Route. Das steht so im
 * README, damit niemand die grüne Ausgabe für mehr hält, als sie ist.
 */

require __DIR__ . '/Pruefer.php';
foreach (glob(__DIR__ . '/../src/Logik/*.php') as $datei) {
    require_once $datei;
}

use MaschinensucherMarkt\Logik\Antwort;
use MaschinensucherMarkt\Logik\Bestandsabgleich;
use MaschinensucherMarkt\Logik\Entscheidung;
use MaschinensucherMarkt\Logik\Inseratdaten;
use MaschinensucherMarkt\Logik\Artikelabbildung;
use MaschinensucherMarkt\Logik\Csv;
use MaschinensucherMarkt\Logik\Inserat;
use MaschinensucherMarkt\Logik\Rueckgang;
use MaschinensucherMarkt\Logik\Spaltenplan;

$p = new Pruefer();

// ---------------------------------------------------------------------------
$p->gruppe('Spaltenplan');

$standard = Spaltenplan::bauen('');
$p->wahr(count($standard['spalten']) >= 32, 'erreicht die genannte Mindestbreite von 32 Spalten');
$p->gleich('standard', $standard['herkunft'], 'ohne Kopfzeile gilt die Standardreihenfolge');

$plan = Spaltenplan::bauen('Anzeigennummer;Kategorie;Bezeichnung;Hersteller;Preis;Beschreibung;Land;PLZ;Ort;Bild 1');
$felder = array();
foreach ($plan['spalten'] as $spalte) {
    $felder[] = $spalte['feld'];
}
$p->gleich(
    array('inseratsnummer', 'kategorie', 'titel', 'hersteller', 'preis', 'beschreibung', 'land', 'plz', 'ort', 'bild1'),
    $felder,
    'ordnet unsere Felder auf die Spalten der Beispieldatei zu'
);
$p->gleich('beispieldatei', $plan['herkunft'], 'erkennt die hinterlegte Kopfzeile');

$luecken = Spaltenplan::bauen('Bezeichnung;Hersteller');
$p->wahr(in_array('preis', $luecken['fehlendePflicht'], true), 'nennt den fehlenden Preis');
$p->wahr(in_array('kategorie', $luecken['fehlendePflicht'], true), 'nennt die fehlende Kategorie');

$fremd = Spaltenplan::bauen('Kategorie;Haendlerrabatt;Preis');
$p->gleich(null, $fremd['spalten'][1]['feld'], 'lässt eine unbekannte Spalte leer, statt die Zeile zu verschieben');
$p->gleich(array('Haendlerrabatt'), $fremd['unbelegt'], 'meldet die Spalte, die wir nicht befüllen');

$bilder = Spaltenplan::bauen('Bild 10;Bild 1');
$p->gleich(null, $bilder['spalten'][0]['feld'], 'verwechselt Bild 1 nicht mit Bild 10');
$p->gleich('bild1', $bilder['spalten'][1]['feld'], 'findet das echte Bild 1');

// ---------------------------------------------------------------------------
$p->gruppe('CSV');

$p->gleich('"Bagger; gebraucht"', Csv::feld('Bagger; gebraucht'), 'quotet, sobald das Trennzeichen im Text steht');
$p->gleich('"Typ ""A"""', Csv::feld('Typ "A"'), 'verdoppelt Anführungszeichen im Text');
$p->gleich('Zeile 1 Zeile 2', Csv::feld("Zeile 1\nZeile 2"), 'macht aus Umbrüchen standardmäßig Leerzeichen');
$p->gleich("\"A\nB\"", Csv::feld("A\nB", ';', 'behalten'), 'behält Umbrüche auf Wunsch — dann in Anführungszeichen');

$kleinerPlan = Spaltenplan::bauen('Kategorie;Haendlerrabatt;Preis');
$p->gleich(
    '12;;1900,00',
    Csv::zeile(array('kategorie' => '12', 'preis' => '1900,00'), $kleinerPlan['spalten']),
    'füllt die unbekannte Spalte leer'
);

$datei = Csv::datei(
    array(array('kategorie' => '1', 'preis' => '10,00'), array('kategorie' => '2', 'preis' => '20,00')),
    Spaltenplan::bauen('Kategorie;Preis')
);
$p->gleich("Kategorie;Preis\r\n1;10,00\r\n2;20,00\r\n", $datei, 'schreibt Kopfzeile, je Inserat eine Zeile und endet mit Umbruch');

// Eine "Kopfzeile" ohne Trennzeichen ist fast immer ein Versehen — dann gilt
// die Standardreihenfolge, und die Konfigurationsseite sagt das auch.
$p->gleich('standard', Spaltenplan::bauen('Kategorie')['herkunft'], 'eine Kopfzeile ohne Trennzeichen zaehlt nicht');

$breiten = array();
foreach (explode("\r\n", trim(Csv::datei(array(array('titel' => 'A'), array()), $standard))) as $zeile) {
    $breiten[] = count(explode(';', $zeile));
}
$p->gleich(1, count(array_unique($breiten)), 'hält bei jeder Zeile dieselbe Spaltenzahl ein');

$p->enthaelt('EUR', Csv::kodiere('Preis 10 €', 'latin1'), 'rettet bei latin1 das Eurozeichen');
$p->gleich("\xEF\xBB\xBF", substr(Csv::kodiere('Größe', 'utf-8'), 0, 3), 'stellt UTF-8 ein BOM voran');

// ---------------------------------------------------------------------------
$p->gruppe('Inserat');

$umgebung = array(
    'nummernPraefix' => 'KK-',
    'preisIst' => 'brutto',
    'mwst' => 19,
    'waehrung' => 'EUR',
    'land' => 'DE',
    'plz' => '70565',
    'ort' => 'Stuttgart',
    'ansprechpartner' => 'Verkauf',
    'telefon' => '0711 000',
    'email' => 'maschinensucher@komplett-konzept.de',
    'kategorieStandard' => '9999',
    'kategorieZuordnung' => array('drehmaschine' => '1234'),
    'shopBasisUrl' => 'https://shop.example.de',
);

$artikel = array(
    'variationId' => 90210,
    'itemId' => 65932,
    'nummer' => 'KK-2024-0815',
    'ean' => '2000000047119',
    'titel' => 'Weiler Drehmaschine Praktikant',
    'beschreibung' => '<p>Gut erhalten.</p>',
    'hersteller' => 'Weiler',
    'modell' => 'Praktikant',
    'baujahr' => '1998',
    'zustand' => 'Gebraucht',
    'preis' => 2261.00,
    'bestand' => 1,
    'gewichtG' => 850000,
    'laengeMM' => 1800,
    'breiteMM' => 800,
    'hoeheMM' => 1400,
    'aktiv' => true,
    'bilder' => array('https://cdn.plenty/1.jpg'),
    'kategorie' => '',
);

$voll = Inserat::bauen($artikel, $umgebung);
$p->gleich(array(), $voll['maengel'], 'ein vollständiger Artikel hat keine Mängel');
// Voreinstellung ist die Plenty-Artikel-ID: Danach sucht Maschinensucher ein
// bestehendes Inserat.
$p->gleich('KK-65932', $voll['werte']['inseratsnummer'], 'bildet die Nummer aus der Artikel-ID');
$mitVariantennummer = Inserat::bauen($artikel, array_merge($umgebung, array('nummernQuelle' => 'variantennummer')));
$p->gleich('KK-2024-0815', $mitVariantennummer['werte']['inseratsnummer'], 'setzt den Vorsatz nicht doppelt davor');
$p->gleich('1900,00', $voll['werte']['preis'], 'rechnet 2261 brutto auf 1900 netto');
$p->gleich('netto', $voll['werte']['preisart'], 'zeichnet netto aus');
$p->gleich('1234', $voll['werte']['kategorie'], 'nimmt die Kategorie aus der Zuordnung');
$p->gleich('850,0', $voll['werte']['gewicht'], 'rechnet Gramm in Kilogramm');
$p->gleich('180', $voll['werte']['laenge'], 'rechnet Millimeter in Zentimeter');
$p->gleich('https://cdn.plenty/1.jpg', $voll['werte']['bild1'], 'übernimmt das erste Foto');
$p->gleich(true, Inserat::vollstaendig($voll), 'und darf damit in die Datei');

$netto = Inserat::bauen($artikel, array_merge($umgebung, array('preisIst' => 'netto')));
$p->gleich('2261,00', $netto['werte']['preis'], 'lässt den Preis stehen, wenn Plenty netto führt');

$ohnePreis = Inserat::bauen(array_merge($artikel, array('preis' => null)), $umgebung);
$p->enthaelt('Kein Preis', $ohnePreis['maengel'], 'hält einen Artikel ohne Preis zurück');

$ohneBild = Inserat::bauen(array_merge($artikel, array('bilder' => array())), $umgebung);
$p->enthaelt('Keine Fotos', $ohneBild['maengel'], 'hält einen Artikel ohne Foto zurück');

$verkauft = Inserat::bauen(array_merge($artikel, array('bestand' => 0)), $umgebung);
$p->enthaelt('Kein Bestand', $verkauft['maengel'], 'nimmt Verkauftes vom Markt');
$p->gleich(false, Inserat::vollstaendig($verkauft), 'und lässt es aus der Datei fallen');

$inaktiv = Inserat::bauen(array_merge($artikel, array('aktiv' => false)), $umgebung);
$p->enthaelt('inaktiv', $inaktiv['maengel'], 'hält zurück, was in Plenty abgeschaltet ist');

$ohneStandort = Inserat::bauen($artikel, array_merge($umgebung, array('plz' => '', 'ort' => '')));
$p->enthaelt('Kein Standort', $ohneStandort['maengel'], 'meldet den fehlenden Standort als Mangel der Einrichtung');

$luecke = Inserat::bauen(array_merge($artikel, array('hersteller' => '', 'baujahr' => '', 'gewichtG' => null)), $umgebung);
$p->gleich('', $luecke['werte']['baujahr'], 'erfindet kein Baujahr');
$p->gleich('', $luecke['werte']['gewicht'], 'schätzt kein Gewicht');
$p->gleich(array(), $luecke['maengel'], 'hält deswegen aber nichts auf');
$p->enthaelt('Kein Baujahr', $luecke['hinweise'], 'sagt es als Hinweis');

$viele = array();
for ($i = 0; $i < 11; $i++) {
    $viele[] = 'https://cdn.plenty/' . $i . '.jpg';
}
$mitVielen = Inserat::bauen(array_merge($artikel, array('bilder' => $viele)), $umgebung);
$p->gleich('https://cdn.plenty/7.jpg', $mitVielen['werte']['bild8'], 'nimmt höchstens acht Fotos');
$p->wahr(!isset($mitVielen['werte']['bild9']), 'und kein neuntes');
$p->enthaelt('ersten 8', $mitVielen['hinweise'], 'sagt, dass mehr da waren');

$eigene = Inserat::bauen(array_merge($artikel, array('kategorie' => '777')), $umgebung);
$p->gleich('777', $eigene['werte']['kategorie'], 'die Rubrik am Artikel gewinnt gegen die Zuordnung');

$fremdeWare = Inserat::bauen(array_merge($artikel, array('titel' => 'Rollcontainer', 'hersteller' => '', 'modell' => '')), $umgebung);
$p->gleich('9999', $fremdeWare['werte']['kategorie'], 'sonst greift die Auffangkategorie');
$p->enthaelt('Auffangkategorie', $fremdeWare['hinweise'], 'und sagt, dass sie gegriffen hat');

$p->gleich(
    'Gut erhalten.' . "\n\n" . '· Kratzer' . "\n" . '· Delle',
    Inserat::alsFliesstext('<p>Gut erhalten.</p><ul><li>Kratzer</li><li>Delle</li></ul>'),
    'macht aus HTML lesbaren Text mit Aufzählung'
);
$p->gleich('Fräse größer', Inserat::alsFliesstext('<p>Fr&auml;se gr&ouml;&szlig;er</p>'), 'löst Entitäten auf');
$p->gleich('Weiler Drehmaschine', Inserat::kuerze('Weiler Drehmaschine Praktikant', 20), 'kürzt an der Wortgrenze');

// ---------------------------------------------------------------------------
$p->gruppe('Notbremse');

$erster = Rueckgang::pruefe(0, null, null, 1000);
$p->gleich(false, $erster['blockiert'], 'lässt den ersten Lauf durch');

$klein = Rueckgang::pruefe(2, 6, null, 1000);
$p->gleich(false, $klein['blockiert'], 'greift unterhalb der Schwelle nicht');

$normal = Rueckgang::pruefe(180, 200, null, 1000);
$p->gleich(false, $normal['blockiert'], 'lässt normale Schwankungen durch');

$einbruch = Rueckgang::pruefe(0, 200, null, 1000);
$p->gleich(true, $einbruch['blockiert'], 'hält einen Einbruch zurück');
$p->enthaelt('0 statt zuletzt 200', $einbruch['meldung'], 'und sagt, worum es geht');

$frei = Rueckgang::pruefe(0, 200, 2000, 1000);
$p->gleich(false, $frei['blockiert'], 'lässt ihn nach einer Freigabe durch');
$p->enthaelt('Rückgang', $frei['meldung'], 'sagt trotzdem, was passiert');

$abgelaufen = Rueckgang::pruefe(0, 200, 900, 1000);
$p->gleich(true, $abgelaufen['blockiert'], 'achtet eine abgelaufene Freigabe nicht mehr');
$p->gleich(1000 + 12 * 3600, Rueckgang::freigabeBis(1000), 'eine Freigabe gilt eine Nacht');

// ---------------------------------------------------------------------------
$p->gruppe('Artikelabbildung');

$variante = array(
    'id' => 90210,
    'itemId' => 4711,
    'number' => 'SYNC-A',
    'model' => 'Praktikant',
    'isActive' => true,
    'weightG' => 850000,
    'lengthMM' => 1800,
    'variationBarcodes' => array(array('code' => '2000000047119')),
    'variationSalesPrices' => array(
        array('salesPriceId' => 1, 'price' => 2261),
        array('salesPriceId' => 4, 'price' => 2600),
    ),
    'stock' => array(array('netStock' => 2), array('netStock' => 1)),
    'item' => array(
        'id' => 4711,
        'manufacturerId' => 7,
        'condition' => 1,
        'flagOne' => 27,
        'texts' => array(
            array('lang' => 'en', 'name1' => 'Lathe', 'description' => '<p>Used.</p>'),
            array('lang' => 'de', 'name1' => 'Weiler Drehmaschine', 'description' => '<p>Gut.</p>'),
        ),
    ),
);

$p->gleich(true, Artikelabbildung::istMarkiert($variante, 27, 'flagOne'), 'erkennt die Markierung im ersten Feld');
$p->gleich(false, Artikelabbildung::istMarkiert($variante, 27, 'flagTwo'),
    'lässt die gleiche Nummer im zweiten Feld nicht gelten — getrennte Listen');
$p->gleich(true, Artikelabbildung::istMarkiert($variante, 27, 'beide'), 'liest auf Wunsch beide Felder');
$p->gleich(false, Artikelabbildung::istMarkiert($variante, 3, 'flagOne'), 'eine andere ID zählt nicht');
$p->gleich(false, Artikelabbildung::istMarkiert(array('id' => 1), 27, 'flagOne'), 'ohne Markierung ist nichts markiert');
$p->gleich(false, Artikelabbildung::istMarkiert($variante, 0, 'flagOne'), 'ohne eingestellte ID geht gar nichts raus');

$p->gleich(3.0, Artikelabbildung::bestand($variante), 'zählt den Bestand über alle Lager');
$p->gleich(null, Artikelabbildung::bestand(array('id' => 1)), 'unterscheidet "unbekannt" von "keiner"');
$p->gleich(0.0, Artikelabbildung::bestand(array('stock' => array(array('netStock' => 0)))), 'Bestand 0 bleibt 0');

$p->gleich(2261.0, Artikelabbildung::preis($variante, null)['preis'], 'nimmt ohne Vorgabe die kleinste Preislisten-ID');
$p->gleich(2600.0, Artikelabbildung::preis($variante, 4)['preis'], 'nimmt die vorgegebene Preisliste');
$p->gleich(null, Artikelabbildung::preis($variante, 99)['preis'], 'lieber kein Preis als der einer fremden Liste');

// Die Ersatzliste: Die eigene Marktplatz-Liste ist am Anfang meist leer,
// waehrend im Webshop laengst ein Preis steht.
$ersatz = Artikelabbildung::preis($variante, 25, 1);
$p->gleich(2261.0, $ersatz['preis'], 'springt auf die Ersatzliste, wenn die erste leer ist');
$p->gleich(true, $ersatz['ersatz'], 'und sagt, dass der Preis von dort kam');
$p->gleich(false, Artikelabbildung::preis($variante, 4, 1)['ersatz'], 'nimmt die erste Liste, wenn sie gefuellt ist');
$p->gleich(null, Artikelabbildung::preis($variante, 25, 99)['preis'], 'ohne beide bleibt es beim Nichts');

$abgebildet = Artikelabbildung::ausVariante($variante, array(7 => 'Weiler'), array('https://cdn/1.jpg'), null);
$p->gleich('Weiler Drehmaschine', $abgebildet['titel'], 'nimmt den deutschen Titel');
$p->gleich('Weiler', $abgebildet['hersteller'], 'löst die Hersteller-ID auf');
$p->gleich('Gebraucht', $abgebildet['zustand'], 'übersetzt den Plenty-Zustand');
$p->gleich('2000000047119', $abgebildet['ean'], 'nimmt den ersten Barcode');
$p->gleich(3.0, $abgebildet['bestand'], 'trägt den Bestand mit');
$p->gleich(false, $abgebildet['preisErsatz'], 'merkt sich, aus welcher Liste der Preis kam');

$nackt = Artikelabbildung::ausVariante(array('id' => 1), array(), array(), null);
$p->gleich('', $nackt['titel'], 'kommt mit einer nackten Variante zurecht');
$p->gleich(null, $nackt['preis'], 'und erfindet keinen Preis');

// ---------------------------------------------------------------------------
$p->gruppe('Inseratsnummer');

// Daran erkennt Maschinensucher ein bestehendes Inserat wieder. Eine andere
// Nummer legt neben jedem laufenden Inserat ein zweites an.
$mitIds = array('itemId' => 62923, 'nummer' => 'NEW-33177', 'variationId' => 56103);
$p->gleich('62923', Inserat::nummernQuelle($mitIds, 'itemId'), 'nimmt die Plenty-Artikel-ID');
$p->gleich('NEW-33177', Inserat::nummernQuelle($mitIds, 'variantennummer'), 'oder die Variantennummer');
$p->gleich('56103', Inserat::nummernQuelle($mitIds, 'variationId'), 'oder die Varianten-ID');
$p->gleich('62923', Inserat::nummernQuelle($mitIds, 'quatsch'), 'und im Zweifel die Artikel-ID');
$p->gleich('56103', Inserat::nummernQuelle(array('variationId' => 56103, 'nummer' => ''), 'variantennummer'),
    'faellt ohne Variantennummer auf die Varianten-ID zurueck');

$nachPlenty = Inserat::bauen(
    array_merge($artikel, array('itemId' => 62923)),
    array_merge($umgebung, array('nummernQuelle' => 'itemId', 'nummernPraefix' => ''))
);
$p->gleich('62923', $nachPlenty['werte']['inseratsnummer'], 'im Inserat steht dann genau die Artikel-ID');
$p->gleich('KK-2024-0815', $nachPlenty['werte']['interne_nummer'], 'die Variantennummer bleibt als interne Nummer erhalten');

$mitErsatzpreis = Inserat::bauen(
    array_merge($artikel, array('preis' => 2261.00, 'preisErsatz' => true)),
    array_merge($umgebung, array('preisIst' => 'netto', 'preisIstErsatz' => 'brutto'))
);
$p->gleich('1900,00', $mitErsatzpreis['werte']['preis'],
    'ein Preis aus der Ersatzliste wird nach DEREN Einstellung gerechnet');

// Die ganze Kette: Variante aus Plenty -> Inserat -> Zeile in der Datei.
$p->gruppe('Ganze Kette');
$ausPlenty = Artikelabbildung::ausVariante($variante, array(7 => 'Weiler'), array('https://cdn/1.jpg'), null);
$inserat = Inserat::bauen($ausPlenty, $umgebung);
$p->gleich(array(), $inserat['maengel'], 'aus einer echten Variante entsteht ein vollständiges Inserat');
$zeile = Csv::zeile($inserat['werte'], Spaltenplan::bauen('')['spalten']);
$p->enthaelt('1900,00', $zeile, 'und in der Zeile steht der Nettopreis');
$p->enthaelt('Weiler Drehmaschine', $zeile, 'und der Titel');

// --- Auswertung der API-Antworten ---------------------------------------
// Die teuerste Verwechslung dieses Plugins: Ablehnung (endgueltig, der
// Artikel braucht eine Korrektur) gegen Stoerung (voruebergehend, spaeter
// nochmal). Deshalb steht jeder Zweig hier einzeln.
$p->gruppe('API-Antworten');

$ok = Antwort::lesen(array('status' => 200, 'daten' => array('success' => true, 'id' => 5954193)));
$p->gleich(Antwort::OK, $ok['art'], '200 mit success=true ist ein Erfolg');
$p->gleich(false, Antwort::nochmal($ok), 'und wird nicht wiederholt');

$abgelehnt = Antwort::lesen(array('status' => 200, 'daten' => array(
    'success' => false,
    'errors' => array('title' => array('Machine type cannot be blank.')),
)));
$p->gleich(Antwort::ABGELEHNT, $abgelehnt['art'],
    '200 mit success=false ist KEIN Erfolg, auch wenn der Status es nahelegt');
$p->gleich(false, Antwort::nochmal($abgelehnt), 'eine Ablehnung wird nicht wiederholt');
$p->enthaelt('title: Machine type cannot be blank.', $abgelehnt['meldung'],
    'der Grund steht samt Feldname in der Meldung');

$keineVerbindung = Antwort::lesen(array('status' => 0, 'fehler' => 'Verbindung fehlgeschlagen: timeout'));
$p->gleich(Antwort::STOERUNG, $keineVerbindung['art'], 'ohne Verbindung ist es eine Stoerung');
$p->gleich(true, Antwort::nochmal($keineVerbindung), 'und die wird spaeter erneut versucht');

$serverfehler = Antwort::lesen(array('status' => 503, 'daten' => array()));
$p->gleich(Antwort::STOERUNG, $serverfehler['art'], '5xx ist eine Stoerung der Gegenstelle');
$p->gleich(true, Antwort::nochmal($serverfehler), 'und wird wiederholt');

$falscherToken = Antwort::lesen(array('status' => 401, 'daten' => array('message' => 'Your request was made with invalid credentials.')));
$p->gleich(Antwort::ZUGANG, $falscherToken['art'], '401 ist ein Zugangsproblem');
$p->gleich(false, Antwort::nochmal($falscherToken),
    'ein falscher Token wird NICHT wiederholt - das sperrt nur den Zugang');

$zuSchnell = Antwort::lesen(array('status' => 403, 'daten' => array('message' => 'Listing creation rate exceeded.')));
$p->gleich(Antwort::ZUGANG, $zuSchnell['art'], 'die Mengenbegrenzung kommt als 403');
$p->gleich(true, Antwort::nochmal($zuSchnell),
    'sie ist aber voruebergehend und wird deshalb spaeter erneut versucht');

$weg = Antwort::lesen(array('status' => 404, 'daten' => array('message' => 'Listing not found')));
$p->gleich(Antwort::FEHLT, $weg['art'], '404 heisst: dieses Inserat gibt es nicht mehr');
$p->gleich(false, Antwort::nochmal($weg), 'und das aendert sich durch Wiederholen nicht');

$einzelmeldung = Antwort::lesen(array('status' => 400, 'daten' => array(
    'errors' => array('price' => 'must be an integer'),
)));
$p->gleich(Antwort::ABGELEHNT, $einzelmeldung['art'], '4xx ohne success-Feld ist eine Ablehnung');
$p->enthaelt('price: must be an integer', $einzelmeldung['meldung'],
    'auch ein einzelner Text statt einer Liste wird gelesen');

$mitHinweis = Antwort::lesen(array('status' => 200, 'daten' => array(
    'success' => true,
    'warnings' => array('images' => array('Image 9 was ignored.')),
)));
$p->gleich(Antwort::OK, $mitHinweis['art'], 'Hinweise machen aus einem Erfolg keine Ablehnung');
$p->gleich(array('images' => array('Image 9 was ignored.')), $mitHinweis['hinweise'],
    'sie bleiben aber erhalten');

$leer = Antwort::lesen(array());
$p->gleich(Antwort::STOERUNG, $leer['art'], 'eine voellig leere Antwort gilt als Stoerung, nicht als Erfolg');

// --- Was drueben schon online steht ------------------------------------
// Die Daten sind dem echten Konto nachgebildet: 591 Inserate, von denen
// die meisten die Plenty-Artikel-ID als Referenz tragen, einige aber einen
// Namen und eines gar nichts.
$p->gruppe('Bestandsabgleich');

$p->gleich(62923, Bestandsabgleich::artikelIdAus('62923'), 'eine reine Zahl ist die Artikel-ID');
$p->gleich(62923, Bestandsabgleich::artikelIdAus('  62923  '), 'Leerzeichen stoeren nicht');
$p->gleich(0, Bestandsabgleich::artikelIdAus('Thomas 3'),
    'ein Name ist keine Artikel-ID - lieber keine Zuordnung als eine falsche');
$p->gleich(0, Bestandsabgleich::artikelIdAus(''), 'eine leere Referenz ebenso');
$p->gleich(0, Bestandsabgleich::artikelIdAus('62923-alt'),
    'und auch nichts, was nur so aussieht wie eine - das wuerde ein fremdes Inserat ueberschreiben');
$p->gleich(62923, Bestandsabgleich::artikelIdAus('KK-62923', 'KK-'), 'ein gepflegter Vorsatz wird abgezogen');

$p->gleich(Bestandsabgleich::AKTIV, Bestandsabgleich::zustandAus(array('ACTIVE')), 'ACTIVE ist aktiv');
$p->gleich(Bestandsabgleich::PAUSIERT, Bestandsabgleich::zustandAus(array('PAUSED')), 'PAUSED ist pausiert');
$p->gleich(Bestandsabgleich::PAUSIERT, Bestandsabgleich::zustandAus(array('EXPIRED')),
    'abgelaufen zaehlt wie pausiert - es ist nicht mehr sichtbar');
$p->gleich(Bestandsabgleich::GESPERRT, Bestandsabgleich::zustandAus(array('ACTIVE', 'BLOCKED')),
    'gesperrt schlaegt aktiv, wenn beides gesetzt ist');
$p->gleich(Bestandsabgleich::AKTIV, Bestandsabgleich::zustandAus(array('ACTIVE', 'PENDING_UPDATE')),
    'waehrend einer Pruefung bleibt die alte Fassung online, also aktiv');
$p->gleich(Bestandsabgleich::UNBEKANNT, Bestandsabgleich::zustandAus(array()), 'ohne Angabe: unbekannt');

$seite = array(
    'pageNumber' => 1,
    'totalPageNumber' => 3,
    'listingCount' => 4,
    'totalListingCount' => 591,
    'listings' => array(
        '21876298' => array(
            'status' => array('ACTIVE'),
            'listing' => array(
                'id' => 21876298,
                'internalId' => '62923',
                'categoryId' => 1659,
                'title' => array('de' => 'Volumenwaage 3D Silence 600'),
                'expirationDate' => 1790000000,
            ),
        ),
        '22412862' => array(
            'status' => array('ACTIVE'),
            'listing' => array(
                'id' => 22412862,
                'internalId' => 'Thomas',
                'categoryId' => 77,
                'title' => array('de' => 'Jungheinrich 4-Rad-Gabelstapler'),
            ),
        ),
        '22734917' => array(
            'status' => array('ACTIVE'),
            'listing' => array('id' => 22734917, 'internalId' => '', 'title' => 'Teppichpaternoster'),
        ),
        '6819970' => array(
            'status' => array('PAUSED'),
            'listing' => array('id' => 6819970, 'internalId' => '24040', 'categoryId' => 500),
        ),
    ),
);

$gelesen = Bestandsabgleich::seiteLesen($seite);
$p->gleich(4, count($gelesen), 'alle vier Inserate der Seite werden gelesen');
$p->gleich(21876298, $gelesen[0]['inseratId'], 'die Inserats-ID kommt aus dem Schluessel');
$p->gleich(62923, $gelesen[0]['artikelId'], 'und die Artikel-ID aus der internalId');
$p->gleich(1659, $gelesen[0]['kategorieId'],
    'die Rubrik wird mitgenommen - damit muss sie in Plenty nicht gepflegt werden');
$p->gleich('Volumenwaage 3D Silence 600', $gelesen[0]['titel'], 'der Titel kommt aus der deutschen Fassung');
$p->gleich(0, $gelesen[1]['artikelId'], 'das Inserat mit dem Namen bleibt ohne Zuordnung');
$p->gleich(0, $gelesen[2]['artikelId'], 'das ohne Referenz ebenfalls');
$p->gleich('Teppichpaternoster', $gelesen[2]['titel'], 'ein Titel als schlichter Text wird auch gelesen');
$p->gleich(Bestandsabgleich::PAUSIERT, $gelesen[3]['zustand'], 'der Zustand kommt aus den Statusmerkmalen');

$bilanz = Bestandsabgleich::bilanz($gelesen);
$p->gleich(4, $bilanz['gesamt'], 'die Bilanz zaehlt alle');
$p->gleich(2, $bilanz['zugeordnet'], 'zwei liessen sich einem Artikel zuordnen');
$p->gleich(2, $bilanz['ohneZuordnung'], 'zwei nicht - die bleiben unangetastet stehen');
$p->gleich(3, $bilanz['aktiv'], 'drei sind online');
$p->gleich(1, $bilanz['pausiert'], 'eines pausiert');
$p->gleich(array(), $bilanz['doppelteArtikel'], 'kein Artikel haengt an zwei Inseraten');

$doppelt = Bestandsabgleich::bilanz(array(
    array('inseratId' => 1, 'artikelId' => 500, 'zustand' => Bestandsabgleich::AKTIV),
    array('inseratId' => 2, 'artikelId' => 500, 'zustand' => Bestandsabgleich::AKTIV),
));
$p->gleich(array(500), $doppelt['doppelteArtikel'],
    'zwei Inserate auf denselben Artikel muessen auffallen - sonst ueberschreiben sie sich gegenseitig');

$p->gleich(true, Bestandsabgleich::weitereSeite($seite, 1), 'nach Seite 1 von 3 kommt noch etwas');
$p->gleich(false, Bestandsabgleich::weitereSeite($seite, 3), 'nach der letzten nicht mehr');
$p->gleich(array(), Bestandsabgleich::seiteLesen(array()), 'eine leere Antwort ergibt eine leere Liste');

// --- Der Koerper des API-Aufrufs ---------------------------------------
$p->gruppe('Inseratdaten');

$umgebungApi = array(
    'sprache' => 'de', 'waehrung' => 'EUR', 'mwst' => 19,
    'preisIst' => 'netto', 'preisIstErsatz' => 'brutto',
    'nummernQuelle' => 'itemId', 'nummernPraefix' => '',
    'land' => 'DE', 'ort' => 'Essen', 'kategorieId' => 1659,
);
$artikelApi = array(
    'itemId' => 62923, 'variationId' => 991, 'nummer' => 'KK-2024-0815',
    'titel' => 'Weiler Drehmaschine',
    'beschreibung' => 'Gut erhaltene Drehmaschine aus zweiter Hand, sofort verfuegbar.',
    'hersteller' => 'Weiler', 'modell' => 'Praktikant',
    'preis' => 1900.00, 'bestand' => 1, 'aktiv' => true,
    'bildnamen' => array('tmp-1627456205-44589.jpg'),
);

$gebaut = Inseratdaten::bauen($artikelApi, $umgebungApi);
$p->gleich(array(), $gebaut['maengel'], 'ein vollstaendiger Artikel ergibt keinen Mangel');
$k = $gebaut['koerper'];
$p->gleich(1659, $k['categoryId'], 'die Rubrik steht im Koerper');
$p->gleich(array('de' => 'Weiler Drehmaschine'), $k['title'], 'der Titel ist nach Sprache abgelegt');
$p->gleich('62923', $k['internalId'], 'die Referenz ist die Plenty-Artikel-ID');
$p->gleich(1900, $k['price'], 'der Preis ist ganzzahlig');
$p->gleich(0.19, $k['priceVat'], 'der Steuersatz kommt als Bruch');
$p->gleich(true, $k['priceNegotiable'], 'Verhandlungsbasis ist der Standard');
$p->gleich(false, $k['priceVATNotIncluded'], 'und der Preis wird mit "zzgl. MwSt." ausgezeichnet');
$p->gleich(array('tmp-1627456205-44589.jpg'), $k['images'], 'die hochgeladenen Bilder werden referenziert');
$p->gleich('Essen', $k['city'], 'der Standort kommt aus der Konfiguration');

// Der Preis ist der Punkt, an dem ein Fehler unmittelbar Geld kostet.
$p->gruppe('Preis');
$p->gleich(1900, Inseratdaten::nettoGanz(array('preis' => 1900.00), array('preisIst' => 'netto')),
    'ein Nettopreis bleibt, wie er ist');
$p->gleich(1596, Inseratdaten::nettoGanz(array('preis' => 1900.00), array('preisIst' => 'brutto', 'mwst' => 19)),
    'ein Bruttopreis wird heruntergerechnet');
$p->gleich(1899, Inseratdaten::nettoGanz(array('preis' => 1899.99), array('preisIst' => 'netto')),
    'Cent werden abgeschnitten, nicht gerundet - sonst stuende der Artikel teurer am Markt als kalkuliert');
$p->gleich(1596, Inseratdaten::nettoGanz(
    array('preis' => 1900.00, 'preisErsatz' => true),
    array('preisIst' => 'netto', 'preisIstErsatz' => 'brutto', 'mwst' => 19)),
    'ein Preis aus der Ersatzliste wird nach DEREN Einstellung gerechnet');
$p->gleich(null, Inseratdaten::nettoGanz(array('preis' => null), array()), 'kein Preis bleibt kein Preis');

// Maengel: alles, was die API ablehnen wuerde, faellt vorher auf.
$p->gruppe('Maengel');
$ohneText = Inseratdaten::bauen(array_merge($artikelApi, array('beschreibung' => 'zu kurz')), $umgebungApi);
$p->enthaelt('mindestens 10 Zeichen', implode(' ', $ohneText['maengel']),
    'eine zu kurze Beschreibung wird vorher erkannt, statt drueben abgelehnt zu werden');
$p->gleich(array(), $ohneText['koerper'], 'und es wird gar kein Koerper gebaut');

$ohnePreis = Inseratdaten::bauen(array_merge($artikelApi, array('preis' => null)), $umgebungApi);
$p->enthaelt('Kein Preis', implode(' ', $ohnePreis['maengel']), 'ein fehlender Preis ist ein Mangel');

$nullPreis = Inseratdaten::bauen(array_merge($artikelApi, array('preis' => 0)), $umgebungApi);
$p->enthaelt('Preis ist 0', implode(' ', $nullPreis['maengel']), 'ein Preis von 0 auch');

$inaktiv = Inseratdaten::bauen(array_merge($artikelApi, array('aktiv' => false)), $umgebungApi);
$p->enthaelt('nicht aktiv', implode(' ', $inaktiv['maengel']), 'ein in Plenty inaktiver Artikel geht nicht raus');

$ohneBestand = Inseratdaten::bauen(array_merge($artikelApi, array('bestand' => 0)), $umgebungApi);
$p->gleich(array(), $ohneBestand['maengel'],
    'fehlender Bestand ist KEIN Mangel - daraus wird pausiert, nicht verworfen');

$ohneRubrik = Inseratdaten::bauen($artikelApi, array_merge($umgebungApi, array('kategorieId' => 0)));
$p->enthaelt('Rubrik', implode(' ', $ohneRubrik['maengel']), 'ohne Rubrik geht nichts raus');

$eigeneRubrik = Inseratdaten::bauen(array_merge($artikelApi, array('kategorieId' => 4711)), $umgebungApi);
$p->gleich(4711, $eigeneRubrik['koerper']['categoryId'], 'die Rubrik des Artikels schlaegt die Auffangrubrik');
$p->gleich(array(), $eigeneRubrik['hinweise'], 'und dann gibt es auch keinen Hinweis darauf');
$p->enthaelt('Auffangrubrik', implode(' ', $gebaut['hinweise']),
    'wird die Auffangrubrik benutzt, steht das als Hinweis im Bericht');

// Laengen: die API schneidet nicht ab, sie lehnt ab.
$p->gruppe('Laengen');
$langerTitel = Inseratdaten::bauen(
    array_merge($artikelApi, array('titel' => str_repeat('Drehmaschine ', 20))), $umgebungApi);
$p->gleich(100, strlen($langerTitel['koerper']['title']['de']), 'ein zu langer Titel wird auf 100 Zeichen gekuerzt');
$p->enthaelt('gekuerzt', implode(' ', $langerTitel['hinweise']), 'und das wird vermerkt');

$mitUmlaut = Inseratdaten::bauen(
    array_merge($artikelApi, array('titel' => str_repeat('Größe ', 30))), $umgebungApi);
$p->gleich(true, strlen($mitUmlaut['koerper']['title']['de']) >= 100,
    'beim Kuerzen wird nach Zeichen gezaehlt, nicht nach Bytes');
$p->gleich(true, mb_check_encoding($mitUmlaut['koerper']['title']['de'], 'UTF-8'),
    'und kein mehrteiliges Zeichen wird zerschnitten - der Text bleibt gueltiges UTF-8');

$mitHtml = Inseratdaten::bauen(
    array_merge($artikelApi, array('beschreibung' => '<p>Erste Zeile</p><p>Zweite &amp; dritte Zeile</p>')),
    $umgebungApi);
$p->enthaelt('Zweite & dritte', $mitHtml['koerper']['description']['de'],
    'HTML aus der Plenty-Beschreibung wird zu lesbarem Text');

// Referenz
$p->gruppe('Referenz');
$p->gleich('62923', Inseratdaten::referenz(array('itemId' => 62923), array('nummernQuelle' => 'itemId')),
    'die Artikel-ID als Referenz');
$p->gleich('027', Inseratdaten::referenz(array('itemId' => 27), array('nummernQuelle' => 'itemId')),
    'zu kurze IDs werden vorn aufgefuellt - die API verlangt drei Zeichen');
$p->gleich('KK-62923', Inseratdaten::referenz(array('itemId' => 62923),
    array('nummernQuelle' => 'itemId', 'nummernPraefix' => 'KK-')), 'ein Vorsatz wird vorangestellt');
$p->gleich('KK-62923', Inseratdaten::referenz(array('itemId' => 62923, 'nummer' => 'KK-62923'),
    array('nummernQuelle' => 'nummer', 'nummernPraefix' => 'KK-')), 'aber nicht doppelt');
$p->gleich('', Inseratdaten::referenz(array('itemId' => 0), array('nummernQuelle' => 'itemId')),
    'ohne Artikel-ID keine Referenz');

// Fingerabdruck: verhindert Aufrufe, die nichts aendern.
$p->gruppe('Fingerabdruck');
$a = Inseratdaten::bauen($artikelApi, $umgebungApi)['koerper'];
$b = Inseratdaten::bauen($artikelApi, $umgebungApi)['koerper'];
$p->gleich(Inseratdaten::fingerabdruck($a), Inseratdaten::fingerabdruck($b),
    'derselbe Artikel ergibt denselben Fingerabdruck');
$c = Inseratdaten::bauen(array_merge($artikelApi, array('preis' => 1800.00)), $umgebungApi)['koerper'];
$p->gleich(true, Inseratdaten::fingerabdruck($a) !== Inseratdaten::fingerabdruck($c),
    'ein anderer Preis ergibt einen anderen');
$p->gleich(false, Inseratdaten::hatSichGeaendert($a, Inseratdaten::fingerabdruck($a)),
    'unveraendert heisst: nicht senden');
$p->gleich(true, Inseratdaten::hatSichGeaendert($a, ''),
    'ohne bekannten Stand wird immer gesendet');

// --- Was mit einem Artikel geschehen soll -------------------------------
// Jede Zelle der Tabelle einzeln. Die Luecken in so einer Entscheidung
// faellt sonst erst auf, wenn ein Inserat verschwunden ist.
$p->gruppe('Entscheidung');

$lage = function (array $abweichung) {
    return array_merge(array(
        'markiert' => true, 'bestand' => 1, 'maengel' => array(),
        'inseratId' => 0, 'zustand' => 'unbekannt',
        'fingerabdruck' => '', 'neuerFingerabdruck' => 'abc',
    ), $abweichung);
};

$p->gleich(Entscheidung::ANLEGEN, Entscheidung::treffen($lage(array()))['tat'],
    'markiert, Bestand da, drueben unbekannt: anlegen');

$p->gleich(Entscheidung::NICHTS, Entscheidung::treffen($lage(array(
    'inseratId' => 500, 'zustand' => 'aktiv', 'fingerabdruck' => 'abc')))['tat'],
    'unveraendert: nichts tun - jede Aenderung loest drueben eine Pruefung aus');

$p->gleich(Entscheidung::AENDERN, Entscheidung::treffen($lage(array(
    'inseratId' => 500, 'zustand' => 'aktiv', 'fingerabdruck' => 'alt')))['tat'],
    'geaenderte Daten: aendern');

$p->gleich(Entscheidung::AENDERN, Entscheidung::treffen($lage(array(
    'inseratId' => 500, 'zustand' => 'aktiv', 'fingerabdruck' => '')))['tat'],
    'ein Inserat aus der Zeit vor dem Plugin wird einmal gesendet');

// Der Fall, um den es dem Auftraggeber geht.
$p->gruppe('Bestand faellt weg');
$ohne = Entscheidung::treffen($lage(array('bestand' => 0, 'inseratId' => 500, 'zustand' => 'aktiv')));
$p->gleich(Entscheidung::PAUSIEREN, $ohne['tat'], 'kein Bestand mehr: pausieren');
$p->enthaelt('Kein Bestand', $ohne['grund'], 'und der Grund steht dabei');

$p->gleich(Entscheidung::NICHTS, Entscheidung::treffen($lage(array(
    'bestand' => 0, 'inseratId' => 500, 'zustand' => 'pausiert')))['tat'],
    'steht es schon still, bleibt es still');

$p->gleich(Entscheidung::ZURUECK, Entscheidung::treffen($lage(array('bestand' => 0)))['tat'],
    'ohne Bestand wird gar nichts erst angelegt');

$p->gleich(Entscheidung::AKTIVIEREN, Entscheidung::treffen($lage(array(
    'bestand' => 3, 'inseratId' => 500, 'zustand' => 'pausiert')))['tat'],
    'kommt Ware nach, wird wieder aktiviert - das Inserat behaelt Laufzeit und Anfragen');

$p->gruppe('Markierung');
$weg = Entscheidung::treffen($lage(array('markiert' => false, 'inseratId' => 500, 'zustand' => 'aktiv')));
$p->gleich(Entscheidung::PAUSIEREN, $weg['tat'], 'Markierung entfernt: pausieren, nicht loeschen');
$p->enthaelt('Markierung', $weg['grund'], 'der Grund benennt die Markierung');
$p->gleich(Entscheidung::NICHTS, Entscheidung::treffen($lage(array('markiert' => false)))['tat'],
    'nicht markiert und drueben unbekannt: nichts');
$p->gleich(Entscheidung::NICHTS, Entscheidung::treffen($lage(array(
    'markiert' => false, 'inseratId' => 500, 'zustand' => 'pausiert')))['tat'],
    'nicht markiert und schon still: nichts');

$p->gruppe('Unvollstaendige Artikel');
$kaputt = Entscheidung::treffen($lage(array(
    'maengel' => array('Kein Preis.'), 'inseratId' => 500, 'zustand' => 'aktiv')));
$p->gleich(Entscheidung::PAUSIEREN, $kaputt['tat'],
    'fehlen Angaben, wird pausiert statt mit halben Daten ueberschrieben');
$p->enthaelt('Kein Preis.', $kaputt['grund'], 'der Mangel steht im Grund');

$p->gleich(Entscheidung::ZURUECK, Entscheidung::treffen($lage(array(
    'maengel' => array('Kein Preis.'))))['tat'],
    'unvollstaendig und unbekannt: zurueckhalten, nicht anlegen');

$p->gruppe('Schreibende Taten');
$p->gleich(true, Entscheidung::schreibt(Entscheidung::ANLEGEN), 'anlegen schreibt');
$p->gleich(true, Entscheidung::schreibt(Entscheidung::PAUSIEREN), 'pausieren schreibt');
$p->gleich(false, Entscheidung::schreibt(Entscheidung::NICHTS), 'nichts schreibt nicht');
$p->gleich(false, Entscheidung::schreibt(Entscheidung::ZURUECK), 'zurueckhalten schreibt nicht');

exit($p->bericht());
