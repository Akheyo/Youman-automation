<?php

namespace MaschinensucherMarkt\Crons;

use MaschinensucherMarkt\Services\Rubrikpflege;
use Plenty\Modules\Cron\Contracts\CronHandler;
use Plenty\Plugin\Log\Loggable;

/**
 * Haelt die Auswahlwerte der Rubrik-Eigenschaft vollstaendig.
 *
 * Beim ersten Mal legt es in Etappen alle Maschinensucher-Rubriken an,
 * danach sieht es einmal am Tag nach neuen. Tut nichts, solange keine
 * Rubrik-Eigenschaft eingetragen ist.
 */
class RubrikenPflegen extends CronHandler
{
    use Loggable;

    public function handle()
    {
        $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.diagnoseZeitplan', array(
            'zeitplan' => 'Rubriken',
        ));

        try {
            $bericht = pluginApp(Rubrikpflege::class)->etappe(40);
            // Immer ein Ergebnis, auch wenn nichts zu tun war: Sonst ist ein
            // Zeitplan, der aus einem Grund aussetzt, nicht von einem zu
            // unterscheiden, der gar nicht laeuft.
            $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.rubrikenErgebnis', $bericht);
        } catch (\Throwable $e) {
            $this->getLogger(__METHOD__)->error('MaschinensucherMarkt::log.laufAbgebrochen', array(
                'meldung' => $e->getMessage(),
                'datei'   => $e->getFile() . ':' . $e->getLine(),
            ));
        }
    }
}
