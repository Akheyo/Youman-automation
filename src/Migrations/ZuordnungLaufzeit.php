<?php

namespace MaschinensucherMarkt\Migrations;

use MaschinensucherMarkt\Models\Verknuepfung;
use Plenty\Modules\Plugin\DataBase\Contracts\Migrate;

/**
 * Ergaenzt die Zuordnung um das Feld laeuftBis (Ablaufdatum des Inserats).
 *
 * Eigene Klasse, weil Plenty jede Migration nur einmal ausfuehrt.
 */
class ZuordnungLaufzeit
{
    public function run(Migrate $migrate)
    {
        $migrate->updateTable(Verknuepfung::class);
    }
}
