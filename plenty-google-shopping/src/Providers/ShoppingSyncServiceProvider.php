<?php

namespace ShoppingSync\Providers;

use Plenty\Modules\Cron\Services\CronContainer;
use Plenty\Plugin\ServiceProvider;
use ShoppingSync\Crons\DeltaSyncCron;
use ShoppingSync\Crons\FullSyncCron;

class ShoppingSyncServiceProvider extends ServiceProvider
{
    public function register()
    {
        $this->getApplication()->register(ShoppingSyncRouteServiceProvider::class);
    }

    public function boot(CronContainer $cron)
    {
        $cron->add(CronContainer::EVERY_FIFTEEN_MINUTES, DeltaSyncCron::class);
        $cron->add(CronContainer::DAILY, FullSyncCron::class);
    }
}
