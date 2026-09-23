<?php

namespace Marktplaats\Api;

use Marktplaats\Mapping\Endpoints;
use Marktplaats\Repositories\SettingsRepository;
use Marktplaats\Services\PluginConfig;
use Plenty\Modules\Plugin\Libs\Contracts\LibraryCallContract;
use Plenty\Plugin\Log\Loggable;

/**
 * Zugriff auf die Marktplaats-API v2 inklusive OAuth2-Tokenverwaltung.
 *
 * Access-Tokens gelten 24 Stunden, Refresh-Tokens laufen nicht ab, werden aber
 * bei jeder Erneuerung ausgetauscht – deshalb wird der neue sofort gespeichert.
 */
class MarktplaatsClient
{
    use Loggable;

    const LIB = 'Marktplaats::marktplaats_http';

    /** Token 5 Minuten vor Ablauf erneuern */
    const REFRESH_MARGIN = 300;

    /** @var LibraryCallContract */
    private $library;

    /** @var PluginConfig */
    private $config;

    /** @var SettingsRepository */
    private $settings;

    public function __construct(LibraryCallContract $library, PluginConfig $config, SettingsRepository $settings)
    {
        $this->library = $library;
        $this->config = $config;
        $this->settings = $settings;
    }

    public function isConnected(): bool
    {
        return $this->settings->get(SettingsRepository::REFRESH_TOKEN) !== '';
    }

    /**
     * Aufruf der API. Bei 401 wird das Token einmal erneuert und wiederholt.
     *
     * @param mixed $body Array fuer JSON-Body, null fuer keinen
     * @return array ['status' => int, 'body' => array|string, 'error' => string]
     */
    public function request(string $method, string $path, $body = null): array
    {
        $token = $this->accessToken(false);
        if ($token === '') {
            return ['status' => 401, 'body' => '', 'error' => 'Nicht mit Marktplaats verbunden.'];
        }

        $response = $this->send($method, $path, $body, $token);
        if ($response['status'] === 401) {
            $token = $this->accessToken(true);
            if ($token !== '') {
                $response = $this->send($method, $path, $body, $token);
            }
        }

        return $response;
    }

    private function send(string $method, string $path, $body, string $token): array
    {
        $params = [
            'method'  => $method,
            'url'     => Endpoints::apiUrl($this->config->environment(), $path, $this->config->apiUrlOverride()),
            'headers' => ['Authorization' => 'Bearer ' . $token],
        ];
        if ($body !== null) {
            $params['json'] = $body;
        }

        return $this->call($params);
    }

    /**
     * Code aus dem OAuth-Rueckruf gegen Tokens tauschen und speichern.
     *
     * @return string Fehlermeldung, leer bei Erfolg
     */
    public function exchangeCode(string $code, string $redirectUri): string
    {
        $response = $this->call([
            'method' => 'POST',
            'url'    => Endpoints::tokenUrl($this->config->environment()),
            'form'   => [
                'grant_type'    => 'authorization_code',
                'code'          => $code,
                'client_id'     => $this->config->clientId(),
                'client_secret' => $this->config->clientSecret(),
                'redirect_uri'  => $redirectUri,
            ],
        ]);

        if (!$this->storeTokens($response)) {
            return $this->tokenError($response);
        }
        $this->settings->set(SettingsRepository::CONNECTED_ENVIRONMENT, $this->config->environment());
        $this->settings->set(SettingsRepository::CONNECTED_AT, (string)time());

        return '';
    }

    public function disconnect()
    {
        foreach ([
            SettingsRepository::ACCESS_TOKEN,
            SettingsRepository::ACCESS_TOKEN_EXPIRES,
            SettingsRepository::REFRESH_TOKEN,
            SettingsRepository::CONNECTED_ENVIRONMENT,
            SettingsRepository::CONNECTED_AT,
        ] as $name) {
            $this->settings->forget($name);
        }
    }

    /**
     * Gueltiges Access-Token, bei Bedarf erneuert. Leer, wenn keine Verbindung besteht.
     */
    public function accessToken(bool $forceRefresh): string
    {
        $token = $this->settings->get(SettingsRepository::ACCESS_TOKEN);
        $expires = (int)$this->settings->get(SettingsRepository::ACCESS_TOKEN_EXPIRES, '0');
        if (!$forceRefresh && $token !== '' && $expires - self::REFRESH_MARGIN > time()) {
            return $token;
        }

        $refreshToken = $this->settings->get(SettingsRepository::REFRESH_TOKEN);
        if ($refreshToken === '') {
            return '';
        }

        $response = $this->call([
            'method' => 'POST',
            'url'    => Endpoints::tokenUrl($this->config->environment()),
            'form'   => [
                'grant_type'    => 'refresh_token',
                'refresh_token' => $refreshToken,
                'client_id'     => $this->config->clientId(),
                'client_secret' => $this->config->clientSecret(),
            ],
        ]);

        if (!$this->storeTokens($response)) {
            $this->getLogger('MarktplaatsClient')->error('Marktplaats::log.tokenRefreshFailed', ['error' => $this->tokenError($response)]);

            return '';
        }

        return $this->settings->get(SettingsRepository::ACCESS_TOKEN);
    }

    private function storeTokens(array $response): bool
    {
        $body = is_array($response['body']) ? $response['body'] : [];
        if ($response['status'] !== 200 || empty($body['access_token'])) {
            return false;
        }

        $this->settings->set(SettingsRepository::ACCESS_TOKEN, (string)$body['access_token']);
        $this->settings->set(
            SettingsRepository::ACCESS_TOKEN_EXPIRES,
            (string)(time() + (int)(isset($body['expires_in']) ? $body['expires_in'] : 86400))
        );
        if (!empty($body['refresh_token'])) {
            $this->settings->set(SettingsRepository::REFRESH_TOKEN, (string)$body['refresh_token']);
        }

        return true;
    }

    private function tokenError(array $response): string
    {
        $body = $response['body'];
        if (is_array($body)) {
            $text = isset($body['error_description']) ? $body['error_description'] : (isset($body['error']) ? $body['error'] : json_encode($body));
        } else {
            $text = $response['error'] !== '' ? $response['error'] : (string)$body;
        }

        return 'Anmeldung bei Marktplaats fehlgeschlagen (HTTP ' . $response['status'] . '): ' . $text;
    }

    private function call(array $params): array
    {
        $response = $this->library->call(self::LIB, $params);

        // Die SDK-Umgebung selbst kann scheitern (z. B. nicht erreichbar) – dann fehlt "status"
        if (!array_key_exists('status', $response)) {
            return [
                'status' => 0,
                'body'   => '',
                'error'  => 'Externe SDK-Umgebung hat nicht geantwortet: ' . json_encode($response),
            ];
        }

        return [
            'status' => (int)$response['status'],
            'body'   => isset($response['body']) ? $response['body'] : '',
            'error'  => isset($response['error']) ? (string)$response['error'] : '',
        ];
    }
}
