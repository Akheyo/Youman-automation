<?php

namespace MaschinensucherMarkt\Logik;

/**
 * Aus einem Artikel wird ein Maschinensucher-Inserat.
 *
 * Diese Klasse rechnet und formt nur — sie kennt weder Plenty noch die
 * Datenbank, damit jede Regel prüfbar bleibt. Denn hier wird entschieden, mit
 * welchem Preis und welchem Text ein Gerät öffentlich steht, und ein Fehler
 * an dieser Stelle ist von außen sichtbar.
 *
 * DREI ENTSCHEIDUNGEN, DIE MAN KENNEN MUSS:
 *
 * 1. NETTOPREIS. Auf einem Händlermarktplatz wird netto ausgezeichnet. Steht
 *    in Plenty ein Bruttopreis (Voreinstellung), wird heruntergerechnet. Ein
 *    Bruttopreis, der als Netto eingestellt wird, macht uns um den Steuersatz
 *    teurer als gewollt, und niemand sieht es dem Inserat an.
 *
 * 2. EINHEITEN. Plenty führt Gewichte in GRAMM und Maße in MILLIMETERN, das
 *    Inserat Kilogramm und Zentimeter. Wer das übersieht, stellt einen
 *    Kompressor mit "12500 kg" ein, und die Speditionsanfrage kommt trotzdem.
 *
 * 3. KEIN RATEN. Was fehlt, bleibt leer. Ein erfundenes Baujahr steht im
 *    Inserat wie eine Angabe vom Typenschild — und ein Käufer richtet seinen
 *    Transport danach ein.
 */
class Inserat
{
    /** Höchstlänge der Überschrift. Lieber selbst kürzen als abgeschnitten werden. */
    const MAX_TITEL = 100;

    /** Höchstlänge des Beschreibungstextes. */
    const MAX_BESCHREIBUNG = 4000;

    /** @var array Spaltenschlüssel => Wert */
    public $werte = array();

    /** @var array Was das Inserat unmöglich macht. Leer = darf raus. */
    public $maengel = array();

    /** @var array Was auffällt, aber nicht aufhält. */
    public $hinweise = array();

