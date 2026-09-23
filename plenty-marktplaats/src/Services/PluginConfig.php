<?php

namespace Marktplaats\Services;

use Marktplaats\Mapping\Endpoints;
use Marktplaats\Mapping\SettingsParser;
use Marktplaats\Repositories\SettingsRepository;
use Plenty\Plugin\ConfigRepository;

/**
 * Liest die Plugin-Konfiguration (Plugins > Plugin-Set > Marktplaats) und
 * bereitet sie fuer AdMapper und den Abgleich auf.
 */
class PluginConfig
{
    const PREFIX = 'Marktplaats.';

    /** @var ConfigRepository */
    private $config;

    /** @var SettingsRepository */
    private $settings;

    /** @var array|null */
    private $mapperSettings = null;

    /** @var string[] */
    private $errors = [];

    public function __construct(ConfigRepository $config, SettingsRepository $settings)
    {
        $this->config = $config;
        $this->settings = $settings;
    }

    public function get(string $key, $default = '')
    {
        $value = $this->config->get(self::PREFIX . $key, $default);

        return $value === null ? $default : $value;
    }

    public function flag(string $key, bool $default): bool
    {
        $value = $this->get($key, $default ? 'true' : 'false');
        if (is_bool($value)) {
            return $value;
        }

        return in_array(strtolower(trim((string)$value)), ['1', 'true', 'yes', 'ja', 'on'], true);
    }

    public function number(string $key, int $default): int
    {
        $value = trim((string)$this->get($key, (string)$default));

        return is_numeric($value) ? (int)$value : $default;
    }

    public function environment(): string
    {
        return Endpoints::environment((string)$this->get('environment', Endpoints::PRODUCTION));
    }

    public function clientId(): string
    {
        return trim((string)$this->get('clientId'));
    }

    public function clientSecret(): string
    {
        return trim((string)$this->get('clientSecret'));
    }

    public function apiUrlOverride(): string
    {
        return trim((string)$this->get('apiUrl'));
    }

    public function autoSync(): bool
    {
        return $this->flag('autoSync', true);
    }

    public function requireStock(): bool
    {
        return $this->flag('requireStock', true);
    }

    public function deleteWhenGone(): bool
    {
        return $this->flag('deleteWhenGone', true);
    }

    public function maxPerRun(): int
    {
        return max(1, $this->number('maxPerRun', 100));
    }

    /**
     * Einstellungen im Format, das AdMapper::map erwartet.
     */
    public function mapperSettings(): array
    {
        if ($this->mapperSettings !== null) {
            return $this->mapperSettings;
        }

        $this->errors = [];

        $categoryMap = SettingsParser::categoryMap($this->get('categoryMap'));
        $attributes = SettingsParser::jsonObject($this->get('attributes'), 'Attribute');
        $conditionMap = SettingsParser::jsonObject($this->get('conditionMap'), 'Zustandszuordnung');
        $this->errors = array_merge($categoryMap['fehler'], $attributes['fehler'], $conditionMap['fehler']);

        $this->mapperSettings = [
            'locale'             => 'nl-NL',
            'languages'          => SettingsParser::languages($this->get('languages', 'nl, de')),
            'titleField'         => (string)$this->get('titleField', 'name1'),
            'salesPriceId'       => $this->number('salesPriceId', 0),
            'priceModel'         => (string)$this->get('priceModel', 'fixed'),
            'postcode'           => (string)$this->get('postcode'),
            'categoryMap'        => $categoryMap['map'],
            'defaultCategoryId'  => $this->number('defaultCategoryId', 0),
            'attributes'         => $attributes['wert'],
            'conditionAttribute' => trim((string)$this->get('conditionAttribute', 'condition')),
            'conditionMap'       => $conditionMap['wert'],
            'sendGpsr'           => $this->flag('sendGpsr', true),
            'manufacturerFallback' => [
                'tradename' => (string)$this->get('gpsrTradename'),
                'address'   => (string)$this->get('gpsrAddress'),
                'email'     => (string)$this->get('gpsrEmail'),
            ],
            'seller' => [
                'sellerName'  => (string)$this->get('sellerName'),
                'phoneNumber' => (string)$this->get('phoneNumber'),
            ],
            'descriptionFooter'  => (string)$this->get('descriptionFooter'),
            'maxImages'          => $this->number('maxImages', 24),
            'referrerId'         => $this->settings->referrerId(),
        ];

        return $this->mapperSettings;
    }

    /**
     * Fehler beim Lesen der Freitextfelder (kaputtes JSON, unlesbare Zeilen).
     *
     * @return string[]
     */
    public function errors(): array
    {
        $this->mapperSettings();

        return $this->errors;
    }
}
