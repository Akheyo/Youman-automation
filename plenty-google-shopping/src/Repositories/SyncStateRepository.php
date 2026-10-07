<?php

namespace ShoppingSync\Repositories;

use Plenty\Modules\Plugin\DataBase\Contracts\DataBase;
use ShoppingSync\Models\SyncState;

class SyncStateRepository
{
    /** @var DataBase */
    private $db;

    public function __construct(DataBase $db)
    {
        $this->db = $db;
    }

    public static function key(int $variationId, string $contentLanguage, string $feedLabel): string
    {
        return $variationId . ':' . $contentLanguage . '~' . $feedLabel;
    }

    /**
     * @return SyncState[] Schlüssel = stateKey
     */
    public function all(): array
    {
        $result = [];
        /** @var SyncState[] $rows */
        $rows = $this->db->query(SyncState::class)->get();
        foreach ($rows as $row) {
            $result[$row->stateKey] = $row;
        }

        return $result;
    }

    /**
     * @return SyncState[]
     */
    public function forVariation(int $variationId): array
    {
        return $this->db->query(SyncState::class)->where('variationId', '=', $variationId)->get();
    }

    /**
     * @return int[] alle Varianten, die gerade bei Google liegen
     */
    public function knownVariationIds(): array
    {
        $ids = [];
        foreach ($this->all() as $state) {
            $ids[(int) $state->variationId] = true;
        }

        return array_keys($ids);
    }

    public function newState(): SyncState
    {
        return pluginApp(SyncState::class);
    }

    public function save(SyncState $state): SyncState
    {
        return $this->db->save($state);
    }

    public function delete(SyncState $state)
    {
        $this->db->delete($state);
    }
}
