<?php

namespace ShoppingSync\Tests\Integration;

use PHPUnit\Framework\TestCase;
use Plenty\Modules\Plugin\Libs\Contracts\LibraryCallContract;
use Plenty\Plugin\ConfigRepository;
use ShoppingSync\Domain\SourceProduct;
use ShoppingSync\Models\SyncLog;
use ShoppingSync\Models\SyncState;
use ShoppingSync\Repositories\SyncLogRepository;
use ShoppingSync\Repositories\SyncStateRepository;
use ShoppingSync\Services\MerchantClient;
use ShoppingSync\Services\PlentyCatalog;
use ShoppingSync\Services\PluginSettings;
use ShoppingSync\Services\SyncService;
use ShoppingSync\Tests\Fixtures;

require_once __DIR__ . '/../../resources/lib/merchant_api.php';

class NullLogger
{
    public function __call($name, $arguments)
    {
        return $this;
    }
}

class FakeConfig extends ConfigRepository
{
    public $values;

    public function __construct(array $values)
    {
        $this->values = $values;
    }

    public function get(string $key, $default = null)
    {
        return $this->values[substr($key, strlen('ShoppingSync.'))] ?? $default;
    }
}

class FakeCatalog extends PlentyCatalog
{
    /** @var SourceProduct[] */
    public $products = [];
    /** @var int[] Varianten, die zwar getaggt, aber nicht lesbar sind */
    public $unreadable = [];

    public function tagsByVariation(array $tagNames): array
    {
        $result = [];
        foreach ($this->products as $id => $product) {
            $tags = array_values(array_intersect($product->tags, $tagNames));
            if ($tags !== []) {
                $result[$id] = $tags;
            }
        }
        foreach ($this->unreadable as $id) {
            $result[$id] = ['shopping_ads', 'type_klimakammer'];
        }

        return $result;
    }

    public function variationIdsWithTag(string $tagName): array
    {
        $ids = [];
        foreach ($this->tagsByVariation([$tagName]) as $id => $tags) {
            $ids[] = $id;
        }

        return $ids;
    }

    public function load(int $variationId, array $tagNames, array $languages, array $salesPriceIds, array $warehouseIds)
    {
        return isset($this->products[$variationId]) ? clone $this->products[$variationId] : null;
    }
}

/**
 * Leitet Bibliotheksaufrufe an das echte Skript weiter – mit einem
 * simulierten Google dahinter.
 */
class FakeLibrary implements LibraryCallContract
{
    /** @var array<string, array> was bei "Google" liegt: Segment → ProductInput */
    public $google = [];
    /** @var string[] Segment-Teile, die Google mit 400 ablehnt */
    public $reject = [];
    public $requests = [];
    public $calls = 0;

