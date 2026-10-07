<?php

namespace ShoppingSync\Crons;

use Plenty\Modules\Cron\Contracts\CronHandler;
use Plenty\Plugin\Log\Loggable;
use ShoppingSync\Services\SyncService;

/**
 * Einmal täglich: vollständiger Abgleich. Frischt alle Produkte auf (Google
 * lässt sie sonst nach 30 Tagen verfallen), holt den Prüfstatus und räumt
 * auf, damit Plenty und Merchant Center nicht auseinanderlaufen.
 */
class FullSyncCron extends CronHandler
{
    use Loggable;

    public function handle(SyncService $sync)
    {
        try {
            $sync->run(true);
        } catch (\Throwable $e) {
            $this->getLogger(__METHOD__)->error('ShoppingSync::log.cronFailed', ['error' => $e->getMessage()]);
        }
    }
}
