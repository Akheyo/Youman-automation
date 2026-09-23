<?php

use Marktplaats\Mapping\SettingsParser;
use PHPUnit\Framework\TestCase;

class SettingsParserTest extends TestCase
{
    public function testKategoriezuordnungVerstehtVerschiedeneSchreibweisen()
    {
        $result = SettingsParser::categoryMap("# Werkzeug\n12 = 345\n13:346\r\n 14 => 347  # Kommentar\n\n");

        $this->assertSame([12 => 345, 13 => 346, 14 => 347], $result['map']);
        $this->assertSame([], $result['fehler']);
    }

    public function testKaputteZeileWirdGemeldetRestGilt()
    {
        $result = SettingsParser::categoryMap("12 = 345\nWerkzeug = 346");

        $this->assertSame([12 => 345], $result['map']);
        $this->assertCount(1, $result['fehler']);
        $this->assertStringContainsString('Zeile 2', $result['fehler'][0]);
    }

    public function testJsonObjekt()
    {
        $this->assertSame(['wert' => ['*' => ['delivery' => 'Verzenden']], 'fehler' => []],
            SettingsParser::jsonObject('{"*": {"delivery": "Verzenden"}}', 'Attribute'));
        $this->assertSame(['wert' => [], 'fehler' => []], SettingsParser::jsonObject('  ', 'Attribute'));

        $kaputt = SettingsParser::jsonObject('{delivery: Verzenden}', 'Attribute');
        $this->assertSame([], $kaputt['wert']);
        $this->assertStringContainsString('Attribute', $kaputt['fehler'][0]);
    }

    public function testSprachen()
    {
        $this->assertSame(['nl', 'de'], SettingsParser::languages('NL, de; nl xx1'));
        $this->assertSame(['nl'], SettingsParser::languages(''));
    }

    public function testPostleitzahl()
    {
        $this->assertSame('1097DN', SettingsParser::postcode(' 1097 dn '));
    }
}
