<?php

namespace MaschinensucherMarkt\Logik;

/**
 * Die Felder eines Maschinensucher-Inserats — und wie sie auf die Spalten der
 * Importdatei kommen.
 *
 * Maschinensucher liest Importdateien SPALTENWEISE. Die Reihenfolge ist die
 * Schnittstelle, nicht die Überschrift — eine verrutschte Spalte schreibt das
 * Baujahr in den Preis, und das fällt niemandem auf, bis ein Bagger für
 * 1.998 € online steht.
 *
 * Die verbindliche Reihenfolge steht in der BEISPIELDATEI aus dem
 * Händlerkonto. Statt Spaltennamen zu erfinden, nimmt `bauen()` deren
 * Kopfzeile entgegen und ordnet unsere Felder darauf zu.
 *
 * NUR STATISCHE METHODEN, KEIN ZUSTAND: Im Plugin-Code von PlentyONE ist
 * `new` nicht erlaubt (der Build lehnt es ab). Objekte entstehen dort über
 * pluginApp() — für reine Rechenlogik ist das unnötiger Umweg, also sind es
 * Funktionen. Dieselbe Datei läuft dadurch auch mit einfachem PHP im Test.
 */
class Spaltenplan
{
    /** Wie viele Bilder je Inserat übergeben werden. */
    const MAX_BILDER = 8;

    /**
     * Die Standardreihenfolge: Schlüssel => [Überschrift, Pflicht, Synonyme].
     *
     * ACHTUNG: beste Annahme, nicht die amtliche Spaltenfolge. 33 Spalten,
     * damit die genannte Mindestbreite von 32 sicher erreicht wird.
     */
    public static function felder()
    {
        $felder = array(
            'inseratsnummer' => array('Inseratsnummer', true, array('inseratsnummer', 'inseratnr', 'anzeigennummer', 'referenz', 'adid', 'id')),
            'kategorie'      => array('Kategorie', true, array('kategorie', 'category', 'warengruppe', 'rubrik')),
            'titel'          => array('Maschinenbezeichnung', true, array('maschinenbezeichnung', 'bezeichnung', 'titel', 'headline', 'name')),
            'hersteller'     => array('Hersteller', false, array('hersteller', 'manufacturer', 'marke', 'fabrikat')),
            'typ'            => array('Typ', false, array('typ', 'modell', 'model', 'typenbezeichnung')),
            'baujahr'        => array('Baujahr', false, array('baujahr', 'year', 'jahr')),
            'zustand'        => array('Zustand', false, array('zustand', 'condition')),
            'beschreibung'   => array('Beschreibung', true, array('beschreibung', 'description', 'text', 'langtext')),
            'preis'          => array('Preis', true, array('preis', 'price', 'nettopreis', 'verkaufspreis')),
            'waehrung'       => array('Waehrung', false, array('waehrung', 'currency', 'wahrung')),
            'preisart'       => array('Preisart', false, array('preisart', 'preistyp', 'pricetype', 'mwstpflichtig')),
            'mwst'           => array('MwSt', false, array('mwst', 'mehrwertsteuer', 'ust', 'vat', 'steuersatz')),
            'menge'          => array('Menge', false, array('menge', 'anzahl', 'stueckzahl', 'quantity', 'stuckzahl')),
            'seriennummer'   => array('Seriennummer', false, array('seriennummer', 'serialnumber', 'seriennr')),
            'interne_nummer' => array('Interne Nummer', false, array('internenummer', 'artikelnummer', 'lagernummer', 'sku', 'ean')),
            'land'           => array('Land', true, array('land', 'country', 'laenderkennzeichen', 'lkz')),
            'plz'            => array('PLZ', true, array('plz', 'postleitzahl', 'zip', 'postcode')),
            'ort'            => array('Ort', true, array('ort', 'stadt', 'city', 'standort')),
            'gewicht'        => array('Gewicht', false, array('gewicht', 'weight', 'kg')),
            'laenge'         => array('Laenge', false, array('laenge', 'lange', 'length')),
            'breite'         => array('Breite', false, array('breite', 'width')),
            'hoehe'          => array('Hoehe', false, array('hoehe', 'hohe', 'height')),
            'ansprechpartner' => array('Ansprechpartner', false, array('ansprechpartner', 'kontakt', 'contact')),
            'telefon'        => array('Telefon', false, array('telefon', 'phone', 'tel')),
            'email'          => array('E-Mail', false, array('email', 'emailadresse', 'mail')),
            'url'            => array('Shop-Link', false, array('url', 'link', 'shoplink', 'weblink')),
        );

        for ($i = 1; $i <= self::MAX_BILDER; $i++) {
            $felder['bild' . $i] = array(
                'Bild ' . $i,
                $i === 1, // Ohne Bild wird ein Inserat nicht angesehen.
                array('bild' . $i, 'bildurl' . $i, 'image' . $i, 'picture' . $i, 'foto' . $i),
            );
        }

        return $felder;
    }

