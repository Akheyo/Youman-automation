<?php

namespace ShoppingSync\Tests\Domain;

use PHPUnit\Framework\TestCase;
use ShoppingSync\Domain\ProductMapper;
use ShoppingSync\Tests\Fixtures;

class ProductMapperTest extends TestCase
{
    public function testMapsUsedKlimakammerForGermany(): void
    {
        $settings = Fixtures::settings();
        $result = (new ProductMapper($settings))->map(Fixtures::klimakammer(), $settings->markets[0]);

        $this->assertSame([], $result->errors);
        $this->assertSame('type_klimakammer', $result->typeTag);
        $input = $result->productInput;
        $this->assertSame('31207', $input['offerId']);
        $this->assertSame('de', $input['contentLanguage']);
        $this->assertSame('DE', $input['feedLabel']);

        $a = $input['productAttributes'];
        $this->assertSame('Weiss Technik WK3-180/70 Klimaprüfschrank -70 °C bis +180 °C', $a['title']);
        $this->assertSame("Gebrauchter Klimaprüfschrank, voll funktionsfähig.\n- Innenraum 180 l\n- -70 °C bis +180 °C", $a['description']);
        $this->assertSame('https://www.shop.example/klimakammern/weiss-wk3-180-70_25433_31207', $a['link']);
        $this->assertSame('https://cdn.example/1.jpg', $a['imageLink']);
        $this->assertSame(['https://cdn.example/2.jpg'], $a['additionalImageLinks']);
        $this->assertSame('IN_STOCK', $a['availability']);
        $this->assertSame(['amountMicros' => '12900000000', 'currencyCode' => 'EUR'], $a['price']);
        $this->assertSame('USED', $a['condition']);
        $this->assertSame('Weiss Technik', $a['brand']);
        $this->assertSame('WK3-180/70', $a['mpn']);
        $this->assertSame(['Klimakammern > Klimaprüfschränke'], $a['productTypes']);
        $this->assertSame('klimakammer', $a['customLabel0']);
        $this->assertSame('klimakammer', $a['shippingLabel']);
        $this->assertArrayNotHasKey('shipping', $a);
    }

    public function testInternalEanIsNeverSentAsGtin(): void
    {
        $settings = Fixtures::settings();
        $result = (new ProductMapper($settings))->map(Fixtures::klimakammer(), $settings->markets[0]);

        $this->assertArrayNotHasKey('gtins', $result->productInput['productAttributes']);
        // Marke + MPN reichen als Kennung – identifierExists bleibt ungesetzt.
        $this->assertArrayNotHasKey('identifierExists', $result->productInput['productAttributes']);
        $this->assertStringContainsString('interne 20er-EAN', implode(' ', $result->warnings));
    }

    public function testRealGtinIsSent(): void
    {
        $settings = Fixtures::settings();
        $product = Fixtures::klimakammer();
        $product->barcodes[] = '4006381333931';

        $a = (new ProductMapper($settings))->map($product, $settings->markets[0])->productInput['productAttributes'];

        $this->assertSame(['4006381333931'], $a['gtins']);
    }

    public function testNoIdentifiersSetsIdentifierExistsFalse(): void
    {
        $settings = Fixtures::settings();
        $product = Fixtures::klimakammer();
        $product->mpn = null;

        $a = (new ProductMapper($settings))->map($product, $settings->markets[0])->productInput['productAttributes'];

        $this->assertFalse($a['identifierExists']);
        $this->assertArrayNotHasKey('mpn', $a);
    }

    public function testOutOfStockAvailability(): void
    {
        $settings = Fixtures::settings();
        $product = Fixtures::klimakammer();
        $product->stockNet = 0;

        $a = (new ProductMapper($settings))->map($product, $settings->markets[0])->productInput['productAttributes'];

        $this->assertSame('OUT_OF_STOCK', $a['availability']);
    }

    public function testMissingRequiredDataGivesErrorsNotGuesses(): void
    {
        $settings = Fixtures::settings();
        $product = Fixtures::klimakammer();
        $product->prices = [];
        $product->images = [];
        $product->conditionId = 7;
        $product->texts['de']['description'] = '';
        $product->texts['de']['urlPath'] = '';

        $result = (new ProductMapper($settings))->map($product, $settings->markets[0]);

        $this->assertNull($result->productInput);
        $this->assertFalse($result->isValid());
        $all = implode(' | ', $result->errors);
        $this->assertStringContainsString('Kein Preis', $all);
        $this->assertStringContainsString('Kein Bild', $all);
        $this->assertStringContainsString('Artikelzustand 7', $all);
        $this->assertStringContainsString('Beschreibung fehlt', $all);
        $this->assertStringContainsString('URL', $all);
    }

