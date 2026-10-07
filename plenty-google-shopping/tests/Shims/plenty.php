<?php
/**
 * Minimale Ersatzklassen für die wenigen Plenty-Typen, die der Sync-Ablauf
 * zur Laufzeit wirklich berührt. So läuft SyncService in Tests ohne Plenty.
 */

namespace Plenty\Plugin\Log {
    trait Loggable
    {
        private function getLogger($identifier)
        {
            return new \ShoppingSync\Tests\Integration\NullLogger();
        }
    }
}

namespace Plenty\Plugin {
    abstract class ConfigRepository
    {
        abstract public function get(string $key, $default = null);
    }
}

namespace Plenty\Modules\Plugin\DataBase\Contracts {
    abstract class Model
    {
    }

    interface DataBase
    {
    }
}

namespace Plenty\Modules\Plugin\Libs\Contracts {
    interface LibraryCallContract
    {
        public function call(string $libCall, array $params = []): array;
    }
}

namespace {
    if (!function_exists('pluginApp')) {
        function pluginApp($abstract, array $parameters = [])
        {
            return new $abstract(...array_values($parameters));
        }
    }
}
