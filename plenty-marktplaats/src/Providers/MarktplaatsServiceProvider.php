<?php

namespace Marktplaats\Providers;

use Marktplaats\Crons\SyncCron;
use Plenty\Modules\Cron\Services\CronContainer;
use Plenty\Plugin\ServiceProvider;

class MarktplaatsServiceProvider extends ServiceProvider
{
    public function register()
    {
        $this->getApplication()->register(MarktplaatsRouteServiceProvider::class);
    }

    public function boot(CronContainer $cronContainer)
    {
        $cronContainer->add(CronContainer::HOURLY, SyncCron::class);
    }
}
