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
class BestandLesen implements CronHandler
{
    use Loggable;

    public function handle()
    {
        $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.zeitplanGestartet', array(
            'zeitplan' => 'Bestandsaufnahme',
        ));

        try {
            $aufnahme = pluginApp(Bestandsaufnahme::class);
            $aufnahme->lauf();
        } catch (\Throwable $e) {
            $this->getLogger(__METHOD__)->error('MaschinensucherMarkt::log.laufAbgebrochen', array(
                'meldung' => $e->getMessage(),
                'datei'   => $e->getFile() . ':' . $e->getLine(),
            ));
        }
    }
}
