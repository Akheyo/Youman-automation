<?php

namespace MaschinensucherMarkt\Crons;

use MaschinensucherMarkt\Services\Bestandsaufnahme;
use Plenty\Modules\Cron\Contracts\CronHandler;
use Plenty\Plugin\Log\Loggable;

/**
 * Liest regelmaessig, was bei Maschinensucher online steht.
 *
 * Der Lauf liest nur. Er aendert bei Maschinensucher nichts.
 *
 * Die erste Zeile ist eine Protokollzeile, und das mit Absicht: Sie
 * beantwortet die Frage, die man sonst nicht beantworten kann — laeuft der
 * Zeitplan ueberhaupt? Ohne sie sieht ein Plugin, das gar nicht erst
 * gestartet wird, genauso aus wie eines, das nichts zu tun hat.
 *
 * Die Dienste werden hier geholt statt im Konstruktor: Scheitert ein
 * Konstruktor, faellt der ganze Zeitplan aus, bevor eine einzige Zeile
 * geschrieben wurde. So landet wenigstens der Grund im Protokoll.
 */
class BestandLesen extends CronHandler
{
    use Loggable;

    public function handle()
    {
        // Verlaufsmeldung (waehrend der Inbetriebnahme als Fehler geschrieben): Fehler erscheinen immer im
        // Protokoll, unabhaengig von der Log-Einstellung. So ist eindeutig
        // zu sehen, ob der Zeitplan ueberhaupt startet. Wieder auf info()
        // zuruecksetzen, sobald das geklaert ist.
        $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.diagnoseZeitplan', array(
            'zeitplan' => 'Bestandsaufnahme',
        ));

        try {
            $aufnahme = pluginApp(Bestandsaufnahme::class);
            // Vierzig Sekunden je Etappe. Reicht das nicht fuer alle Seiten,
            // macht der naechste Lauf dort weiter, wo dieser aufgehoert hat.
            $bericht = $aufnahme->etappe(40);

            // Verlaufsmeldung (waehrend der Inbetriebnahme als Fehler geschrieben): das Ergebnis, sichtbar
            // unabhaengig von der Log-Einstellung.
            $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.diagnoseErgebnis', $bericht);
        } catch (\Throwable $e) {
            $this->getLogger(__METHOD__)->error('MaschinensucherMarkt::log.laufAbgebrochen', array(
                'meldung' => $e->getMessage(),
                'datei'   => $e->getFile() . ':' . $e->getLine(),
            ));
        }
    }
}
