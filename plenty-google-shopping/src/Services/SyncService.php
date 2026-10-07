<?php

namespace ShoppingSync\Services;

use Plenty\Plugin\Log\Loggable;
use ShoppingSync\Domain\GoogleStatus;
use ShoppingSync\Domain\MarketConfig;
use ShoppingSync\Domain\ProductMapper;
use ShoppingSync\Domain\Settings;
use ShoppingSync\Domain\SourceProduct;
use ShoppingSync\Domain\SyncDecider;
use ShoppingSync\Domain\SyncDecision;
use ShoppingSync\Models\SyncState;
use ShoppingSync\Repositories\SyncLogRepository;
use ShoppingSync\Repositories\SyncStateRepository;

/**
 * Ein Sync-Lauf: Plenty lesen → je Variante und Markt entscheiden →
 * gesammelt an Google senden → Stand und Protokoll schreiben.
 *
 * Kandidaten sind alle Varianten mit dem Freigabe-Tag PLUS alle, die gerade
 * bei Google liegen. So wird auch erkannt, wenn der Tag entfernt oder die
 * Variante gelöscht wurde.
 */
class SyncService
{
    use Loggable;

    const BATCH_SIZE = 50;

    /** @var PluginSettings */
    private $pluginSettings;
    /** @var PlentyCatalog */
    private $catalog;
    /** @var MerchantClient */
    private $merchant;
    /** @var SyncStateRepository */
    private $states;
    /** @var SyncLogRepository */
    private $log;

    public function __construct(
        PluginSettings $pluginSettings,
        PlentyCatalog $catalog,
        MerchantClient $merchant,
        SyncStateRepository $states,
        SyncLogRepository $log
    ) {
        $this->pluginSettings = $pluginSettings;
        $this->catalog = $catalog;
        $this->merchant = $merchant;
        $this->states = $states;
        $this->log = $log;
    }

