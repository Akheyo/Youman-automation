<?php

namespace MaschinensucherMarkt\Migrations;

use MaschinensucherMarkt\Models\Verknuepfung;
use Plenty\Modules\Plugin\DataBase\Contracts\Migrate;

/**
 * Legt die Plugin-Tabellen an. Läuft beim Bauen des Plugin-Sets
 * (siehe "runOnBuild" in der plugin.json) und ist wiederholbar.
 */
class TabellenAnlegen
{
    public function run(Migrate $migrate)
    {
        $migrate->createTable(Verknuepfung::class);
    }
}
