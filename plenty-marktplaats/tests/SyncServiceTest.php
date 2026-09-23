<?php

use Marktplaats\Api\MarktplaatsClient;
use Marktplaats\Repositories\ListingRepository;
use Marktplaats\Repositories\SettingsRepository;
use Marktplaats\Services\PluginConfig;
use Marktplaats\Services\SyncService;
use Marktplaats\Services\VariationSource;
use PHPUnit\Framework\TestCase;

/** Einstellungen im Speicher statt in der Plugin-Datenbank */
class FakeSettings extends SettingsRepository
{
    public $werte = [SettingsRepository::REFERRER_ID => '142', SettingsRepository::REFRESH_TOKEN => 'r'];

    public function __construct()
    {
    }

    public function get(string $name, string $default = ''): string
    {
        return isset($this->werte[$name]) ? $this->werte[$name] : $default;
    }

    public function set(string $name, string $value)
    {
        $this->werte[$name] = $value;
    }

    public function forget(string $name)
    {
        unset($this->werte[$name]);
    }
}

/** Anzeigen-Tabelle im Speicher */
class FakeListings extends ListingRepository
{
    public $zeilen = [];

    public function __construct()
    {
    }

    public function find(int $variationId)
    {
        return isset($this->zeilen[$variationId]) ? (object)$this->zeilen[$variationId] : null;
    }

    public function allByVariation(): array
    {
        $result = [];
        foreach ($this->zeilen as $id => $zeile) {
            $result[$id] = self::toArray((object)$zeile);
        }

        return $result;
    }

    public function save(array $data): \Marktplaats\Models\Listing
    {
        $id = (int)$data['variationId'];
        $leer = [
            'variationId' => $id, 'itemId' => 0, 'mpItemId' => '', 'status' => '', 'adHash' => '', 'imageHash' => '',
            'errorType' => '', 'lastError' => '', 'warnings' => '', 'title' => '', 'price' => 0, 'syncedAt' => 0,
        ];
        $this->zeilen[$id] = array_merge(isset($this->zeilen[$id]) ? $this->zeilen[$id] : $leer, $data);

        // Das Modell wird im Abgleich nicht weiterverwendet
        return (new ReflectionClass(\Marktplaats\Models\Listing::class))->newInstanceWithoutConstructor();
    }
}

class SyncServiceTest extends TestCase
{
    /** @var FakeSettings */
    private $settings;
    /** @var FakeListings */
    private $listings;
    /** @var array Aufrufe an Marktplaats: [Methode, Pfad, Body] */
    private $aufrufe = [];
    /** @var array Vorbereitete Antworten, der Reihe nach; sonst Standardantwort */
    private $antworten = [];
    /** @var array[] Varianten, die Plenty liefert */
    private $varianten = [];
    private $maxPerRun = 100;
    private $verbunden = true;

    protected function setUp(): void
    {
        if (!class_exists(\Plenty\Modules\Plugin\DataBase\Contracts\Model::class)) {
            eval('namespace Plenty\Modules\Plugin\DataBase\Contracts; abstract class Model {}');
        }
        $this->settings = new FakeSettings();
        $this->listings = new FakeListings();
    }

    private function variante(int $id, float $preis = 25.0): array
    {
        return [
            'id' => $id, 'itemId' => $id + 1000, 'isActive' => true, 'visibleForMarket' => true, 'stockNet' => 1,
            'itemTexts' => [['lang' => 'nl', 'name1' => 'Artikel ' . $id, 'description' => 'Beschrijving']],
            'variationSalesPrices' => [['salesPriceId' => 1, 'price' => $preis]],
            'itemImages' => [['position' => 1, 'url' => 'https://cdn.example/' . $id . '.jpg']],
            'variationDefaultCategory' => [['branchId' => 10]],
            'item' => ['condition' => 0],
        ];
    }

