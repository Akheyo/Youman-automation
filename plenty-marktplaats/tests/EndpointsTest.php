<?php

use Marktplaats\Mapping\Endpoints;
use PHPUnit\Framework\TestCase;

class EndpointsTest extends TestCase
{
    public function testAuthorizeUrl()
    {
        $url = Endpoints::authorizeUrl('production', 'client 1', 'https://shop.example/markets/marktplaats/auth/callback', 'abc');

        $this->assertSame(
            'https://auth.marktplaats.nl/accounts/oauth/authorize?response_type=code&client_id=client+1'
            . '&redirect_uri=https%3A%2F%2Fshop.example%2Fmarkets%2Fmarktplaats%2Fauth%2Fcallback&state=abc',
            $url
        );
    }

    public function testSandboxUndUnbekannteUmgebung()
    {
        $this->assertSame('https://auth.demo.qa-mp.so/accounts/oauth/token', Endpoints::tokenUrl('sandbox'));
        $this->assertSame('https://auth.marktplaats.nl/accounts/oauth/token', Endpoints::tokenUrl('irgendwas'));
    }

    public function testApiUrlMitUndOhneEigeneAdresse()
    {
        $this->assertSame('https://api.marktplaats.nl/v2/advertisements', Endpoints::apiUrl('production', '/advertisements'));
        $this->assertSame('https://api.test.example/v2/me', Endpoints::apiUrl('sandbox', 'me', 'https://api.test.example/v2/'));
    }
}
