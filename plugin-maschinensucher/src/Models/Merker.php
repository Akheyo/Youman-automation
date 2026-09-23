<?php

namespace MaschinensucherMarkt\Models;

use Plenty\Modules\Plugin\DataBase\Contracts\Model;

/**
 * Ein benannter Zeitpunkt, den sich das Plugin merkt.
 *
 * Gebraucht fuer genau eine Frage, die sich aus der Zuordnungstabelle
 * allein nicht beantworten laesst: Ist die Bestandsaufnahme jemals
 * VOLLSTAENDIG durchgelaufen? Eine Tabelle mit Zeilen kann auch die Haelfte
 * eines abgebrochenen Laufs sein.
 *
 * @property int    $id
 * @property string $name
 * @property int    $zeit  Unix-Zeit
 */
class Merker extends Model
{
    public $id = 0;
    public $name = '';
    public $zeit = 0;

    public function getTableName(): string
    {
        return 'MaschinensucherMarkt::Merker';
    }
}
