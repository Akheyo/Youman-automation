<?php

namespace MaschinensucherMarkt\Logik;

/**
 * Die Notbremse: eine plötzlich viel kürzere Datei geht NICHT raus.
 *
 * Der automatische Import ist ein Abgleich, kein Hinzufügen. Was in der Datei
 * fehlt, verschwindet auf Maschinensucher. Das ist der Sinn der Sache — und
 * zugleich ihre gefährlichste Eigenschaft: Eine entfernte Markierung zu viel,
 * ein leerer Bestand wegen eines fehlenden Lagerrechts, und die Nacht nimmt
 * den ganzen Bestand vom Markt. Niemand sieht es, weil es lautlos passiert:
 * Der Abruf war erfolgreich, die Datei war gültig, sie war nur leer.
 *
 * Deshalb: Fällt die Zahl der Inserate gegenüber dem letzten erfolgreichen
 * Lauf stark ab, wird die alte Datei weiter ausgeliefert und der neue Lauf
 * meldet sich. Ein Mensch gibt den Rückgang frei, wenn er gewollt war.
 *
 * Unter der Schwelle greift die Bremse nicht: Bei sechs Inseraten ist "nur
 * noch zwei" ein normaler Dienstag.
 */
class Rueckgang
{
    /** Ab so vielen Inseraten in der letzten Datei wird überhaupt geprüft. */
    const SCHWELLE = 10;

    /** Unter diesem Anteil der letzten Menge gilt es als Einbruch. */
    const ANTEIL = 0.5;

    /** Wie lange eine Freigabe gilt — lang genug für eine Nacht, nicht länger. */
    const FREIGABE_STUNDEN = 12;

    /**
     * @param int      $jetzt   Inserate, die jetzt ausgeliefert würden.
     * @param int|null $zuletzt Inserate des letzten erfolgreichen Laufs.
     * @param int|null $freiBis Unix-Zeit, bis zu der ein Mensch freigegeben hat.
     * @param int|null $zeit    Jetztzeit — als Parameter, damit prüfbar.
     * @return array ['blockiert' => bool, 'meldung' => string|null, 'freigegeben' => bool]
     */
    public static function pruefe($jetzt, $zuletzt, $freiBis = null, $zeit = null)
    {
        $zeit = $zeit === null ? time() : $zeit;
        $freigegeben = $freiBis !== null && (int) $freiBis > $zeit;

        if ($zuletzt === null || $zuletzt < self::SCHWELLE || $jetzt >= $zuletzt * self::ANTEIL) {
            return array('blockiert' => false, 'meldung' => null, 'freigegeben' => $freigegeben);
        }

        $meldung = 'Rückgang: ' . (int) $jetzt . ' statt zuletzt ' . (int) $zuletzt . ' Inserate. '
            . 'Die neue Datei wird zurückgehalten, damit der Abgleich nicht den Bestand vom Markt nimmt. '
            . 'In der Plugin-Konfiguration freigeben, wenn der Rückgang gewollt ist.';

        return array('blockiert' => !$freigegeben, 'meldung' => $meldung, 'freigegeben' => $freigegeben);
    }

    /** Ende einer jetzt erteilten Freigabe. */
    public static function freigabeBis($zeit = null)
    {
        $zeit = $zeit === null ? time() : $zeit;
        return $zeit + self::FREIGABE_STUNDEN * 3600;
    }
}
