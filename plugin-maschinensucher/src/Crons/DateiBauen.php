<?php

namespace MaschinensucherMarkt\Crons;

use MaschinensucherMarkt\Services\Feedbauer;
use Plenty\Modules\Cron\Contracts\CronHandler as Cron;
use Plenty\Plugin\Log\Loggable;

/**
 * Baut die Importdatei im Hintergrund.
 *
 * Angemeldet im ServiceProvider. Wie oft, entscheidet der Zeitplan dort —
 * stündlich ist ein guter Anfang: Der Lauf liest den ganzen Artikelstamm, und
 * Maschinensucher holt die Datei ohnehin nur einmal je Nacht ab. Wer schneller
 * vom Markt nehmen will, stellt auf viertelstündlich.
 */
class DateiBauen extends Cron
{
    use Loggable;

    public function handle(Feedbauer $bauer)
    {
        try {
            $bauer->bauen();
        } catch (\Throwable $e) {
            // Ein Cron, der eine Ausnahme durchlässt, taucht in Plenty als
            // stiller Fehlschlag auf. Lieber selbst ins Log schreiben — und
            // die zuletzt gute Datei bleibt ohnehin liegen.
            $this->getLogger(__METHOD__)->error('MaschinensucherMarkt::log.laufAbgebrochen', $e->getMessage());
        }
    }
}
