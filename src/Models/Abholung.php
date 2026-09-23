<?php

namespace MaschinensucherMarkt\Models;

use Plenty\Modules\Plugin\DataBase\Contracts\Model;

/**
 * Eine Zeile je Abruf der Datei — auch je abgewiesenem.
 *
 * Ein Feed, den niemand abholt, sieht von innen aus wie einer, der läuft.
 * Und ein falsches Token in der hinterlegten Adresse ist der
 * wahrscheinlichste Fehler dieser Strecke: Ohne diese Zeilen ist er
 * unsichtbar, weil Maschinensucher nichts zurückmeldet.
 *
 * @property int $id
 * @property int $geholtAm   Unix-Zeit
 * @property bool $ok        Datei ausgeliefert?
 * @property int $inserate   Zeilen in der ausgelieferten Datei
 * @property int $bytes
 * @property string $absender
 * @property string $kennung  User-Agent
 * @property string $meldung  Grund bei ok = false
 */
class Abholung extends Model
{
    public $id = 0;
    public $geholtAm = 0;
    public $ok = false;
    public $inserate = 0;
    public $bytes = 0;
    public $absender = '';
    public $kennung = '';
    public $meldung = '';

    public function getTableName(): string
    {
        return 'MaschinensucherMarkt::Abholung';
    }
}
