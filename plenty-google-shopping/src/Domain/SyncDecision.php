<?php

namespace ShoppingSync\Domain;

class SyncDecision
{
    const INSERT = 'insert';
    const UPDATE = 'update';
    const OUT_OF_STOCK = 'out_of_stock';
    const DELETE = 'delete';
    const NONE = 'none';
    const ERROR = 'error';

    const STATUS_ACTIVE = 'active';
    const STATUS_OUT_OF_STOCK = 'out_of_stock';

    /** @var string */
    public $action;
    /** @var string */
    public $reason;
    /** @var bool Ein Datenfehler war der Anlass (fürs Protokoll) */
    public $isError = false;
    /** @var MappingResult|null */
    public $mapping;
    /** @var string */
    public $hash = '';

    public static function upsert(string $action, string $reason, MappingResult $mapping, string $hash): SyncDecision
    {
        $d = new self();
        $d->action = $action;
        $d->reason = $reason;
        $d->mapping = $mapping;
        $d->hash = $hash;

        return $d;
    }

    public static function delete(string $reason, bool $isError = false): SyncDecision
    {
        $d = new self();
        $d->action = self::DELETE;
        $d->reason = $reason;
        $d->isError = $isError;

        return $d;
    }

    public static function none(string $reason): SyncDecision
    {
        $d = new self();
        $d->action = self::NONE;
        $d->reason = $reason;

        return $d;
    }

    public static function error(string $reason): SyncDecision
    {
        $d = new self();
        $d->action = self::ERROR;
        $d->reason = $reason;
        $d->isError = true;

        return $d;
    }

    public function sendsProduct(): bool
    {
        return in_array($this->action, [self::INSERT, self::UPDATE, self::OUT_OF_STOCK], true);
    }

    /**
     * Status, der nach erfolgreicher Übertragung gespeichert wird.
     */
    public function resultingStatus(): string
    {
        return $this->action === self::OUT_OF_STOCK ? self::STATUS_OUT_OF_STOCK : self::STATUS_ACTIVE;
    }
}
