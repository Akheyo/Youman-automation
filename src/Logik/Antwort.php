<?php

namespace MaschinensucherMarkt\Logik;

/**
 * Liest eine API-Antwort und sagt, was sie bedeutet.
 *
 * Der Unterschied, um den es hier geht: Wurde etwas ABGELEHNT oder ist etwas
 * AUSGEFALLEN? Eine Ablehnung ist endgueltig — dieselbe Anfrage nochmal zu
 * schicken bringt nichts, der Artikel braucht eine Korrektur in Plenty. Ein
 * Ausfall ist voruebergehend und muss beim naechsten Lauf erneut versucht
 * werden.
 *
 * Wer beides verwechselt, baut einen der beiden teuren Fehler: Entweder wird
 * eine kaputte Anfrage im Minutentakt wiederholt, bis die Gegenstelle sperrt,
 * oder eine Netzstoerung gilt als "Inserat erledigt" und der Bestand laeuft
 * still auseinander.
 */
class Antwort
{
    const OK        = 'ok';
    const ABGELEHNT = 'abgelehnt';
    const ZUGANG    = 'zugang';
    const FEHLT     = 'fehlt';
    const STOERUNG  = 'stoerung';

    /**
     * @param array $roh Rueckgabe von resources/lib/ruf.php
     * @return array ['art', 'meldung', 'daten', 'felder', 'hinweise', 'nochmal']
     */
    public static function lesen(array $roh)
    {
        $status = isset($roh['status']) ? (int) $roh['status'] : 0;
        $daten  = isset($roh['daten']) && is_array($roh['daten']) ? $roh['daten'] : array();
        $fehler = isset($roh['fehler']) ? (string) $roh['fehler'] : '';

        $felder   = self::meldungenJeFeld($daten, 'errors');
        $hinweise = self::meldungenJeFeld($daten, 'warnings');

        // Gar keine Verbindung. Das ist nie die Schuld des Artikels.
        if ($status === 0) {
            return self::bauen(self::STOERUNG, $fehler !== '' ? $fehler : 'Keine Verbindung zur API.', $daten, $felder, $hinweise, true);
        }

        if ($status === 401) {
            return self::bauen(self::ZUGANG, 'Der API-Token wird nicht akzeptiert.', $daten, $felder, $hinweise, false);
        }

        if ($status === 403) {
            // Auch die Mengenbegrenzung beim Anlegen landet hier. Die ist
            // voruebergehend, deshalb: spaeter nochmal.
            $meldung = self::meldung($daten, 'Zugriff verweigert.');
            return self::bauen(self::ZUGANG, $meldung, $daten, $felder, $hinweise, self::istMengenbegrenzung($meldung));
        }

        if ($status === 404) {
            return self::bauen(self::FEHLT, self::meldung($daten, 'Nicht gefunden.'), $daten, $felder, $hinweise, false);
        }

        if ($status >= 500) {
            return self::bauen(self::STOERUNG, 'Die Gegenstelle meldet einen Fehler (' . $status . ').', $daten, $felder, $hinweise, true);
        }

        if ($status >= 400) {
            return self::bauen(self::ABGELEHNT, self::zusammenfassen($felder, self::meldung($daten, 'Abgelehnt.')), $daten, $felder, $hinweise, false);
        }

        // 2xx heisst noch nicht, dass es geklappt hat: Die API antwortet auch
        // auf abgelehnte Inserate mit 200 und success=false.
        if (array_key_exists('success', $daten) && $daten['success'] === false) {
            return self::bauen(self::ABGELEHNT, self::zusammenfassen($felder, 'Abgelehnt, ohne Angabe eines Grundes.'), $daten, $felder, $hinweise, false);
        }

        if ($fehler !== '') {
            return self::bauen(self::STOERUNG, $fehler, $daten, $felder, $hinweise, true);
        }

        return self::bauen(self::OK, '', $daten, $felder, $hinweise, false);
    }

    public static function istOk(array $gelesen)
    {
        return isset($gelesen['art']) && $gelesen['art'] === self::OK;
    }

    /**
     * Soll dieselbe Anfrage spaeter noch einmal versucht werden?
     */
    public static function nochmal(array $gelesen)
    {
        return !empty($gelesen['nochmal']);
    }

    /**
     * Fasst die Feldmeldungen zu einem Satz zusammen, den man im Log lesen kann.
     */
    public static function zusammenfassen(array $felder, $ersatz = '')
    {
        $teile = array();
        foreach ($felder as $feld => $meldungen) {
            $teile[] = $feld . ': ' . implode(' ', $meldungen);
        }
        if (count($teile) === 0) {
            return (string) $ersatz;
        }
        return implode(' | ', $teile);
    }

    private static function bauen($art, $meldung, array $daten, array $felder, array $hinweise, $nochmal)
    {
        return array(
            'art'      => $art,
            'meldung'  => (string) $meldung,
            'daten'    => $daten,
            'felder'   => $felder,
            'hinweise' => $hinweise,
            'nochmal'  => (bool) $nochmal,
        );
    }

    private static function meldung(array $daten, $ersatz)
    {
        if (isset($daten['message']) && is_string($daten['message']) && $daten['message'] !== '') {
            return $daten['message'];
        }
        return $ersatz;
    }

    private static function istMengenbegrenzung($meldung)
    {
        return stripos($meldung, 'rate') !== false;
    }

    /**
     * Die API liefert Meldungen als Feldname => Liste von Texten. Robust
     * gelesen, weil ein einzelner Text statt einer Liste sonst zum Absturz
     * fuehrt.
     */
    private static function meldungenJeFeld(array $daten, $schluessel)
    {
        if (!isset($daten[$schluessel]) || !is_array($daten[$schluessel])) {
            return array();
        }
        $heraus = array();
        foreach ($daten[$schluessel] as $feld => $meldungen) {
            $liste = is_array($meldungen) ? $meldungen : array($meldungen);
            $sauber = array();
            foreach ($liste as $eintrag) {
                if (is_string($eintrag) && $eintrag !== '') {
                    $sauber[] = $eintrag;
                }
            }
            if (count($sauber) > 0) {
                $heraus[(string) $feld] = $sauber;
            }
        }
        return $heraus;
    }
}
