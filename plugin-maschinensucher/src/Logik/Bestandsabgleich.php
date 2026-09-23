<?php

namespace MaschinensucherMarkt\Logik;

/**
 * Liest, was bei Maschinensucher schon online steht.
 *
 * Der Sinn: Bevor dieses Plugin irgendetwas anlegt, muss es wissen, was es
 * drueben bereits gibt. Sonst entsteht zu jedem der bestehenden Inserate ein
 * zweites — dieselbe Maschine, zweimal am Markt, zweimal bezahlt.
 *
 * Die Bruecke ist die internalId: die eigene Referenznummer, die beim Konto
 * die Plenty-Artikel-ID ist. Wo sie fehlt oder etwas anderes drinsteht (bei
 * ein paar Inseraten steht ein Name), bleibt die Zuordnung leer. Das ist
 * ausdruecklich erlaubt und kein Fehler: Ein solches Inserat wird dann
 * weder angefasst noch geloescht, es bleibt einfach in Ruhe stehen.
 */
class Bestandsabgleich
{
    const AKTIV     = 'aktiv';
    const PAUSIERT  = 'pausiert';
    const GESPERRT  = 'gesperrt';
    const PRUEFUNG  = 'pruefung';
    const UNBEKANNT = 'unbekannt';

    /**
     * Macht aus einer Seite von GET /json/listing/all eine schlichte Liste.
     *
     * @param array  $daten   Die 'daten' der Antwort
     * @param string $praefix Vorsatz, der vor der Artikel-ID steht, falls einer gepflegt wird
     * @return array
     */
    public static function seiteLesen(array $daten, $praefix = '')
    {
        $inserate = array();
        $roh = isset($daten['listings']) && is_array($daten['listings']) ? $daten['listings'] : array();

        foreach ($roh as $schluessel => $eintrag) {
            $eintrag = (array) $eintrag;
            $inserat = isset($eintrag['listing']) ? (array) $eintrag['listing'] : array();

            // Die ID steht im Schluessel UND im Inserat. Der Schluessel ist
            // die verlaesslichere Quelle, weil die Liste danach indiziert ist.
            $inseratId = (int) $schluessel;
            if ($inseratId <= 0 && isset($inserat['id'])) {
                $inseratId = (int) $inserat['id'];
            }
            if ($inseratId <= 0) {
                continue;
            }

            $internalId = isset($inserat['internalId']) ? trim((string) $inserat['internalId']) : '';

            $inserate[] = array(
                'inseratId'   => $inseratId,
                'internalId'  => $internalId,
                'artikelId'   => self::artikelIdAus($internalId, $praefix),
                'kategorieId' => isset($inserat['categoryId']) ? (int) $inserat['categoryId'] : 0,
                'zustand'     => self::zustandAus(isset($eintrag['status']) ? $eintrag['status'] : array()),
                'titel'       => self::titelAus($inserat),
                'laeuftBis'   => isset($inserat['expirationDate']) ? (int) $inserat['expirationDate'] : 0,
            );
        }

        return $inserate;
    }

    /**
     * Die Plenty-Artikel-ID aus der eigenen Referenz.
     *
     * Null bedeutet: nicht zuordenbar. Dieser Fall ist haeufiger als man
     * denkt — gewachsene Konten haben Inserate, bei denen jemand einen Namen
     * oder gar nichts eingetragen hat.
     */
    public static function artikelIdAus($internalId, $praefix = '')
    {
        $wert = trim((string) $internalId);
        if ($wert === '') {
            return 0;
        }

        $praefix = trim((string) $praefix);
        if ($praefix !== '' && stripos($wert, $praefix) === 0) {
            $wert = substr($wert, strlen($praefix));
        }

        $wert = trim($wert);
        // Bewusst streng: "62923" ja, "Thomas 3" nein, "62923-alt" nein.
        // Eine halb erratene Zuordnung waere schlimmer als gar keine — sie
        // wuerde ein fremdes Inserat ueberschreiben.
        if ($wert === '' || !ctype_digit($wert)) {
            return 0;
        }

        return (int) $wert;
    }

