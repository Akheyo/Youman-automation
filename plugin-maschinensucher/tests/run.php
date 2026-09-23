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

use MaschinensucherMarkt\Logik\Artikelabbildung;
use MaschinensucherMarkt\Logik\Csv;
use MaschinensucherMarkt\Logik\Inserat;
use MaschinensucherMarkt\Logik\Rueckgang;
use MaschinensucherMarkt\Logik\Spaltenplan;

$p = new Pruefer();

// ---------------------------------------------------------------------------
$p->gruppe('Spaltenplan');

$standard = new Spaltenplan('');
$p->wahr(count($standard->spalten) >= 32, 'erreicht die genannte Mindestbreite von 32 Spalten');
$p->gleich('standard', $standard->herkunft, 'ohne Kopfzeile gilt die Standardreihenfolge');

$plan = new Spaltenplan('Anzeigennummer;Kategorie;Bezeichnung;Hersteller;Preis;Beschreibung;Land;PLZ;Ort;Bild 1');
$felder = array();
foreach ($plan->spalten as $spalte) {
    $felder[] = $spalte['feld'];
}
$p->gleich(
    array('inseratsnummer', 'kategorie', 'titel', 'hersteller', 'preis', 'beschreibung', 'land', 'plz', 'ort', 'bild1'),
    $felder,
    'ordnet unsere Felder auf die Spalten der Beispieldatei zu'
);
$p->gleich('beispieldatei', $plan->herkunft, 'erkennt die hinterlegte Kopfzeile');

$luecken = new Spaltenplan('Bezeichnung;Hersteller');
$p->wahr(in_array('preis', $luecken->fehlendePflicht, true), 'nennt den fehlenden Preis');
$p->wahr(in_array('kategorie', $luecken->fehlendePflicht, true), 'nennt die fehlende Kategorie');

$fremd = new Spaltenplan('Kategorie;Haendlerrabatt;Preis');
$p->gleich(null, $fremd->spalten[1]['feld'], 'lässt eine unbekannte Spalte leer, statt die Zeile zu verschieben');
$p->gleich(array('Haendlerrabatt'), $fremd->unbelegt, 'meldet die Spalte, die wir nicht befüllen');

$bilder = new Spaltenplan('Bild 10;Bild 1');
$p->gleich(null, $bilder->spalten[0]['feld'], 'verwechselt Bild 1 nicht mit Bild 10');
$p->gleich('bild1', $bilder->spalten[1]['feld'], 'findet das echte Bild 1');

// ---------------------------------------------------------------------------
$p->gruppe('CSV');

$csv = new Csv(';');
$p->gleich('"Bagger; gebraucht"', $csv->feld('Bagger; gebraucht'), 'quotet, sobald das Trennzeichen im Text steht');
$p->gleich('"Typ ""A"""', $csv->feld('Typ "A"'), 'verdoppelt Anführungszeichen im Text');
$p->gleich('Zeile 1 Zeile 2', $csv->feld("Zeile 1\nZeile 2"), 'macht aus Umbrüchen standardmäßig Leerzeichen');
$p->gleich("\"A\nB\"", (new Csv(';', 'behalten'))->feld("A\nB"), 'behält Umbrüche auf Wunsch — dann in Anführungszeichen');

$kleinerPlan = new Spaltenplan('Kategorie;Haendlerrabatt;Preis');
$p->gleich('12;;1900,00', $csv->zeile(array('kategorie' => '12', 'preis' => '1900,00'), $kleinerPlan), 'füllt die unbekannte Spalte leer');

$datei = $csv->datei(
    array(array('kategorie' => '1', 'preis' => '10,00'), array('kategorie' => '2', 'preis' => '20,00')),
    new Spaltenplan('Kategorie;Preis')
);
$p->gleich("Kategorie;Preis\r\n1;10,00\r\n2;20,00\r\n", $datei, 'schreibt Kopfzeile, je Inserat eine Zeile und endet mit Umbruch');