    /**
     * @param array $artikel Siehe Feldliste unten — flaches Array, keine Modelle.
     * @param array $umgebung Betriebsangaben aus der Plugin-Konfiguration.
     */
    public function __construct(array $artikel, array $umgebung)
    {
        $hole = function ($schluessel, $standard = null) use ($artikel) {
            return isset($artikel[$schluessel]) ? $artikel[$schluessel] : $standard;
        };
        $einst = function ($schluessel, $standard = '') use ($umgebung) {
            return isset($umgebung[$schluessel]) && $umgebung[$schluessel] !== null ? $umgebung[$schluessel] : $standard;
        };

        // ---- Überschrift und Text ----------------------------------------
        $titel = self::kuerze((string) $hole('titel', ''), self::MAX_TITEL);
        if ($titel === '') {
            $this->maengel[] = 'Kein Titel — die Variante hat in Plenty keinen Namen.';
        }

        $beschreibung = self::kuerze(self::alsFliesstext((string) $hole('beschreibung', '')), self::MAX_BESCHREIBUNG);
        if ($beschreibung === '') {
            $this->maengel[] = 'Keine Beschreibung — am Artikel steht kein Text.';
        }

        // ---- Verfügbarkeit ------------------------------------------------
        // Was nicht da ist, wird nicht angeboten. Eine Anfrage zu einem
        // verkauften Gerät kostet Vertrauen, und zwar bei dem, der sich
        // gemeldet hat.
        if ($hole('aktiv', true) === false) {
            $this->maengel[] = 'In Plenty inaktiv — inaktive Artikel gehen nicht auf den Marktplatz.';
        }
        $bestand = $hole('bestand', null);
        if ($bestand !== null && $bestand <= 0) {
            $this->maengel[] = 'Kein Bestand.';
        }
        if ($bestand === null) {
            $this->hinweise[] = 'Bestand unbekannt — Plenty hat keine Bestandszeile geliefert.';
        }

        // ---- Preis ---------------------------------------------------------
        $brutto = self::zahlOderNull($hole('preis', null));
        $preisFeld = '';
        if ($brutto === null || $brutto <= 0) {
            $this->maengel[] = 'Kein Preis — ohne Preis kein Inserat.';
        } else {
            $mwst = (float) $einst('mwst', 19);
            $preisFeld = self::zahl($einst('preisIst', 'brutto') === 'netto' ? $brutto : self::netto($brutto, $mwst), 2);
        }

        // ---- Bilder ---------------------------------------------------------
        $alle = array();
        foreach ((array) $hole('bilder', array()) as $url) {
            if (is_string($url) && trim($url) !== '') {
                $alle[] = trim($url);
            }
        }
        $bilder = array_slice($alle, 0, Spaltenplan::MAX_BILDER);
        if (count($bilder) === 0) {
            $this->maengel[] = 'Keine Fotos — ein Inserat ohne Bild wird nicht angesehen.';
        }
        if (count($alle) > Spaltenplan::MAX_BILDER) {
            $this->hinweise[] = count($alle) . ' Fotos vorhanden, übertragen werden die ersten ' . Spaltenplan::MAX_BILDER . '.';
        }

        // ---- Kategorie und Standort -----------------------------------------
        $kategorie = self::findeKategorie($artikel, $umgebung);
        if ($kategorie['kategorie'] === '') {
            $this->maengel[] = 'Keine Maschinensucher-Kategorie hinterlegt (Plugin-Konfiguration).';
        } elseif ($kategorie['herkunft'] === 'standard') {
            $this->hinweise[] = 'Auffangkategorie „' . $kategorie['kategorie'] . '" — keine Zuordnung hat gegriffen.';
        }

        if ($einst('plz') === '' || $einst('ort') === '' || $einst('land') === '') {
            $this->maengel[] = 'Kein Standort hinterlegt (PLZ / Ort / Land in der Plugin-Konfiguration).';
        }

        // ---- Was auffällt, aber nicht aufhält --------------------------------
        if ((string) $hole('hersteller', '') === '') {
            $this->hinweise[] = 'Kein Hersteller hinterlegt.';
        }
        if ((string) $hole('baujahr', '') === '') {
            $this->hinweise[] = 'Kein Baujahr — auf Maschinenmarktplätzen die erste Rückfrage.';
        }
        if (self::zahlOderNull($hole('gewichtG', null)) === null) {
            $this->hinweise[] = 'Kein Gewicht — Transportfrage bleibt offen.';
        }

        // ---- Zusammensetzen ---------------------------------------------------
        $gewichtG = self::zahlOderNull($hole('gewichtG', null));
        $shopBasis = rtrim((string) $einst('shopBasisUrl'), '/');
        $nummer = trim((string) $hole('nummer', ''));
        if ($nummer === '') {
            $nummer = (string) $hole('variationId', '');
        }

        $this->werte = array(
            'inseratsnummer'  => self::inseratsnummer($nummer, (string) $einst('nummernPraefix', 'KK-')),
            'kategorie'       => $kategorie['kategorie'],
            'titel'           => $titel,
            'hersteller'      => (string) $hole('hersteller', ''),
            'typ'             => (string) $hole('modell', ''),
            'baujahr'         => (string) $hole('baujahr', ''),
            'zustand'         => (string) $hole('zustand', ''),
            'beschreibung'    => $beschreibung,
            'preis'           => $preisFeld,
            'waehrung'        => (string) $einst('waehrung', 'EUR'),
            'preisart'        => 'netto',
            'mwst'            => self::zahl((float) $einst('mwst', 19), 0),
            'menge'           => (string) max(1, (int) ($bestand === null ? 1 : $bestand)),
            'seriennummer'    => '',
            'interne_nummer'  => $nummer !== '' ? $nummer : (string) $hole('ean', ''),
            'land'            => (string) $einst('land', 'DE'),
            'plz'             => (string) $einst('plz'),
            'ort'             => (string) $einst('ort'),
            'gewicht'         => $gewichtG !== null && $gewichtG > 0 ? self::zahl($gewichtG / 1000, 1) : '',
            'laenge'          => self::mmInCm($hole('laengeMM', null)),
            'breite'          => self::mmInCm($hole('breiteMM', null)),
            'hoehe'           => self::mmInCm($hole('hoeheMM', null)),
            'ansprechpartner' => (string) $einst('ansprechpartner'),
            'telefon'         => (string) $einst('telefon'),
            'email'           => (string) $einst('email'),
            'url'             => $shopBasis !== '' && $hole('itemId') ? $shopBasis . '/a-' . $hole('itemId') : '',
        );

        $nr = 1;
        foreach ($bilder as $url) {
            $this->werte['bild' . $nr] = $url;
            $nr++;
        }
    }

    /** Darf dieses Inserat in die Datei? */
    public function vollstaendig()
    {
        return count($this->maengel) === 0;
    }

    // -----------------------------------------------------------------------
    // Kleinteile
    // -----------------------------------------------------------------------

    /**
     * Die feste Nummer des Inserats — aus der Variantennummer.
     *
     * Trägt sie den Vorsatz schon (unsere Nummern beginnen oft mit „KK-"),
     * wird er nicht noch einmal davorgesetzt: „KK-KK-2024-0815" funktioniert
     * zwar, sieht im Maschinensucher-Konto aber aus wie ein Fehler — und wer
     * so etwas sieht, fasst die Nummern an, an denen die Zuordnung hängt.
     */
    public static function inseratsnummer($nummer, $praefix)
    {
        $nummer = trim((string) $nummer);
        if ($praefix !== '' && stripos($nummer, $praefix) === 0) {
            return $nummer;
        }
        return $praefix . $nummer;
    }

