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
 *
 * Nur statische Methoden und keine Closures: Der Plugin-Build von PlentyONE
 * lässt weder `new` noch den Aufruf einer Funktion aus einer Variablen zu.
 */
class Inserat
{
    /** Höchstlänge der Überschrift. Lieber selbst kürzen als abgeschnitten werden. */
    const MAX_TITEL = 100;

    /** Höchstlänge des Beschreibungstextes. */
    const MAX_BESCHREIBUNG = 4000;

    /**
     * Baut das Inserat und sagt gleichzeitig, was ihm fehlt.
     *
     * Beides in einem Durchgang, damit sich zeigen lässt, was rausginge UND
     * warum es (noch) nicht rausgeht. Zwei getrennte Wege wären zwei
     * Wahrheiten, die auseinanderlaufen können.
     *
     * @param array $artikel  flaches Array, siehe Artikelabbildung
     * @param array $umgebung Betriebsangaben aus der Plugin-Konfiguration
     * @return array ['werte' => array, 'maengel' => array, 'hinweise' => array]
     */
    public static function bauen(array $artikel, array $umgebung)
    {
        $maengel = array();
        $hinweise = array();

        // ---- Überschrift und Text ----------------------------------------
        $titel = self::kuerze((string) self::wert($artikel, 'titel', ''), self::MAX_TITEL);
        if ($titel === '') {
            $maengel[] = 'Kein Titel — die Variante hat in Plenty keinen Namen.';
        }

        $beschreibung = self::kuerze(
            self::alsFliesstext((string) self::wert($artikel, 'beschreibung', '')),
            self::MAX_BESCHREIBUNG
        );
        if ($beschreibung === '') {
            $maengel[] = 'Keine Beschreibung — am Artikel steht kein Text.';
        }

        // ---- Verfügbarkeit ------------------------------------------------
        // Was nicht da ist, wird nicht angeboten. Eine Anfrage zu einem
        // verkauften Gerät kostet Vertrauen, und zwar bei dem, der sich
        // gemeldet hat.
        if (self::wert($artikel, 'aktiv', true) === false) {
            $maengel[] = 'In Plenty inaktiv — inaktive Artikel gehen nicht auf den Marktplatz.';
        }
        $bestand = self::wert($artikel, 'bestand', null);
        if ($bestand !== null && $bestand <= 0) {
            $maengel[] = 'Kein Bestand.';
        }
        if ($bestand === null) {
            $hinweise[] = 'Bestand unbekannt — Plenty hat keine Bestandszeile geliefert.';
        }

        // ---- Preis ---------------------------------------------------------
        $brutto = self::zahlOderNull(self::wert($artikel, 'preis', null));
        $preisFeld = '';
        if ($brutto === null || $brutto <= 0) {
            $maengel[] = 'Kein Preis — ohne Preis kein Inserat.';
        } else {
            $mwst = (float) self::wert($umgebung, 'mwst', 19);
            // Welche Liste den Preis geliefert hat, entscheidet: Die eine kann
            // netto geführt sein, die andere brutto.
            $ausErsatz = self::wert($artikel, 'preisErsatz', false) === true;
            $schluessel = $ausErsatz ? 'preisIstErsatz' : 'preisIst';
            $istNetto = self::wert($umgebung, $schluessel, 'brutto') === 'netto';
            $preisFeld = self::zahl($istNetto ? $brutto : self::netto($brutto, $mwst), 2);
        }

        // ---- Bilder ---------------------------------------------------------
        $alle = array();
        foreach ((array) self::wert($artikel, 'bilder', array()) as $url) {
            if (is_string($url) && trim($url) !== '') {
                $alle[] = trim($url);
            }
        }
        $bilder = array_slice($alle, 0, Spaltenplan::MAX_BILDER);
        if (count($bilder) === 0) {
            $maengel[] = 'Keine Fotos — ein Inserat ohne Bild wird nicht angesehen.';
        }
        if (count($alle) > Spaltenplan::MAX_BILDER) {
            $hinweise[] = count($alle) . ' Fotos vorhanden, übertragen werden die ersten ' . Spaltenplan::MAX_BILDER . '.';
        }

        // ---- Kategorie und Standort -----------------------------------------
        $kategorie = self::findeKategorie($artikel, $umgebung);
        if ($kategorie['kategorie'] === '') {
            $maengel[] = 'Keine Maschinensucher-Kategorie hinterlegt (Plugin-Konfiguration).';
        } elseif ($kategorie['herkunft'] === 'standard') {
            $hinweise[] = 'Auffangkategorie „' . $kategorie['kategorie'] . '" — keine Zuordnung hat gegriffen.';
        }

        $plz = (string) self::wert($umgebung, 'plz', '');
        $ort = (string) self::wert($umgebung, 'ort', '');
        $land = (string) self::wert($umgebung, 'land', 'DE');
        if ($plz === '' || $ort === '' || $land === '') {
            $maengel[] = 'Kein Standort hinterlegt (PLZ / Ort / Land in der Plugin-Konfiguration).';
        }

        // ---- Was auffällt, aber nicht aufhält --------------------------------
        if ((string) self::wert($artikel, 'hersteller', '') === '') {
            $hinweise[] = 'Kein Hersteller hinterlegt.';
        }
        if ((string) self::wert($artikel, 'baujahr', '') === '') {
            $hinweise[] = 'Kein Baujahr — auf Maschinenmarktplätzen die erste Rückfrage.';
        }
        $gewichtG = self::zahlOderNull(self::wert($artikel, 'gewichtG', null));
        if ($gewichtG === null) {
            $hinweise[] = 'Kein Gewicht — Transportfrage bleibt offen.';
        }

        // ---- Zusammensetzen ---------------------------------------------------
        $shopBasis = rtrim((string) self::wert($umgebung, 'shopBasisUrl', ''), '/');
        $itemId = self::wert($artikel, 'itemId', 0);
        $variantennummer = trim((string) self::wert($artikel, 'nummer', ''));
        if ($variantennummer === '') {
            $variantennummer = (string) self::wert($artikel, 'variationId', '');
        }
        $nummer = self::nummernQuelle($artikel, (string) self::wert($umgebung, 'nummernQuelle', 'itemId'));

        $werte = array(
            'inseratsnummer'  => self::inseratsnummer($nummer, (string) self::wert($umgebung, 'nummernPraefix', 'KK-')),
            'kategorie'       => $kategorie['kategorie'],
            'titel'           => $titel,
            'hersteller'      => (string) self::wert($artikel, 'hersteller', ''),
            'typ'             => (string) self::wert($artikel, 'modell', ''),
            'baujahr'         => (string) self::wert($artikel, 'baujahr', ''),
            'zustand'         => (string) self::wert($artikel, 'zustand', ''),
            'beschreibung'    => $beschreibung,
            'preis'           => $preisFeld,
            'waehrung'        => (string) self::wert($umgebung, 'waehrung', 'EUR'),
            'preisart'        => 'netto',
            'mwst'            => self::zahl((float) self::wert($umgebung, 'mwst', 19), 0),
            'menge'           => (string) max(1, (int) ($bestand === null ? 1 : $bestand)),
            'seriennummer'    => '',
            'interne_nummer'  => $variantennummer !== '' ? $variantennummer : (string) self::wert($artikel, 'ean', ''),
            'land'            => $land,
            'plz'             => $plz,
            'ort'             => $ort,
            'gewicht'         => $gewichtG !== null && $gewichtG > 0 ? self::zahl($gewichtG / 1000, 1) : '',
            'laenge'          => self::mmInCm(self::wert($artikel, 'laengeMM', null)),
            'breite'          => self::mmInCm(self::wert($artikel, 'breiteMM', null)),
            'hoehe'           => self::mmInCm(self::wert($artikel, 'hoeheMM', null)),
            'ansprechpartner' => (string) self::wert($umgebung, 'ansprechpartner', ''),
            'telefon'         => (string) self::wert($umgebung, 'telefon', ''),
            'email'           => (string) self::wert($umgebung, 'email', ''),
            'url'             => $shopBasis !== '' && $itemId ? $shopBasis . '/a-' . $itemId : '',
        );

        $nr = 1;
        foreach ($bilder as $url) {
            $werte['bild' . $nr] = $url;
            $nr++;
        }

        return array('werte' => $werte, 'maengel' => $maengel, 'hinweise' => $hinweise);
    }