    /**
     * Die Statusmerkmale der API zu einem Wort.
     *
     * Die API liefert eine Liste, ein Inserat kann mehrere tragen. Die
     * Reihenfolge hier ist die Rangfolge: Gesperrt schlaegt pausiert,
     * pausiert schlaegt aktiv.
     */
    public static function zustandAus($status)
    {
        $flaggen = array();
        foreach ((array) $status as $eintrag) {
            if (is_string($eintrag)) {
                $flaggen[] = strtoupper($eintrag);
            }
        }

        if (count($flaggen) === 0) {
            return self::UNBEKANNT;
        }
        if (in_array('BLOCKED', $flaggen, true)) {
            return self::GESPERRT;
        }
        if (in_array('PAUSED', $flaggen, true)
            || in_array('EXPIRED', $flaggen, true)
            || in_array('INACTIVE', $flaggen, true)) {
            return self::PAUSIERT;
        }
        if (in_array('ACTIVE', $flaggen, true)) {
            // Eine laufende Pruefung aendert nichts daran, dass das Inserat
            // oeffentlich sichtbar ist — die alte Fassung bleibt stehen.
            return self::AKTIV;
        }
        if (in_array('UNDER_REVIEW', $flaggen, true) || in_array('PENDING_UPDATE', $flaggen, true)) {
            return self::PRUEFUNG;
        }

        return self::UNBEKANNT;
    }

    /**
     * Ob nach dieser Seite noch eine weitere kommt.
     */
    public static function weitereSeite(array $daten, $seite)
    {
        $gesamt = isset($daten['totalPageNumber']) ? (int) $daten['totalPageNumber'] : 0;
        if ($gesamt > 0) {
            return (int) $seite < $gesamt;
        }
        // Ohne Seitenangabe: Solange etwas kam, koennte noch mehr kommen.
        $anzahl = isset($daten['listingCount']) ? (int) $daten['listingCount'] : 0;
        return $anzahl > 0;
    }

    /**
     * Der Titel kommt je Sprache. Fuer Protokolle reicht irgendeiner,
     * Deutsch bevorzugt.
     */
    public static function titelAus(array $inserat)
    {
        $titel = isset($inserat['title']) ? $inserat['title'] : '';
        if (is_string($titel)) {
            return $titel;
        }
        $titel = (array) $titel;
        if (isset($titel['de']) && is_string($titel['de'])) {
            return $titel['de'];
        }
        foreach ($titel as $eintrag) {
            if (is_string($eintrag) && $eintrag !== '') {
                return $eintrag;
            }
        }
        return '';
    }

    /**
     * Fasst eine gelesene Liste zusammen — die Zahlen, die man nach dem
     * ersten Lauf sehen will.
     */
    public static function bilanz(array $inserate)
    {
        $bilanz = array(
            'gesamt'          => count($inserate),
            'zugeordnet'      => 0,
            'ohneZuordnung'   => 0,
            'aktiv'           => 0,
            'pausiert'        => 0,
            'doppelteArtikel' => array(),
        );

        $gesehen = array();
        foreach ($inserate as $inserat) {
            if ($inserat['zustand'] === self::AKTIV) {
                $bilanz['aktiv']++;
            } elseif ($inserat['zustand'] === self::PAUSIERT) {
                $bilanz['pausiert']++;
            }

            $artikelId = (int) $inserat['artikelId'];
            if ($artikelId <= 0) {
                $bilanz['ohneZuordnung']++;
                continue;
            }
            $bilanz['zugeordnet']++;
            if (isset($gesehen[$artikelId])) {
                // Zwei Inserate auf denselben Artikel: Das muss auffallen,
                // sonst ueberschreiben sie sich bei jedem Lauf gegenseitig.
                $bilanz['doppelteArtikel'][] = $artikelId;
            }
            $gesehen[$artikelId] = true;
        }

        return $bilanz;
    }
}