    /**
     * @param bool $full vollständiger Abgleich: alles auffrischen, Google-Status holen, Verwaiste löschen
     * @param int[] $onlyVariationIds leer = alle Kandidaten
     */
    public function run(bool $full, array $onlyVariationIds = []): array
    {
        $settings = $this->pluginSettings->load();
        $summary = [
            'full' => $full,
            'dryRun' => $settings->dryRun,
            'configErrors' => $settings->errors,
            'counts' => [],
            'errors' => [],
        ];

        $problems = $settings->blockingProblems();
        if ($problems !== []) {
            $summary['errors'] = $problems;
            return $summary;
        }
        foreach ($settings->errors as $configError) {
            $this->getLogger(__METHOD__)->warning('ShoppingSync::log.configError', ['error' => $configError]);
        }

        $now = time();
        $markets = $settings->activeMarkets();
        $mapper = new ProductMapper($settings);
        $decider = new SyncDecider($settings);

        $tagNames = array_merge([$settings->releaseTag], array_keys($settings->types));
        $tagsByVariation = $this->catalog->tagsByVariation($tagNames);
        $released = [];
        foreach ($tagsByVariation as $variationId => $tags) {
            if (in_array($settings->releaseTag, $tags, true)) {
                $released[$variationId] = true;
            }
        }

        $statesByKey = $this->states->all();
        $statesByVariation = [];
        foreach ($statesByKey as $state) {
            $statesByVariation[(int) $state->variationId][$state->stateKey] = $state;
        }

        $candidates = array_unique(array_merge(array_keys($released), array_keys($statesByVariation)));
        if ($onlyVariationIds !== []) {
            $candidates = array_values(array_intersect($candidates, $onlyVariationIds));
        }
        sort($candidates);

        $pending = [];
        foreach ($candidates as $variationId) {
            $variationStates = $statesByVariation[$variationId] ?? [];

            if (!isset($released[$variationId])) {
                // Tag entfernt oder Variante gelöscht: nur noch aufräumen.
                foreach ($variationStates as $state) {
                    $pending[] = $this->deleteFromState($state, "Tag \"{$settings->releaseTag}\" nicht mehr gesetzt oder Variante gelöscht.");
                }
                continue;
            }

            $product = $this->catalog->load(
                $variationId,
                $tagsByVariation[$variationId] ?? [],
                array_map(function (MarketConfig $m) {
                    return $m->textLanguage;
                }, $markets),
                array_map(function (MarketConfig $m) {
                    return $m->salesPriceId;
                }, $markets),
                $settings->warehouseIds
            );

            if ($product === null) {
                // Variante trägt den Tag, ist aber nicht lesbar: nichts
                // löschen – ein Lesefehler ist kein Verkauf.
                $this->logOnce($variationId, 0, '*', 'Variante konnte in Plenty nicht gelesen werden – übersprungen.', $settings->dryRun);
                continue;
            }

            $activeKeys = [];
            foreach ($markets as $market) {
                $key = SyncStateRepository::key($variationId, $market->contentLanguage, $market->feedLabel);
                $activeKeys[$key] = true;
                $state = $variationStates[$key] ?? null;

                $mapping = $decider->releaseProblem($product) === null ? $mapper->map($product, $market) : null;
                $decision = $decider->decide($product, $mapping, $state !== null ? $state->toDeciderState() : null, $now, $full);

                if ($decision->action === SyncDecision::NONE) {
                    continue;
                }
                if ($decision->action === SyncDecision::ERROR) {
                    $this->logOnce($variationId, $product->itemId, self::marketLabel($market), $decision->reason, $settings->dryRun);
                    $summary['counts']['error'] = ($summary['counts']['error'] ?? 0) + 1;
                    continue;
                }

                if ($mapping !== null && $mapping->warnings !== [] && $decision->sendsProduct()) {
                    $decision->reason .= ' Hinweise: ' . implode(' ', $mapping->warnings);
                }

                $pending[] = [
                    'variationId' => $variationId,
                    'itemId' => $product->itemId,
                    'market' => $market,
                    'marketLabel' => self::marketLabel($market),
                    'stateKey' => $key,
                    'state' => $state,
                    'decision' => $decision,
                    'operation' => $decision->sendsProduct()
                        ? ['op' => 'insert', 'productInput' => $decision->mapping->productInput]
                        : ['op' => 'delete', 'segment' => GoogleStatus::productSegment($market->contentLanguage, $market->feedLabel, $settings->offerId($variationId))],
                ];
            }

            // Markt aus der Konfiguration genommen oder deaktiviert → dort entfernen.
            foreach ($variationStates as $key => $state) {
                if (!isset($activeKeys[$key])) {
                    $pending[] = $this->deleteFromState($state, 'Markt ist nicht mehr aktiv.');
                }
            }
        }

        $this->execute($settings, $pending, $summary, $now);

        if ($full) {
            $summary['googleStatus'] = $this->refreshGoogleStatus($settings, $now);
            $this->log->prune();
        }

        if ($full || $summary['counts'] !== [] || $summary['errors'] !== []) {
            $this->logRun($settings, $full, count($candidates), $summary);
        }

        return $summary;
    }

    private function logRun(Settings $settings, bool $full, int $candidates, array $summary)
    {
        $this->log->add(0, 0, '*', 'run', $summary['errors'] === [], $settings->dryRun, json_encode([
            'full' => $full,
            'candidates' => $candidates,
            'counts' => $summary['counts'],
            'errors' => $summary['errors'],
        ]));
    }

