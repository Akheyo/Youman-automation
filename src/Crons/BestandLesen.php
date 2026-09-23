<?php

namespace MaschinensucherMarkt\Crons;

use MaschinensucherMarkt\Services\Bestandsaufnahme;
use Plenty\Modules\Cron\Contracts\CronHandler;
use Plenty\Plugin\Log\Loggable;

/**
 * Liest stuendlich, was bei Maschinensucher online steht.
 *
 * Warum als Zeitplan und nicht nur ueber die Adresse im Shop: Dieser
 * Mandant faehrt den neuen PlentyONE Shop, und der bedient keine
 * PHP-Plugin-Routen. Eine Strecke, die sich nur ueber den Browser ausloesen
 * laesst, waere hier also gar nicht ausloesbar. Der Zeitplan braucht
 * niemanden, der eine Adresse aufruft — das Ergebnis steht im Log.
 *
 * Der Lauf liest nur. Er aendert bei Maschinensucher nichts.
 */
class BestandLesen implements CronHandler
{
    use Loggable;

    /** @var Bestandsaufnahme */
    private $aufnahme;

    public function __construct(Bestandsaufnahme $aufnahme)
    {
        $this->aufnahme = $aufnahme;
    }

    public function handle()
    {
        try {
            $this->aufnahme->lauf();
        } catch (\Throwable $e) {
            // Eine Ausnahme im Zeitplan verschwindet sonst spurlos.
            $this->getLogger(__METHOD__)->error('MaschinensucherMarkt::log.laufAbgebrochen', array(
                'meldung' => $e->getMessage(),
                'datei'   => $e->getFile() . ':' . $e->getLine(),
            ));
        }
    }
}
