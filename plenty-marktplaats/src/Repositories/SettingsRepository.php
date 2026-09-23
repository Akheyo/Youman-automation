<?php

namespace Marktplaats\Repositories;

use Marktplaats\Models\Setting;
use Plenty\Modules\Plugin\DataBase\Contracts\DataBase;

/**
 * Laufzeitwerte des Plugins (nicht die Konfiguration – die liegt im Plugin-Set).
 */
class SettingsRepository
{
    const REFERRER_ID = 'referrerId';
    const ACCESS_TOKEN = 'accessToken';
    const ACCESS_TOKEN_EXPIRES = 'accessTokenExpiresAt';
    const REFRESH_TOKEN = 'refreshToken';
    const OAUTH_STATE = 'oauthState';
    const OAUTH_STATE_EXPIRES = 'oauthStateExpiresAt';
    const CONNECTED_ENVIRONMENT = 'connectedEnvironment';
    const CONNECTED_AT = 'connectedAt';
    const LAST_SYNC = 'lastSync';
    const SYNC_LOCK = 'syncLock';

    /** @var DataBase */
    private $database;

    public function __construct(DataBase $database)
    {
        $this->database = $database;
    }

    public function get(string $name, string $default = ''): string
    {
        $rows = $this->database->query(Setting::class)->where('name', '=', $name)->get();

        return count($rows) > 0 ? (string)$rows[0]->value : $default;
    }

    public function set(string $name, string $value)
    {
        /** @var Setting $setting */
        $setting = pluginApp(Setting::class);
        $setting->name = $name;
        $setting->value = $value;
        $this->database->save($setting);
    }

    public function forget(string $name)
    {
        $rows = $this->database->query(Setting::class)->where('name', '=', $name)->get();
        foreach ($rows as $row) {
            $this->database->delete($row);
        }
    }

    public function getJson(string $name): array
    {
        $value = json_decode($this->get($name), true);

        return is_array($value) ? $value : [];
    }

    public function setJson(string $name, array $value)
    {
        $this->set($name, (string)json_encode($value));
    }

    public function referrerId(): float
    {
        return (float)$this->get(self::REFERRER_ID, '0');
    }
}
