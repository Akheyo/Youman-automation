<?php

namespace MaschinensucherMarkt\Logik;

/**
 * Wann ein Inserat verlaengert wird.
 *
 * Nur was markiert ist und Bestand hat: Ein verkauftes oder abgemeldetes
 * Inserat soll auslaufen, nicht kostenpflichtig weiterlaufen. Ein schon
 * abgelaufenes Inserat mit Bestand wird ebenfalls verlaengert - es gehoert
 * an den Markt.
 */
class Laufzeit
{
    const TAG = 86400;

    /**
     * @param int   $laeuftBis Unix-Zeit, 0 = unbekannt
     * @param int   $jetzt
     * @param int   $tage      Grenze in Tagen, 0 = Verlaengern aus
     * @param bool  $markiert
     * @param float $bestand
     * @return bool
     */
    public static function verlaengern($laeuftBis, $jetzt, $tage, $markiert, $bestand)
    {
        if ((int) $tage <= 0 || (int) $laeuftBis <= 0 || !$markiert || (float) $bestand <= 0) {
            return false;
        }
        return (int) $laeuftBis - (int) $jetzt <= (int) $tage * self::TAG;
    }

    /** Restlaufzeit in ganzen Tagen (negativ = abgelaufen), fuers Protokoll. */
    public static function restTage($laeuftBis, $jetzt)
    {
        return (int) floor(((int) $laeuftBis - (int) $jetzt) / self::TAG);
    }
}
