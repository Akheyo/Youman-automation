<?php

namespace Marktplaats\Controllers;

use Marktplaats\Api\MarktplaatsClient;
use Marktplaats\Mapping\Endpoints;
use Marktplaats\Repositories\ListingRepository;
use Marktplaats\Repositories\SettingsRepository;
use Marktplaats\Services\PluginConfig;
use Marktplaats\Services\RedirectUri;
use Plenty\Plugin\Controller;
use Plenty\Plugin\Http\Request;
use Plenty\Plugin\Http\Response;

class AuthController extends Controller
{
    /** Wie lange ein Anmeldevorgang gueltig ist */
    const STATE_SECONDS = 900;

    /** @var MarktplaatsClient */
    private $client;
    /** @var PluginConfig */
    private $config;
    /** @var SettingsRepository */
    private $settings;
    /** @var RedirectUri */
    private $redirectUri;

    public function __construct(MarktplaatsClient $client, PluginConfig $config, SettingsRepository $settings, RedirectUri $redirectUri)
    {
        $this->client = $client;
        $this->config = $config;
        $this->settings = $settings;
        $this->redirectUri = $redirectUri;
    }

    /**
     * GET /rest/markets/marktplaats/status
     */
    public function status(ListingRepository $listings): array
    {
        $connectedEnvironment = $this->settings->get(SettingsRepository::CONNECTED_ENVIRONMENT);

        return [
            'connected'            => $this->client->isConnected(),
            'connectedEnvironment' => $connectedEnvironment,
            'connectedAt'          => (int)$this->settings->get(SettingsRepository::CONNECTED_AT, '0'),
            'environment'          => $this->config->environment(),
            'environmentMismatch'  => $connectedEnvironment !== '' && $connectedEnvironment !== $this->config->environment(),
            'credentialsSet'       => $this->config->clientId() !== '' && $this->config->clientSecret() !== '',
            'redirectUri'          => $this->redirectUri->get(),
            'referrerId'           => $this->settings->referrerId(),
            'autoSync'             => $this->config->autoSync(),
            'lastSync'             => $this->settings->getJson(SettingsRepository::LAST_SYNC),
            'counts'               => $listings->counts(),
            'configErrors'         => $this->config->errors(),
        ];
    }

    /**
     * GET /rest/markets/marktplaats/auth/login-url
     */
    public function loginUrl(Response $response)
    {
        if ($this->config->clientId() === '' || $this->config->clientSecret() === '') {
            return $response->json(['error' => 'Client-ID und Client-Secret zuerst in der Konfiguration eintragen.'], 400);
        }

        $state = sha1(uniqid((string)mt_rand(), true) . microtime());
        $this->settings->set(SettingsRepository::OAUTH_STATE, $state);
        $this->settings->set(SettingsRepository::OAUTH_STATE_EXPIRES, (string)(time() + self::STATE_SECONDS));

        return [
            'url'         => Endpoints::authorizeUrl($this->config->environment(), $this->config->clientId(), $this->redirectUri->get(), $state),
            'redirectUri' => $this->redirectUri->get(),
        ];
    }

    /**
     * DELETE /rest/markets/marktplaats/auth
     */
    public function disconnect(): array
    {
        $this->client->disconnect();

        return ['connected' => false];
    }

    /**
     * GET /markets/marktplaats/auth/callback  (oeffentlich – hierher leitet Marktplaats nach der Anmeldung)
     */
    public function callback(Request $request, Response $response)
    {
        $expected = $this->settings->get(SettingsRepository::OAUTH_STATE);
        $expires = (int)$this->settings->get(SettingsRepository::OAUTH_STATE_EXPIRES, '0');
        $state = (string)$request->get('state', '');

        if ((string)$request->get('error', '') !== '') {
            return $this->page($response, false, 'Marktplaats hat die Anmeldung abgelehnt: '
                . $request->get('error') . ' ' . $request->get('error_description', ''));
        }
        if ($expected === '' || $state === '' || $state !== $expected || $expires < time()) {
            return $this->page($response, false, 'Der Anmeldevorgang ist abgelaufen oder ungueltig. Bitte in Plenty erneut auf "Verbinden" klicken.');
        }
        // Jeder Anmeldevorgang gilt nur einmal
        $this->settings->forget(SettingsRepository::OAUTH_STATE);

        $code = (string)$request->get('code', '');
        if ($code === '') {
            return $this->page($response, false, 'Marktplaats hat keinen Code zurueckgegeben.');
        }

        $error = $this->client->exchangeCode($code, $this->redirectUri->get());
        if ($error !== '') {
            return $this->page($response, false, $error);
        }

        return $this->page($response, true, 'Plenty ist jetzt mit Marktplaats verbunden. Dieses Fenster kann geschlossen werden.');
    }

    private function page(Response $response, bool $ok, string $message)
    {
        $text = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
        $color = $ok ? '#1a7f37' : '#b42318';
        $status = $ok ? 'ok' : 'error';
        $html = '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Marktplaats</title></head>'
            . '<body style="font-family:sans-serif;max-width:560px;margin:60px auto;padding:0 16px">'
            . '<h2 style="color:' . $color . '">' . ($ok ? 'Verbunden' : 'Nicht verbunden') . '</h2>'
            . '<p>' . $text . '</p>'
            . '<script>try{window.opener&&window.opener.postMessage({marktplaatsAuth:"' . $status . '"},"*");'
            . ($ok ? 'setTimeout(function(){window.close()},1500);' : '') . '}catch(e){}</script>'
            . '</body></html>';

        return $response->make($html, $ok ? 200 : 400, ['Content-Type' => 'text/html; charset=utf-8']);
    }
}
