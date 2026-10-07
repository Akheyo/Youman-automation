<?php

namespace ShoppingSync\Tests\Domain;

use PHPUnit\Framework\TestCase;
use ShoppingSync\Domain\ProductMapper;
use ShoppingSync\Domain\Settings;
use ShoppingSync\Domain\SourceProduct;
use ShoppingSync\Domain\SyncDecider;
use ShoppingSync\Domain\SyncDecision;
use ShoppingSync\Tests\Fixtures;

class SyncDeciderTest extends TestCase
{
    const NOW = 1_800_000_000;
    const DAY = 86400;

    private function decide(SourceProduct $product = null, array $state = null, array $overrides = [], bool $force = false): SyncDecision
    {
        $settings = Fixtures::settings($overrides);
        $decider = new SyncDecider($settings);
        $mapping = null;
        if ($product !== null && $decider->releaseProblem($product) === null) {
            $mapping = (new ProductMapper($settings))->map($product, $settings->markets[0]);
        }

        return $decider->decide($product, $mapping, $state, self::NOW, $force);
    }

    private function hashOf(SourceProduct $product, array $overrides = []): string
    {
        $settings = Fixtures::settings($overrides);

        return (new ProductMapper($settings))->map($product, $settings->markets[0])->hash();
    }

    private function activeState(SourceProduct $product, int $syncedAgo = 3600): array
    {
        return ['status' => SyncDecision::STATUS_ACTIVE, 'hash' => $this->hashOf($product), 'syncedAt' => self::NOW - $syncedAgo, 'outOfStockSince' => null];
    }

    public function testNewReleasedInStockIsInserted(): void
    {
        $d = $this->decide(Fixtures::klimakammer());

        $this->assertSame(SyncDecision::INSERT, $d->action);
        $this->assertSame('IN_STOCK', $d->mapping->productInput['productAttributes']['availability']);
        $this->assertSame(SyncDecision::STATUS_ACTIVE, $d->resultingStatus());
    }

    public function testNewReleasedWithoutStockWaits(): void
    {
        $p = Fixtures::klimakammer();
        $p->stockNet = 0;

        $this->assertSame(SyncDecision::NONE, $this->decide($p)->action);
    }

    public function testWithoutReleaseTagNothingHappens(): void
    {
        $p = Fixtures::klimakammer();
        $p->tags = ['type_klimakammer'];

        $this->assertSame(SyncDecision::NONE, $this->decide($p)->action);
    }

    public function testUnchangedProductIsNotResent(): void
    {
        $p = Fixtures::klimakammer();

        $this->assertSame(SyncDecision::NONE, $this->decide($p, $this->activeState($p))->action);
    }

    public function testChangedPriceDescriptionOrImagesTriggerUpdate(): void
    {
        foreach ([
            function (SourceProduct $p) { $p->prices[1] = 9999.0; },
            function (SourceProduct $p) { $p->texts['de']['description'] = 'Neu beschrieben'; },
            function (SourceProduct $p) { $p->images[] = 'https://cdn.example/3.jpg'; },
        ] as $change) {
            $p = Fixtures::klimakammer();
            $state = $this->activeState($p);
            $change($p);

            $d = $this->decide($p, $state);
            $this->assertSame(SyncDecision::UPDATE, $d->action);
            $this->assertSame('Produktdaten geändert.', $d->reason);
        }
    }

    public function testSoldOutMarksOutOfStock(): void
    {
        $p = Fixtures::klimakammer();
        $state = $this->activeState($p);
        $p->stockNet = 0;

        $d = $this->decide($p, $state);

        $this->assertSame(SyncDecision::OUT_OF_STOCK, $d->action);
        $this->assertSame('OUT_OF_STOCK', $d->mapping->productInput['productAttributes']['availability']);
        $this->assertSame(SyncDecision::STATUS_OUT_OF_STOCK, $d->resultingStatus());
    }