    /** Darf dieses Inserat in die Datei? */
    public static function vollstaendig(array $inserat)
    {
        return isset($inserat['maengel']) && count($inserat['maengel']) === 0;
    }

    // -----------------------------------------------------------------------
    // Kleinteile
    // -----------------------------------------------------------------------

    /** Ein Wert aus einem Array, mit Vorgabe. Ersetzt die frühere Closure. */
    public static function wert(array $daten, $schluessel, $standard = null)
    {
        if (!array_key_exists($schluessel, $daten) || $daten[$schluessel] === null) {
            return $standard;
        }
        return $daten[$schluessel];
    }

    /**
     * Woraus die Inseratsnummer gebildet wird.
     *
     * DAS IST DIE STELLE, AN DER SICH ENTSCHEIDET, OB EIN LAUF BESTEHENDE
     * INSERATE AKTUALISIERT ODER VERDOPPELT. Maschinensucher erkennt ein
     * Inserat an dieser Nummer wieder. Wer seine Inserate bisher unter der
     * Plenty-Artikel-ID geführt hat, muss genau die liefern — eine andere
     * Nummer legt neben jedem laufenden Inserat ein zweites an.
     *
     * 'itemId'          — die Plenty-Artikel-ID (Vorgabe)
     * 'variantennummer' — die Variantennummer, sonst die Varianten-ID
     * 'variationId'     — die Varianten-ID
     */
    public static function nummernQuelle(array $artikel, $quelle = 'itemId')
    {
        if ($quelle === 'variationId') {
            return (string) self::wert($artikel, 'variationId', '');
        }
        if ($quelle === 'variantennummer') {
            $nummer = trim((string) self::wert($artikel, 'nummer', ''));
            return $nummer !== '' ? $nummer : (string) self::wert($artikel, 'variationId', '');
        }
        return (string) self::wert($artikel, 'itemId', '');
    }

