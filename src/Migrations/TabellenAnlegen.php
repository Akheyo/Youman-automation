<?php

namespace MaschinensucherMarkt\Migrations;

use Plenty\Modules\Plugin\DataBase\Contracts\Migrate;

/**
 * Leer — und genau so muss sie bleiben.
 *
 * Plenty fuehrt jede Migrationsklasse genau EINMAL aus und merkt sich das.
 * Diese hier lief, als das Plugin noch eine CSV-Datei baute, und legte die
 * Tabellen jener Fassung an. Alles, was spaeter in sie hineingeschrieben
 * wurde, hat Plenty nie mehr ausgefuehrt — so fehlte am 24.09. die
 * Zuordnungstabelle, obwohl sie hier stand.
 *
 * Neue Tabellen oder Spalten gehoeren deshalb IMMER in eine neue Klasse,
 * die zusaetzlich in plugin.json unter "runOnBuild" eingetragen wird.
 */
class TabellenAnlegen
{
    public function run(Migrate $migrate)
    {
    }
}
