<?php

namespace Marktplaats\Crons;

use Marktplaats\Services\PluginConfig;
use Marktplaats\Services\SyncService;
use Plenty\Modules\Cron\Contracts\CronHandler;
use Plenty\Plugin\Log\Loggable;

/**
 * Stuendlicher Abgleich, abschaltbar in der Konfiguration ("Automatisch abgleichen").
 */
class SyncCron extends CronHandler
{
    use Loggable;

    public function handle(SyncService $sync, PluginConfig $config)
    {
        if (!$config->autoSync()) {
            return;
        }

        $summary = $sync->run();
        $this->getLogger('SyncCron')->info('Marktplaats::log.syncFinished', $summary);
    }
}
