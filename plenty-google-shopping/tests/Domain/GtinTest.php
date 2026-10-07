<?php

namespace ShoppingSync\Tests\Domain;

use PHPUnit\Framework\TestCase;
use ShoppingSync\Domain\Gtin;

class GtinTest extends TestCase
{
    public function testAcceptsRealManufacturerEan13(): void
    {
        $this->assertSame('4006381333931', Gtin::normalize('4006381333931'));
        $this->assertSame('4006381333931', Gtin::normalize(' 400-6381-333931 '));
    }

    public function testAcceptsUpcAndGtin14(): void
    {
        $this->assertSame('036000291452', Gtin::normalize('036000291452'));
        $this->assertSame('10036000291459', Gtin::normalize('10036000291459'));
    }

    public function testRejectsInternalEanFromErfassung(): void
    {
        // Präfix 20, korrekt gebildete Prüfziffer – trotzdem kein Hersteller-Code.
        $this->assertTrue(Gtin::hasValidCheckDigit('2000000254333'));
        $this->assertNull(Gtin::normalize('2000000254333'));
        $this->assertNull(Gtin::normalize('2912345678906'));
    }

    public function testRejectsOtherRestrictedRanges(): void
    {
        $this->assertNull(Gtin::normalize('212345678909'));   // UPC 2x
        $this->assertNull(Gtin::normalize('9812345678902'));  // Gutschein
        $this->assertNull(Gtin::normalize('20123451'));       // RCN-8
    }

    public function testRejectsWrongCheckDigitAndGarbage(): void
    {
        $this->assertNull(Gtin::normalize('4006381333932'));
        $this->assertNull(Gtin::normalize('0000000000000'));
        $this->assertNull(Gtin::normalize('ABC'));
        $this->assertNull(Gtin::normalize('12345'));
        $this->assertNull(Gtin::normalize(''));
    }

    public function testFilterKeepsOnlyTransferableCodesOnce(): void
    {
        $this->assertSame(
            ['4006381333931'],
            Gtin::filter(['2000000254333', '4006381333931', '4006381333931', 'x'])
        );
    }
}