    private function service(): SyncService
    {
        $client = $this->getMockBuilder(MarktplaatsClient::class)->disableOriginalConstructor()->getMock();
        $client->method('isConnected')->willReturnCallback(function () {
            return $this->verbunden;
        });
        $client->method('request')->willReturnCallback(function ($methode, $pfad, $body = null) {
            $this->aufrufe[] = [$methode, $pfad, $body];
            if (count($this->antworten) > 0) {
                return array_shift($this->antworten);
            }
            if ($methode === 'POST' && $pfad === 'advertisements') {
                return ['status' => 201, 'body' => ['itemId' => 'm' . (count($this->aufrufe) + 100)], 'error' => ''];
            }

            return ['status' => 200, 'body' => [], 'error' => ''];
        });

        $config = $this->getMockBuilder(PluginConfig::class)->disableOriginalConstructor()->getMock();
        $config->method('clientId')->willReturn('id');
        $config->method('clientSecret')->willReturn('secret');
        $config->method('environment')->willReturn('production');
        $config->method('requireStock')->willReturn(true);
        $config->method('deleteWhenGone')->willReturn(true);
        $config->method('maxPerRun')->willReturnCallback(function () {
            return $this->maxPerRun;
        });
        $config->method('errors')->willReturn([]);
        $config->method('mapperSettings')->willReturn([
            'languages' => ['nl'], 'salesPriceId' => 1, 'priceModel' => 'fixed', 'postcode' => '5911AB',
            'categoryMap' => [10 => 500], 'attributes' => ['*' => ['delivery' => 'Verzenden']],
            'conditionAttribute' => 'condition', 'conditionMap' => ['0' => 'Nieuw'], 'maxImages' => 24,
        ]);

        $source = $this->getMockBuilder(VariationSource::class)->disableOriginalConstructor()->getMock();
        $source->method('page')->willReturnCallback(function ($page) {
            return ['variations' => $page === 1 ? $this->varianten : [], 'lastPage' => true];
        });
        $source->method('one')->willReturnCallback(function ($id) {
            foreach ($this->varianten as $v) {
                if ($v['id'] === $id) {
                    return $v;
                }
            }

            return null;
        });

        return new SyncService($client, $config, $this->settings, $this->listings, $source);
    }

    private function methoden(): array
    {
        return array_map(function ($a) {
            return $a[0] . ' ' . $a[1];
        }, $this->aufrufe);
    }

    public function testNeueVarianteWirdMitBildernAngelegt()
    {
        $this->varianten = [$this->variante(1)];
        $summary = $this->service()->run();

        $this->assertTrue($summary['complete']);
        $this->assertSame(1, $summary['created']);
        $this->assertSame(['POST advertisements', 'POST advertisements/m101/images'], $this->methoden());
        $this->assertSame(['urls' => ['https://cdn.example/1.jpg'], 'replaceAll' => true], $this->aufrufe[1][2]);
        $this->assertSame(500, $this->aufrufe[0][2]['categoryId']);
        $this->assertSame(2500, $this->aufrufe[0][2]['priceModel']['askingPrice']);

        $zeile = $this->listings->zeilen[1];
        $this->assertSame('m101', $zeile['mpItemId']);
        $this->assertSame('online', $zeile['status']);
        $this->assertSame('Artikel 1', $zeile['title']);
        // Sperre wieder frei
        $this->assertSame('0', $this->settings->werte[SettingsRepository::SYNC_LOCK]);
    }

    public function testZweiterLaufOhneAenderungRuftNichtsAuf()
    {
        $this->varianten = [$this->variante(1)];
        $this->service()->run();
        $this->aufrufe = [];

        $summary = $this->service()->run();
        $this->assertSame([], $this->aufrufe);
        $this->assertSame(1, $summary['unchanged']);
    }

    public function testPreisaenderungAktualisiertOhneBilder()
    {
        $this->varianten = [$this->variante(1)];
        $this->service()->run();
        $this->aufrufe = [];

        $this->varianten = [$this->variante(1, 30.0)];
        $summary = $this->service()->run();

        $this->assertSame(['PUT advertisements/m101'], $this->methoden());
        $this->assertSame(3000, $this->aufrufe[0][2]['priceModel']['askingPrice']);
        $this->assertSame(1, $summary['updated']);
    }

    public function testAbgelaufeneAnzeigeWirdNeuAngelegt()
    {
        $this->varianten = [$this->variante(1)];
        $this->service()->run();
        $this->aufrufe = [];

        $this->varianten = [$this->variante(1, 30.0)];
        $this->antworten = [['status' => 404, 'body' => ['code' => 'advertisement-not-found'], 'error' => '']];
        $this->service()->run();

        $this->assertSame(['PUT advertisements/m101', 'POST advertisements', 'POST advertisements/m102/images'], $this->methoden());
        $this->assertSame('m102', $this->listings->zeilen[1]['mpItemId']);
    }

    public function testUnbekanntesAttributWirdWeggelassenUndErneutGesendet()
    {
        $this->varianten = [$this->variante(1)];
        $this->antworten = [[
            'status' => 400,
            'body'   => ['code' => 'validation-failure', 'details' => [['field' => 'delivery', 'code' => 'unknown-field']]],
            'error'  => '',
        ]];
        $this->service()->run();

        $this->assertSame(['POST advertisements', 'POST advertisements', 'POST advertisements/m102/images'], $this->methoden());
        $this->assertArrayHasKey('delivery', $this->aufrufe[0][2]);
        $this->assertArrayNotHasKey('delivery', $this->aufrufe[1][2]);
        $this->assertSame('online', $this->listings->zeilen[1]['status']);
        $this->assertStringContainsString('delivery', $this->listings->zeilen[1]['warnings']);
    }

