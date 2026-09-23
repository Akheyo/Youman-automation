<?php

namespace MaschinensucherMarkt\Models;

use Plenty\Modules\Plugin\DataBase\Contracts\Model;

/**
 * Ein benannter Zeitpunkt, den sich das Plugin merkt.
 *
 * Gebraucht fuer zwei Fragen, die sich aus der Zuordnungstabelle allein
 * nicht beantworten lassen: Ist die Bestandsaufnahme jemals VOLLSTAENDIG
 * durchgelaufen? Und bei welcher Seite macht die naechste Etappe weiter?
 * Eine Tabelle mit Zeilen kann auch die Haelfte eines abgebrochenen Laufs
 * sein.
 *
 * @property int    $id
 * @property string $name
 * @property int    $zeit  Unix-Zeit
 * @property int    $wert  ein Zahlenwert, etwa die Seite, bei der es weitergeht
 */
class Merker extends Model
{
    public $id = 0;
    public $name = '';
    public $zeit = 0;
    public $wert = 0;

    public function getTableName(): string
    {
        return 'MaschinensucherMarkt::Merker';
    }
}
