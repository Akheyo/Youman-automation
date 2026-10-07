<?php

namespace ShoppingSync\Tests\Lib;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../resources/lib/merchant_api.php';

class MerchantApiLibTest extends TestCase
{
    /** @var string */
    private static $privateKey;
    /** @var string */
    private static $publicKey;

    public static function setUpBeforeClass(): void
    {
        $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($key, $pem);
        self::$privateKey = $pem;
        self::$publicKey = openssl_pkey_get_details($key)['key'];
    }

    private function credentials(): string
    {
        return json_encode([
            'type' => 'service_account',
            'client_email' => 'shopping-sync@projekt.iam.gserviceaccount.com',
            'private_key' => self::$privateKey,
            'token_uri' => 'https://oauth2.googleapis.com/token',
        ]);
    }

    /**
     * Fake-HTTP: zeichnet Aufrufe auf und antwortet aus einer Liste.
     */
    private function fakeHttp(array &$calls, array $responses): callable
    {
        return function (string $method, string $url, array $headers, $body) use (&$calls, &$responses) {
            $calls[] = compact('method', 'url', 'headers', 'body');
            if (strpos($url, 'oauth2.googleapis.com/token') !== false) {
                return [200, json_encode(['access_token' => 'ya29.test', 'expires_in' => 3600])];
            }

            return array_shift($responses) ?? [500, '{}'];
        };
    }

    public function testJwtIsSignedWithServiceAccountKey(): void
    {
        $jwt = \ssync_jwt(['iss' => 'a', 'aud' => 'b'], self::$privateKey);
        [$header, $claims, $signature] = explode('.', $jwt);

        $this->assertSame(['alg' => 'RS256', 'typ' => 'JWT'], json_decode(base64_decode(strtr($header, '-_', '+/')), true));
        $this->assertSame(1, openssl_verify(
            $header . '.' . $claims,
            base64_decode(strtr($signature, '-_', '+/')),
            self::$publicKey,
            OPENSSL_ALGO_SHA256
        ));
    }

    public function testBatchInsertAndDelete(): void
    {
        $calls = [];
        $http = $this->fakeHttp($calls, [
            [200, '{"name":"accounts/123/productInputs/de~DE~31207"}'],
            [404, '{"error":{"message":"not found"}}'],
            [400, '{"error":{"message":"Invalid price"}}'],
        ]);

        $result = \ssync_main([
            'action' => 'batch',
            'credentials' => $this->credentials(),
            'merchantId' => '123',
            'dataSourceId' => '456',
            'operations' => [
                ['ref' => 0, 'op' => 'insert', 'productInput' => ['offerId' => '31207', 'contentLanguage' => 'de', 'feedLabel' => 'DE', 'productAttributes' => ['title' => 'Klimaprüfschrank']]],
                ['ref' => 1, 'op' => 'delete', 'segment' => 'de~DE~31208'],
                ['ref' => 2, 'op' => 'insert', 'productInput' => ['offerId' => '31209']],
            ],
        ], $http);

        $this->assertTrue($result['ok']);
        $this->assertCount(4, $calls, 'ein Token-Abruf + drei Operationen');

        $token = $calls[0];
        $this->assertSame('POST', $token['method']);
        parse_str($token['body'], $form);
        $this->assertSame('urn:ietf:params:oauth:grant-type:jwt-bearer', $form['grant_type']);
        $claims = json_decode(base64_decode(strtr(explode('.', $form['assertion'])[1], '-_', '+/')), true);
        $this->assertSame('https://www.googleapis.com/auth/content', $claims['scope']);

        $insert = $calls[1];
        $this->assertSame('POST', $insert['method']);
        $this->assertSame(
            'https://merchantapi.googleapis.com/products/v1/accounts/123/productInputs:insert?dataSource=accounts%2F123%2FdataSources%2F456',
            $insert['url']
        );
        $this->assertSame('Bearer ya29.test', $insert['headers']['Authorization']);
        $this->assertStringContainsString('"title":"Klimaprüfschrank"', $insert['body']);

        $delete = $calls[2];
        $this->assertSame('DELETE', $delete['method']);
        $this->assertSame(
            'https://merchantapi.googleapis.com/products/v1/accounts/123/productInputs/de~DE~31208?dataSource=accounts%2F123%2FdataSources%2F456',
            $delete['url']
        );

        $this->assertSame(
            [
                ['ref' => 0, 'ok' => true, 'status' => 200, 'error' => null],
                ['ref' => 1, 'ok' => true, 'status' => 404, 'error' => null],
                ['ref' => 2, 'ok' => false, 'status' => 400, 'error' => 'HTTP 400: Invalid price'],
            ],
            $result['results']
        );
    }

    public function testInvalidCredentialsFailWholeCall(): void
    {
        $calls = [];
        $result = \ssync_main(['action' => 'batch', 'credentials' => '{}', 'merchantId' => '1', 'dataSourceId' => '2'], $this->fakeHttp($calls, []));

        $this->assertFalse($result['ok']);
        $this->assertStringContainsString('Service-Account-Schlüssel ist ungültig', $result['error']);
        $this->assertSame([], $calls);
    }

    public function testRejectedTokenIsReported(): void
    {
        $http = function () {
            return [400, '{"error":"invalid_grant","error_description":"Invalid JWT Signature."}'];
        };

        $result = \ssync_main(['action' => 'ping', 'credentials' => $this->credentials(), 'merchantId' => '1'], $http);

        $this->assertFalse($result['ok']);
        $this->assertSame('Anmeldung bei Google fehlgeschlagen: Invalid JWT Signature.', $result['error']);
    }

    public function testListProductsPaginates(): void
    {
        $calls = [];
        $http = $this->fakeHttp($calls, [[200, '{"products":[{"offerId":"31207"}],"nextPageToken":"abc"}']]);

        $result = \ssync_main(['action' => 'list_products', 'credentials' => $this->credentials(), 'merchantId' => '123', 'pageToken' => 'xyz'], $http);

        $this->assertTrue($result['ok']);
        $this->assertSame([['offerId' => '31207']], $result['products']);
        $this->assertSame('abc', $result['nextPageToken']);
        $this->assertSame('https://merchantapi.googleapis.com/products/v1/accounts/123/products?pageSize=250&pageToken=xyz', $calls[1]['url']);
    }

    public function testRegisterGcp(): void
    {
        $calls = [];
        $http = $this->fakeHttp($calls, [[200, '{"name":"accounts/123/developerRegistration","gcpIds":["42"]}']]);

        $result = \ssync_main(['action' => 'register_gcp', 'credentials' => $this->credentials(), 'merchantId' => '123', 'developerEmail' => 'team@firma.de'], $http);

        $this->assertTrue($result['ok']);
        $this->assertSame('https://merchantapi.googleapis.com/accounts/v1/accounts/123/developerRegistration:registerGcp', $calls[1]['url']);
        $this->assertSame('{"developerEmail":"team@firma.de"}', $calls[1]['body']);
    }
}
