<?php

namespace MaschinensucherMarkt\Crons;

use MaschinensucherMarkt\Services\Abgleich;
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
class Abgleichen implements CronHandler
{
    use Loggable;

    public function handle()
    {
        $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.zeitplanGestartet', array(
            'zeitplan' => 'Abgleich',
        ));

        try {
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
    }
}
