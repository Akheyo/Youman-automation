<?php

namespace MaschinensucherMarkt\Logik;

/**
 * Was mit einem Artikel geschehen soll.
 *
 * Eine einzige Tabelle, an einer Stelle, ohne Netz und ohne Datenbank —
 * damit jeder Fall pruefbar ist. Die Strecke hat mehr Zustaende, als man
 * beim Hinsehen glaubt: markiert oder nicht, Bestand oder nicht, Maengel
 * oder nicht, drueben bekannt oder nicht, dort aktiv oder pausiert. Verteilt
 * man das auf mehrere Klassen, findet man die Luecken nie.
 *
 * Der Leitsatz: Im Zweifel NICHTS tun. Ein Inserat, das faelschlich stehen
 * bleibt, kostet Aufmerksamkeit. Ein Inserat, das faelschlich geloescht
 * wird, kostet die Laufzeit, die Aufrufe und die Anfragen.
 */
class Entscheidung
{
    const ANLEGEN      = 'anlegen';
    const AENDERN      = 'aendern';
    const PAUSIEREN    = 'pausieren';
    const AKTIVIEREN   = 'aktivieren';
    const NICHTS       = 'nichts';
    const ZURUECK      = 'zurueckhalten';

    /**
     * @param array $lage
     *   markiert            bool   Traegt der Artikel die Markierung?
     *   bestand             int    Verfuegbarer Bestand
     *   maengel             array  Was fehlt, damit ein Inserat entstehen kann
     *   inseratId           int    Drueben bekannt? 0 = nein
     *   zustand             string aktiv | pausiert | unbekannt
     *   fingerabdruck       string zuletzt gesendeter Stand
     *   neuerFingerabdruck  string jetziger Stand
     *   verwaltet           bool   Hat das Plugin dieses Inserat schon einmal
     *                              selbst geschrieben? Nur dann ist eine
     *                              fehlende Markierung eine Anweisung.
     *   perApi              bool   Hat das Plugin es ueber die API angelegt? Nur
     *                              dann laesst es sich aendern.
     * @return array ['tat', 'grund']
     */
    public static function treffen(array $lage)
    {
        $markiert  = !empty($lage['markiert']);
        $bestand   = isset($lage['bestand']) ? (int) $lage['bestand'] : 0;
        $maengel   = isset($lage['maengel']) && is_array($lage['maengel']) ? $lage['maengel'] : array();
        $inseratId = isset($lage['inseratId']) ? (int) $lage['inseratId'] : 0;
        $zustand   = isset($lage['zustand']) ? (string) $lage['zustand'] : 'unbekannt';
        $bekannt   = $inseratId > 0;
        $aktiv     = $bekannt && $zustand === 'aktiv';
        $verwaltet = $bekannt && !empty($lage['verwaltet']);
        $perApi    = $bekannt && !empty($lage['perApi']);

        // ---- Nicht markiert --------------------------------------------------
        // Eine Ansage ist das NUR bei einem Inserat, das das Plugin selbst
        // verwaltet: Dann wurde die Markierung entfernt, und der Artikel soll
        // vom Markt. Pausieren, nicht loeschen — wer sie versehentlich
        // entfernt, soll sie zurueckdrehen koennen, ohne alles zu verlieren.
        //
        // Ein Inserat, das die Bestandsaufnahme bloss VORGEFUNDEN hat, ist
        // etwas anderes. Dass sein Artikel nicht markiert ist, heisst nur:
        // noch nicht uebernommen. Es wird nicht angefasst. Ohne diese
        // Unterscheidung pausiert der erste Lauf auf einem frischen System
        // saemtliche bestehenden Inserate — denn dort ist noch nichts
        // markiert.
        if (!$markiert) {
            if ($aktiv && $verwaltet) {
                return self::tat(self::PAUSIEREN, 'Die Markierung wurde entfernt.');
            }
            if ($bekannt && !$verwaltet) {
                return self::tat(self::NICHTS, 'Nicht markiert und nicht vom Plugin verwaltet — bleibt, wie es ist.');
            }
            return self::tat(self::NICHTS, $bekannt
                ? 'Nicht markiert, steht drueben schon still.'
                : 'Nicht markiert.');
        }

        // ---- Maengel --------------------------------------------------------
        // Etwas fehlt, das die API verlangt. Ein bestehendes Inserat darf
        // dann nicht mit halben Daten ueberschrieben werden.
        if (count($maengel) > 0) {
            $grund = implode(' ', $maengel);
            if ($aktiv && $verwaltet) {
                return self::tat(self::PAUSIEREN, 'Angaben fehlen: ' . $grund);
            }
            // Ein vorgefundenes Inserat bleibt stehen, wie es ist: Es lief
            // bisher mit SEINEN Daten, und dass Plenty unvollstaendig ist,
            // ist kein Grund, es vom Markt zu nehmen. Gemeldet wird trotzdem.
            return self::tat(self::ZURUECK, $grund);
        }

        // ---- Kein Bestand -----------------------------------------------------
        if ($bestand <= 0) {
            if ($aktiv) {
                return self::tat(self::PAUSIEREN, 'Kein Bestand mehr.');
            }
            if (!$bekannt) {
                // Nichts anlegen, was im selben Atemzug pausiert wuerde.
                return self::tat(self::ZURUECK, 'Kein Bestand — es wird erst gar nichts angelegt.');
            }
            return self::tat(self::NICHTS, 'Kein Bestand, steht drueben schon still.');
        }

        // ---- Bestand da, alles vollstaendig -------------------------------------
        if (!$bekannt) {
            return self::tat(self::ANLEGEN, 'Noch nicht bei Maschinensucher.');
        }

        $geaendert = self::hatSichGeaendert($lage);

        if (!$aktiv) {
            // Erst wieder sichtbar machen. Steht auch inhaltlich etwas an,
            // holt das der naechste Lauf — zwei Aufrufe in einem Zug auf
            // dasselbe Inserat vertragen sich schlecht mit der Pruefung,
            // die drueben nach jeder Aenderung laeuft.
            return self::tat(self::AKTIVIEREN, 'Wieder Bestand vorhanden.');
        }

        if ($geaendert) {
            if (!$perApi) {
                // Die API aendert nur Inserate, die ueber die API angelegt
                // wurden. Ein Versuch bei einem vorgefundenen Inserat
                // scheitert — also gar nicht erst versuchen. Pausieren und
                // Aktivieren gehen weiterhin.
                return self::tat(self::NICHTS,
                    'Inhalt nicht aenderbar: Das Inserat wurde nicht ueber die API angelegt. '
                    . 'Pausieren und Aktivieren gehen weiterhin.');
            }
            return self::tat(self::AENDERN, 'Die Daten haben sich geaendert.');
        }

        return self::tat(self::NICHTS, 'Unveraendert.');
    }

