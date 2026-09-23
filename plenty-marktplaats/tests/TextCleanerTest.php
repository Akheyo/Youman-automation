<?php

use Marktplaats\Mapping\TextCleaner;
use PHPUnit\Framework\TestCase;

class TextCleanerTest extends TestCase
{
    public function testHtmlWirdZuTextMitAbsaetzenUndListen()
    {
        $html = "<h2>Bosch Akkuschrauber</h2>\n<p>Sehr guter&nbsp;Zustand &amp; komplett.</p><ul><li>18 V</li><li>2 Akkus</li></ul><p>Abholung<br>oder Versand</p>";

        $this->assertSame(
            "Bosch Akkuschrauber\n\nSehr guter Zustand & komplett.\n\n- 18 V\n- 2 Akkus\n\nAbholung\noder Versand",
            TextCleaner::htmlToText($html)
        );
    }

    public function testUmbruecheImHtmlQuelltextZaehlenNicht()
    {
        $this->assertSame('Zeile eins geht weiter', TextCleaner::htmlToText("Zeile eins\n   geht weiter"));
    }

    public function testLeererTextBleibtLeer()
    {
        $this->assertSame('', TextCleaner::htmlToText(null));
        $this->assertSame('', TextCleaner::htmlToText('<p> </p>'));
    }

    public function testTitelWirdAnWortgrenzeGekuerzt()
    {
        $title = TextCleaner::title('Makita DHP482 Akku-Schlagbohrschrauber 18V inklusive zwei Akkus und Ladegeraet im Koffer');

        $this->assertLessThanOrEqual(60, mb_strlen($title));
        $this->assertSame('Makita DHP482 Akku-Schlagbohrschrauber 18V inklusive zwei', $title);
    }

    public function testKurzerTitelBleibtUnveraendert()
    {
        $this->assertSame('Stuhl <b>massiv</b>', TextCleaner::title('Stuhl &lt;b&gt;massiv&lt;/b&gt;'));
        $this->assertSame('Stuhl massiv', TextCleaner::title('<b>Stuhl</b>   massiv'));
    }

    public function testLangesWortOhneLeerzeichenWirdHartGekuerzt()
    {
        $this->assertSame(str_repeat('a', 60), TextCleaner::title(str_repeat('a', 80)));
    }

    public function testUmlauteZaehlenAlsEinZeichen()
    {
        $this->assertSame(str_repeat('ü', 60), TextCleaner::title(str_repeat('ü', 61)));
    }
}
