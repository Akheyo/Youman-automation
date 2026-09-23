<?php

use Marktplaats\Mapping\AdMapper;
use PHPUnit\Framework\TestCase;

class AdMapperTest extends TestCase
{
    private function variation(array $override = []): array
    {
        return array_merge([
            'id'     => 1001,
            'itemId' => 501,
            'itemTexts' => [
                ['lang' => 'de', 'name1' => 'Akkuschrauber Bosch', 'description' => '<p>Deutscher Text</p>'],
                ['lang' => 'nl', 'name1' => 'Accuboormachine Bosch', 'description' => '<p>Nette staat</p><ul><li>18 V</li></ul>'],
            ],
            'variationSalesPrices' => [
                ['salesPriceId' => 1, 'price' => 99.0],
                ['salesPriceId' => 7, 'price' => 49.95],
            ],
            'images' => [],
            'itemImages' => [
                ['id' => 2, 'position' => 2, 'url' => 'https://cdn.example/2.jpg', 'fileType' => 'jpg'],
                ['id' => 1, 'position' => 1, 'url' => 'https://cdn.example/1.jpg', 'fileType' => 'jpg'],
                ['id' => 3, 'position' => 3, 'url' => 'https://cdn.example/3.gif', 'fileType' => 'gif'],
            ],
            'variationDefaultCategory' => [['branchId' => 40, 'plentyId' => 1]],
            'variationCategories' => [['categoryId' => 41], ['categoryId' => 40]],
            'item' => ['condition' => 1],
            'manufacturer' => [
                'name' => 'Bosch', 'street' => 'Robert-Bosch-Platz', 'houseNo' => '1',
                'postcode' => '70839', 'town' => 'Gerlingen', 'email' => 'info@bosch.example',
            ],
        ], $override);
    }

    private function settings(array $override = []): array
    {
        return array_merge([
            'locale'            => 'nl-NL',
            'languages'         => ['nl', 'de'],
            'titleField'        => 'name1',
            'salesPriceId'      => 7,
            'priceModel'        => 'fixed',
            'postcode'          => '1097 dn',
            'categoryMap'       => [41 => 1234, 40 => 999],
            'defaultCategoryId' => 0,
            'attributes'        => ['*' => ['delivery' => 'Verzenden'], '999' => ['delivery' => 'Ophalen of Verzenden']],
            'conditionAttribute'=> 'condition',
            'conditionMap'      => ['0' => 'Nieuw', '1' => 'Gebruikt'],
            'sendGpsr'          => true,
            'maxImages'         => 24,
            'referrerId'        => 0,
        ], $override);
    }

    public function testVollstaendigeAnzeige()
    {
        $result = AdMapper::map($this->variation(), $this->settings());

        $this->assertSame([], $result['problems']);
        $this->assertSame([], $result['warnings']);
        $this->assertSame([
            'categoryId'   => 999,
            'translations' => [[
                'locale'      => 'nl-NL',
                'title'       => 'Accuboormachine Bosch',
                'description' => "Nette staat\n\n- 18 V",
            ]],
            'priceModel'   => ['modelType' => 'fixed', 'askingPrice' => 4995],
            'location'     => ['postcode' => '1097DN'],
            'delivery'     => 'Ophalen of Verzenden',
            'condition'    => 'Gebruikt',
            'manufacturerTradename' => 'Bosch',
            'manufacturerAddress'   => 'Robert-Bosch-Platz 1, 70839 Gerlingen',
            'manufacturerEmail'     => 'info@bosch.example',
        ], $result['ad']);
        $this->assertSame(['https://cdn.example/1.jpg', 'https://cdn.example/2.jpg'], $result['imageUrls']);
    }

    public function testStandardkategorieHatVorrangVorWeiterenKategorien()
    {
        $this->assertSame(999, AdMapper::resolveCategory($this->variation(), $this->settings()));

        $ohneStandard = $this->variation(['variationDefaultCategory' => []]);
        $this->assertSame(1234, AdMapper::resolveCategory($ohneStandard, $this->settings()));
    }