    public function call(string $libCall, array $params = []): array
    {
        $this->calls++;
        $self = $this;
        $http = function (string $method, string $url, array $headers, $body) use ($self) {
            if (strpos($url, '/token') !== false) {
                return [200, '{"access_token":"t"}'];
            }
            $self->requests[] = [$method, $url];
            if ($method === 'POST') {
                $input = json_decode($body, true);
                $segment = $input['contentLanguage'] . '~' . $input['feedLabel'] . '~' . $input['offerId'];
                if (in_array($input['offerId'], $self->reject, true)) {
                    return [400, '{"error":{"message":"Value for attribute price is invalid"}}'];
                }
                $self->google[$segment] = $input;
                return [200, $body];
            }
            if ($method === 'DELETE') {
                $segment = rawurldecode(explode('?', substr($url, strrpos($url, '/') + 1))[0]);
                unset($self->google[$segment]);
                return [200, '{}'];
            }
            // GET products
            $products = [];
            foreach ($self->google as $segment => $input) {
                $products[] = [
                    'offerId' => $input['offerId'],
                    'contentLanguage' => $input['contentLanguage'],
                    'feedLabel' => $input['feedLabel'],
                    'dataSource' => 'accounts/123456789/dataSources/987654',
                    'productStatus' => ['destinationStatuses' => [
                        ['reportingContext' => 'SHOPPING_ADS', 'approvedCountries' => [$input['feedLabel']]],
                    ]],
                ];
            }
            return [200, json_encode(['products' => $products])];
        };

        $key = openssl_pkey_new(['private_key_bits' => 1024, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($key, $pem);
        $params['credentials'] = json_encode(['client_email' => 'x@y', 'private_key' => $pem]);

        return \ssync_main($params, $http);
    }
}

class MemoryStates extends SyncStateRepository
{
    /** @var SyncState[] */
    public $rows = [];

    public function __construct()
    {
    }

    public function all(): array
    {
        return $this->rows;
    }

    public function forVariation(int $variationId): array
    {
        return array_values(array_filter($this->rows, function ($s) use ($variationId) {
            return (int) $s->variationId === $variationId;
        }));
    }

    public function newState(): SyncState
    {
        return new SyncState();
    }

    public function save(SyncState $state): SyncState
    {
        $this->rows[$state->stateKey] = $state;
        return $state;
    }

    public function delete(SyncState $state)
    {
        unset($this->rows[$state->stateKey]);
    }
}

class MemoryLog extends SyncLogRepository
{
    /** @var SyncLog[] */
    public $rows = [];

    public function __construct()
    {
    }

    public function add(int $variationId, int $itemId, string $market, string $action, bool $success, bool $dryRun, string $message)
    {
        $entry = new SyncLog();
        $entry->id = count($this->rows) + 1;
        $entry->variationId = $variationId;
        $entry->itemId = $itemId;
        $entry->market = $market;
        $entry->action = $action;
        $entry->success = $success;
        $entry->dryRun = $dryRun;
        $entry->message = $message;
        $this->rows[] = $entry;
    }

    public function latest(int $limit = 200, int $variationId = 0, bool $onlyErrors = false): array
    {
        $rows = array_reverse(array_filter($this->rows, function ($e) use ($variationId, $onlyErrors) {
            return ($variationId === 0 || $e->variationId === $variationId) && (!$onlyErrors || !$e->success);
        }));

        return array_slice(array_values($rows), 0, $limit);
    }

    public function prune()
    {
    }

    public function actionsFor(int $variationId): array
    {
        return array_values(array_map(function ($e) {
            return $e->action;
        }, array_filter($this->rows, function ($e) use ($variationId) {
            return $e->variationId === $variationId;
        })));
    }
}

class SyncServiceTest extends TestCase
{
    /** @var FakeCatalog */
    private $catalog;
    /** @var FakeLibrary */
    private $library;
    /** @var MemoryStates */
    private $states;
    /** @var MemoryLog */
    private $log;
    /** @var FakeConfig */
    private $config;

    protected function setUp(): void
    {
        $this->catalog = new FakeCatalog();
        $this->library = new FakeLibrary();
        $this->states = new MemoryStates();
        $this->log = new MemoryLog();
        $this->config = new FakeConfig(Fixtures::raw());
    }

    private function service(): SyncService
    {
        return new SyncService(
            new PluginSettings($this->config),
            $this->catalog,
            new MerchantClient($this->library),
            $this->states,
            $this->log
        );
    }

    private function addProduct(int $variationId, int $itemId = 25433): SourceProduct
    {
        $p = Fixtures::klimakammer();
        $p->variationId = $variationId;
        $p->itemId = $itemId;
        $this->catalog->products[$variationId] = $p;

        return $p;
    }

    public function testFullLifecycleOfAKlimakammer(): void
    {
        $p = $this->addProduct(31207);
        $sync = $this->service();

        // 1. freigegeben + Bestand → hinzufügen
        $summary = $sync->run(false);
        $this->assertSame(['insert' => 1], $summary['counts']);
        $this->assertSame('IN_STOCK', $this->library->google['de~DE~31207']['productAttributes']['availability']);
        $this->assertSame('active', $this->states->rows['31207:de~DE']->status);

        // 2. nichts geändert → kein Aufruf an Google
        $calls = $this->library->calls;
        $this->assertSame([], $sync->run(false)['counts']);
        $this->assertSame($calls, $this->library->calls);

        // 3. Preis geändert → aktualisieren
        $this->catalog->products[31207]->prices[1] = 11900.0;
        $this->assertSame(['update' => 1], $sync->run(false)['counts']);
        $this->assertSame('11900000000', $this->library->google['de~DE~31207']['productAttributes']['price']['amountMicros']);

        // 4. verkauft → nicht vorrätig
        $this->catalog->products[31207]->stockNet = 0;
        $this->assertSame(['out_of_stock' => 1], $sync->run(false)['counts']);
        $this->assertSame('OUT_OF_STOCK', $this->library->google['de~DE~31207']['productAttributes']['availability']);
        $this->assertGreaterThan(0, $this->states->rows['31207:de~DE']->outOfStockSince);

        // 5. wieder auf Lager → reaktivieren
        $this->catalog->products[31207]->stockNet = 1;
        $this->assertSame(['update' => 1], $sync->run(false)['counts']);
        $this->assertSame('IN_STOCK', $this->library->google['de~DE~31207']['productAttributes']['availability']);
        $this->assertSame(0, $this->states->rows['31207:de~DE']->outOfStockSince);

        // 6. shopping_ads entfernt → löschen
        $this->catalog->products[31207]->tags = ['type_klimakammer'];
        $this->assertSame(['delete' => 1], $sync->run(false)['counts']);
        $this->assertSame([], $this->library->google);
        $this->assertSame([], $this->states->rows);

        $this->assertSame(['insert', 'update', 'out_of_stock', 'update', 'delete'], $this->log->actionsFor(31207));
    }

    public function testDeletedVariationIsRemovedAtGoogle(): void
    {
        $this->addProduct(31207);
        $sync = $this->service();
        $sync->run(false);

        unset($this->catalog->products[31207]);

        $this->assertSame(['delete' => 1], $sync->run(false)['counts']);
        $this->assertSame([], $this->library->google);
    }

    public function testUnreadableButTaggedVariationIsNotDeleted(): void
    {
        $this->addProduct(31207);
        $sync = $this->service();
        $sync->run(false);

        // Lesefehler: Variante trägt den Tag noch, load() liefert nichts.
        unset($this->catalog->products[31207]);
        $this->catalog->unreadable = [31207];

        $this->assertSame([], $sync->run(false)['counts']);
        $this->assertArrayHasKey('de~DE~31207', $this->library->google);
        $this->assertSame('error', $this->log->latest(1, 31207)[0]->action);
    }

    public function testDryRunSendsNothingAndKeepsNoState(): void
    {
        $this->config->values['global.dryRun'] = 'true';
        $this->addProduct(31207);

        $summary = $this->service()->run(false);

        $this->assertTrue($summary['dryRun']);
        $this->assertSame(['insert' => 1], $summary['counts']);
        $this->assertSame(0, $this->library->calls);
        $this->assertSame([], $this->states->rows);
        $this->assertTrue($this->log->latest(1, 31207)[0]->dryRun);

        // Weitere Läufe im Testmodus wiederholen den Eintrag nicht.
        $this->service()->run(false);
        $this->service()->run(false);
        $this->assertSame(['insert'], $this->log->actionsFor(31207));
    }

    public function testPilotListKeepsOtherProductsAway(): void
    {
        $this->config->values['sync.pilotItemIds'] = '25433';
        $this->addProduct(31207, 25433);
        $this->addProduct(40000, 30000);

        $this->service()->run(false);

        $this->assertSame(['de~DE~31207'], array_keys($this->library->google));
    }

    public function testGoogleRejectionIsLoggedAndRetried(): void
    {
        $this->addProduct(31207);
        $this->library->reject = ['31207'];
        $sync = $this->service();

        $summary = $sync->run(false);
        $this->assertSame(['failed' => 1], $summary['counts']);
        $entry = $this->log->latest(1, 31207)[0];
        $this->assertFalse($entry->success);
        $this->assertStringContainsString('Value for attribute price is invalid', $entry->message);
        $this->assertSame([], $this->states->rows, 'ohne Erfolg kein Stand – nächster Lauf versucht es erneut');

        $this->library->reject = [];
        $this->assertSame(['insert' => 1], $sync->run(false)['counts']);
    }

    public function testDataErrorIsLoggedOnlyOnce(): void
    {
        $p = $this->addProduct(31207);
        $p->images = [];
        $sync = $this->service();

        $sync->run(false);
        $sync->run(false);
        $sync->run(false);

        $errors = array_filter($this->log->rows, function ($e) {
            return $e->variationId === 31207 && $e->action === 'error';
        });
        $this->assertCount(1, $errors);
        $this->assertStringContainsString('Kein Bild', reset($errors)->message);
    }

    public function testSecondCountryIsJustConfiguration(): void
    {
        $markets = json_decode($this->config->values['mapping.markets'], true);
        $markets[] = ['country' => 'AT', 'contentLanguage' => 'de', 'currency' => 'EUR', 'salesPriceId' => 2, 'shopUrl' => 'https://www.shop.example/at'];
        $this->config->values['mapping.markets'] = json_encode($markets);
        $p = $this->addProduct(31207);
        $p->prices[2] = 13100.0;
        $sync = $this->service();

        $this->assertSame(['insert' => 2], $sync->run(false)['counts']);
        $this->assertSame('13100000000', $this->library->google['de~AT~31207']['productAttributes']['price']['amountMicros']);

        // AT wieder deaktivieren → nur dort entfernen
        $markets[1]['active'] = false;
        $this->config->values['mapping.markets'] = json_encode($markets);
        $this->assertSame(['delete' => 1], $this->service()->run(false)['counts']);
        $this->assertSame(['de~DE~31207'], array_keys($this->library->google));
    }

    public function testFullSyncFetchesStatusAndCleansOrphans(): void
    {
        $this->addProduct(31207);
        $sync = $this->service();
        $sync->run(false);

        // Bei Google liegt etwas in unserer Datenquelle, das Plenty nicht (mehr) kennt.
        $this->library->google['de~DE~99999'] = ['offerId' => '99999', 'contentLanguage' => 'de', 'feedLabel' => 'DE'];

        $summary = $sync->run(true);

        $this->assertSame(['update' => 1], $summary['counts'], 'Vollabgleich frischt auf');
        $this->assertSame(1, $summary['googleStatus']['orphansDeleted']);
        $this->assertSame(['de~DE~31207'], array_keys($this->library->google));
        $this->assertSame('approved', $this->states->rows['31207:de~DE']->googleStatus);
    }

    public function testDisabledPluginDoesNothing(): void
    {
        $this->config->values['global.enabled'] = 'false';
        $this->addProduct(31207);

        $summary = $this->service()->run(false);

        $this->assertNotEmpty($summary['errors']);
        $this->assertSame(0, $this->library->calls);
    }

    public function testPreviewShowsPayloadWithoutSending(): void
    {
        $p = $this->addProduct(31207);
        $p->tags = ['type_klimakammer']; // noch nicht freigegeben

        $preview = $this->service()->preview(31207);

        $this->assertSame(0, $this->library->calls);
        $de = $preview['markets']['DE/de'];
        $this->assertStringContainsString('shopping_ads', $de['releaseProblem']);
        $this->assertSame('none', $de['nextAction']);
        $this->assertSame('USED', $de['productInput']['productAttributes']['condition']);
    }
}
