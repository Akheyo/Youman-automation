<?php

/**
 * Externe Bibliothek für die Google Merchant API (products/v1).
 *
 * Plenty führt Aufrufe nach außen in diesen Bibliotheks-Skripten aus
 * (LibraryCallContract → "ShoppingSync::merchant_api"). Ein Aufruf holt ein
 * Zugriffstoken für den Service-Account und arbeitet dann eine ganze Liste
 * von Operationen ab – so gibt es pro Sync-Lauf nur einen Token-Abruf.
 *
 * Parameter:
 *   action          "batch" | "list_products" | "ping" | "register_gcp"
 *   credentials     Service-Account-Schlüssel (JSON-String)
 *   merchantId      Merchant-Center-Konto-ID
 *   dataSourceId    ID der API-Datenquelle
 *   operations      (batch) Liste aus {ref, op: "insert", productInput} | {ref, op: "delete", segment}
 *   pageToken       (list_products) optional
 *   developerEmail  (register_gcp) Google-Konto, das API-Hinweise von Google bekommt
 */

const SSYNC_API_BASE = 'https://merchantapi.googleapis.com/products/v1';
const SSYNC_ACCOUNTS_BASE = 'https://merchantapi.googleapis.com/accounts/v1';
const SSYNC_SCOPE = 'https://www.googleapis.com/auth/content';