    public function testSoldOutDeletesWhenConfigured(): void
    {
        $p = Fixtures::klimakammer();
        $state = $this->activeState($p);
        $p->stockNet = 0;

        $d = $this->decide($p, $state, ['sync.stockZeroAction' => Settings::STOCK_ZERO_DELETE]);

        $this->assertSame(SyncDecision::DELETE, $d->action);
    }

    public function testBackInStockIsReactivated(): void
    {
        $p = Fixtures::klimakammer();
        $p->stockNet = 0;
        $state = ['status' => SyncDecision::STATUS_OUT_OF_STOCK, 'hash' => $this->hashOf($p), 'syncedAt' => self::NOW - 3600, 'outOfStockSince' => self::NOW - 5 * self::DAY];
        $p->stockNet = 1;

        $d = $this->decide($p, $state);

        $this->assertSame(SyncDecision::UPDATE, $d->action);
        $this->assertSame('Wieder auf Lager.', $d->reason);
        $this->assertSame('IN_STOCK', $d->mapping->productInput['productAttributes']['availability']);
    }

    public function testLongOutOfStockIsDeleted(): void
    {
        $p = Fixtures::klimakammer();
        $p->stockNet = 0;
        $state = ['status' => SyncDecision::STATUS_OUT_OF_STOCK, 'hash' => $this->hashOf($p), 'syncedAt' => self::NOW - 3600, 'outOfStockSince' => self::NOW - 31 * self::DAY];

        $this->assertSame(SyncDecision::DELETE, $this->decide($p, $state)->action);
        $this->assertSame(SyncDecision::NONE, $this->decide($p, $state, ['sync.deleteAfterDaysOutOfStock' => '0'])->action);
    }

    public function testRemovedReleaseTagDeletes(): void
    {
        $p = Fixtures::klimakammer();
        $state = $this->activeState($p);
        $p->tags = ['type_klimakammer'];

        $d = $this->decide($p, $state);

        $this->assertSame(SyncDecision::DELETE, $d->action);
        $this->assertStringContainsString('shopping_ads', $d->reason);
    }

    public function testInactiveVariationDeletes(): void
    {
        $p = Fixtures::klimakammer();
        $state = $this->activeState($p);
        $p->isActive = false;

        $this->assertSame(SyncDecision::DELETE, $this->decide($p, $state)->action);
    }

    public function testDeletedVariationDeletes(): void
    {
        $p = Fixtures::klimakammer();

        $this->assertSame(SyncDecision::DELETE, $this->decide(null, $this->activeState($p))->action);
        $this->assertSame(SyncDecision::NONE, $this->decide(null, null)->action);
    }

    public function testPilotListLimitsRollout(): void
    {
        $p = Fixtures::klimakammer();

        $this->assertSame(SyncDecision::INSERT, $this->decide($p, null, ['sync.pilotItemIds' => '25433'])->action);
        $this->assertSame(SyncDecision::NONE, $this->decide($p, null, ['sync.pilotItemIds' => '1,2'])->action);
    }

    public function testBrokenDataNeverAdvertisesStaleOffer(): void
    {
        $p = Fixtures::klimakammer();
        $state = $this->activeState($p);
        $p->prices = [];

        $known = $this->decide($p, $state);
        $this->assertSame(SyncDecision::DELETE, $known->action);
        $this->assertTrue($known->isError);
        $this->assertStringContainsString('Kein Preis', $known->reason);

        $new = $this->decide($p);
        $this->assertSame(SyncDecision::ERROR, $new->action);
    }

    public function testPeriodicRefreshBeforeGoogleExpiry(): void
    {
        $p = Fixtures::klimakammer();

        $this->assertSame(SyncDecision::NONE, $this->decide($p, $this->activeState($p, 19 * self::DAY))->action);
        $this->assertSame(SyncDecision::UPDATE, $this->decide($p, $this->activeState($p, 20 * self::DAY))->action);
        $this->assertSame(SyncDecision::UPDATE, $this->decide($p, $this->activeState($p), [], true)->action);
    }
}