    /** Alle Felder, ohne die kein Inserat rausgeht. */
    public static function pflichtfelder()
    {
        $pflicht = array();
        foreach (self::felder() as $key => $feld) {
            if ($feld[1]) {
                $pflicht[] = $key;
            }
        }
        return $pflicht;
    }

    /**
     * Vergleichsform einer Überschrift: klein, ohne Umlaute, ohne alles, was
     * keine Ziffer und kein Buchstabe ist. "Bild-URL 1" und "bildurl1" sind
     * dieselbe Spalte, und daran soll eine Zuordnung nicht scheitern.
     */
    public static function normKopf($text)
    {
        $text = mb_strtolower((string) $text, 'UTF-8');
        $text = str_replace(array('ä', 'ö', 'ü', 'ß'), array('ae', 'oe', 'ue', 'ss'), $text);
        return preg_replace('/[^a-z0-9]/', '', $text);
    }

    /**
     * Baut den Plan.
     *
     * Eine Spalte, die wir nicht erkennen, bleibt LEER statt zu verrutschen:
     * Die Breite der Zeile richtet sich nach der Kopfzeile, nicht nach unseren
     * Feldern. Lieber eine leere Spalte, die jemand sieht, als eine gefüllte
     * an der falschen Stelle.
     *
     * @param string $kopfzeile Kopfzeile der offiziellen Beispieldatei, oder ''
     * @param string $trenner
     * @return array ['spalten' => [['kopf','feld']], 'herkunft', 'fehlendePflicht', 'unbelegt']
     */
    public static function bauen($kopfzeile = '', $trenner = ';')
    {
        $kopfzeile = trim((string) $kopfzeile);
        $felder = self::felder();

        if ($kopfzeile === '' || strpos($kopfzeile, $trenner) === false) {
            $spalten = array();
            foreach ($felder as $key => $feld) {
                $spalten[] = array('kopf' => $feld[0], 'feld' => $key);
            }
            return array(
                'spalten' => $spalten,
                'herkunft' => 'standard',
                'fehlendePflicht' => array(),
                'unbelegt' => array(),
            );
        }

        $spalten = array();
        $unbelegt = array();
        $vergeben = array();

        foreach (explode($trenner, $kopfzeile) as $kopf) {
            $kopf = trim($kopf);
            $kopf = preg_replace('/^"(.*)"$/s', '$1', $kopf);
            $norm = self::normKopf($kopf);
            $treffer = null;

            if ($norm !== '') {
                // Erst exakt, dann "enthält" — sonst schnappt sich "bild1" die
                // Spalte "Bild 10", und das Titelbild wäre das zehnte Foto.
                foreach ($felder as $key => $feld) {
                    if (isset($vergeben[$key])) {
                        continue;
                    }
                    if (in_array($norm, $feld[2], true)) {
                        $treffer = $key;
                        break;
                    }
                }
                if ($treffer === null) {
                    foreach ($felder as $key => $feld) {
                        if (isset($vergeben[$key])) {
                            continue;
                        }
                        foreach ($feld[2] as $synonym) {
                            if (strlen($synonym) >= 4 && self::enthaelt($norm, $synonym)) {
                                $treffer = $key;
                                break 2;
                            }
                        }
                    }
                }
            }

            if ($treffer !== null) {
                $vergeben[$treffer] = true;
            } else {
                $unbelegt[] = $kopf;
            }
            $spalten[] = array('kopf' => $kopf, 'feld' => $treffer);
        }

        $fehlendePflicht = array();
        foreach (self::pflichtfelder() as $key) {
            if (!isset($vergeben[$key])) {
                $fehlendePflicht[] = $key;
            }
        }

        return array(
            'spalten' => $spalten,
            'herkunft' => 'beispieldatei',
            'fehlendePflicht' => $fehlendePflicht,
            'unbelegt' => $unbelegt,
        );
    }

    /**
     * Enthält die Überschrift dieses Synonym — ohne dass unmittelbar eine
     * Ziffer folgt? Die Ausnahme ist der Grund für diese Funktion: "bild1"
     * steckt auch in "bild10", und das Titelbild wäre dann das zehnte Foto.
     */
    private static function enthaelt($norm, $synonym)
    {
        $ab = 0;
        while (($stelle = strpos($norm, $synonym, $ab)) !== false) {
            $danach = substr($norm, $stelle + strlen($synonym), 1);
            if ($danach === '' || $danach < '0' || $danach > '9') {
                return true;
            }
            $ab = $stelle + 1;
        }
        return false;
    }
}
