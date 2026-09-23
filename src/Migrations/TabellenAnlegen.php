<?php

namespace MaschinensucherMarkt\Migrations;

use MaschinensucherMarkt\Models\Abholung;
use MaschinensucherMarkt\Models\Stand;
use Plenty\Modules\Plugin\DataBase\Contracts\Migrate;

/**
 * Legt die beiden Plugin-Tabellen an. Läuft beim Bauen des Plugin-Sets
 * (siehe "runOnBuild" in der plugin.json) und ist wiederholbar.
 */
class TabellenAnlegen
{
    public function run(Migrate $migrate)
    {
        $migrate->createTable(Stand::class);
        $migrate->createTable(Abholung::class);
    }
}
