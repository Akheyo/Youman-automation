<?php

namespace MaschinensucherMarkt\Logik;

/**
 * Von einer Plenty-Variante zu dem flachen Artikel-Array, aus dem ein Inserat
 * entsteht.
 *
 * Reine Umrechnung — die Klasse bekommt das Array, das die Plenty-Suche
 * liefert, und gibt ein Array zurück. Kein Repository, keine Modelle: So
 * lässt sich genau das prüfen, was sonst nur im Livesystem auffällt, nämlich
 * ob wir die richtigen Felder lesen.
 */
class Artikelabbildung
{
    /**
     * Die Zustände, die PlentyONE kennt (Einrichtung → Artikel → Zustand).
     * Die IDs sind dort fest vergeben; der Text geht so ins Inserat.
     */
    public static $zustandText = array(
        0 => 'Neu',
        1 => 'Gebraucht',
        2 => 'Neu (Restposten)',
        3 => 'Gebraucht (generalüberholt)',
        4 => 'Defekt',
    );

    /**
     * Trägt der Artikel die Maschinensucher-Markierung?
     *
     * DAS IST DER SCHALTER DER GANZEN STRECKE, und er steht in Plenty: Wer die
     * Markierung am Artikel setzt, stellt das Gerät auf den Marktplatz; wer
     * sie wegnimmt, holt es zurück.
     *
     * Die beiden Markierungsfelder sind getrennte Listen: Die 27 in Feld 1 ist
     * nicht dieselbe Markierung wie die 27 in Feld 2. Deshalb wird nur das
     * eingestellte Feld gelesen — sonst ginge ein Artikel online, weil in der
     * anderen Liste zufällig dieselbe Nummer steht.
     *
     * @param array  $variante Rohdaten aus der Plenty-Suche
     * @param int    $id       Markierungs-ID, z. B. 27
     * @param string $feld     'flagOne', 'flagTwo' oder 'beide'
     */
    public static function istMarkiert(array $variante, $id, $feld = 'flagOne')
    {
        $id = (int) $id;
        if ($id <= 0) {
            return false;
        }

        $eins = (int) self::tief($variante, array('item', 'flagOne'), self::wert($variante, 'flagOne', 0));
        $zwei = (int) self::tief($variante, array('item', 'flagTwo'), self::wert($variante, 'flagTwo', 0));

        if ($feld === 'flagTwo') {
            return $zwei === $id;
        }
        if ($feld === 'beide') {
            return $eins === $id || $zwei === $id;
        }
        return $eins === $id;
    }

    /**
     * Bestand über alle Lager.
     *
     * Gezählt wird der NETTO-Bestand: Was reserviert ist, gehört schon
     * jemandem. Ohne Bestandsangabe null, nicht 0 — das ist ein Unterschied:
     * "nichts da" nimmt ein Inserat vom Markt, "nicht bekannt" nicht.
     */
    public static function bestand(array $variante)
    {
        $zeilen = self::wert($variante, 'stock', null);
        if (is_array($zeilen) && count($zeilen) > 0) {
            $summe = 0;
            foreach ($zeilen as $zeile) {
                $netto = self::wert((array) $zeile, 'netStock', null);
                if ($netto === null) {
                    $netto = self::wert((array) $zeile, 'physicalStock', 0);
                }
                $summe += (float) $netto;
            }
            return $summe;
        }
        $einzeln = self::wert($variante, 'stockNet', null);
        return $einzeln === null ? null : (float) $einzeln;
    }

    /**
     * Der Verkaufspreis.
     *
     * Gibt es mehrere Preislisten, entscheidet die konfigurierte ID. Ohne
     * Vorgabe wird die KLEINSTE genommen — in Plenty üblicherweise die
     * Hauptpreisliste. Ist die konfigurierte Liste nicht dabei, gibt es
     * KEINEN Preis: Lieber kein Inserat als eines mit dem Preis einer
     * fremden Liste, den so niemand beschlossen hat.
     */
    public static function preis(array $variante, $preislisteId = null)
    {
        $preise = self::wert($variante, 'variationSalesPrices', array());
        $brauchbar = array();
        foreach ((array) $preise as $eintrag) {
            $eintrag = (array) $eintrag;
            $wert = isset($eintrag['price']) ? (float) $eintrag['price'] : 0;
            if ($wert > 0) {
                $brauchbar[] = array(
                    'id' => isset($eintrag['salesPriceId']) ? (int) $eintrag['salesPriceId'] : PHP_INT_MAX,
                    'preis' => $wert,
                );
            }
        }
        if (count($brauchbar) === 0) {
            return null;
        }

        if ($preislisteId !== null && (int) $preislisteId > 0) {
            foreach ($brauchbar as $eintrag) {
                if ($eintrag['id'] === (int) $preislisteId) {
                    return $eintrag['preis'];
                }
            }
            return null;
        }

        usort($brauchbar, function ($a, $b) {
            return $a['id'] - $b['id'];
        });
        return $brauchbar[0]['preis'];
    }

