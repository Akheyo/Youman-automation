<?php

use Marktplaats\Mapping\SyncPlanner;
use PHPUnit\Framework\TestCase;

class SyncPlannerTest extends TestCase
{
    private function mapped(string $hash = 'ad1:img1', array $problems = []): array
    {
        return ['hash' => $hash, 'problems' => $problems];
    }

    private function listing(array $override = []): array
    {
        return array_merge(['mpItemId' => 'm123', 'status' => 'online', 'adHash' => 'ad1', 'imageHash' => 'img1', 'errorType' => ''], $override);
    }

    public function testNeueVarianteWirdAngelegt()
    {
        $this->assertSame(SyncPlanner::CREATE, SyncPlanner::decide(null, true, $this->mapped()));
        $this->assertSame(SyncPlanner::CREATE, SyncPlanner::decide($this->listing(['status' => 'removed']), true, $this->mapped()));
        $this->assertSame(SyncPlanner::CREATE, SyncPlanner::decide($this->listing(['mpItemId' => '']), true, $this->mapped()));
    }

    public function testUnveraendertPassiertNichts()
    {
        $this->assertSame(SyncPlanner::NONE, SyncPlanner::decide($this->listing(), true, $this->mapped()));
    }

    public function testAenderungen()
    {
        $this->assertSame(SyncPlanner::UPDATE, SyncPlanner::decide($this->listing(), true, $this->mapped('ad2:img1')));
        $this->assertSame(SyncPlanner::IMAGES, SyncPlanner::decide($this->listing(), true, $this->mapped('ad1:img2')));
    }

    public function testNichtMehrGewuenschtWirdGeloescht()
    {
        $this->assertSame(SyncPlanner::DELETE, SyncPlanner::decide($this->listing(), false));
        $this->assertSame(SyncPlanner::NONE, SyncPlanner::decide($this->listing(['status' => 'removed']), false));
        $this->assertSame(SyncPlanner::NONE, SyncPlanner::decide(null, false));
    }

    public function testProblemeVerhindernUpload()
    {
        $this->assertSame(SyncPlanner::INVALID, SyncPlanner::decide(null, true, $this->mapped('a:b', ['Preis fehlt'])));
    }

    public function testValidierungsfehlerWirdNichtStuendlichWiederholt()
    {
        $fehler = $this->listing(['mpItemId' => '', 'status' => 'error', 'errorType' => 'validation']);
        $this->assertSame(SyncPlanner::NONE, SyncPlanner::decide($fehler, true, $this->mapped()));
        // ... aber sobald sich die Daten aendern
        $this->assertSame(SyncPlanner::CREATE, SyncPlanner::decide($fehler, true, $this->mapped('ad9:img1')));

        // Voruebergehende Fehler werden wiederholt
        $voruebergehend = $this->listing(['status' => 'error', 'errorType' => 'transient']);
        $this->assertSame(SyncPlanner::UPDATE, SyncPlanner::decide($voruebergehend, true, $this->mapped()));
    }

    public function testWanted()
    {
        $this->assertTrue(SyncPlanner::wanted(true, true, 3, true));
        $this->assertFalse(SyncPlanner::wanted(true, true, 0, true));
        $this->assertFalse(SyncPlanner::wanted(true, true, null, true));
        $this->assertTrue(SyncPlanner::wanted(true, true, 0, false));
        $this->assertFalse(SyncPlanner::wanted(false, true, 3, true));
        $this->assertFalse(SyncPlanner::wanted(true, false, 3, true));
    }

    public function testFehlertext()
    {
        $body = [
            'code' => 'validation-failure',
            'message' => 'Validatie mislukt',
            'details' => [
                ['field' => 'title', 'code' => 'input-too-long', 'value' => '60'],
                ['fields' => ['a', 'b'], 'code' => 'a-b-c'],
            ],
        ];

        $this->assertSame('validation-failure (Validatie mislukt): title: input-too-long (60); a/b: a-b-c', SyncPlanner::describeError(400, $body));
        $this->assertSame('HTTP 502: Bad Gateway', SyncPlanner::describeError(502, '<h1>Bad Gateway</h1>'));
    }

    public function testUnbekannteFelder()
    {
        $nurUnbekannt = ['details' => [
            ['field' => 'manufacturerEmail', 'code' => 'unknown-field'],
            ['field' => 'delivery', 'code' => 'unknown-field'],
        ]];
        $this->assertSame(['manufacturerEmail', 'delivery'], SyncPlanner::unknownFields($nurUnbekannt));

        $gemischt = ['details' => [
            ['field' => 'delivery', 'code' => 'unknown-field'],
            ['field' => 'title', 'code' => 'input-too-long'],
        ]];
        $this->assertSame([], SyncPlanner::unknownFields($gemischt));

        $kernfeld = ['details' => [['field' => 'categoryId', 'code' => 'unknown-field']]];
        $this->assertSame([], SyncPlanner::unknownFields($kernfeld));
    }

    public function testFehlerart()
    {
        $this->assertSame('transient', SyncPlanner::errorType(503));
        $this->assertSame('transient', SyncPlanner::errorType(0));
        $this->assertSame('transient', SyncPlanner::errorType(401));
        $this->assertSame('validation', SyncPlanner::errorType(400));
    }
}
