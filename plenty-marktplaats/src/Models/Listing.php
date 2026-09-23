<?php

namespace Marktplaats\Models;

use Plenty\Modules\Plugin\DataBase\Contracts\Model;

/**
 * Eine Plenty-Variante und ihre Anzeige auf Marktplaats.
 *
 * @property int    $variationId
 * @property int    $itemId
 * @property string $mpItemId    Anzeigen-ID bei Marktplaats, z. B. "m1234567890"
 * @property string $status      online | error | removed
 * @property string $adHash
 * @property string $imageHash
 * @property string $errorType   validation | transient
 * @property string $lastError
 * @property string $warnings
 * @property string $title
 * @property int    $price       Cent
 * @property int    $syncedAt    Unix-Zeitstempel der letzten Aenderung
 */
class Listing extends Model
{
    public $variationId = 0;
    public $itemId = 0;
    public $mpItemId = '';
    public $status = '';
    public $adHash = '';
    public $imageHash = '';
    public $errorType = '';
    public $lastError = '';
    public $warnings = '';
    public $title = '';
    public $price = 0;
    public $syncedAt = 0;

    protected $primaryKeyFieldName = 'variationId';
    protected $primaryKeyFieldType = 'int';
    protected $autoIncrementPrimaryKey = false;
    protected $textFields = ['lastError', 'warnings'];

    public function getTableName(): string
    {
        return 'Marktplaats::Listing';
    }
}