    /**
     * Aendert ein Inserat drueben tatsaechlich etwas?
     *
     * Ohne diese Frage ginge bei jedem Lauf der ganze Bestand raus. Jede
     * Aenderung loest bei Maschinensucher eine Pruefung aus, die bis zu 24
     * Stunden dauern kann — ein Plugin, das im Minutentakt sendet, haelt
     * seine eigenen Inserate dauerhaft in der Warteschlange.
     */
    public static function hatSichGeaendert(array $lage)
    {
        $alt = isset($lage['fingerabdruck']) ? (string) $lage['fingerabdruck'] : '';
        $neu = isset($lage['neuerFingerabdruck']) ? (string) $lage['neuerFingerabdruck'] : '';

        if ($neu === '') {
            return false;
        }
        // Kein bekannter Stand: Das Inserat stammt aus der Zeit vor dem
        // Plugin. Einmal senden, danach ist der Stand bekannt.
        if ($alt === '') {
            return true;
        }
        return $alt !== $neu;
    }

    /**
     * Schreibt die Tat drueben etwas? Nur solche zaehlen gegen eine
     * Mengenbegrenzung und nur die muessen gebremst werden.
     */
    public static function schreibt($tat)
    {
        return $tat === self::ANLEGEN
            || $tat === self::AENDERN
            || $tat === self::PAUSIEREN
            || $tat === self::AKTIVIEREN;
    }

    private static function tat($tat, $grund)
    {
        return array('tat' => $tat, 'grund' => (string) $grund);
    }
}
