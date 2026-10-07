<?php

namespace ShoppingSync\Tests;

use ShoppingSync\Domain\Settings;
use ShoppingSync\Domain\SourceProduct;

/**
 * Testdaten nah an der Wirklichkeit: eine gebrauchte Klimakammer wie
 * Artikel 25433, Pilotmarkt Deutschland.
 */
class Fixtures
{
    public static function raw(array $overrides = []): array
    {
        return array_merge([
            'global.enabled' => 'true',
            'global.dryRun' => 'false',
            'google.merchantId' => '123456789',
            'google.dataSourceId' => '987654',
            'google.serviceAccountJson' => '{"client_email":"x@y","private_key":"k"}',
            'sync.releaseTag' => 'shopping_ads',
            'sync.pilotItemIds' => '',
            'mapping.types' => json_encode([
                'type_klimakammer' => ['productType' => 'Klimakammern > Klimaprüfschränke', 'customLabel0' => 'klimakammer'],
                'type_laborgeraet' => ['productType' => ['de' => 'Laborgeräte', 'fr' => 'Équipement de laboratoire'], 'customLabel0' => 'laborgeraet'],
                'type_sonstiges' => ['productType' => 'Sonstiges', 'customLabel0' => 'sonstiges'],
            ]),
            'mapping.markets' => json_encode([[
                'country' => 'DE',
                'feedLabel' => 'DE',
                'contentLanguage' => 'de',
                'currency' => 'EUR',
                'salesPriceId' => 1,
                'shopUrl' => 'https://www.shop.example/',
                'shipping' => ['type_klimakammer' => ['shippingLabel' => 'klimakammer']],
            ]]),
        ], $overrides);
    }

    public static function settings(array $overrides = []): Settings
    {
        return Settings::fromConfig(self::raw($overrides));
    }

    public static function klimakammer(): SourceProduct
    {
        $p = new SourceProduct();
        $p->variationId = 31207;
        $p->itemId = 25433;
        $p->isActive = true;
        $p->stockNet = 1;
        $p->tags = ['shopping_ads', 'type_klimakammer'];
        $p->texts = ['de' => [
            'name1' => 'Weiss Technik WK3-180/70 Klimaprüfschrank -70 °C bis +180 °C',
            'description' => '<p>Gebrauchter Klimaprüfschrank, <b>voll funktionsfähig</b>.</p><ul><li>Innenraum 180 l</li><li>-70 °C bis +180 °C</li></ul>',
            'urlPath' => 'klimakammern/weiss-wk3-180-70',
        ]];
        $p->prices = [1 => 12900.0];
        $p->images = ['https://cdn.example/1.jpg', 'https://cdn.example/2.jpg'];
        $p->brand = 'Weiss Technik';
        $p->mpn = 'WK3-180/70';
        $p->barcodes = ['2000000254333']; // interne 20er-EAN aus der Erfassung
        $p->conditionId = 1;

        return $p;
    }
}
