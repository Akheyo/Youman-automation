<?php

namespace Marktplaats\Migrations;

use Marktplaats\Models\Listing;
use Marktplaats\Models\Setting;
use Plenty\Modules\Plugin\DataBase\Contracts\Migrate;

class CreateTables
{
    public function run(Migrate $migrate)
    {
        $migrate->createTable(Setting::class);
        $migrate->createTable(Listing::class);
    }
}