    /**
     * Was würde für diese Variante an Google gehen? Sendet nichts.
     */
    public function preview(int $variationId): array
    {
        $settings = $this->pluginSettings->load();
        $mapper = new ProductMapper($settings);
        $decider = new SyncDecider($settings);
        $markets = $settings->activeMarkets();

        $tagNames = array_merge([$settings->releaseTag], array_keys($settings->types));
        $tags = $this->catalog->tagsByVariation($tagNames)[$variationId] ?? [];
        $product = $this->catalog->load(
            $variationId,
            $tags,
            array_map(function (MarketConfig $m) {
                return $m->textLanguage;
            }, $markets),
            array_map(function (MarketConfig $m) {
                return $m->salesPriceId;
            }, $markets),
            $settings->warehouseIds
        );

        $result = [
            'variationId' => $variationId,
            'configErrors' => $settings->errors,
            'blockingProblems' => $settings->blockingProblems(),
            'found' => $product !== null,
            'markets' => [],
        ];
        if ($product === null) {
            return $result;
        }

        $result['plenty'] = [
            'itemId' => $product->itemId,
            'isActive' => $product->isActive,
            'stockNet' => $product->stockNet,
            'tags' => $product->tags,
            'conditionId' => $product->conditionId,
            'brand' => $product->brand,
            'mpn' => $product->mpn,
            'barcodes' => $product->barcodes,
            'images' => count($product->images),
        ];

        $states = [];
        foreach ($this->states->forVariation($variationId) as $state) {
            $states[$state->stateKey] = $state;
        }

        foreach ($markets as $market) {
            $key = SyncStateRepository::key($variationId, $market->contentLanguage, $market->feedLabel);
            $state = $states[$key] ?? null;
            $releaseProblem = $decider->releaseProblem($product);
            // Die Abbildung zeigen wir auch ohne Freigabe – genau dann will
            // man sehen, was noch fehlt, bevor shopping_ads gesetzt wird.
            $mapping = $mapper->map($product, $market);
            $decision = $decider->decide($product, $releaseProblem === null ? $mapping : null, $state !== null ? $state->toDeciderState() : null, time());

            $result['markets'][self::marketLabel($market)] = [
                'releaseProblem' => $releaseProblem,
                'nextAction' => $decision->action,
                'reason' => $decision->reason,
                'errors' => $mapping->errors,
                'warnings' => $mapping->warnings,
                'productInput' => $mapping->productInput,
                'google' => $state === null ? null : [
                    'status' => $state->googleStatus,
                    'issues' => json_decode($state->googleIssues ?: '[]', true),
                    'syncedAt' => $state->syncedAt,
                    'lastError' => $state->lastError,
                ],
            ];
        }

        return $result;
    }

    /**
     * Holt den Prüfstatus aller Produkte von Google, gleicht ab und räumt auf.
     */
    public function refreshGoogleStatus(Settings $settings, int $now): array
    {
        if ($settings->dryRun) {
            return ['skipped' => 'Testmodus – Google wird nicht abgefragt.'];
        }

        $statesByKey = $this->states->all();
        $marketsByKey = [];
        foreach ($settings->markets as $market) {
            $marketsByKey[$market->contentLanguage . '~' . $market->feedLabel] = $market;
        }
        $ourDataSource = 'accounts/' . $settings->merchantId . '/dataSources/' . $settings->dataSourceId;
        $released = array_flip($this->catalog->variationIdsWithTag($settings->releaseTag));

        $seen = [];
        $orphans = [];
        $pageToken = null;
        $pages = 0;
        do {
            $response = $this->merchant->listProducts($settings, $pageToken);
            if (!$response['ok']) {
                $this->log->add(0, 0, '*', 'status', false, false, 'Google-Status konnte nicht geladen werden: ' . $response['error']);
                return ['error' => $response['error']];
            }

            foreach ($response['products'] ?? [] as $product) {
                $offerId = (string) ($product['offerId'] ?? '');
                $lang = (string) ($product['contentLanguage'] ?? '');
                $feedLabel = (string) ($product['feedLabel'] ?? '');
                $variationId = $this->variationIdFromOfferId($settings, $offerId);
                if ($variationId === null) {
                    continue;
                }
                $key = SyncStateRepository::key($variationId, $lang, $feedLabel);
                $seen[$key] = true;
                $market = $marketsByKey[$lang . '~' . $feedLabel] ?? null;

                if (isset($statesByKey[$key])) {
                    $summary = GoogleStatus::summarize($product, $market !== null ? $market->country : $feedLabel);
                    $state = $statesByKey[$key];
                    $state->googleStatus = $summary['status'];
                    $state->googleIssues = json_encode($summary['issues']);
                    $state->googleCheckedAt = $now;
                    $this->states->save($state);
                } elseif (($product['dataSource'] ?? '') === $ourDataSource && !isset($released[$variationId])) {
                    // Liegt in UNSERER Datenquelle, aber wir wissen nichts davon.
                    // Manuell im Merchant Center angelegte Produkte (andere
                    // Datenquelle) werden nie angefasst. Noch freigegebene
                    // Varianten auch nicht – die holt der nächste Lauf ein.
                    $orphans[] = [
                        'variationId' => $variationId,
                        'itemId' => 0,
                        'marketLabel' => ($market !== null ? $market->country : $feedLabel) . '/' . $lang,
                        'stateKey' => $key,
                        'state' => null,
                        'decision' => SyncDecision::delete('Abgleich: bei Google vorhanden, in Plenty nicht mehr freigegeben.'),
                        'operation' => ['op' => 'delete', 'segment' => GoogleStatus::productSegment($lang, $feedLabel, $offerId)],
                    ];
                }
            }

            $pageToken = $response['nextPageToken'] ?? null;
            $pages++;
        } while ($pageToken && $pages < 200);

        // Bei uns als übertragen vermerkt, bei Google aber nicht (mehr) da:
        // Hash vergessen, damit der nächste Lauf es neu sendet.
        $resent = 0;
        foreach ($statesByKey as $key => $state) {
            if (!isset($seen[$key]) && $now - (int) $state->syncedAt > 6 * 3600) {
                $state->hash = '';
                $state->googleStatus = GoogleStatus::UNKNOWN;
                $this->states->save($state);
                $resent++;
            }
        }

        $summary = ['counts' => [], 'errors' => []];
        $this->execute($settings, $orphans, $summary, $now);

        return ['checked' => count($seen), 'orphansDeleted' => $summary['counts']['delete'] ?? 0, 'markedForResend' => $resent];
    }

