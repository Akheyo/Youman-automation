<?php

/**
 * Prüft die reine Logik des Plugins: Abbildung der Plenty-Daten, Auswertung
 * der API-Antworten, Bestandsabgleich, Inseratdaten, Entscheidung.
 *
 *   php tests/run.php
 *
 * Was hier NICHT geprüft wird, weil es ein laufendes Plenty oder die echte
 * API braucht: die Artikelsuche, die Plugin-Datenbank, der Bildupload und
 * die Aufrufe selbst. Das steht so im README, damit niemand die grüne
 * Ausgabe für mehr hält, als sie ist.
 */

require __DIR__ . '/Pruefer.php';
foreach (glob(__DIR__ . '/../src/Logik/*.php') as $datei) {
    require_once $datei;
}

use MaschinensucherMarkt\Logik\Antwort;
use MaschinensucherMarkt\Logik\Bestandsabgleich;
use MaschinensucherMarkt\Logik\Entscheidung;
use MaschinensucherMarkt\Logik\Inseratdaten;
use MaschinensucherMarkt\Logik\Suchdokument;
use MaschinensucherMarkt\Logik\Artikelabbildung;

$p = new Pruefer();

// ---------------------------------------------------------------------------
// --- Die Plenty-Daten, wie das Plugin sie liest ------------------------
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
    'inseratId' => 500, 'zustand' => 'aktiv', 'fingerabdruck' => 'alt', 'perApi' => true)))['tat'],
    'geaenderte Daten bei einem selbst angelegten Inserat: aendern');

// Die API aendert nur Inserate, die ueber die API angelegt wurden. Alle
// 594 bestehenden Inserate dieses Kontos sind es nicht.
$p->gruppe('Vorgefundene Inserate aendern');
$vorhanden = Entscheidung::treffen($lage(array(
    'inseratId' => 500, 'zustand' => 'aktiv', 'fingerabdruck' => '', 'perApi' => false)));
$p->gleich(Entscheidung::NICHTS, $vorhanden['tat'],
    'ein vorgefundenes Inserat wird NICHT geaendert - die API wuerde es ablehnen');
$p->enthaelt('nicht ueber die API angelegt', $vorhanden['grund'], 'und der Grund sagt warum');
$p->gleich(Entscheidung::NICHTS, Entscheidung::treffen($lage(array(
    'inseratId' => 500, 'zustand' => 'aktiv', 'fingerabdruck' => 'alt')))['tat'],
    'ohne Angabe gilt ein Inserat als nicht per API angelegt - im Zweifel nicht aendern');
$p->gleich(Entscheidung::PAUSIEREN, Entscheidung::treffen($lage(array(
    'bestand' => 0, 'inseratId' => 500, 'zustand' => 'aktiv', 'perApi' => false)))['tat'],
    'pausieren geht aber auch bei vorgefundenen - das ist die Hauptsache');
$p->gleich(Entscheidung::AKTIVIEREN, Entscheidung::treffen($lage(array(
    'bestand' => 2, 'inseratId' => 500, 'zustand' => 'pausiert', 'perApi' => false)))['tat'],
    'und wieder aktivieren ebenso');
$p->gleich(Entscheidung::AENDERN, Entscheidung::treffen($lage(array(
    'inseratId' => 500, 'zustand' => 'aktiv', 'fingerabdruck' => '', 'perApi' => true)))['tat'],
    'ein selbst angelegtes ohne bekannten Stand wird einmal gesendet');
$p->gruppe('Entscheidung, Fortsetzung');

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
$weg = Entscheidung::treffen($lage(array('markiert' => false, 'inseratId' => 500, 'zustand' => 'aktiv', 'verwaltet' => true)));
$p->gleich(Entscheidung::PAUSIEREN, $weg['tat'], 'Markierung entfernt: pausieren, nicht loeschen');
$p->enthaelt('Markierung', $weg['grund'], 'der Grund benennt die Markierung');
$p->gleich(Entscheidung::NICHTS, Entscheidung::treffen($lage(array('markiert' => false)))['tat'],
    'nicht markiert und drueben unbekannt: nichts');
