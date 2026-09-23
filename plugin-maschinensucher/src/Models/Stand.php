<?php

namespace MaschinensucherMarkt\Models;

use Plenty\Modules\Plugin\DataBase\Contracts\Model;

/**
 * Der Stand der Strecke — genau eine Zeile.
 *
 * Hier steht, was der letzte Lauf ergeben hat und bis wann ein Rückgang
 * freigegeben ist. Ohne diesen Stand könnte die Notbremse nicht rechnen: Sie
 * vergleicht die Inserate von jetzt mit denen des letzten erfolgreichen
 * Laufs.
 *
 * @property int $id
 * @property int $gebautAm       Unix-Zeit des letzten erfolgreichen Laufs
 * @property int $inserate       Inserate in der zuletzt gebauten Datei
 * @property int $uebersprungen  Markierte Artikel, denen etwas fehlte
 * @property int $freiBis        Bis wann ein Rückgang freigegeben ist
 * @property string $meldung     Letzte Meldung (Notbremse, Einrichtung)
 */
class Stand extends Model
{
    public $id = 0;
    public $gebautAm = 0;
    public $inserate = 0;
    public $uebersprungen = 0;
    public $freiBis = 0;
    public $meldung = '';

    public function getTableName(): string
    {
        return 'MaschinensucherMarkt::Stand';
    }
}