    public function testValidierungsfehlerWirdGespeichertUndNichtWiederholt()
    {
        $this->varianten = [$this->variante(1)];
        $this->antworten = [[
            'status' => 400,
            'body'   => ['code' => 'validation-failure', 'details' => [['field' => 'condition', 'code' => 'invalid-field-value', 'value' => ['Nieuw', 'Gebruikt']]]],
            'error'  => '',
        ]];
        $summary = $this->service()->run();

        $this->assertSame(1, $summary['failed']);
        $zeile = $this->listings->zeilen[1];
        $this->assertSame('error', $zeile['status']);
        $this->assertSame('validation', $zeile['errorType']);
        $this->assertSame('validation-failure: condition: invalid-field-value (Nieuw|Gebruikt)', $zeile['lastError']);

        $this->aufrufe = [];
        $this->service()->run();
        $this->assertSame([], $this->aufrufe);
    }

    public function testUnvollstaendigeVarianteGehtNichtRaus()
    {
        $ohnePreis = $this->variante(1);
        $ohnePreis['variationSalesPrices'] = [];
        $this->varianten = [$ohnePreis];
        $summary = $this->service()->run();

        $this->assertSame([], $this->aufrufe);
        $this->assertSame(1, $summary['invalid']);
        $this->assertStringContainsString('Verkaufspreis 1', $this->listings->zeilen[1]['lastError']);
    }

    public function testNichtMehrFreigegebeneVarianteWirdEntfernt()
    {
        $this->varianten = [$this->variante(1), $this->variante(2)];
        $this->service()->run();
        $this->aufrufe = [];

        $this->varianten = [$this->variante(1)];
        $summary = $this->service()->run();

        $this->assertSame(['DELETE advertisements/m103'], $this->methoden());
        $this->assertSame(1, $summary['deleted']);
        $this->assertSame('removed', $this->listings->zeilen[2]['status']);
    }

    public function testAusverkauftWirdEntfernt()
    {
        $this->varianten = [$this->variante(1)];
        $this->service()->run();
        $this->aufrufe = [];

        $ausverkauft = $this->variante(1);
        $ausverkauft['stockNet'] = 0;
        $this->varianten = [$ausverkauft];
        $this->service()->run();

        $this->assertSame(['DELETE advertisements/m101'], $this->methoden());
    }

    public function testKeinMassenloeschenWennPlentyNichtsLiefert()
    {
        $this->varianten = [];
        for ($i = 1; $i <= 6; $i++) {
            $this->varianten[] = $this->variante($i);
        }
        $this->service()->run();
        $this->aufrufe = [];

        $this->varianten = [];
        $summary = $this->service()->run();

        $this->assertSame([], $this->aufrufe);
        $this->assertStringContainsString('NICHT entfernt', $summary['message']);
    }

    public function testHoechstzahlProLauf()
    {
        $this->maxPerRun = 1;
        $this->varianten = [$this->variante(1), $this->variante(2)];
        $summary = $this->service()->run();

        $this->assertSame(1, $summary['created']);
        $this->assertSame(1, $summary['deferred']);
        $this->assertStringContainsString('naechsten Lauf', $summary['message']);

        $this->aufrufe = [];
        $summary = $this->service()->run();
        $this->assertSame(1, $summary['created']);
        $this->assertSame(1, $summary['unchanged']);
    }

    public function testOhneVerbindungKeinAbgleich()
    {
        $this->verbunden = false;
        $this->varianten = [$this->variante(1)];
        $summary = $this->service()->run();

        $this->assertFalse($summary['complete']);
        $this->assertStringContainsString('Noch nicht mit Marktplaats verbunden', $summary['message']);
        $this->assertSame([], $this->aufrufe);
    }

    public function testLaufendeSperreVerhindertZweitenLauf()
    {
        $this->settings->werte[SettingsRepository::SYNC_LOCK] = (string)(time() - 60);
        $this->varianten = [$this->variante(1)];
        $summary = $this->service()->run();

        $this->assertStringContainsString('laeuft bereits', $summary['message']);
        $this->assertSame([], $this->aufrufe);
    }

    public function testEinzelabgleichUndEntfernen()
    {
        $this->varianten = [$this->variante(7)];
        $result = $this->service()->syncOne(7);
        $this->assertSame('online', $result['listing']['status']);

        $this->aufrufe = [];
        $result = $this->service()->removeOne(7);
        $this->assertSame(['DELETE advertisements/m101'], $this->methoden());
        $this->assertSame('removed', $result['listing']['status']);

        $this->assertStringContainsString('keine Anzeige', $this->service()->removeOne(7)['message']);
    }

    public function testVorschauErklaertWarumNicht()
    {
        $v = $this->variante(3);
        $v['visibleForMarket'] = false;
        $this->varianten = [$v];
        $preview = $this->service()->preview(3);

        $this->assertFalse($preview['wanted']);
        $this->assertSame('none', $preview['action']);
        $this->assertStringContainsString('nicht fuer "Marktplaats" freigegeben', $preview['notWantedBecause'][0]);
        $this->assertSame([], $this->aufrufe);
    }
}
