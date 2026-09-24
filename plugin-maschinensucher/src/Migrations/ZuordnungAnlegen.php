<?php

namespace MaschinensucherMarkt\Migrations;

use MaschinensucherMarkt\Models\Merker;
use MaschinensucherMarkt\Models\Verknuepfung;
use Plenty\Modules\Plugin\DataBase\Contracts\Migrate;

/**
 * Legt die Tabellen der API-Fassung an: die Zuordnung Artikel <-> Inserat
 * und die Merker der Bestandsaufnahme.
 *
 * Eine eigene Klasse, weil Plenty jede Migration nur einmal ausfuehrt —
 * siehe TabellenAnlegen. Aendert sich spaeter eine dieser Tabellen, kommt
 * wieder eine NEUE Klasse dazu (mit updateTable), statt diese zu aendern.
 */
class ZuordnungAnlegen
{
    public function run(Migrate $migrate)
    {
        $migrate->createTable(Verknuepfung::class);
        $migrate->createTable(Merker::class);
    }
}
