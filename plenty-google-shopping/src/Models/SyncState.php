<?php

namespace ShoppingSync\Models;

use Plenty\Modules\Plugin\DataBase\Contracts\Model;

/**
 * Was zuletzt für eine Variante in einem Markt an Google übertragen wurde –
 * und was Google davon hält.
 *
 * @property int    $id
 * @property string $stateKey         "{variationId}:{contentLanguage}~{feedLabel}"
 * @property int    $variationId
 * @property int    $itemId
 * @property string $country
 * @property string $contentLanguage
 * @property string $feedLabel
 * @property string $offerId
 * @property string $status           active | out_of_stock
 * @property string $hash
 * @property int    $syncedAt
 * @property int    $outOfStockSince
 * @property string $googleStatus     approved | pending | disapproved | unknown
 * @property string $googleIssues     JSON
 * @property int    $googleCheckedAt
 * @property string $lastError
 * @property int    $lastErrorAt
 */
class SyncState extends Model
{
    public $id = 0;
    public $stateKey = '';
    public $variationId = 0;
    public $itemId = 0;
    public $country = '';
    public $contentLanguage = '';
    public $feedLabel = '';
    public $offerId = '';
    public $status = '';
    public $hash = '';
    public $syncedAt = 0;
    public $outOfStockSince = 0;
    public $googleStatus = 'unknown';
    public $googleIssues = '[]';
    public $googleCheckedAt = 0;
    public $lastError = '';
    public $lastErrorAt = 0;

    protected $textFields = ['googleIssues', 'lastError'];

    public function getTableName(): string
    {
        return 'ShoppingSync::SyncState';
    }

    /**
     * Stand im Format, das der SyncDecider erwartet.
     */
    public function toDeciderState(): array
    {
        return [
            'status' => $this->status,
            'hash' => $this->hash,
            'syncedAt' => (int) $this->syncedAt,
            'outOfStockSince' => $this->outOfStockSince > 0 ? (int) $this->outOfStockSince : null,
        ];
    }
}