    public function testTypeTagIsRequiredAndUnique(): void
    {
        $settings = Fixtures::settings();
        $mapper = new ProductMapper($settings);

        $none = Fixtures::klimakammer();
        $none->tags = ['shopping_ads'];
        $this->assertStringContainsString('Kein Produktgruppen-Tag', $mapper->map($none, $settings->markets[0])->errors[0]);

        $two = Fixtures::klimakammer();
        $two->tags = ['shopping_ads', 'type_klimakammer', 'type_sonstiges'];
        $this->assertStringContainsString('Mehrere Produktgruppen-Tags', $mapper->map($two, $settings->markets[0])->errors[0]);
    }

    public function testPerCountryLanguagePriceAndShippingRates(): void
    {
        $markets = [[
            'country' => 'FR', 'contentLanguage' => 'fr', 'currency' => 'EUR', 'salesPriceId' => 5,
            'shopUrl' => 'https://www.shop.example/fr',
            'linkTemplate' => '{shopUrl}/{lang}/{urlPath}_{itemId}_{variationId}',
            'shipping' => ['default' => ['rates' => [
                ['price' => '149.00', 'service' => 'Spedition', 'minHandlingTime' => 1, 'maxHandlingTime' => 3, 'minTransitTime' => 3, 'maxTransitTime' => 6],
            ]]],
        ]];
        $settings = Fixtures::settings(['mapping.markets' => json_encode($markets)]);
        $product = Fixtures::klimakammer();
        $product->tags = ['shopping_ads', 'type_laborgeraet'];
        $product->texts['fr'] = ['name1' => 'Enceinte climatique', 'description' => 'Occasion', 'urlPath' => 'enceinte'];
        $product->prices[5] = 13500.5;

        $result = (new ProductMapper($settings))->map($product, $settings->markets[0]);
        $a = $result->productInput['productAttributes'];

        $this->assertSame([], $result->errors);
        $this->assertSame('fr', $result->productInput['contentLanguage']);
        $this->assertSame('FR', $result->productInput['feedLabel']);
        $this->assertSame('Enceinte climatique', $a['title']);
        $this->assertSame('https://www.shop.example/fr/fr/enceinte_25433_31207', $a['link']);
        $this->assertSame('13500500000', $a['price']['amountMicros']);
        $this->assertSame(['Équipement de laboratoire'], $a['productTypes']);
        $this->assertSame('laborgeraet', $a['customLabel0']);
        $this->assertArrayNotHasKey('shippingLabel', $a);
        $this->assertSame([[
            'price' => ['amountMicros' => '149000000', 'currencyCode' => 'EUR'],
            'country' => 'FR',
            'service' => 'Spedition',
            'minHandlingTime' => '1',
            'maxHandlingTime' => '3',
            'minTransitTime' => '3',
            'maxTransitTime' => '6',
        ]], $a['shipping']);
    }

    public function testMissingTranslationIsAnError(): void
    {
        $markets = [['country' => 'NL', 'contentLanguage' => 'nl', 'currency' => 'EUR', 'salesPriceId' => 1, 'shopUrl' => 'https://www.shop.example/nl']];
        $settings = Fixtures::settings(['mapping.markets' => json_encode($markets)]);

        $result = (new ProductMapper($settings))->map(Fixtures::klimakammer(), $settings->markets[0]);

        $this->assertStringContainsString('Keine Texte in der Plenty-Sprache "nl"', $result->errors[0]);
    }

    public function testLongTitleIsCutAtWordBoundary(): void
    {
        $settings = Fixtures::settings();
        $product = Fixtures::klimakammer();
        $product->texts['de']['name1'] = str_repeat('Klimakammer ', 20);

        $title = (new ProductMapper($settings))->map($product, $settings->markets[0])->productInput['productAttributes']['title'];

        $this->assertLessThanOrEqual(150, mb_strlen($title));
        $this->assertStringEndsWith('Klimakammer', $title);
    }

    public function testHashChangesWithPriceButNotWithKeyOrder(): void
    {
        $settings = Fixtures::settings();
        $mapper = new ProductMapper($settings);
        $product = Fixtures::klimakammer();

        $first = $mapper->map($product, $settings->markets[0])->hash();
        $this->assertSame($first, $mapper->map(Fixtures::klimakammer(), $settings->markets[0])->hash());

        $product->prices[1] = 11900.0;
        $this->assertNotSame($first, $mapper->map($product, $settings->markets[0])->hash());
    }
}