if (!function_exists('ssync_main')) {
    /**
     * @param callable|null $http function(string $method, string $url, array $headers, ?string $body): array{0:int,1:string}
     */
    function ssync_main(array $params, $http = null): array
    {
        $http = $http ?: 'ssync_guzzle';

        $merchantId = preg_replace('/\D+/', '', (string) ($params['merchantId'] ?? ''));
        $dataSourceId = preg_replace('/\D+/', '', (string) ($params['dataSourceId'] ?? ''));
        if ($merchantId === '') {
            return ['ok' => false, 'error' => 'Merchant-Center-ID fehlt.'];
        }

        try {
            $token = ssync_access_token((string) ($params['credentials'] ?? ''), $http);
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => 'Anmeldung bei Google fehlgeschlagen: ' . $e->getMessage()];
        }

        $account = 'accounts/' . $merchantId;
        $action = (string) ($params['action'] ?? '');

        if ($action === 'ping' || $action === 'list_products') {
            $query = ['pageSize' => $action === 'ping' ? 1 : 250];
            if (!empty($params['pageToken'])) {
                $query['pageToken'] = (string) $params['pageToken'];
            }
            $response = ssync_request($http, 'GET', SSYNC_API_BASE . '/' . $account . '/products?' . http_build_query($query), $token);
            if (!$response['ok']) {
                return ['ok' => false, 'error' => $response['error'], 'status' => $response['status']];
            }

            return [
                'ok' => true,
                'products' => $response['body']['products'] ?? [],
                'nextPageToken' => $response['body']['nextPageToken'] ?? null,
            ];
        }

        if ($action === 'register_gcp') {
            // Einmalig nötig: Das Cloud-Projekt des Service-Accounts beim
            // Merchant-Center-Konto als Entwickler registrieren.
            $response = ssync_request($http, 'POST', SSYNC_ACCOUNTS_BASE . '/' . $account . '/developerRegistration:registerGcp', $token, [
                'developerEmail' => (string) ($params['developerEmail'] ?? ''),
            ]);

            return $response['ok']
                ? ['ok' => true, 'registration' => $response['body']]
                : ['ok' => false, 'error' => $response['error'], 'status' => $response['status']];
        }

        if ($action !== 'batch') {
            return ['ok' => false, 'error' => 'Unbekannte Aktion: ' . $action];
        }
        if ($dataSourceId === '') {
            return ['ok' => false, 'error' => 'Datenquellen-ID fehlt.'];
        }

        $dataSource = $account . '/dataSources/' . $dataSourceId;
        $results = [];
        foreach ((array) ($params['operations'] ?? []) as $operation) {
            $ref = $operation['ref'] ?? null;
            $op = (string) ($operation['op'] ?? '');

            if ($op === 'insert') {
                $url = SSYNC_API_BASE . '/' . $account . '/productInputs:insert?' . http_build_query(['dataSource' => $dataSource]);
                $response = ssync_request($http, 'POST', $url, $token, $operation['productInput'] ?? []);
            } elseif ($op === 'delete') {
                $segment = rawurlencode((string) ($operation['segment'] ?? ''));
                $url = SSYNC_API_BASE . '/' . $account . '/productInputs/' . $segment . '?' . http_build_query(['dataSource' => $dataSource]);
                $response = ssync_request($http, 'DELETE', $url, $token);
                // Schon weg ist für uns dasselbe wie gelöscht.
                if ($response['status'] === 404) {
                    $response = ['ok' => true, 'status' => 404, 'body' => [], 'error' => null];
                }
            } else {
                $response = ['ok' => false, 'status' => 0, 'body' => [], 'error' => 'Unbekannte Operation: ' . $op];
            }

            $results[] = [
                'ref' => $ref,
                'ok' => $response['ok'],
                'status' => $response['status'],
                'error' => $response['error'],
            ];
        }

        return ['ok' => true, 'results' => $results];
    }

    function ssync_access_token(string $credentialsJson, $http): string
    {
        $credentials = json_decode($credentialsJson, true);
        if (!is_array($credentials) || empty($credentials['client_email']) || empty($credentials['private_key'])) {
            throw new \RuntimeException('Service-Account-Schlüssel ist ungültig (client_email/private_key fehlen).');
        }

        $tokenUri = $credentials['token_uri'] ?? 'https://oauth2.googleapis.com/token';
        $now = time();
        $jwt = ssync_jwt([
            'iss' => $credentials['client_email'],
            'scope' => SSYNC_SCOPE,
            'aud' => $tokenUri,
            'iat' => $now,
            'exp' => $now + 3600,
        ], $credentials['private_key']);

        [$status, $body] = $http('POST', $tokenUri, ['Content-Type' => 'application/x-www-form-urlencoded'], http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt,
        ]));
        $data = json_decode($body, true);
        if ($status !== 200 || empty($data['access_token'])) {
            $reason = $data['error_description'] ?? ($data['error'] ?? ('HTTP ' . $status));
            throw new \RuntimeException((string) $reason);
        }

        return (string) $data['access_token'];
    }

    function ssync_jwt(array $claims, string $privateKey): string
    {
        $segments = [
            ssync_base64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT'])),
            ssync_base64url(json_encode($claims)),
        ];
        $signature = '';
        $key = openssl_pkey_get_private($privateKey);
        if ($key === false || !openssl_sign(implode('.', $segments), $signature, $key, OPENSSL_ALGO_SHA256)) {
            throw new \RuntimeException('Privater Schlüssel kann nicht gelesen werden.');
        }
        $segments[] = ssync_base64url($signature);

        return implode('.', $segments);
    }

    function ssync_base64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * @return array{ok: bool, status: int, body: array, error: string|null}
     */
    function ssync_request($http, string $method, string $url, string $token, $json = null): array
    {
        $headers = ['Authorization' => 'Bearer ' . $token, 'Accept' => 'application/json'];
        $body = null;
        if ($json !== null) {
            $headers['Content-Type'] = 'application/json';
            $body = json_encode($json, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        try {
            [$status, $raw] = $http($method, $url, $headers, $body);
        } catch (\Throwable $e) {
            return ['ok' => false, 'status' => 0, 'body' => [], 'error' => 'Verbindung zu Google fehlgeschlagen: ' . $e->getMessage()];
        }

        $decoded = json_decode((string) $raw, true);
        $decoded = is_array($decoded) ? $decoded : [];
        if ($status >= 200 && $status < 300) {
            return ['ok' => true, 'status' => $status, 'body' => $decoded, 'error' => null];
        }

        $message = $decoded['error']['message'] ?? trim(substr((string) $raw, 0, 500));

        return ['ok' => false, 'status' => $status, 'body' => $decoded, 'error' => 'HTTP ' . $status . ': ' . $message];
    }

    function ssync_guzzle(string $method, string $url, array $headers, $body): array
    {
        $client = new \GuzzleHttp\Client(['timeout' => 30, 'http_errors' => false]);
        $options = ['headers' => $headers];
        if ($body !== null) {
            $options['body'] = $body;
        }
        $response = $client->request($method, $url, $options);

        return [$response->getStatusCode(), (string) $response->getBody()];
    }
}

if (class_exists('SdkRestApi')) {
    return ssync_main([
        'action' => SdkRestApi::getParam('action'),
        'credentials' => SdkRestApi::getParam('credentials'),
        'merchantId' => SdkRestApi::getParam('merchantId'),
        'dataSourceId' => SdkRestApi::getParam('dataSourceId'),
        'operations' => SdkRestApi::getParam('operations'),
        'pageToken' => SdkRestApi::getParam('pageToken'),
        'developerEmail' => SdkRestApi::getParam('developerEmail'),
    ]);
}
