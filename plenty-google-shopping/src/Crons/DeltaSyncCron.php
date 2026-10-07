<?php

namespace ShoppingSync\Crons;

use Plenty\Modules\Cron\Contracts\CronHandler;
use Plenty\Plugin\Log\Loggable;
use ShoppingSync\Services\SyncService;

/**
 * Alle 15 Minuten: Änderungen (Preis, Text, Bilder, Bestand, Tags) an Google
 * übertragen. Gesendet wird nur, was sich gegenüber dem letzten Stand
 * tatsächlich geändert hat.
 */
class DeltaSyncCron extends CronHandler
{
    use Loggable;

    public function handle(SyncService $sync)
    {
        try {
            $sync->run(false);
        } catch (\Throwable $e) {
            $this->getLogger(__METHOD__)->error('ShoppingSync::log.cronFailed', ['error' => $e->getMessage()]);
        }
    }
}
