<?php

namespace ShoppingSync\Repositories;

use Plenty\Modules\Plugin\DataBase\Contracts\DataBase;
use ShoppingSync\Models\SyncLog;

class SyncLogRepository
{
    const KEEP_DAYS = 90;

    /** @var DataBase */
    private $db;

    public function __construct(DataBase $db)
    {
        $this->db = $db;
    }

    public function add(int $variationId, int $itemId, string $market, string $action, bool $success, bool $dryRun, string $message)
    {
        /** @var SyncLog $entry */
        $entry = pluginApp(SyncLog::class);
        $entry->createdAt = time();
        $entry->variationId = $variationId;
        $entry->itemId = $itemId;
        $entry->market = $market;
        $entry->action = $action;
        $entry->success = $success;
        $entry->dryRun = $dryRun;
        $entry->message = mb_substr($message, 0, 4000);
        $this->db->save($entry);
    }

    /**
     * @return SyncLog[]
     */
    public function latest(int $limit = 200, int $variationId = 0, bool $onlyErrors = false): array
    {
        $query = $this->db->query(SyncLog::class);
        if ($variationId > 0) {
            $query->where('variationId', '=', $variationId);
        }
        if ($onlyErrors) {
            $query->where('success', '=', false);
        }

        return $query->orderBy('id', 'desc')->limit(max(1, min($limit, 1000)))->get();
    }

    public function prune()
    {
        $this->db->query(SyncLog::class)->where('createdAt', '<', time() - self::KEEP_DAYS * 86400)->delete();
    }
}
