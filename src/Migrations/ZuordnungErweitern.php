<?php

namespace MaschinensucherMarkt\Migrations;

use MaschinensucherMarkt\Models\Verknuepfung;
use Plenty\Modules\Plugin\DataBase\Contracts\Migrate;

/**
 * Ergaenzt die Zuordnung um das Feld perApi.
 *
 * Eine eigene Klasse und updateTable statt einer Aenderung an
 * ZuordnungAnlegen: Plenty fuehrt jede Migration nur einmal aus, und
 * ZuordnungAnlegen ist auf dem Testsystem bereits gelaufen.
 */
class ZuordnungErweitern
{
    public function run(Migrate $migrate)
    {
        $migrate->updateTable(Verknuepfung::class);
    }
}
