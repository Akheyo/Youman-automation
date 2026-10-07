<?php

namespace ShoppingSync\Domain;

/**
 * Die komplette, geprüfte Plugin-Konfiguration.
 *
 * Wird aus den Rohwerten der Plenty-Plugin-Konfiguration gebaut. Fehler
 * werden gesammelt statt geworfen: Ein Tippfehler im Markt "FR" darf den
 * laufenden Markt "DE" nicht anhalten.
 */
class Settings
{
    const STOCK_ZERO_OUT_OF_STOCK = 'out_of_stock';
    const STOCK_ZERO_DELETE = 'delete';

    const DEFAULT_CONDITION_MAP = [
        '0' => 'NEW',   // Neu
        '1' => 'USED',  // Gebraucht
        '2' => 'NEW',   // Neu & OVP
        '3' => 'NEW',   // Neu mit Etikett
        '4' => 'USED',  // B-Ware
    ];

    /** @var bool */
    public $enabled = false;
    /** @var bool Alles berechnen und protokollieren, aber nichts an Google senden */
    public $dryRun = true;
    /** @var string */
    public $merchantId = '';
    /** @var string */
    public $dataSourceId = '';
    /** @var string Service-Account-Schlüssel als JSON */
    public $serviceAccountJson = '';
    /** @var string */
    public $releaseTag = 'shopping_ads';
    /** @var int[] Leer = alle freigegebenen Artikel; sonst nur diese Plenty-Artikel-IDs */
    public $pilotItemIds = [];
    /** @var string */
    public $offerIdPrefix = '';
    /** @var string name1|name2|name3 */
    public $titleField = 'name1';
    /** @var string */
    public $stockZeroAction = self::STOCK_ZERO_OUT_OF_STOCK;
    /** @var int 0 = nie automatisch löschen */
    public $deleteAfterDaysOutOfStock = 30;
    /** @var int Google lässt Produkte nach 30 Tagen ohne Update verfallen */
    public $refreshAfterDays = 20;
    /** @var int */
    public $maxAdditionalImages = 10;
    /** @var int[] Leer = alle Vertriebslager */
    public $warehouseIds = [];
    /** @var array<string, string> Plenty-Zustand-ID → NEW|USED|REFURBISHED */
    public $conditionMap = self::DEFAULT_CONDITION_MAP;
    /** @var array<string, ProductTypeConfig> */
    public $types = [];
    /** @var MarketConfig[] */
    public $markets = [];
    /** @var string[] */
    public $errors = [];

    public static function fromConfig(array $raw): Settings
    {
        $s = new self();

        $s->enabled = self::bool($raw['global.enabled'] ?? false);
        $s->dryRun = self::bool($raw['global.dryRun'] ?? true);
        $s->merchantId = preg_replace('/\D+/', '', (string) ($raw['google.merchantId'] ?? ''));
        $s->dataSourceId = preg_replace('/\D+/', '', (string) ($raw['google.dataSourceId'] ?? ''));
        $s->serviceAccountJson = trim((string) ($raw['google.serviceAccountJson'] ?? ''));
        $s->releaseTag = trim((string) ($raw['sync.releaseTag'] ?? '')) ?: 'shopping_ads';
        $s->pilotItemIds = self::intList($raw['sync.pilotItemIds'] ?? '');
        $s->offerIdPrefix = trim((string) ($raw['sync.offerIdPrefix'] ?? ''));
        $s->warehouseIds = self::intList($raw['sync.warehouseIds'] ?? '');

        $titleField = trim((string) ($raw['sync.titleField'] ?? 'name1'));
        $s->titleField = in_array($titleField, ['name1', 'name2', 'name3'], true) ? $titleField : 'name1';

        $action = trim((string) ($raw['sync.stockZeroAction'] ?? self::STOCK_ZERO_OUT_OF_STOCK));
        $s->stockZeroAction = $action === self::STOCK_ZERO_DELETE ? self::STOCK_ZERO_DELETE : self::STOCK_ZERO_OUT_OF_STOCK;
        $s->deleteAfterDaysOutOfStock = max(0, (int) ($raw['sync.deleteAfterDaysOutOfStock'] ?? 30));
        $s->refreshAfterDays = min(29, max(1, (int) ($raw['sync.refreshAfterDays'] ?? 20)));
        $s->maxAdditionalImages = min(10, max(0, (int) ($raw['sync.maxAdditionalImages'] ?? 10)));

        if ($s->offerIdPrefix !== '' && !preg_match('/^[A-Za-z0-9_-]{1,20}$/', $s->offerIdPrefix)) {
            $s->errors[] = 'Offer-ID-Präfix darf nur A–Z, 0–9, - und _ enthalten (max. 20 Zeichen).';
            $s->offerIdPrefix = '';
        }

        $s->parseConditionMap($raw['mapping.conditions'] ?? '');
        $s->parseTypes($raw['mapping.types'] ?? '');
        $s->parseMarkets($raw['mapping.markets'] ?? '');

        return $s;
    }

