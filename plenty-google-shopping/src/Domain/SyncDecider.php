<?php

namespace ShoppingSync\Domain;

/**
 * Die Regeln aus der Anforderung, an einer Stelle:
 *
 *   neu + freigegeben + Bestand > 0  → hinzufügen
 *   Produktdaten geändert            → aktualisieren
 *   Bestand = 0                      → "nicht vorrätig" (oder löschen, je nach Einstellung)
 *   shopping_ads entfernt / inaktiv  → bei Google löschen
 *   Produkt gelöscht                 → bei Google löschen
 *
 * Reine Logik ohne Plenty und ohne Google – deshalb vollständig getestet.
 */
class SyncDecider
{
    /** @var Settings */
    private $settings;

    public function __construct(Settings $settings)
    {
        $this->settings = $settings;
    }

    /**
     * @param SourceProduct|null $product null = Variante existiert in Plenty nicht (mehr)
     * @param MappingResult|null $mapping null, wenn nicht freigegeben (dann wird nicht abgebildet)
     * @param array|null $state bisheriger Stand: status, hash, syncedAt, outOfStockSince
     */
    public function decide($product, $mapping, $state, int $now, bool $force = false): SyncDecision
    {
        $known = $state !== null;

        if ($product === null) {
            return $known
                ? SyncDecision::delete('Variante existiert in Plenty nicht mehr.')
                : SyncDecision::none('Variante existiert nicht.');
        }

        $release = $this->releaseProblem($product);
        if ($release !== null) {
            return $known ? SyncDecision::delete($release) : SyncDecision::none($release);
        }

        if ($mapping === null || !$mapping->isValid()) {
            $errors = $mapping === null ? ['Keine Abbildung möglich.'] : $mapping->errors;
            $reason = 'Daten unvollständig: ' . implode(' ', $errors);

            // Lieber gar nicht werben als mit veraltetem Preis oder Text.
            return $known ? SyncDecision::delete($reason, true) : SyncDecision::error($reason);
        }

        $inStock = $product->stockNet > 0;
        $hash = $mapping->hash();

        if ($inStock) {
            if (!$known) {
                return SyncDecision::upsert(SyncDecision::INSERT, 'Neu freigegeben, Bestand vorhanden.', $mapping, $hash);
            }
            if (($state['status'] ?? '') !== SyncDecision::STATUS_ACTIVE) {
                return SyncDecision::upsert(SyncDecision::UPDATE, 'Wieder auf Lager.', $mapping, $hash);
            }
            if (($state['hash'] ?? '') !== $hash) {
                return SyncDecision::upsert(SyncDecision::UPDATE, 'Produktdaten geändert.', $mapping, $hash);
            }
            if ($this->isDueForRefresh($state, $now) || $force) {
                return SyncDecision::upsert(SyncDecision::UPDATE, 'Regelmäßige Auffrischung (Google lässt Produkte nach 30 Tagen verfallen).', $mapping, $hash);
            }

            return SyncDecision::none('Unverändert.');
        }

        // Kein Bestand.
        if (!$known) {
            return SyncDecision::none('Kein Bestand – wird erst mit Bestand übertragen.');
        }
        if ($this->settings->stockZeroAction === Settings::STOCK_ZERO_DELETE) {
            return SyncDecision::delete('Bestand 0 – laut Einstellung bei Google entfernen.');
        }

        $outOfStockSince = $state['outOfStockSince'] ?? null;
        if (($state['status'] ?? '') !== SyncDecision::STATUS_OUT_OF_STOCK) {
            return SyncDecision::upsert(SyncDecision::OUT_OF_STOCK, 'Bestand 0 – bei Google als nicht vorrätig markiert.', $mapping, $hash);
        }

        $days = $this->settings->deleteAfterDaysOutOfStock;
        if ($days > 0 && $outOfStockSince !== null && $now - (int) $outOfStockSince >= $days * 86400) {
            return SyncDecision::delete("Seit über {$days} Tagen nicht vorrätig – bei Google entfernt.");
        }
        if (($state['hash'] ?? '') !== $hash || $this->isDueForRefresh($state, $now) || $force) {
            return SyncDecision::upsert(SyncDecision::OUT_OF_STOCK, 'Nicht vorrätig, Daten aufgefrischt.', $mapping, $hash);
        }

        return SyncDecision::none('Nicht vorrätig, unverändert.');
    }

    /**
     * Warum die Variante nicht (mehr) zu Google gehört – oder null, wenn sie dorthin gehört.
     *
     * @return string|null
     */
    public function releaseProblem(SourceProduct $product)
    {
        if (!in_array($this->settings->releaseTag, $product->tags, true)) {
            return "Tag \"{$this->settings->releaseTag}\" nicht (mehr) gesetzt.";
        }
        if (!$product->isActive) {
            return 'Variante ist in Plenty inaktiv.';
        }
        if (!$this->settings->isPilotItem($product->itemId)) {
            return 'Artikel ist nicht in der Pilot-Liste.';
        }

        return null;
    }

    private function isDueForRefresh(array $state, int $now): bool
    {
        $syncedAt = (int) ($state['syncedAt'] ?? 0);

        return $now - $syncedAt >= $this->settings->refreshAfterDays * 86400;
    }
}
