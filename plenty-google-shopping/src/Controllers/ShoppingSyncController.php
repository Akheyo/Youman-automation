<?php

namespace ShoppingSync\Controllers;

use Plenty\Plugin\Controller;
use Plenty\Plugin\Http\Request;
use ShoppingSync\Repositories\SyncLogRepository;
use ShoppingSync\Repositories\SyncStateRepository;
use ShoppingSync\Services\MerchantClient;
use ShoppingSync\Services\PluginSettings;
use ShoppingSync\Services\SyncService;

/**
 * REST-Endpunkte für Einführung und Kontrolle (nur mit Backend-Login).
 */
class ShoppingSyncController extends Controller
{
    /**
     * GET /rest/shopping-sync/preview/{variationId}
     * Zeigt genau, was an Google ginge – ohne etwas zu senden.
     */
    public function preview(SyncService $sync, int $variationId)
    {
        return $sync->preview($variationId);
    }

    /**
     * POST /rest/shopping-sync/run   { "full": false, "variationIds": [123] }
     */
    public function run(Request $request, SyncService $sync)
    {
        $ids = [];
        foreach ((array) $request->get('variationIds', []) as $id) {
            if ((int) $id > 0) {
                $ids[] = (int) $id;
            }
        }
        $full = in_array((string) $request->get('full', 'false'), ['1', 'true'], true);

        return $sync->run($full, $ids);
    }

    /**
     * GET /rest/shopping-sync/states
     * Alle übertragenen Produkte mit Google-Status (freigegeben, in Prüfung, abgelehnt).
     */
    public function states(SyncStateRepository $states)
    {
        $result = [];
        foreach ($states->all() as $state) {
            $result[] = [
                'variationId' => (int) $state->variationId,
                'itemId' => (int) $state->itemId,
                'market' => $state->country . '/' . $state->contentLanguage,
                'feedLabel' => $state->feedLabel,
                'offerId' => $state->offerId,
                'status' => $state->status,
                'syncedAt' => self::iso($state->syncedAt),
                'outOfStockSince' => self::iso($state->outOfStockSince),
                'googleStatus' => $state->googleStatus,
                'googleIssues' => json_decode($state->googleIssues ?: '[]', true),
                'googleCheckedAt' => self::iso($state->googleCheckedAt),
                'lastError' => $state->lastError,
                'lastErrorAt' => self::iso($state->lastErrorAt),
            ];
        }

        return $result;
    }

    /**
     * GET /rest/shopping-sync/log?variationId=…&onlyErrors=1&limit=200
     */
    public function log(Request $request, SyncLogRepository $log)
    {
        $entries = $log->latest(
            (int) $request->get('limit', 200),
            (int) $request->get('variationId', 0),
            in_array((string) $request->get('onlyErrors', '0'), ['1', 'true'], true)
        );
        $result = [];
        foreach ($entries as $entry) {
            $result[] = [
                'createdAt' => self::iso($entry->createdAt),
                'variationId' => (int) $entry->variationId,
                'itemId' => (int) $entry->itemId,
                'market' => $entry->market,
                'action' => $entry->action,
                'success' => (bool) $entry->success,
                'dryRun' => (bool) $entry->dryRun,
                'message' => $entry->message,
            ];
        }

        return $result;
    }

    /**
     * POST /rest/shopping-sync/register-gcp   { "developerEmail": "name@firma.de" }
     * Einmalig: Cloud-Projekt des Service-Accounts für die Merchant API registrieren.
     */
    public function registerGcp(Request $request, PluginSettings $pluginSettings, MerchantClient $merchant)
    {
        $email = trim((string) $request->get('developerEmail', ''));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'error' => 'developerEmail fehlt (ein Google-Konto, kein Service-Account).'];
        }

        return $merchant->registerGcp($pluginSettings->load(), $email);
    }

    /**
     * GET /rest/shopping-sync/check
     * Konfiguration prüfen und Verbindung zu Google testen.
     */
    public function check(PluginSettings $pluginSettings, MerchantClient $merchant)
    {
        $settings = $pluginSettings->load();
        $result = [
            'enabled' => $settings->enabled,
            'dryRun' => $settings->dryRun,
            'releaseTag' => $settings->releaseTag,
            'pilotItemIds' => $settings->pilotItemIds,
            'types' => array_keys($settings->types),
            'markets' => array_map(function ($m) {
                return $m->country . '/' . $m->contentLanguage . ($m->active ? '' : ' (inaktiv)');
            }, $settings->markets),
            'configErrors' => $settings->errors,
            'blockingProblems' => $settings->blockingProblems(),
        ];

        if ($settings->serviceAccountJson !== '' && $settings->merchantId !== '') {
            $ping = $merchant->ping($settings);
            $result['google'] = $ping['ok'] ? 'Verbindung ok' : ('Fehler: ' . ($ping['error'] ?? 'unbekannt'));
        } else {
            $result['google'] = 'Nicht getestet – Merchant-ID oder Schlüssel fehlt.';
        }

        return $result;
    }

    /**
     * @return string|null
     */
    private static function iso($timestamp)
    {
        return (int) $timestamp > 0 ? date('c', (int) $timestamp) : null;
    }
}