    public function testRueckfallAufStandardkategorieUndFehlerOhneKategorie()
    {
        $settings = $this->settings(['categoryMap' => [], 'defaultCategoryId' => 77]);
        $this->assertSame(77, AdMapper::map($this->variation(), $settings)['ad']['categoryId']);

        $result = AdMapper::map($this->variation(), $this->settings(['categoryMap' => []]));
        $this->assertCount(1, $result['problems']);
        $this->assertStringContainsString('Kategorie', $result['problems'][0]);
    }

    public function testDeutscherTextAlsRueckfallMitHinweis()
    {
        $variation = $this->variation(['itemTexts' => [['lang' => 'de', 'name1' => 'Akkuschrauber', 'description' => '']]]);
        $result = AdMapper::map($variation, $this->settings());

        $this->assertSame([], $result['problems']);
        $this->assertSame('Akkuschrauber', $result['ad']['translations'][0]['title']);
        // Ohne Beschreibung steht der Titel drin – Marktplaats verlangt eine
        $this->assertSame('Akkuschrauber', $result['ad']['translations'][0]['description']);
        $this->assertStringContainsString('"nl"', $result['warnings'][0]);
    }

    public function testTextZeileOhneNameZaehltNicht()
    {
        $variation = $this->variation(['itemTexts' => [['lang' => 'nl', 'name1' => ' '], ['lang' => 'de', 'name1' => 'Tisch']]]);

        $this->assertSame('Tisch', AdMapper::map($variation, $this->settings())['ad']['translations'][0]['title']);
    }

    public function testOhneTextUndOhnePreisGibtEsProbleme()
    {
        $variation = $this->variation(['itemTexts' => [], 'variationSalesPrices' => []]);
        $result = AdMapper::map($variation, $this->settings());

        $this->assertGreaterThanOrEqual(2, count($result['problems']));
        $this->assertStringContainsString('Verkaufspreis 7', implode(' ', $result['problems']));
    }

    public function testPreismodelle()
    {
        $bieten = AdMapper::map($this->variation(['variationSalesPrices' => []]), $this->settings(['priceModel' => 'bidding']));
        $this->assertSame(['modelType' => 'bidding'], $bieten['ad']['priceModel']);
        $this->assertSame([], $bieten['problems']);

        $siehe = AdMapper::map($this->variation(), $this->settings(['priceModel' => 'see description']));
        $this->assertSame(['modelType' => 'see description'], $siehe['ad']['priceModel']);

        $unbekannt = AdMapper::map($this->variation(), $this->settings(['priceModel' => 'free']));
        $this->assertNotEmpty($unbekannt['problems']);
    }

    public function testPreisRundungAufCent()
    {
        $variation = $this->variation(['variationSalesPrices' => [['salesPriceId' => 7, 'price' => '19.999']]]);

        $this->assertSame(2000, AdMapper::map($variation, $this->settings())['ad']['priceModel']['askingPrice']);
    }

    public function testFusszeileUndVerkaeufer()
    {
        $settings = $this->settings([
            'descriptionFooter' => '<p>Ophalen in Venlo</p>',
            'seller' => ['sellerName' => 'Komplett Konzept', 'phoneNumber' => '+49 (0) 170-123', 'showEmail' => ''],
        ]);
        $ad = AdMapper::map($this->variation(), $settings)['ad'];

        $this->assertSame("Nette staat\n\n- 18 V\n\nOphalen in Venlo", $ad['translations'][0]['description']);
        $this->assertSame(['sellerName' => 'Komplett Konzept', 'phoneNumber' => '+490170123'], $ad['seller']);
    }

