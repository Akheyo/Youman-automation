<?php

namespace ShoppingSync\Tests\Domain;

use PHPUnit\Framework\TestCase;
use ShoppingSync\Domain\Settings;
use ShoppingSync\Tests\Fixtures;

class SettingsTest extends TestCase
{
    public function testParsesPilotConfiguration(): void
    {
        $s = Fixtures::settings(['sync.pilotItemIds' => '25433, 25434;25435']);

        $this->assertSame([], $s->errors);
        $this->assertSame([], $s->blockingProblems());
        $this->assertSame([25433, 25434, 25435], $s->pilotItemIds);
        $this->assertTrue($s->isPilotItem(25433));
        $this->assertFalse($s->isPilotItem(99999));
        $this->assertCount(1, $s->activeMarkets());
        $this->assertSame('https://www.shop.example', $s->markets[0]->shopUrl);
        $this->assertSame('USED', $s->conditionMap['1']);
    }

    public function testEmptyPilotListMeansAllReleased(): void
    {
        $this->assertTrue(Fixtures::settings()->isPilotItem(4711));
    }

    public function testNewCountryIsOnlyConfiguration(): void
    {
        $markets = json_decode(Fixtures::raw()['mapping.markets'], true);
        $markets[] = ['country' => 'AT', 'contentLanguage' => 'de', 'currency' => 'EUR', 'salesPriceId' => 1, 'shopUrl' => 'https://www.shop.example/at'];
        $markets[] = ['country' => 'BE', 'feedLabel' => 'BE', 'contentLanguage' => 'nl', 'currency' => 'EUR', 'salesPriceId' => 3, 'shopUrl' => 'https://www.shop.example/nl'];
        $markets[] = ['country' => 'BE', 'feedLabel' => 'BE', 'contentLanguage' => 'fr', 'currency' => 'EUR', 'salesPriceId' => 3, 'shopUrl' => 'https://www.shop.example/fr', 'active' => false];

        $s = Fixtures::settings(['mapping.markets' => json_encode($markets)]);

        $this->assertSame([], $s->errors);
        $this->assertCount(4, $s->markets);
        $this->assertCount(3, $s->activeMarkets());
        $this->assertSame('AT', $s->markets[1]->feedLabel);
    }

    public function testBrokenMarketDoesNotStopOthers(): void
    {
        $markets = json_decode(Fixtures::raw()['mapping.markets'], true);
        $markets[] = ['country' => 'FR', 'contentLanguage' => 'fr', 'currency' => 'EUR', 'salesPriceId' => 0, 'shopUrl' => 'http://insecure'];

        $s = Fixtures::settings(['mapping.markets' => json_encode($markets)]);

        $this->assertCount(1, $s->markets);
        $this->assertSame('DE', $s->markets[0]->country);
        $this->assertCount(2, $s->errors);
        $this->assertStringContainsString('salesPriceId', $s->errors[0]);
        $this->assertStringContainsString('https://', $s->errors[1]);
    }

    public function testDuplicateMarketIsRejected(): void
    {
        $markets = json_decode(Fixtures::raw()['mapping.markets'], true);
        $markets[] = $markets[0];

        $s = Fixtures::settings(['mapping.markets' => json_encode($markets)]);

        $this->assertCount(1, $s->markets);
        $this->assertStringContainsString('doppelt', $s->errors[0]);
    }

    public function testInvalidJsonIsReportedAndBlocks(): void
    {
        $s = Fixtures::settings(['mapping.markets' => '[{', 'mapping.types' => 'nope']);

        $this->assertContains('Märkte sind kein gültiges JSON.', $s->errors);
        $this->assertContains('Kein aktiver, gültiger Markt konfiguriert.', $s->blockingProblems());
        $this->assertContains('Keine gültige Produktgruppe konfiguriert.', $s->blockingProblems());
    }

    public function testDryRunNeedsNoGoogleCredentials(): void
    {
        $s = Fixtures::settings(['global.dryRun' => 'true', 'google.serviceAccountJson' => '', 'google.merchantId' => '']);
        $this->assertSame([], $s->blockingProblems());

        $live = Fixtures::settings(['google.serviceAccountJson' => '']);
        $this->assertContains('Service-Account-Schlüssel fehlt.', $live->blockingProblems());
    }

    public function testDisabledBlocks(): void
    {
        $this->assertContains(
            'Synchronisierung ist in der Plugin-Konfiguration ausgeschaltet.',
            Fixtures::settings(['global.enabled' => 'false'])->blockingProblems()
        );
    }

    public function testConditionMapValidation(): void
    {
        $s = Fixtures::settings(['mapping.conditions' => '{"0":"new","1":"used","4":"kaputt"}']);

        $this->assertSame(['0' => 'NEW', '1' => 'USED'], $s->conditionMap);
        $this->assertStringContainsString('kaputt', $s->errors[0]);
    }

    public function testDefaultsAreSafe(): void
    {
        $s = Settings::fromConfig([]);

        $this->assertFalse($s->enabled);
        $this->assertTrue($s->dryRun);
        $this->assertSame('shopping_ads', $s->releaseTag);
        $this->assertSame(Settings::STOCK_ZERO_OUT_OF_STOCK, $s->stockZeroAction);
    }

    public function testOfferIdPrefix(): void
    {
        $this->assertSame('pl-31207', Fixtures::settings(['sync.offerIdPrefix' => 'pl-'])->offerId(31207));

        $bad = Fixtures::settings(['sync.offerIdPrefix' => 'a/b']);
        $this->assertSame('31207', $bad->offerId(31207));
        $this->assertNotEmpty($bad->errors);
    }
}
