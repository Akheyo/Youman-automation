<?php

namespace Marktplaats\Mapping;

/**
 * Adressen der Marktplaats-API je Umgebung.
 * Quelle: https://api.marktplaats.nl/docs/v2/authentication.html
 */
class Endpoints
{
    const PRODUCTION = 'production';
    const SANDBOX = 'sandbox';

    const AUTH_HOSTS = [
        self::PRODUCTION => 'https://auth.marktplaats.nl',
        self::SANDBOX    => 'https://auth.demo.qa-mp.so',
    ];

    const API_HOSTS = [
        self::PRODUCTION => 'https://api.marktplaats.nl',
        // Marktplaats nennt die Sandbox-API-Adresse zusammen mit den Zugangsdaten;
        // weicht sie ab, in der Konfiguration unter "API-Adresse" eintragen.
        self::SANDBOX    => 'https://api.demo.qa-mp.so',
    ];

    public static function environment($value): string
    {
        return $value === self::SANDBOX ? self::SANDBOX : self::PRODUCTION;
    }

    public static function authorizeUrl(string $environment, string $clientId, string $redirectUri, string $state): string
    {
        return self::AUTH_HOSTS[self::environment($environment)] . '/accounts/oauth/authorize?' . http_build_query([
            'response_type' => 'code',
            'client_id'     => $clientId,
            'redirect_uri'  => $redirectUri,
            'state'         => $state,
        ]);
    }

    public static function tokenUrl(string $environment): string
    {
        return self::AUTH_HOSTS[self::environment($environment)] . '/accounts/oauth/token';
    }

    /**
     * @param string $override API-Adresse aus der Konfiguration (leer = Standard der Umgebung)
     */
    public static function apiUrl(string $environment, string $path, string $override = ''): string
    {
        $base = trim($override) !== '' ? trim($override) : self::API_HOSTS[self::environment($environment)];
        $base = preg_replace('#/+$#', '', $base);
        // Wer ".../v2" eintraegt, soll kein ".../v2/v2" bekommen
        $base = preg_replace('#/v2$#', '', $base);

        return $base . '/v2/' . ltrim($path, '/');
    }
}
