<?php

namespace MaschinensucherMarkt\Logik;

/**
 * Macht aus einem Plenty-Artikel den Koerper eines API-Aufrufs.
 *
 * Das Gegenstueck zur frueheren CSV-Zeile — nur dass die API genauer
 * hinsieht. Sie lehnt ein Inserat ab, statt eine unvollstaendige Zeile
 * stillschweigend zu schlucken. Deshalb prueft diese Klasse VORHER und gibt
 * Maengel zurueck, statt einen Aufruf loszuschicken, der ohnehin scheitert.
 *
 * Reine Rechnerei, kein Plenty, kein Netz — damit alles davon pruefbar ist.
 */
class Inseratdaten
{
    /** Grenzen aus der API-Beschreibung. */
    const TITEL_MAX = 100;
    const TEXT_MIN = 10;
    const TEXT_MAX = 3500;
    const REFERENZ_MIN = 3;
    const REFERENZ_MAX = 50;

    /**
     * @param array $artikel   aus Artikelabbildung::ausVariante()
     * @param array $umgebung  aus Einstellungen::umgebung()
     * @return array ['koerper', 'maengel', 'hinweise']
     */
    public static function bauen(array $artikel, array $umgebung)
    {
        $maengel = array();
        $hinweise = array();
        $sprache = self::wert($umgebung, 'sprache', 'de');

        // ---- Titel ------------------------------------------------------
        $titel = self::saubereZeile(self::wert($artikel, 'titel', ''));
        if ($titel === '') {
            $maengel[] = 'Kein Titel in Plenty hinterlegt.';
        } elseif (self::laenge($titel) > self::TITEL_MAX) {
            $titel = self::kuerzen($titel, self::TITEL_MAX);
            $hinweise[] = 'Der Titel war laenger als ' . self::TITEL_MAX . ' Zeichen und wurde gekuerzt.';
        }

        // ---- Beschreibung ------------------------------------------------
        $text = self::fliesstext(self::wert($artikel, 'beschreibung', ''));
        if (self::laenge($text) < self::TEXT_MIN) {
            // Die API verlangt mindestens 10 Zeichen. Eine leere oder fast
            // leere Beschreibung wuerde abgelehnt — das hier zu merken ist
            // billiger als ein Aufruf, der scheitert.
            $maengel[] = 'Keine Beschreibung in Plenty (die API verlangt mindestens ' . self::TEXT_MIN . ' Zeichen).';
        } elseif (self::laenge($text) > self::TEXT_MAX) {
            $text = self::kuerzen($text, self::TEXT_MAX);
            $hinweise[] = 'Die Beschreibung war laenger als ' . self::TEXT_MAX . ' Zeichen und wurde gekuerzt.';
        }

        // ---- Rubrik -------------------------------------------------------
        $kategorieId = (int) self::wert($artikel, 'kategorieId', 0);
        if ($kategorieId <= 0) {
            $kategorieId = (int) self::wert($umgebung, 'kategorieId', 0);
            if ($kategorieId > 0) {
                $hinweise[] = 'Auffangrubrik ' . $kategorieId . ' verwendet — der Artikel hat keine eigene.';
            }
        }
        if ($kategorieId <= 0) {
            $maengel[] = 'Keine Maschinensucher-Rubrik bekannt.';
        }

        // ---- Referenz ------------------------------------------------------
        $referenz = self::referenz($artikel, $umgebung);
        if ($referenz === '') {
            $maengel[] = 'Keine Referenznummer bildbar (Artikel-ID fehlt).';
        }

        // ---- Preis ----------------------------------------------------------
        $preis = self::nettoGanz($artikel, $umgebung);
        if ($preis === null) {
            $maengel[] = 'Kein Preis in der eingestellten Preisliste.';
        } elseif ($preis <= 0) {
            $maengel[] = 'Der Preis ist 0.';
            $preis = null;
        }

        // ---- Bestand und Aktivzustand ----------------------------------------
        // KEIN Mangel: Ohne Bestand wird pausiert, nicht verworfen. Ein
        // Mangel hiesse "kann nicht uebertragen werden" - hier ist aber
        // genau bekannt, was zu tun ist.
        if (self::wert($artikel, 'aktiv', true) === false) {
            $maengel[] = 'Der Artikel ist in Plenty nicht aktiv.';
        }

        if (count($maengel) > 0) {
            return array('koerper' => array(), 'maengel' => $maengel, 'hinweise' => $hinweise);
        }

        // ---- Zusammenbauen -----------------------------------------------------
        $koerper = array(
            'categoryId'  => $kategorieId,
            'title'       => array($sprache => $titel),
            'description' => array($sprache => $text),
            'internalId'  => $referenz,
        );

        $hersteller = self::saubereZeile(self::wert($artikel, 'hersteller', ''));
        if ($hersteller !== '') {
            $koerper['manufacturer'] = $hersteller;
        }

        $modell = self::saubereZeile(self::wert($artikel, 'modell', ''));
        if ($modell !== '') {
            $koerper['model'] = $modell;
        }

        $koerper['price'] = $preis;
        $koerper['priceCurrency'] = self::wert($umgebung, 'waehrung', 'EUR');
        $koerper['priceNegotiable'] = self::wert($umgebung, 'preisVerhandelbar', true) !== false;
        // false heisst "zzgl. MwSt.", true heisst "keine MwSt. ausweisbar".
        // Beides muss mitgeschickt werden, sobald ein Preis gesetzt ist.
        $koerper['priceVATNotIncluded'] = self::wert($umgebung, 'ohneUmsatzsteuer', false) === true;
        $mwst = (float) self::wert($umgebung, 'mwst', 19);
        if ($mwst > 0) {
            $koerper['priceVat'] = round($mwst / 100, 4);
        }

        $ort = self::saubereZeile(self::wert($umgebung, 'ort', ''));
        if ($ort !== '') {
            $koerper['city'] = $ort;
        }
        $land = strtoupper(self::saubereZeile(self::wert($umgebung, 'land', '')));
        if ($land !== '') {
            $koerper['countryIso2'] = substr($land, 0, 2);
        }

        $laufzeit = (int) self::wert($umgebung, 'laufzeitMonate', 0);
        if ($laufzeit > 0) {
            $koerper['durationInMonths'] = max(1, min(12, $laufzeit));
        }

        $bilder = self::bildnamen($artikel);
        if (count($bilder) > 0) {
            $koerper['images'] = $bilder;
        }

        $notiz = self::saubereZeile(self::wert($artikel, 'nummer', ''));
        if ($notiz !== '') {
            // Die Variantennummer ist fuer Kaeufer uninteressant, fuer die
            // Zuordnung im eigenen Haus aber Gold wert.
            $koerper['internalNote'] = 'Plenty-Variante ' . $notiz;
        }

        return array('koerper' => $koerper, 'maengel' => array(), 'hinweise' => $hinweise);
    }