    public function testAttributeKoennenKernfelderNichtUeberschreiben()
    {
        $settings = $this->settings(['attributes' => ['*' => ['categoryId' => 1, 'priceModel' => 'x', 'color' => 'Rood']]]);
        $ad = AdMapper::map($this->variation(), $settings)['ad'];

        $this->assertSame(999, $ad['categoryId']);
        $this->assertSame('fixed', $ad['priceModel']['modelType']);
        $this->assertSame('Rood', $ad['color']);
    }

    public function testGpsrRueckfallBeiUnvollstaendigemHersteller()
    {
        $settings = $this->settings(['manufacturerFallback' => ['tradename' => 'KK GmbH', 'address' => 'Hauptstr. 1, 12345 Ort', 'email' => 'info@kk.example']]);

        $ohneEmail = $this->variation(['manufacturer' => ['name' => 'NoName', 'street' => 'Weg', 'houseNo' => '2', 'postcode' => '1', 'town' => 'X']]);
        $this->assertSame([
            'manufacturerTradename' => 'NoName',
            'manufacturerAddress'   => 'Weg 2, 1 X',
            'manufacturerEmail'     => 'info@kk.example',
        ], AdMapper::gpsr($ohneEmail, $settings));

        $ohneHersteller = $this->variation(['manufacturer' => []]);
        $this->assertSame('KK GmbH', AdMapper::gpsr($ohneHersteller, $settings)['manufacturerTradename']);

        $aus = AdMapper::map($this->variation(), $this->settings(['sendGpsr' => false]))['ad'];
        $this->assertArrayNotHasKey('manufacturerTradename', $aus);
    }

    public function testVariantenbilderVorArtikelbildernUndHoechstzahl()
    {
        $variation = $this->variation(['images' => [['position' => 0, 'url' => '//cdn.example/v.png', 'fileType' => 'png']]]);
        $this->assertSame(['https://cdn.example/v.png'], AdMapper::pickImages($variation, $this->settings()));

        $this->assertSame(['https://cdn.example/1.jpg'], AdMapper::pickImages($this->variation(), $this->settings(['maxImages' => 1])));
    }

    public function testNurFreigegebeneBilderWennFreigabeGesetzt()
    {
        $variation = $this->variation(['itemImages' => [
            ['position' => 1, 'url' => 'https://cdn.example/a.jpg', 'availabilities' => [['type' => 'mandant', 'value' => 1]]],
            ['position' => 2, 'url' => 'https://cdn.example/b.jpg', 'availabilities' => [['type' => 'marketplace', 'value' => 104.01]]],
        ]]);

        $this->assertSame(['https://cdn.example/b.jpg'], AdMapper::pickImages($variation, $this->settings(['referrerId' => 104.01])));
        // Ohne passende Freigabe: alle Bilder
        $this->assertCount(2, AdMapper::pickImages($variation, $this->settings(['referrerId' => 200])));
    }

    public function testFehlendePostleitzahl()
    {
        $result = AdMapper::map($this->variation(), $this->settings(['postcode' => '']));
        $this->assertStringContainsString('Postleitzahl', implode(' ', $result['problems']));

        $zuLang = AdMapper::map($this->variation(), $this->settings(['postcode' => '1097 DN X']));
        $this->assertStringContainsString('zu lang', implode(' ', $zuLang['problems']));
    }

    public function testHashIstStabilUndTrenntAnzeigeUndBilder()
    {
        $a = AdMapper::map($this->variation(), $this->settings());
        $b = AdMapper::map($this->variation(), $this->settings());
        $this->assertSame($a['hash'], $b['hash']);

        $andereBilder = AdMapper::map($this->variation(['images' => [['url' => 'https://cdn.example/x.jpg']]]), $this->settings());
        list($adA, $imgA) = AdMapper::splitHash($a['hash']);
        list($adB, $imgB) = AdMapper::splitHash($andereBilder['hash']);
        $this->assertSame($adA, $adB);
        $this->assertNotSame($imgA, $imgB);
    }
}