    private function execute(Settings $settings, array $pending, array &$summary, int $now)
    {
        if ($pending === []) {
            return;
        }

        if ($settings->dryRun) {
            // Im Testmodus wird kein Stand gespeichert – ohne diese Sperre
            // stünde dieselbe Entscheidung alle 15 Minuten im Protokoll.
            foreach ($pending as $entry) {
                /** @var SyncDecision $decision */
                $decision = $entry['decision'];
                $summary['counts'][$decision->action] = ($summary['counts'][$decision->action] ?? 0) + 1;
                if (!$this->isRepeat($entry['variationId'], $entry['marketLabel'], $decision->action, $decision->reason)) {
                    $this->log->add($entry['variationId'], $entry['itemId'], $entry['marketLabel'], $decision->action, !$decision->isError, true, $decision->reason);
                }
            }
            return;
        }

        foreach (array_chunk($pending, self::BATCH_SIZE) as $chunk) {
            $operations = [];
            foreach ($chunk as $index => $entry) {
                $operations[] = array_merge(['ref' => $index], $entry['operation']);
            }

            $response = $this->merchant->batch($settings, $operations);
            if (!$response['ok']) {
                // Ganzer Block gescheitert (z. B. Anmeldung): jede Variante protokollieren.
                foreach ($chunk as $entry) {
                    $this->handleResult($entry, false, $response['error'] ?? 'Unbekannter Fehler', $now, $summary);
                }
                $summary['errors'][] = $response['error'] ?? 'Unbekannter Fehler';
                continue;
            }

            foreach ($response['results'] ?? [] as $result) {
                $entry = $chunk[(int) $result['ref']] ?? null;
                if ($entry !== null) {
                    $this->handleResult($entry, (bool) $result['ok'], (string) ($result['error'] ?? ''), $now, $summary);
                }
            }
        }
    }

