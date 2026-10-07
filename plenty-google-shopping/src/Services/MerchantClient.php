<?php

namespace ShoppingSync\Services;

use Plenty\Modules\Plugin\Libs\Contracts\LibraryCallContract;
use ShoppingSync\Domain\Settings;

/**
 * Ruft die Bibliothek resources/lib/merchant_api.php auf.
 */
class MerchantClient
{
    /** @var LibraryCallContract */
    private $library;

    public function __construct(LibraryCallContract $library)
    {
        $this->library = $library;
    }

    /**
     * @param array $operations Liste aus {ref, op: insert, productInput} | {ref, op: delete, segment}
     * @return array{ok: bool, error?: string, results?: array}
     */
    public function batch(Settings $settings, array $operations): array
    {
        if ($operations === []) {
            return ['ok' => true, 'results' => []];
        }

        return $this->call($settings, ['action' => 'batch', 'operations' => $operations]);
    }

    /**
     * @return array{ok: bool, error?: string, products?: array, nextPageToken?: string|null}
     */
    public function listProducts(Settings $settings, $pageToken = null): array
    {
        return $this->call($settings, ['action' => 'list_products', 'pageToken' => $pageToken]);
    }

    public function registerGcp(Settings $settings, string $developerEmail): array
    {
        return $this->call($settings, ['action' => 'register_gcp', 'developerEmail' => $developerEmail]);
    }

    public function ping(Settings $settings): array
    {
        return $this->call($settings, ['action' => 'ping']);
    }

    private function call(Settings $settings, array $params): array
    {
        try {
            $result = $this->library->call('ShoppingSync::merchant_api', array_merge([
                'credentials' => $settings->serviceAccountJson,
                'merchantId' => $settings->merchantId,
                'dataSourceId' => $settings->dataSourceId,
            ], $params));
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => 'Bibliotheksaufruf fehlgeschlagen: ' . $e->getMessage()];
        }

        if (!is_array($result) || !array_key_exists('ok', $result)) {
            // Plenty gibt Fehler im Bibliotheksskript als {error: true, message: …} zurück.
            $message = is_array($result) ? ($result['message'] ?? json_encode($result)) : 'keine Antwort';

            return ['ok' => false, 'error' => 'Unerwartete Antwort der Bibliothek: ' . $message];
        }

        return $result;
    }
}