    /**
     * Die feste Nummer des Inserats.
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
     * Erst die von Hand am Artikel gesetzte, dann die Zuordnung über
     * Suchworte, dann die Auffangkategorie. Dass die Auffangkategorie
     * gegriffen hat, wird gesagt: Ein Inserat in der falschen Rubrik ist so
     * gut wie keines.
     */
    public static function findeKategorie(array $artikel, array $umgebung)
    {
        $eigene = trim((string) self::wert($artikel, 'kategorie', ''));
        if ($eigene !== '') {
            return array('kategorie' => $eigene, 'herkunft' => 'artikel');
        }

        $heuhaufen = mb_strtolower(
            (string) self::wert($artikel, 'titel', '') . ' ' .
            (string) self::wert($artikel, 'hersteller', '') . ' ' .
            (string) self::wert($artikel, 'modell', ''),
            'UTF-8'
        );

        foreach ((array) self::wert($umgebung, 'kategorieZuordnung', array()) as $wort => $kategorie) {
            $wort = mb_strtolower(trim((string) $wort), 'UTF-8');
            if ($wort !== '' && strpos($heuhaufen, $wort) !== false) {
                return array('kategorie' => (string) $kategorie, 'herkunft' => 'zuordnung');
            }
        }

        return array(
            'kategorie' => (string) self::wert($umgebung, 'kategorieStandard', ''),
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
        $luecke = strrpos($schnitt, ' ');
        if ($luecke !== false && $luecke > $max * 0.6) {
            $schnitt = substr($schnitt, 0, $luecke);
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
