<?php

namespace Marktplaats\Services;

use Plenty\Modules\Helper\Services\WebstoreHelper;

/**
 * Rueckruf-Adresse fuer die Marktplaats-Anmeldung. Sie muss bei Marktplaats
 * genau so hinterlegt sein, deshalb wird sie in der Oberflaeche angezeigt.
 */
class RedirectUri
{
    const PATH = '/markets/marktplaats/auth/callback';

    /** @var WebstoreHelper */
    private $webstoreHelper;

    /** @var PluginConfig */
    private $config;

    public function __construct(WebstoreHelper $webstoreHelper, PluginConfig $config)
    {
        $this->webstoreHelper = $webstoreHelper;
        $this->config = $config;
    }

    public function get(): string
    {
        $override = trim((string)$this->config->get('redirectUri'));
        if ($override !== '') {
            return $override;
        }

        $domain = rtrim((string)$this->webstoreHelper->getCurrentWebstoreConfiguration()->domainSsl, '/');
        if ($domain !== '' && strpos($domain, 'http') !== 0) {
            $domain = 'https://' . $domain;
        }

        return $domain . self::PATH;
    }
}
