<?php

namespace Marktplaats\Models;

use Plenty\Modules\Plugin\DataBase\Contracts\Model;

/**
 * Schluessel/Wert-Speicher fuer Zugangsdaten und Laufzeitwerte
 * (Tokens, Herkunfts-ID, letzter Abgleich).
 */
class Setting extends Model
{
    public $name = '';
    public $value = '';

    protected $primaryKeyFieldName = 'name';
    protected $primaryKeyFieldType = 'string';
    protected $autoIncrementPrimaryKey = false;
    protected $textFields = ['value'];

    public function getTableName(): string
    {
        return 'Marktplaats::Setting';
    }
}