$p->gleich(Entscheidung::NICHTS, Entscheidung::treffen($lage(array(
    'markiert' => false, 'inseratId' => 500, 'zustand' => 'pausiert')))['tat'],
    'nicht markiert und schon still: nichts');

$p->gruppe('Unvollstaendige Artikel');
$kaputt = Entscheidung::treffen($lage(array(
    'maengel' => array('Kein Preis.'), 'inseratId' => 500, 'zustand' => 'aktiv', 'verwaltet' => true)));
$p->gleich(Entscheidung::PAUSIEREN, $kaputt['tat'],
    'fehlen Angaben, wird pausiert statt mit halben Daten ueberschrieben');
$p->enthaelt('Kein Preis.', $kaputt['grund'], 'der Mangel steht im Grund');

$p->gleich(Entscheidung::ZURUECK, Entscheidung::treffen($lage(array(
    'maengel' => array('Kein Preis.'))))['tat'],
    'unvollstaendig und unbekannt: zurueckhalten, nicht anlegen');

// Der Fall, der ein Live-Konto leergeraeumt haette: frisches System, noch
// nichts markiert, die Bestandsaufnahme hat hunderte laufende Inserate
// gefunden. Keines davon darf angefasst werden.
$p->gruppe('Vorgefundene Inserate');
$vorgefunden = Entscheidung::treffen($lage(array(
    'markiert' => false, 'inseratId' => 500, 'zustand' => 'aktiv', 'verwaltet' => false)));
$p->gleich(Entscheidung::NICHTS, $vorgefunden['tat'],
    'ein vorgefundenes, nicht markiertes Inserat wird NICHT pausiert');
$p->enthaelt('nicht vom Plugin verwaltet', $vorgefunden['grund'], 'und der Grund sagt das');

$p->gleich(Entscheidung::NICHTS, Entscheidung::treffen($lage(array(
    'markiert' => false, 'inseratId' => 500, 'zustand' => 'aktiv')))['tat'],
    'ohne Angabe gilt ein Inserat als nicht verwaltet - im Zweifel nichts tun');

$vorgefundenOhnePreis = Entscheidung::treffen($lage(array(
    'maengel' => array('Kein Preis.'), 'inseratId' => 500, 'zustand' => 'aktiv', 'verwaltet' => false)));
$p->gleich(Entscheidung::ZURUECK, $vorgefundenOhnePreis['tat'],
    'fehlt in Plenty der Preis, bleibt ein vorgefundenes Inserat mit seinen alten Daten stehen');

$p->gleich(Entscheidung::PAUSIEREN, Entscheidung::treffen($lage(array(
    'bestand' => 0, 'inseratId' => 500, 'zustand' => 'aktiv', 'verwaltet' => false)))['tat'],
    'ist der Artikel aber MARKIERT und ausverkauft, geht es offline - verwaltet oder nicht');

$p->gruppe('Schreibende Taten');
$p->gleich(true, Entscheidung::schreibt(Entscheidung::ANLEGEN), 'anlegen schreibt');
$p->gleich(true, Entscheidung::schreibt(Entscheidung::PAUSIEREN), 'pausieren schreibt');
$p->gleich(false, Entscheidung::schreibt(Entscheidung::NICHTS), 'nichts schreibt nicht');
$p->gleich(false, Entscheidung::schreibt(Entscheidung::ZURUECK), 'zurueckhalten schreibt nicht');

// --- Uebersetzung aus dem Suchindex ------------------------------------
// Die Form, in der Plentys Suchindex Varianten liefert (so liest sie auch
// Plentys eigenes Shop-Plugin IO), und was der Rest des Plugins daraus
// braucht.
$p->gruppe('Suchdokument');