    private function handleResult(array $entry, bool $ok, string $error, int $now, array &$summary)
    {
        /** @var SyncDecision $decision */
        $decision = $entry['decision'];
        /** @var SyncState|null $state */
        $state = $entry['state'];

        if (!$ok) {
            $message = $decision->reason . ' → Google-Fehler: ' . $error;
            $this->log->add($entry['variationId'], $entry['itemId'], $entry['marketLabel'], $decision->action, false, false, $message);
            $this->getLogger(__METHOD__)->error('ShoppingSync::log.googleError', [
                'variationId' => $entry['variationId'],
                'market' => $entry['marketLabel'],
                'action' => $decision->action,
                'error' => $error,
            ]);
            if ($state !== null) {
                $state->lastError = $error;
                $state->lastErrorAt = $now;
                $this->states->save($state);
            }
            $summary['counts']['failed'] = ($summary['counts']['failed'] ?? 0) + 1;
            return;
        }

        $this->log->add($entry['variationId'], $entry['itemId'], $entry['marketLabel'], $decision->action, !$decision->isError, false, $decision->reason);
        $summary['counts'][$decision->action] = ($summary['counts'][$decision->action] ?? 0) + 1;

        if ($decision->action === SyncDecision::DELETE) {
            if ($state !== null) {
                $this->states->delete($state);
            }
            return;
        }

        /** @var MarketConfig $market */
        $market = $entry['market'];
        $wasOutOfStock = $state !== null && $state->status === SyncDecision::STATUS_OUT_OF_STOCK;
        if ($state === null) {
            $state = $this->states->newState();
            $state->stateKey = $entry['stateKey'];
            $state->variationId = $entry['variationId'];
            $state->country = $market->country;
            $state->contentLanguage = $market->contentLanguage;
            $state->feedLabel = $market->feedLabel;
            $state->googleStatus = GoogleStatus::PENDING;
        }
        $state->itemId = $entry['itemId'];
        $state->offerId = (string) $decision->mapping->productInput['offerId'];
        $state->status = $decision->resultingStatus();
        $state->hash = $decision->hash;
        $state->syncedAt = $now;
        $state->outOfStockSince = $state->status === SyncDecision::STATUS_OUT_OF_STOCK
            ? ($wasOutOfStock && $state->outOfStockSince > 0 ? $state->outOfStockSince : $now)
            : 0;
        $state->lastError = '';
        $state->lastErrorAt = 0;
        $this->states->save($state);
    }

    private function deleteFromState(SyncState $state, string $reason): array
    {
        return [
            'variationId' => (int) $state->variationId,
            'itemId' => (int) $state->itemId,
            'marketLabel' => $state->country . '/' . $state->contentLanguage,
            'stateKey' => $state->stateKey,
            'state' => $state,
            'decision' => SyncDecision::delete($reason),
            'operation' => [
                'op' => 'delete',
                'segment' => GoogleStatus::productSegment($state->contentLanguage, $state->feedLabel, $state->offerId),
            ],
        ];
    }

    /**
     * Datenfehler nur protokollieren, wenn sie neu sind – sonst steht
     * derselbe Fehler alle 15 Minuten im Protokoll.
     */
    private function logOnce(int $variationId, int $itemId, string $market, string $message, bool $dryRun)
    {
        if ($this->isRepeat($variationId, $market, SyncDecision::ERROR, $message)) {
            return;
        }
        $this->log->add($variationId, $itemId, $market, SyncDecision::ERROR, false, $dryRun, $message);
        $this->getLogger(__METHOD__)->warning('ShoppingSync::log.productError', [
            'variationId' => $variationId,
            'market' => $market,
            'error' => $message,
        ]);
    }

    /**
     * Ist der jüngste Protokolleintrag dieser Variante in diesem Markt genau derselbe?
     */
    private function isRepeat(int $variationId, string $market, string $action, string $message): bool
    {
        foreach ($this->log->latest(50, $variationId) as $entry) {
            if ($entry->market === $market) {
                return $entry->action === $action && $entry->message === $message;
            }
        }

        return false;
    }

    /**
     * @return int|null
     */
    private function variationIdFromOfferId(Settings $settings, string $offerId)
    {
        $prefix = $settings->offerIdPrefix;
        if ($prefix !== '') {
            if (strpos($offerId, $prefix) !== 0) {
                return null;
            }
            $offerId = substr($offerId, strlen($prefix));
        }

        return ctype_digit($offerId) ? (int) $offerId : null;
    }

    private static function marketLabel(MarketConfig $market): string
    {
        return $market->country . '/' . $market->contentLanguage;
    }
}
