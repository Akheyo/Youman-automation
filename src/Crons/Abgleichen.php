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

    /** @var Abgleich */
    private $abgleich;

    public function __construct(Abgleich $abgleich)
    {
        $this->abgleich = $abgleich;
    }

    public function handle()
    {
        try {
            $this->abgleich->lauf();
        } catch (\Throwable $e) {
            $this->getLogger(__METHOD__)->error('MaschinensucherMarkt::log.laufAbgebrochen', array(
                'meldung' => $e->getMessage(),
                'datei'   => $e->getFile() . ':' . $e->getLine(),
            ));
        }
    }
}