$dokument = array(
    'id' => '19',
    'data' => array(
        'variation' => array(
            'id' => 19, 'itemId' => 19, 'number' => 'SIE-V2', 'model' => 'V20',
            'isActive' => true, 'weightG' => 12000, 'lengthMM' => 600,
        ),
        'item' => array(
            'id' => 19, 'flagOne' => 27,
            'manufacturer' => array('id' => 4, 'name' => 'siemens', 'externalName' => 'Siemens'),
        ),
        'texts' => array(
            array('lang' => 'en', 'name1' => 'Frequency inverter', 'description' => 'english'),
            array('lang' => 'de', 'name1' => 'Siemens V20 Frequenzumrichter', 'description' => 'Neuwertig, originalverpackt.'),
        ),
        'salesPrices' => array(
            array('id' => 1, 'price' => 5.99),
            array('id' => 25, 'price' => 480.00),
        ),
        'stock' => array('net' => 3, 'physical' => 4),
        'barcodes' => array(array('code' => '4011234567890')),
    ),
);

$v = Suchdokument::alsVariante($dokument);
$p->gleich(19, $v['id'], 'die Varianten-ID kommt aus variation.id');
$p->gleich(19, $v['itemId'], 'die Artikel-ID aus item.id');
$p->gleich('SIE-V2', $v['number'], 'die Variantennummer');
$p->gleich(4, $v['item']['manufacturerId'], 'der Hersteller als ID');
$p->gleich('Siemens', Suchdokument::herstellername($dokument), 'und als Name, der externe bevorzugt');
$p->gleich(27, $v['item']['flagOne'], 'die Markierung, falls das Dokument sie mitbringt');
$p->gleich(array(array('salesPriceId' => 1, 'price' => 5.99), array('salesPriceId' => 25, 'price' => 480.0)),
    $v['variationSalesPrices'], 'die Preise in der Form, die die Preisauswahl kennt');
$p->gleich(array(array('netStock' => 3.0)), $v['stock'],
    'der Bestand: "net" aus dem Index wird zum netStock der alten Form');

// Die ganze Kette bis zum Artikel, den der Abgleich verarbeitet.
$a = Artikelabbildung::ausVariante($v, array(4 => 'Siemens'), array(), 25, 1);
$p->gleich('Siemens V20 Frequenzumrichter', $a['titel'], 'der deutsche Titel wird genommen, nicht der erste');
$p->gleich('Neuwertig, originalverpackt.', $a['beschreibung'], 'ebenso die deutsche Beschreibung');
$p->gleich(480.0, $a['preis'], 'der Preis aus der eingestellten Liste 25');
$p->gleich(3.0, $a['bestand'], 'der Bestand');
$p->gleich('Siemens', $a['hersteller'], 'der Hersteller');

$ohneHuelle = Suchdokument::alsVariante($dokument['data']);
$p->gleich(19, $ohneHuelle['id'], 'auch ohne die Huelle "data" wird gelesen');

$bestandAlsListe = Suchdokument::alsVariante(array('data' => array(
    'variation' => array('id' => 5), 'item' => array('id' => 5),
    'stock' => array(array('netStock' => 2), array('netStock' => 1)),
)));
$p->gleich(array(array('netStock' => 2.0), array('netStock' => 1.0)), $bestandAlsListe['stock'],
    'ein Bestand als Liste je Lager wird ebenfalls gelesen');

$preisVerschachtelt = Suchdokument::alsVariante(array('data' => array(
    'variation' => array('id' => 6), 'item' => array('id' => 6),
    'salesPrices' => array(array('salesPriceId' => 25, 'price' => array('value' => 99.5))),
)));
$p->gleich(array(array('salesPriceId' => 25, 'price' => 99.5)), $preisVerschachtelt['variationSalesPrices'],
    'ein verschachtelter Preis wird ausgepackt');

$leer = Suchdokument::alsVariante(array());
$p->gleich(0, $leer['id'], 'ein leeres Dokument fuehrt nicht zum Absturz');
$p->gleich(array(), $leer['variationSalesPrices'], 'sondern zu leeren Werten - und damit zu einem Mangel');

$gliederung = Suchdokument::gliederung($dokument);
$p->gleich('net,physical', $gliederung['stock'], 'die Gliederung nennt die Unterschluessel, fuer die Fehlersuche');

exit($p->bericht());
