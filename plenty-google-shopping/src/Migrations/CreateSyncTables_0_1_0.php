<?php

namespace ShoppingSync\Migrations;

use Plenty\Modules\Plugin\DataBase\Contracts\Migrate;
use ShoppingSync\Models\SyncLog;
use ShoppingSync\Models\SyncState;

class CreateSyncTables_0_1_0
{
    public function run(Migrate $migrate)
    {
        $migrate->createTable(SyncState::class);
        $migrate->createTable(SyncLog::class);
    }
}
