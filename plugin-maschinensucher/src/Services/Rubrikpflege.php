<?php

namespace MaschinensucherMarkt\Services;

use MaschinensucherMarkt\Api\Zugang;
use MaschinensucherMarkt\Logik\Antwort;
use MaschinensucherMarkt\Logik\Rubrik;
use Plenty\Modules\Property\V2\Contracts\PropertySelectionRepositoryContract;
use Plenty\Plugin\Log\Loggable;

/**
 * Legt die Maschinensucher-Rubriken als Auswahlwerte der Rubrik-Eigenschaft an.
 *
 * Damit waehlen die Mitarbeiter die Rubrik am Artikel aus einer Liste,
 * statt Nummern nachzuschlagen. Jeder Wert heisst etwa
 * "Steuerungen – Automatisierungstechnik (102)"; die Zahl am Ende liest der
 * Abgleich.
 *
 * Angelegt wird nur, was fehlt — erkannt an der Rubriknummer, auch bei
 * Werten, die jemand von Hand angelegt hat. Geloescht oder umbenannt wird
 * nichts. Es sind rund zweitausend Rubriken; das geht in Etappen, jede mit
 * einem Zeitbudget, der naechste Lauf macht weiter. Ist alles da, wird nur
 * noch einmal am Tag nachgesehen, ob Maschinensucher neue Rubriken hat.
 */
class Rubrikpflege
{
    use Loggable;

    const NEU_PRUEFEN = 86400;

    /** @var Zugang */
    private $api;

    /** @var Rubrikauswahl */
    private $auswahl;

    /** @var PropertySelectionRepositoryContract */
    private $werte;

    /** @var Einstellungen */
    private $einstellungen;

    /** @var Zuordnung */
    private $zuordnung;

    public function __construct(
        Zugang $api,
        Rubrikauswahl $auswahl,
        PropertySelectionRepositoryContract $werte,
        Einstellungen $einstellungen,
        Zuordnung $zuordnung
    ) {
        $this->api = $api;
        $this->auswahl = $auswahl;
        $this->werte = $werte;
        $this->einstellungen = $einstellungen;
        $this->zuordnung = $zuordnung;
    }

    /**
     * @param float $budget Sekunden, nach denen kein Wert mehr begonnen wird
     */
    public function etappe($budget)
    {
        $eigenschaft = $this->einstellungen->rubrikEigenschaft();
        if ($eigenschaft <= 0 || !$this->einstellungen->rubrikenAnlegen()) {
            return array('ok' => true, 'tat' => 'Rubrik-Eigenschaft nicht eingerichtet oder Anlegen ausgeschaltet.');
        }
        if (time() - $this->zuordnung->rubrikenGeprueft($eigenschaft) < self::NEU_PRUEFEN) {
            return array('ok' => true, 'tat' => 'Rubriken vollstaendig, heute schon geprueft.');
        }
        if (!$this->einstellungen->apiEingerichtet()) {
            return array('ok' => false, 'tat' => 'Kein API-Token hinterlegt.');
        }

        $beginn = microtime(true);
        $antwort = $this->api->kategoriebaum('de-de');
        if (!Antwort::istOk($antwort)) {
            $this->getLogger(__METHOD__)->warning('MaschinensucherMarkt::log.rubrikenBaumFehlt', array(
                'meldung' => $antwort['meldung'],
            ));
            return array('ok' => false, 'tat' => 'Rubrikbaum nicht lesbar.');
        }

        $blaetter = Rubrik::blaetter(is_array($antwort['daten']) ? $antwort['daten'] : array());
        if (count($blaetter) === 0) {
            $this->getLogger(__METHOD__)->warning('MaschinensucherMarkt::log.rubrikenBaumFehlt', array(
                'meldung' => 'Der Rubrikbaum war leer.',
            ));
            return array('ok' => false, 'tat' => 'Rubrikbaum leer.');
        }

        $vorhanden = array();
        foreach ($this->auswahl->karte($eigenschaft) as $namen) {
            $nummer = Rubrik::nummer($namen);
            if ($nummer > 0) {
                $vorhanden[$nummer] = true;
            }
        }

        $angelegt = 0;
        $fehler = '';
        foreach ($blaetter as $position => $blatt) {
            if (isset($vorhanden[$blatt['id']])) {
                continue;
            }
            if (microtime(true) - $beginn >= (float) $budget) {
                break;
            }
            try {
                $this->werte->create(array(
                    'propertyId' => $eigenschaft,
                    'position'   => $position,
                    'names'      => array(
                        array('lang' => 'de', 'name' => $blatt['name']),
                    ),
                ));
                $vorhanden[$blatt['id']] = true;
                $angelegt++;
            } catch (\Throwable $e) {
                // Beim ersten Fehler aufhoeren: Scheitert einer, scheitern
                // meist alle, und zweitausend gleiche Fehlerzeilen helfen
                // niemandem.
                $fehler = $e->getMessage();
                break;
            }
        }

        $offen = 0;
        foreach ($blaetter as $blatt) {
            if (!isset($vorhanden[$blatt['id']])) {
                $offen++;
            }
        }
        if ($offen === 0) {
            $this->zuordnung->rubrikenGeprueftMerken($eigenschaft);
        }

        $bericht = array(
            'ok'          => $fehler === '',
            'eigenschaft' => $eigenschaft,
            'rubriken'    => count($blaetter),
            'angelegt'    => $angelegt,
            'offen'       => $offen,
            'dauer'       => round(microtime(true) - $beginn, 1),
        );
        if ($fehler !== '') {
            $bericht['fehler'] = $fehler;
            $this->getLogger(__METHOD__)->error('MaschinensucherMarkt::log.rubrikenFehler', $bericht);
        } elseif ($angelegt > 0 || $offen > 0) {
            $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.rubrikenGepflegt', $bericht);
        }

        return $bericht;
    }
}
