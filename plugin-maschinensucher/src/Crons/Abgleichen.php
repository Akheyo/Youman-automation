<?php

namespace MaschinensucherMarkt\Crons;

use MaschinensucherMarkt\Services\Abgleich;
use MaschinensucherMarkt\Services\Zuordnung;
use Plenty\Modules\Cron\Contracts\CronHandler;
use Plenty\Plugin\Log\Loggable;

/**
 * Der regelmaessige Durchlauf ueber den ganzen Stamm.
 *
 * Das Sicherheitsnetz hinter der Ereignisaktion: Sie faengt ab, was an
 * einem Auftrag haengt. Alles andere — eine Umlagerung, eine Inventur, ein
 * von Hand geaenderter Preis, ein neu gesetztes Haekchen — faellt nur hier
 * auf.
 */
class Abgleichen extends CronHandler
{
    use Loggable;

    public function handle()
    {
        // Verlaufsmeldung (waehrend der Inbetriebnahme als Fehler geschrieben): Fehler erscheinen immer im
        // Protokoll, unabhaengig von der Log-Einstellung. So ist eindeutig
        // zu sehen, ob der Zeitplan ueberhaupt startet. Wieder auf info()
        // zuruecksetzen, sobald das geklaert ist.
        $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.diagnoseZeitplan', array(
            'zeitplan' => $this->name(),
        ));

        $zuordnung = null;
        try {
            // Nie zwei Abgleiche gleichzeitig: Beide hielten denselben neuen
            // Artikel fuer unbekannt und legten ihn an.
            $zuordnung = pluginApp(Zuordnung::class);
            if (!$zuordnung->abgleichSperren()) {
                $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.abgleichLaeuftSchon', array(
                    'zeitplan' => $this->name(),
                ));
                return;
            }

            $abgleich = pluginApp(Abgleich::class);
            $bericht = $abgleich->lauf();
            if (empty($bericht['ok'])) {
                $this->getLogger(__METHOD__)->warning('MaschinensucherMarkt::log.nichtAbgeglichen', array(
                    'meldung' => isset($bericht['meldung']) ? $bericht['meldung'] : '',
                ));
            }
        } catch (\Throwable $e) {
            $this->getLogger(__METHOD__)->error('MaschinensucherMarkt::log.laufAbgebrochen', array(
                'meldung' => $e->getMessage(),
                'datei'   => $e->getFile() . ':' . $e->getLine(),
            ));
        }

        if ($zuordnung !== null) {
            try {
                $zuordnung->abgleichFreigeben();
            } catch (\Throwable $e) {
                // Bleibt die Sperre stehen, verfaellt sie nach zehn Minuten.
            }
        }
    }

    /** Wie der Zeitplan im Protokoll heisst. */
    protected function name()
    {
        return 'Abgleich (15 Minuten)';
    }
}
