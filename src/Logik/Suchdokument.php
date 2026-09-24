<?php

namespace MaschinensucherMarkt\Logik;

/**
 * Uebersetzt ein Ergebnis der Plenty-Suche in die Form, die der Rest des
 * Plugins kennt.
 *
 * Warum ueberhaupt eine Uebersetzung: Die klassische Variantensuche lieferte
 * auf diesem System fuer eine vorhandene Variante schlicht nichts zurueck.
 * Plentys eigenes Shop-Plugin sucht Artikel ueber den Suchindex, und dessen
 * Dokumente sind anders geschnitten — Texte, Preise und Bestand stehen an
 * anderer Stelle und heissen anders.
 *
 * Absichtlich nachsichtig gelesen: Wo Plenty einen Wert unter mehreren
 * Namen kennt, wird jeder davon versucht. Fehlt etwas, entsteht kein Absturz,
 * sondern ein leerer Wert — und daraus ein Mangel am Artikel, der im Bericht
 * steht und nichts bei Maschinensucher anrichtet.
 */
class Suchdokument
{
    /**
     * @param array $dokument Ein Eintrag aus 'documents', mit oder ohne Huelle 'data'
     * @return array Variante in der Form, die Artikelabbildung::ausVariante erwartet
     */
    public static function alsVariante(array $dokument)
    {
        $daten = isset($dokument['data']) && is_array($dokument['data']) ? $dokument['data'] : $dokument;

        $variante = self::feld($daten, 'variation', array());
        $artikel  = self::feld($daten, 'item', array());

        $variantenId = (int) self::erstes($variante, array('id'), self::erstes($dokument, array('id'), 0));
        $artikelId   = (int) self::erstes($artikel, array('id'), self::erstes($variante, array('itemId'), 0));

        $hersteller = self::feld($artikel, 'manufacturer', array());
        $zustand    = self::erstes($artikel, array('condition', 'conditionApi'), null);
        if (is_array($zustand)) {
            $zustand = isset($zustand['id']) ? $zustand['id'] : null;
        }

        return array(
            'id'        => $variantenId,
            'itemId'    => $artikelId,
            'number'    => (string) self::erstes($variante, array('number'), ''),
            'model'     => (string) self::erstes($variante, array('model'), ''),
            'isActive'  => self::erstes($variante, array('isActive'), true) !== false,
            'weightG'   => self::erstes($variante, array('weightG', 'weightNetG'), null),
            'lengthMM'  => self::erstes($variante, array('lengthMM'), null),
            'widthMM'   => self::erstes($variante, array('widthMM'), null),
            'heightMM'  => self::erstes($variante, array('heightMM'), null),
            'item'      => array(
                'id'             => $artikelId,
                'manufacturerId' => (int) self::erstes($hersteller, array('id'), self::erstes($artikel, array('manufacturerId'), 0)),
                'condition'      => $zustand,
                'flagOne'        => (int) self::erstes($artikel, array('flagOne', 'flag1'), 0),
                'flagTwo'        => (int) self::erstes($artikel, array('flagTwo', 'flag2'), 0),
                'texts'          => self::texte($daten),
            ),
            'variationSalesPrices' => self::preise($daten),
            'variationBarcodes'    => self::barcodes($daten),
            'stock'                => self::bestand($daten),
        );
    }

    /**
     * Der Herstellername, falls das Dokument ihn mitbringt. Dann braucht es
     * keinen zusaetzlichen Aufruf fuer die Herstellerliste.
     */
    public static function herstellername(array $dokument)
    {
        $daten = isset($dokument['data']) && is_array($dokument['data']) ? $dokument['data'] : $dokument;
        $hersteller = self::feld(self::feld($daten, 'item', array()), 'manufacturer', array());
        $name = (string) self::erstes($hersteller, array('externalName'), '');
        if ($name === '') {
            $name = (string) self::erstes($hersteller, array('name'), '');
        }
        return $name;
    }