    /**
     * Fehlt etwas, ohne das gar nicht synchronisiert werden kann?
     *
     * @return string[]
     */
    public function blockingProblems(): array
    {
        $problems = [];
        if (!$this->enabled) {
            $problems[] = 'Synchronisierung ist in der Plugin-Konfiguration ausgeschaltet.';
        }
        if (!$this->dryRun) {
            if ($this->merchantId === '') {
                $problems[] = 'Merchant-Center-ID fehlt.';
            }
            if ($this->dataSourceId === '') {
                $problems[] = 'Datenquellen-ID (API-Datenquelle im Merchant Center) fehlt.';
            }
            if ($this->serviceAccountJson === '') {
                $problems[] = 'Service-Account-Schlüssel fehlt.';
            }
        }
        if ($this->types === []) {
            $problems[] = 'Keine gültige Produktgruppe konfiguriert.';
        }
        if ($this->activeMarkets() === []) {
            $problems[] = 'Kein aktiver, gültiger Markt konfiguriert.';
        }

        return $problems;
    }

    /**
     * @return MarketConfig[]
     */
    public function activeMarkets(): array
    {
        return array_values(array_filter($this->markets, function (MarketConfig $m) {
            return $m->active;
        }));
    }

    public function isPilotItem(int $itemId): bool
    {
        return $this->pilotItemIds === [] || in_array($itemId, $this->pilotItemIds, true);
    }

    public function offerId(int $variationId): string
    {
        return $this->offerIdPrefix . $variationId;
    }

    private function parseConditionMap($rawValue)
    {
        $rawValue = trim((string) $rawValue);
        if ($rawValue === '') {
            return;
        }
        $data = json_decode($rawValue, true);
        if (!is_array($data)) {
            $this->errors[] = 'Zustands-Zuordnung ist kein gültiges JSON – Standard wird verwendet.';
            return;
        }

        $map = [];
        foreach ($data as $plentyId => $rawGoogleValue) {
            $googleValue = strtoupper(trim((string) $rawGoogleValue));
            if (!in_array($googleValue, ['NEW', 'USED', 'REFURBISHED'], true)) {
                $this->errors[] = "Zustand {$plentyId}: \"{$rawGoogleValue}\" ist nicht erlaubt (NEW, USED oder REFURBISHED).";
                continue;
            }
            $map[(string) $plentyId] = $googleValue;
        }
        $this->conditionMap = $map;
    }

    private function parseTypes($rawValue)
    {
        $data = json_decode(trim((string) $rawValue), true);
        if (!is_array($data)) {
            $this->errors[] = 'Produktgruppen sind kein gültiges JSON.';
            return;
        }
        foreach ($data as $tag => $entry) {
            $type = ProductTypeConfig::fromArray((string) $tag, $entry, $this->errors);
            if ($type !== null) {
                $this->types[$type->tag] = $type;
            }
        }
    }

    private function parseMarkets($rawValue)
    {
        $data = json_decode(trim((string) $rawValue), true);
        if (!is_array($data)) {
            $this->errors[] = 'Märkte sind kein gültiges JSON.';
            return;
        }
        $seen = [];
        foreach ($data as $entry) {
            $market = MarketConfig::fromArray($entry, $this->errors);
            if ($market === null) {
                continue;
            }
            $key = $market->contentLanguage . '~' . $market->feedLabel;
            if (isset($seen[$key])) {
                $this->errors[] = "Markt {$market->country}: Sprache {$market->contentLanguage} mit Feed-Label {$market->feedLabel} ist doppelt konfiguriert.";
                continue;
            }
            $seen[$key] = true;
            $this->markets[] = $market;
        }
    }

    /**
     * @return int[]
     */
    private static function intList($value): array
    {
        $result = [];
        foreach (preg_split('/[\s,;]+/', (string) $value) as $part) {
            if ($part !== '' && ctype_digit($part)) {
                $result[] = (int) $part;
            }
        }

        return array_values(array_unique($result));
    }

    private static function bool($value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        return in_array(strtolower(trim((string) $value)), ['1', 'true', 'yes', 'ja', 'on'], true);
    }
}