    /**
     * Ein Fingerabdruck des Inserats.
     *
     * Wozu: Der Lauf geht ueber den ganzen Stamm, aber die allermeisten
     * Artikel aendern sich zwischen zwei Laeufen nicht. Ohne diesen
     * Vergleich schickte das Plugin alle paar Minuten hunderte Aufrufe los,
     * die nichts aendern — und jede Aenderung loest drueben eine Pruefung
     * aus, die bis zu 24 Stunden dauert.
     */
    public static function fingerabdruck(array $koerper)
    {
        $flach = self::flach($koerper);
        ksort($flach);
        $teile = array();
        foreach ($flach as $schluessel => $wert) {
            $teile[] = $schluessel . '=' . $wert;
        }
        return md5(implode('|', $teile));
    }

    /**
     * Ob sich gegenueber dem zuletzt gesendeten Stand etwas geaendert hat.
     */
    public static function hatSichGeaendert(array $koerper, $alterFingerabdruck)
    {
        $alt = (string) $alterFingerabdruck;
        if ($alt === '') {
            return true;
        }
        return self::fingerabdruck($koerper) !== $alt;
    }

    // ---- Bausteine -------------------------------------------------------------

    /**
     * Die eigene Referenznummer. Muss drueben eindeutig sein und zwischen
     * 3 und 50 Zeichen lang.
     */
    public static function referenz(array $artikel, array $umgebung)
    {
        $quelle = (string) self::wert($umgebung, 'nummernQuelle', 'itemId');
        $wert = '';
        if ($quelle === 'nummer') {
            $wert = self::saubereZeile(self::wert($artikel, 'nummer', ''));
        } elseif ($quelle === 'variationId') {
            $id = (int) self::wert($artikel, 'variationId', 0);
            $wert = $id > 0 ? (string) $id : '';
        } else {
            $id = (int) self::wert($artikel, 'itemId', 0);
            $wert = $id > 0 ? (string) $id : '';
        }

        if ($wert === '') {
            return '';
        }

        $praefix = self::saubereZeile(self::wert($umgebung, 'nummernPraefix', ''));
        if ($praefix !== '' && stripos($wert, $praefix) !== 0) {
            $wert = $praefix . $wert;
        }

        if (self::laenge($wert) > self::REFERENZ_MAX) {
            $wert = self::kuerzen($wert, self::REFERENZ_MAX);
        }
        if (self::laenge($wert) < self::REFERENZ_MIN) {
            // Kurze Artikel-IDs gibt es: aus "27" wuerde die API nichts
            // machen koennen. Vorn auffuellen aendert die Zahl nicht.
            $wert = str_pad($wert, self::REFERENZ_MIN, '0', STR_PAD_LEFT);
        }

        return $wert;
    }