    /**
     * Welche Schluessel ein Dokument hat — fuer die Fehlersuche, falls Plenty
     * etwas anders benennt als hier erwartet.
     */
    public static function gliederung(array $dokument)
    {
        $daten = isset($dokument['data']) && is_array($dokument['data']) ? $dokument['data'] : $dokument;
        $heraus = array();
        foreach ($daten as $schluessel => $wert) {
            if (is_array($wert)) {
                $unter = array();
                foreach ($wert as $k => $v) {
                    $unter[] = (string) $k;
                    if (count($unter) >= 15) {
                        break;
                    }
                }
                $heraus[(string) $schluessel] = implode(',', $unter);
            } else {
                $heraus[(string) $schluessel] = '(Wert)';
            }
        }
        return $heraus;
    }

    // ---- Bausteine ---------------------------------------------------------

    private static function texte(array $daten)
    {
        $texte = self::erstes($daten, array('texts'), array());
        $heraus = array();
        foreach ((array) $texte as $eintrag) {
            if (!is_array($eintrag)) {
                continue;
            }
            $heraus[] = array(
                'lang'             => (string) self::erstes($eintrag, array('lang'), ''),
                'name1'            => (string) self::erstes($eintrag, array('name1', 'name'), ''),
                'description'      => (string) self::erstes($eintrag, array('description'), ''),
                'shortDescription' => (string) self::erstes($eintrag, array('shortDescription'), ''),
            );
        }
        return $heraus;
    }

    private static function preise(array $daten)
    {
        $liste = self::erstes($daten, array('salesPrices', 'prices', 'variationSalesPrices'), array());
        $heraus = array();
        foreach ((array) $liste as $eintrag) {
            if (!is_array($eintrag)) {
                continue;
            }
            $id = (int) self::erstes($eintrag, array('salesPriceId', 'id'), 0);
            $preis = self::erstes($eintrag, array('price', 'value', 'unitPrice'), null);
            if (is_array($preis)) {
                $preis = self::erstes($preis, array('value', 'price'), null);
            }
            if ($id > 0 && $preis !== null) {
                $heraus[] = array('salesPriceId' => $id, 'price' => (float) $preis);
            }
        }
        return $heraus;
    }

    private static function barcodes(array $daten)
    {
        $liste = self::erstes($daten, array('barcodes', 'variationBarcodes'), array());
        $heraus = array();
        foreach ((array) $liste as $eintrag) {
            if (is_array($eintrag)) {
                $code = (string) self::erstes($eintrag, array('code'), '');
                if ($code !== '') {
                    $heraus[] = array('code' => $code);
                }
            }
        }
        return $heraus;
    }

    /**
     * Der Bestand. Im Suchindex steht er als ein Objekt mit "net", in der
     * alten Suche als Liste je Lager mit "netStock". Beides wird gelesen.
     */
    private static function bestand(array $daten)
    {
        $bestand = self::erstes($daten, array('stock'), null);
        if (!is_array($bestand)) {
            return array();
        }
        $einzeln = self::erstes($bestand, array('net', 'netStock', 'stockNet'), null);
        if ($einzeln !== null && !is_array($einzeln)) {
            return array(array('netStock' => (float) $einzeln));
        }
        $heraus = array();
        foreach ($bestand as $zeile) {
            if (is_array($zeile)) {
                $netto = self::erstes($zeile, array('netStock', 'net'), null);
                if ($netto !== null) {
                    $heraus[] = array('netStock' => (float) $netto);
                }
            }
        }
        return $heraus;
    }

    private static function feld(array $daten, $schluessel, $ersatz)
    {
        return isset($daten[$schluessel]) && is_array($daten[$schluessel]) ? $daten[$schluessel] : $ersatz;
    }

    private static function erstes(array $daten, array $schluessel, $ersatz)
    {
        foreach ($schluessel as $s) {
            if (array_key_exists($s, $daten) && $daten[$s] !== null) {
                return $daten[$s];
            }
        }
        return $ersatz;
    }
}
