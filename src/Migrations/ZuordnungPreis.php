<?php

namespace MaschinensucherMarkt\Migrations;

use MaschinensucherMarkt\Models\Verknuepfung;
use Plenty\Modules\Plugin\DataBase\Contracts\Migrate;

/**
 * Ergaenzt die Zuordnung um das Feld ohnePreis (kein sichtbarer Preis bei
 * Maschinensucher).
 *
 * Eigene Klasse, weil Plenty jede Migration nur einmal ausfuehrt.
 */
class ZuordnungPreis
{
    public function run(Migrate $migrate)
    {
        $migrate->updateTable(Verknuepfung::class);
    }
}