    /**
     * Der Preis, wie die API ihn will: netto, ganzzahlig, ohne Cent.
     *
     * Abgerundet, nicht kaufmaennisch: Aus 1899,99 darf keine 1900 werden.
     * Aufgerundet waere der Preis am Markt hoeher als der kalkulierte.
     */
    public static function nettoGanz(array $artikel, array $umgebung)
    {
        $roh = self::wert($artikel, 'preis', null);
        if ($roh === null || $roh === '') {
            return null;
        }
        $betrag = (float) $roh;

        $ausErsatz = self::wert($artikel, 'preisErsatz', false) === true;
        $schluessel = $ausErsatz ? 'preisIstErsatz' : 'preisIst';
        $istNetto = self::wert($umgebung, $schluessel, 'brutto') === 'netto';

        if (!$istNetto) {
            $mwst = (float) self::wert($umgebung, 'mwst', 19);
            $betrag = $mwst > 0 ? $betrag / (1 + ($mwst / 100)) : $betrag;
        }

        return (int) floor($betrag);
    }

    public static function bildnamen(array $artikel)
    {
        $namen = array();
        foreach ((array) self::wert($artikel, 'bildnamen', array()) as $name) {
            if (is_string($name) && trim($name) !== '') {
                $namen[] = trim($name);
            }
        }
        return $namen;
    }

    // ---- Kleinkram ---------------------------------------------------------------

    private static function flach(array $daten, $vorsatz = '')
    {
        $heraus = array();
        foreach ($daten as $schluessel => $wert) {
            $pfad = $vorsatz === '' ? (string) $schluessel : $vorsatz . '.' . $schluessel;
            if (is_array($wert)) {
                foreach (self::flach($wert, $pfad) as $k => $v) {
                    $heraus[$k] = $v;
                }
            } elseif (is_bool($wert)) {
                $heraus[$pfad] = $wert ? '1' : '0';
            } else {
                $heraus[$pfad] = (string) $wert;
            }
        }
        return $heraus;
    }

    public static function wert(array $daten, $schluessel, $ersatz = null)
    {
        return array_key_exists($schluessel, $daten) && $daten[$schluessel] !== null
            ? $daten[$schluessel]
            : $ersatz;
    }

    private static function saubereZeile($wert)
    {
        $text = trim((string) $wert);
        $text = str_replace(array("\r\n", "\r", "\n", "\t"), ' ', $text);
        while (strpos($text, '  ') !== false) {
            $text = str_replace('  ', ' ', $text);
        }
        return trim($text);
    }

    private static function fliesstext($wert)
    {
        $text = (string) $wert;
        $text = strip_tags(str_replace(array('<br>', '<br/>', '<br />', '</p>', '</li>'), "\n", $text));
        $text = html_entity_decode($text, ENT_QUOTES, 'UTF-8');
        $text = str_replace(array("\r\n", "\r"), "\n", $text);
        while (strpos($text, "\n\n\n") !== false) {
            $text = str_replace("\n\n\n", "\n\n", $text);
        }
        return trim($text);
    }

    private static function laenge($text)
    {
        return strlen(utf8_decode((string) $text));
    }

    /**
     * Kuerzt auf die erlaubte Laenge, ohne ein Zeichen zu zerschneiden.
     */
    private static function kuerzen($text, $laenge)
    {
        $text = (string) $text;
        if (self::laenge($text) <= $laenge) {
            return $text;
        }
        $heraus = '';
        $zaehler = 0;
        $stellen = strlen($text);
        for ($i = 0; $i < $stellen; $i++) {
            $zeichen = substr($text, $i, 1);
            // Folgebytes eines mehrteiligen Zeichens zaehlen nicht mit.
            if ((ord($zeichen) & 0xC0) !== 0x80) {
                if ($zaehler >= $laenge) {
                    break;
                }
                $zaehler++;
            }
            $heraus .= $zeichen;
        }
        return rtrim($heraus);
    }
}