    /** Der deutsche Textblock, sonst der erste vorhandene. */
    public static function text(array $variante)
    {
        $texte = self::tief($variante, array('item', 'texts'), self::wert($variante, 'variationDescription', array()));
        $texte = (array) $texte;
        if (count($texte) === 0) {
            return array('name' => '', 'beschreibung' => '');
        }
        $gewaehlt = null;
        foreach ($texte as $eintrag) {
            $eintrag = (array) $eintrag;
            if (isset($eintrag['lang']) && strtolower($eintrag['lang']) === 'de') {
                $gewaehlt = $eintrag;
                break;
            }
        }
        if ($gewaehlt === null) {
            $gewaehlt = (array) $texte[0];
        }
        $name = isset($gewaehlt['name1']) && $gewaehlt['name1'] !== '' ? $gewaehlt['name1'] : self::wert($gewaehlt, 'name', '');
        $beschreibung = isset($gewaehlt['description']) && $gewaehlt['description'] !== ''
            ? $gewaehlt['description']
            : self::wert($gewaehlt, 'shortDescription', '');

        return array('name' => (string) $name, 'beschreibung' => (string) $beschreibung);
    }

    /**
     * Baut aus der Plenty-Variante das flache Array für das Inserat.
     *
     * @param array $variante   Rohdaten aus der Suche
     * @param array $hersteller Herstellernamen nach Plenty-ID
     * @param array $bilder     Bild-Adressen (öffentliche Plenty-URLs)
     * @param int|null $preislisteId
     */
    public static function ausVariante(array $variante, array $hersteller = array(), array $bilder = array(), $preislisteId = null)
    {
        $texte = self::text($variante);
        $herstellerId = (int) self::tief($variante, array('item', 'manufacturerId'), 0);
        $zustandId = self::tief($variante, array('item', 'condition'), null);
        if (is_array($zustandId) && isset($zustandId['id'])) {
            $zustandId = $zustandId['id'];
        }

        $barcode = '';
        foreach ((array) self::wert($variante, 'variationBarcodes', array()) as $eintrag) {
            $eintrag = (array) $eintrag;
            if (isset($eintrag['code']) && trim((string) $eintrag['code']) !== '') {
                $barcode = trim((string) $eintrag['code']);
                break;
            }
        }

        return array(
            'variationId' => (int) self::wert($variante, 'id', 0),
            'itemId'      => (int) self::wert($variante, 'itemId', self::tief($variante, array('item', 'id'), 0)),
            'nummer'      => (string) self::wert($variante, 'number', ''),
            'ean'         => $barcode,
            'titel'       => $texte['name'],
            'beschreibung' => $texte['beschreibung'],
            'hersteller'  => $herstellerId > 0 && isset($hersteller[$herstellerId]) ? $hersteller[$herstellerId] : '',
            'modell'      => (string) self::wert($variante, 'model', ''),
            'baujahr'     => '',
            'zustand'     => $zustandId !== null && isset(self::$zustandText[(int) $zustandId]) ? self::$zustandText[(int) $zustandId] : '',
            'preis'       => self::preis($variante, $preislisteId),
            'bestand'     => self::bestand($variante),
            'gewichtG'    => self::wert($variante, 'weightG', self::wert($variante, 'weightNetG', null)),
            'laengeMM'    => self::wert($variante, 'lengthMM', null),
            'breiteMM'    => self::wert($variante, 'widthMM', null),
            'hoeheMM'     => self::wert($variante, 'heightMM', null),
            'aktiv'       => self::wert($variante, 'isActive', true) !== false,
            'bilder'      => $bilder,
            'kategorie'   => '',
        );
    }

    private static function wert(array $daten, $schluessel, $standard = null)
    {
        return array_key_exists($schluessel, $daten) && $daten[$schluessel] !== null ? $daten[$schluessel] : $standard;
    }

    private static function tief(array $daten, array $pfad, $standard = null)
    {
        $zeiger = $daten;
        foreach ($pfad as $teil) {
            $zeiger = (array) $zeiger;
            if (!array_key_exists($teil, $zeiger) || $zeiger[$teil] === null) {
                return $standard;
            }
            $zeiger = $zeiger[$teil];
        }
        return $zeiger;
    }
}
