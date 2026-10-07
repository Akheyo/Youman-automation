<?php

namespace ShoppingSync\Models;

use Plenty\Modules\Plugin\DataBase\Contracts\Model;

/**
 * Ein Protokolleintrag: Produkt, Zeitpunkt, Aktion, Ergebnis.
 *
 * @property int    $id
 * @property int    $createdAt
 * @property int    $variationId
 * @property int    $itemId
 * @property string $market         "DE" bzw. "BE/fr"
 * @property string $action         insert | update | out_of_stock | delete | error | run
 * @property bool   $success
 * @property bool   $dryRun
 * @property string $message
 */
class SyncLog extends Model
{
    public $id = 0;
    public $createdAt = 0;
    public $variationId = 0;
    public $itemId = 0;
    public $market = '';
    public $action = '';
    public $success = true;
    public $dryRun = false;
    public $message = '';

    protected $textFields = ['message'];

    public function getTableName(): string
    {
        return 'ShoppingSync::SyncLog';
    }
}