    /**
     * Welche Kategorie passt?
     *
     * Erst die von Hand am Artikel gesetzte (Eigenschaft/Konfiguration), dann
     * die Zuordnung über Suchworte, dann die Auffangkategorie. Dass die
     * Auffangkategorie gegriffen hat, wird gesagt: Ein Inserat in der falschen
     * Rubrik ist so gut wie keines.
     */
    public static function findeKategorie(array $artikel, array $umgebung)
    {
        $eigene = isset($artikel['kategorie']) ? trim((string) $artikel['kategorie']) : '';
        if ($eigene !== '') {
            return array('kategorie' => $eigene, 'herkunft' => 'artikel');
        }

        $heuhaufen = mb_strtolower(
            (isset($artikel['titel']) ? $artikel['titel'] : '') . ' ' .
            (isset($artikel['hersteller']) ? $artikel['hersteller'] : '') . ' ' .
            (isset($artikel['modell']) ? $artikel['modell'] : ''),
            'UTF-8'
        );

        $zuordnung = isset($umgebung['kategorieZuordnung']) ? (array) $umgebung['kategorieZuordnung'] : array();
        foreach ($zuordnung as $wort => $kategorie) {
            $wort = mb_strtolower(trim((string) $wort), 'UTF-8');
            if ($wort !== '' && mb_strpos($heuhaufen, $wort) !== false) {
                return array('kategorie' => (string) $kategorie, 'herkunft' => 'zuordnung');
            }
        }

        return array(
            'kategorie' => isset($umgebung['kategorieStandard']) ? (string) $umgebung['kategorieStandard'] : '',
            'herkunft' => 'standard',
        );
    }

    /** Brutto → Netto. Der Satz kommt aus der Konfiguration, nicht aus dem Code. */
    public static function netto($brutto, $mwstProzent)
    {
        $satz = is_numeric($mwstProzent) && $mwstProzent > 0 ? (float) $mwstProzent : 0.0;
        return round($brutto / (1 + $satz / 100), 2);
    }

    /** Zahl mit Komma als Dezimaltrennzeichen — so liest Maschinensucher sie. */
    public static function zahl($wert, $stellen = 2)
    {
        return number_format((float) $wert, $stellen, ',', '');
    }

    /** Millimeter aus Plenty als Zentimeter fürs Inserat. */
    public static function mmInCm($mm)
    {
        $wert = self::zahlOderNull($mm);
        if ($wert === null || $wert <= 0) {
            return '';
        }
        return self::zahl($wert / 10, 0);
    }

    public static function zahlOderNull($wert)
    {
        if ($wert === null || $wert === '' || !is_numeric($wert)) {
            return null;
        }
        return (float) $wert;
    }

    /**
     * Kürzt an der letzten Wortgrenze davor. Ein mitten im Wort
     * abgeschnittener Titel sieht aus wie ein Datenfehler — und ist einer.
     */
    public static function kuerze($text, $max)
    {
        $text = trim($text);
        if (mb_strlen($text, 'UTF-8') <= $max) {
            return $text;
        }
        $schnitt = mb_substr($text, 0, $max, 'UTF-8');
        $luecke = mb_strrpos($schnitt, ' ', 0, 'UTF-8');
        if ($luecke !== false && $luecke > $max * 0.6) {
            $schnitt = mb_substr($schnitt, 0, $luecke, 'UTF-8');
        }
        return rtrim($schnitt, " \t\n\r,;·-");
    }

    /**
     * Macht aus der HTML-Beschreibung einen Fließtext.
     *
     * Plenty-Beschreibungen sind HTML, weil sie so im Shop gebraucht werden.
     * In eine Importdatei gehören keine Tags: Im günstigen Fall werden sie
     * entfernt, im ungünstigen stehen sie sichtbar im Inserat. Absätze und
     * Aufzählungen bleiben als Zeilenumbrüche erhalten.
     */
    public static function alsFliesstext($html)
    {
        $text = preg_replace('/<\s*br\s*\/?>/i', "\n", $html);
        $text = preg_replace('/<\s*\/\s*(p|div|h[1-6]|tr)\s*>/i', "\n\n", $text);
        $text = preg_replace('/<\s*li[^>]*>/i', "\n· ", $text);
        $text = preg_replace('/<[^>]+>/', '', $text);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/[ \t]+/', ' ', $text);
        $text = preg_replace('/ *\n */', "\n", $text);
        $text = preg_replace('/\n{3,}/', "\n\n", $text);
        return trim($text);
    }
}
