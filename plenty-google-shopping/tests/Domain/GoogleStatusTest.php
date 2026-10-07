<?php

namespace ShoppingSync\Tests\Domain;

use PHPUnit\Framework\TestCase;
use ShoppingSync\Domain\GoogleStatus;

class GoogleStatusTest extends TestCase
{
    public function testPlainSegment(): void
    {
        $this->assertSame('de~DE~31207', GoogleStatus::productSegment('de', 'DE', '31207'));
    }

    public function testSpecialCharactersAreBase64UrlEncoded(): void
    {
        // Beispiel aus der Google-Doku: en~US~sku/123 → ZW5-VVN-c2t1LzEyMw
        $this->assertSame('ZW5-VVN-c2t1LzEyMw', GoogleStatus::productSegment('en', 'US', 'sku/123'));
    }

    public function testSummarizesShoppingAdsStatusPerCountry(): void
    {
        $product = ['productStatus' => [
            'destinationStatuses' => [
                ['reportingContext' => 'FREE_LISTINGS', 'disapprovedCountries' => ['DE']],
                ['reportingContext' => 'SHOPPING_ADS', 'approvedCountries' => ['DE'], 'pendingCountries' => ['AT']],
            ],
            'itemLevelIssues' => [
                ['severity' => 'DEMOTED', 'attribute' => 'gtin', 'description' => 'Missing GTIN', 'applicableCountries' => ['DE']],
                ['severity' => 'DISAPPROVED', 'attribute' => 'link', 'description' => 'Broken link', 'detail' => '404', 'applicableCountries' => ['FR']],
            ],
        ]];

        $de = GoogleStatus::summarize($product, 'DE');
        $this->assertSame(GoogleStatus::APPROVED, $de['status']);
        $this->assertSame([['severity' => 'DEMOTED', 'attribute' => 'gtin', 'description' => 'Missing GTIN']], $de['issues']);

        $this->assertSame(GoogleStatus::PENDING, GoogleStatus::summarize($product, 'AT')['status']);
        $this->assertSame(GoogleStatus::UNKNOWN, GoogleStatus::summarize($product, 'NL')['status']);
    }

    public function testDisapprovedWins(): void
    {
        $product = ['productStatus' => ['destinationStatuses' => [
            ['reportingContext' => 'SHOPPING_ADS', 'disapprovedCountries' => ['DE'], 'approvedCountries' => ['DE']],
        ]]];

        $this->assertSame(GoogleStatus::DISAPPROVED, GoogleStatus::summarize($product, 'DE')['status']);
    }
}