// Eine "Kopfzeile" ohne Trennzeichen ist fast immer ein Versehen — dann gilt
// die Standardreihenfolge, und die Konfigurationsseite sagt das auch.
$p->gleich('standard', (new Spaltenplan('Kategorie'))->herkunft, 'eine Kopfzeile ohne Trennzeichen zaehlt nicht');

$breiten = array();
foreach (explode("\r\n", trim($csv->datei(array(array('titel' => 'A'), array()), $standard))) as $zeile) {
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

$voll = new Inserat($artikel, $umgebung);
$p->gleich(array(), $voll->maengel, 'ein vollständiger Artikel hat keine Mängel');
$p->gleich('KK-2024-0815', $voll->werte['inseratsnummer'], 'setzt den Vorsatz nicht doppelt davor');
$p->gleich('1900,00', $voll->werte['preis'], 'rechnet 2261 brutto auf 1900 netto');
$p->gleich('netto', $voll->werte['preisart'], 'zeichnet netto aus');
$p->gleich('1234', $voll->werte['kategorie'], 'nimmt die Kategorie aus der Zuordnung');
$p->gleich('850,0', $voll->werte['gewicht'], 'rechnet Gramm in Kilogramm');
$p->gleich('180', $voll->werte['laenge'], 'rechnet Millimeter in Zentimeter');
$p->gleich('https://cdn.plenty/1.jpg', $voll->werte['bild1'], 'übernimmt das erste Foto');

$netto = new Inserat($artikel, array_merge($umgebung, array('preisIst' => 'netto')));
$p->gleich('2261,00', $netto->werte['preis'], 'lässt den Preis stehen, wenn Plenty netto führt');

$ohnePreis = new Inserat(array_merge($artikel, array('preis' => null)), $umgebung);
$p->enthaelt('Kein Preis', $ohnePreis->maengel, 'hält einen Artikel ohne Preis zurück');

$ohneBild = new Inserat(array_merge($artikel, array('bilder' => array())), $umgebung);
$p->enthaelt('Keine Fotos', $ohneBild->maengel, 'hält einen Artikel ohne Foto zurück');

$verkauft = new Inserat(array_merge($artikel, array('bestand' => 0)), $umgebung);
$p->enthaelt('Kein Bestand', $verkauft->maengel, 'nimmt Verkauftes vom Markt');
$p->gleich(false, $verkauft->vollstaendig(), 'und lässt es damit aus der Datei fallen');

$inaktiv = new Inserat(array_merge($artikel, array('aktiv' => false)), $umgebung);
$p->enthaelt('inaktiv', $inaktiv->maengel, 'hält zurück, was in Plenty abgeschaltet ist');

$ohneStandort = new Inserat($artikel, array_merge($umgebung, array('plz' => '', 'ort' => '')));
$p->enthaelt('Kein Standort', $ohneStandort->maengel, 'meldet den fehlenden Standort als Mangel der Einrichtung');

$luecke = new Inserat(array_merge($artikel, array('hersteller' => '', 'baujahr' => '', 'gewichtG' => null)), $umgebung);
$p->gleich('', $luecke->werte['baujahr'], 'erfindet kein Baujahr');
$p->gleich('', $luecke->werte['gewicht'], 'schätzt kein Gewicht');
$p->gleich(array(), $luecke->maengel, 'hält deswegen aber nichts auf');
$p->enthaelt('Kein Baujahr', $luecke->hinweise, 'sagt es als Hinweis');

$viele = array();
for ($i = 0; $i < 11; $i++) {
    $viele[] = 'https://cdn.plenty/' . $i . '.jpg';
}
$mitVielen = new Inserat(array_merge($artikel, array('bilder' => $viele)), $umgebung);
$p->gleich('https://cdn.plenty/7.jpg', $mitVielen->werte['bild8'], 'nimmt höchstens acht Fotos');
$p->wahr(!isset($mitVielen->werte['bild9']), 'und kein neuntes');
$p->enthaelt('ersten 8', $mitVielen->hinweise, 'sagt, dass mehr da waren');

$eigene = new Inserat(array_merge($artikel, array('kategorie' => '777')), $umgebung);
$p->gleich('777', $eigene->werte['kategorie'], 'die Rubrik am Artikel gewinnt gegen die Zuordnung');

$fremdeWare = new Inserat(array_merge($artikel, array('titel' => 'Rollcontainer', 'hersteller' => '', 'modell' => '')), $umgebung);
$p->gleich('9999', $fremdeWare->werte['kategorie'], 'sonst greift die Auffangkategorie');
$p->enthaelt('Auffangkategorie', $fremdeWare->hinweise, 'und sagt, dass sie gegriffen hat');

$p->gleich('Gut erhalten.' . "\n\n" . '· Kratzer' . "\n" . '· Delle',
    Inserat::alsFliesstext('<p>Gut erhalten.</p><ul><li>Kratzer</li><li>Delle</li></ul>'),
    'macht aus HTML lesbaren Text mit Aufzählung');
$p->gleich('Fräse größer', Inserat::alsFliesstext('<p>Fr&auml;se gr&ouml;&szlig;er</p>'), 'löst Entitäten auf');
$p->gleich('Weiler Drehmaschine', Inserat::kuerze('Weiler Drehmaschine Praktikant', 20), 'kürzt an der Wortgrenze');

// ---------------------------------------------------------------------------
$p->gruppe('Notbremse');

$erster = new Rueckgang(0, null, null, 1000);
$p->gleich(false, $erster->blockiert, 'lässt den ersten Lauf durch');

$klein = new Rueckgang(2, 6, null, 1000);
$p->gleich(false, $klein->blockiert, 'greift unterhalb der Schwelle nicht');

$normal = new Rueckgang(180, 200, null, 1000);
$p->gleich(false, $normal->blockiert, 'lässt normale Schwankungen durch');

$einbruch = new Rueckgang(0, 200, null, 1000);
$p->gleich(true, $einbruch->blockiert, 'hält einen Einbruch zurück');
$p->enthaelt('0 statt zuletzt 200', $einbruch->meldung, 'und sagt, worum es geht');

$frei = new Rueckgang(0, 200, 2000, 1000);
$p->gleich(false, $frei->blockiert, 'lässt ihn nach einer Freigabe durch');
$p->enthaelt('Rückgang', $frei->meldung, 'sagt trotzdem, was passiert');

$abgelaufen = new Rueckgang(0, 200, 900, 1000);
$p->gleich(true, $abgelaufen->blockiert, 'achtet eine abgelaufene Freigabe nicht mehr');
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

$p->gleich(2261.0, Artikelabbildung::preis($variante, null), 'nimmt ohne Vorgabe die kleinste Preislisten-ID');
$p->gleich(2600.0, Artikelabbildung::preis($variante, 4), 'nimmt die vorgegebene Preisliste');
$p->gleich(null, Artikelabbildung::preis($variante, 99), 'lieber kein Preis als der einer fremden Liste');

$abgebildet = Artikelabbildung::ausVariante($variante, array(7 => 'Weiler'), array('https://cdn/1.jpg'), null);
$p->gleich('Weiler Drehmaschine', $abgebildet['titel'], 'nimmt den deutschen Titel');
$p->gleich('Weiler', $abgebildet['hersteller'], 'löst die Hersteller-ID auf');
$p->gleich('Gebraucht', $abgebildet['zustand'], 'übersetzt den Plenty-Zustand');
$p->gleich('2000000047119', $abgebildet['ean'], 'nimmt den ersten Barcode');
$p->gleich(3.0, $abgebildet['bestand'], 'trägt den Bestand mit');

$nackt = Artikelabbildung::ausVariante(array('id' => 1), array(), array(), null);
$p->gleich('', $nackt['titel'], 'kommt mit einer nackten Variante zurecht');
$p->gleich(null, $nackt['preis'], 'und erfindet keinen Preis');

exit($p->bericht());
