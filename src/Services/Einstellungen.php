<?php

namespace MaschinensucherMarkt\Services;

use Plenty\Plugin\ConfigRepository;

/**
 * Die Plugin-Konfiguration, einmal eingelesen.
 *
 * Alles, was der Betrieb einstellt, steht im Plenty-Backend unter
 * Plugins → Plugin-Set → Maschinensucher → Konfiguration. Diese Klasse macht
 * daraus ein einfaches Array, damit die Logik (Logik/Inserat.php) ohne
 * Plenty auskommt und geprüft werden kann.
 */
class Einstellungen
{
    const PLUGIN = 'MaschinensucherMarkt';

    /** @var ConfigRepository */
    private $config;

    public function __construct(ConfigRepository $config)
    {
        $this->config = $config;
    }

    private function wert($schluessel, $standard = '')
    {
        $wert = $this->config->get(self::PLUGIN . '.' . $schluessel, $standard);
        if ($wert === null) {
            return $standard;
        }
        if (is_string($wert)) {
            return trim($wert);
        }
        return $wert;
    }

    /**
     * Zahl aus der Konfiguration.
     *
     * Die Prüfung auf den leeren Text ist der Punkt: (float) '' ist 0 — eine
     * nicht ausgefüllte Mehrwertsteuer wäre stillschweigend 0 % geworden, und
     * jeder Preis ginge um den Steuersatz zu hoch raus.
     */
    private function zahl($schluessel, $standard)
    {
        $roh = $this->wert($schluessel, '');
        if ($roh === '' || !is_numeric(str_replace(',', '.', (string) $roh))) {
            return $standard;
        }
        return (float) str_replace(',', '.', (string) $roh);
    }

    /** Das Token in der Abholadresse. Ohne gültiges Token ist die Strecke aus. */
    /**
     * Der Token fuer die Maschinensucher-API. Vollzugriff auf alle Inserate.
     */
    public function apiToken()
    {
        return trim((string) $this->wert('apiToken', ''));
    }

    public function apiEingerichtet()
    {
        return strlen($this->apiToken()) >= 16;
    }

    /**
     * Vorsatz vor der Inseratsnummer. Leer, wenn die nackte Artikel-ID
     * verwendet wird — so steht es bei diesem Konto auf den bestehenden
     * Inseraten.
     */
    public function nummernPraefix()
    {
        return trim((string) $this->wert('nummernPraefix', ''));
    }



    /** ID der Plenty-Markierung, die einen Artikel auf den Marktplatz stellt. */
    public function markierungId()
    {
        return (int) $this->zahl('flagId', 27);
    }

    /** 'flagOne', 'flagTwo' oder 'beide'. */
    public function markierungFeld()
    {
        $feld = (string) $this->wert('flagFeld', 'flagOne');
        return in_array($feld, array('flagOne', 'flagTwo', 'beide'), true) ? $feld : 'flagOne';
    }


    public function preislisteId()
    {
        $id = (int) $this->zahl('preislisteId', 0);
        return $id > 0 ? $id : null;
    }

    /**
     * Die Liste, die einspringt, wenn die erste am Artikel leer ist.
     *
     * Ohne sie ginge am Anfang fast nichts raus: Die eigene Marktplatz-Liste
     * ist frisch angelegt meist leer, während im Webshop längst ein Preis
     * steht.
     */
    public function preislisteErsatzId()
    {
        $id = (int) $this->zahl('preislisteErsatzId', 0);
        return $id > 0 ? $id : null;
    }





    /** Alles, was an einem Inserat hängt, aber nicht am Artikel. */
    public function umgebung()
    {
        return array(
            'nummernPraefix' => (string) $this->wert('nummernPraefix', 'KK-'),
            'preisIst' => $this->wert('preisIst', 'brutto') === 'netto' ? 'netto' : 'brutto',
            'preisIstErsatz' => $this->wert('preisIstErsatz', 'brutto') === 'netto' ? 'netto' : 'brutto',
            'nummernQuelle' => $this->nummernQuelle(),
            'mwst' => $this->zahl('mwst', 19),
            'waehrung' => (string) $this->wert('waehrung', 'EUR'),
            'land' => (string) $this->wert('land', 'DE'),
            'plz' => (string) $this->wert('plz', ''),
            'ort' => (string) $this->wert('ort', ''),
            'ansprechpartner' => (string) $this->wert('ansprechpartner', ''),
            'telefon' => (string) $this->wert('telefon', ''),
            'email' => (string) $this->wert('email', ''),
            'kategorieStandard' => (string) $this->wert('kategorie', ''),
            'kategorieId' => (int) $this->wert('kategorie', 0),
            'kategorieZuordnung' => $this->zuordnung(),
            'shopBasisUrl' => (string) $this->wert('shopBasisUrl', ''),
        );
    }

    /** Woraus die Inseratsnummer gebildet wird — siehe Logik/Inserat.php. */
    public function nummernQuelle()
    {
        $quelle = (string) $this->wert('nummernQuelle', 'itemId');
        return in_array($quelle, array('itemId', 'variantennummer', 'variationId'), true) ? $quelle : 'itemId';
    }

    /** Zuordnung "wort=kategorie,wort=kategorie" aus einem Textfeld. */
    public function zuordnung()
    {
        $karte = array();
        foreach (explode(',', (string) $this->wert('kategorieZuordnung', '')) as $paar) {
            $teile = explode('=', $paar);
            if (count($teile) === 2 && trim($teile[0]) !== '' && trim($teile[1]) !== '') {
                $karte[trim($teile[0])] = trim($teile[1]);
            }
        }
        return $karte;
    }

    /** Was an der Einrichtung fehlt — für das Protokoll und die Fehlermeldung. */
    public function maengel()
    {
        $maengel = array();
        if (!$this->apiEingerichtet()) {
            $maengel[] = 'Der API-Token fehlt oder ist zu kurz (mindestens 16 Zeichen).';
        }
        if ($this->markierungId() <= 0) {
            $maengel[] = 'Keine Markierungs-ID eingestellt — ohne sie geht kein Artikel raus.';
        }
        // Die Auffangrubrik steht hier bewusst NICHT mehr: Die bestehenden
        // Inserate bringen ihre Rubrik aus der Bestandsaufnahme mit.
        // Gebraucht wird sie nur fuer Artikel, die drueben noch nicht
        // stehen — und dort faellt ihr Fehlen beim einzelnen Artikel auf,
        // nicht beim ganzen Lauf.
        $umgebung = $this->umgebung();
        if ($umgebung['plz'] === '' || $umgebung['ort'] === '') {
            $maengel[] = 'Kein Standort eingestellt (PLZ / Ort).';
        }
        if ($umgebung['email'] === '') {
            $maengel[] = 'Keine E-Mail eingestellt — Anfragen hätten keinen Empfänger.';
        }
        return $maengel;
    }
}
