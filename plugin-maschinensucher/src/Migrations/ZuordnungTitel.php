<?php

namespace MaschinensucherMarkt\Migrations;

use MaschinensucherMarkt\Models\Verknuepfung;
use Plenty\Modules\Plugin\DataBase\Contracts\Migrate;

/**
 * Ergaenzt die Zuordnung um den Inserattitel (fuer die Inseratliste).
 *
 * Eigene Klasse, weil Plenty jede Migration nur einmal ausfuehrt.
 */
class ZuordnungTitel
{
    public function run(Migrate $migrate)
    {
        $migrate->updateTable(Verknuepfung::class);
    }
}
