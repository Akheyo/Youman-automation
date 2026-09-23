<?php

namespace Marktplaats\Repositories;

use Marktplaats\Models\Listing;
use Plenty\Modules\Plugin\DataBase\Contracts\DataBase;

class ListingRepository
{
    /** @var DataBase */
    private $database;

    public function __construct(DataBase $database)
    {
        $this->database = $database;
    }

    /**
     * @return Listing|null
     */
    public function find(int $variationId)
    {
        $rows = $this->database->query(Listing::class)->where('variationId', '=', $variationId)->get();

        return count($rows) > 0 ? $rows[0] : null;
    }

    /**
     * Alle Eintraege als Arrays, nach Variante indiziert.
     *
     * @return array<int, array>
     */
    public function allByVariation(): array
    {
        $result = [];
        foreach ($this->database->query(Listing::class)->get() as $listing) {
            $result[(int)$listing->variationId] = self::toArray($listing);
        }

        return $result;
    }

    /**
     * Fuer die Uebersicht: neueste Aenderung zuerst, optional nach Status gefiltert.
     */
    public function page(int $page, int $perPage, string $status = ''): array
    {
        // Zwei getrennte Abfragen: count() soll die Seitenabfrage nicht veraendern
        $total = $this->filtered($status)->count();
        $rows = $this->filtered($status)->orderBy('syncedAt', 'desc')->forPage(max(1, $page), $perPage)->get();

        $entries = [];
        foreach ($rows as $row) {
            $entries[] = self::toArray($row);
        }

        return ['total' => $total, 'page' => max(1, $page), 'perPage' => $perPage, 'entries' => $entries];
    }

    private function filtered(string $status)
    {
        $query = $this->database->query(Listing::class);

        return $status !== '' ? $query->where('status', '=', $status) : $query;
    }

    public function counts(): array
    {
        $counts = ['online' => 0, 'error' => 0, 'removed' => 0];
        foreach (array_keys($counts) as $status) {
            $counts[$status] = $this->database->query(Listing::class)->where('status', '=', $status)->count();
        }

        return $counts;
    }

    public function save(array $data): Listing
    {
        $listing = $this->find((int)$data['variationId']);
        if ($listing === null) {
            /** @var Listing $listing */
            $listing = pluginApp(Listing::class);
            $listing->variationId = (int)$data['variationId'];
        }

        foreach (['itemId', 'price', 'syncedAt'] as $int) {
            if (array_key_exists($int, $data)) {
                $listing->{$int} = (int)$data[$int];
            }
        }
        foreach (['mpItemId', 'status', 'adHash', 'imageHash', 'errorType', 'lastError', 'warnings', 'title'] as $string) {
            if (array_key_exists($string, $data)) {
                $listing->{$string} = (string)$data[$string];
            }
        }

        $this->database->save($listing);

        return $listing;
    }

    public static function toArray($listing): array
    {
        return [
            'variationId' => (int)$listing->variationId,
            'itemId'      => (int)$listing->itemId,
            'mpItemId'    => (string)$listing->mpItemId,
            'status'      => (string)$listing->status,
            'adHash'      => (string)$listing->adHash,
            'imageHash'   => (string)$listing->imageHash,
            'errorType'   => (string)$listing->errorType,
            'lastError'   => (string)$listing->lastError,
            'warnings'    => (string)$listing->warnings,
            'title'       => (string)$listing->title,
            'price'       => (int)$listing->price,
            'syncedAt'    => (int)$listing->syncedAt,
        ];
    }
}
