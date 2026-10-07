<?php

namespace ShoppingSync\Services;

use Plenty\Plugin\ConfigRepository;
use ShoppingSync\Domain\Settings;

/**
 * Liest die Plugin-Konfiguration (Plugin-Set → ShoppingSync → Konfiguration).
 */
class PluginSettings
{
    const KEYS = [
        'global.enabled',
        'global.dryRun',
        'google.merchantId',
        'google.dataSourceId',
        'google.serviceAccountJson',
        'sync.releaseTag',
        'sync.pilotItemIds',
        'sync.offerIdPrefix',
        'sync.titleField',
        'sync.stockZeroAction',
        'sync.deleteAfterDaysOutOfStock',
        'sync.refreshAfterDays',
        'sync.maxAdditionalImages',
        'sync.warehouseIds',
        'mapping.types',
        'mapping.markets',
        'mapping.conditions',
    ];

    /** @var ConfigRepository */
    private $config;

    public function __construct(ConfigRepository $config)
    {
        $this->config = $config;
    }

    public function load(): Settings
    {
        $raw = [];
        foreach (self::KEYS as $key) {
            $value = $this->config->get('ShoppingSync.' . $key);
            if ($value !== null) {
                $raw[$key] = $value;
            }
        }

        return Settings::fromConfig($raw);
    }
}
