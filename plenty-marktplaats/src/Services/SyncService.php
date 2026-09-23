<?php

namespace Marktplaats\Services;

use Marktplaats\Api\MarktplaatsClient;
use Marktplaats\Mapping\AdMapper;
use Marktplaats\Mapping\SyncPlanner;
use Marktplaats\Repositories\ListingRepository;
use Marktplaats\Repositories\SettingsRepository;
use Plenty\Plugin\Log\Loggable;

/**
 * Gleicht die fuer Marktplaats freigegebenen Plenty-Varianten mit den Anzeigen ab:
 * neue anlegen, geaenderte aktualisieren, nicht mehr gewuenschte entfernen.
 */
class SyncService
{
    use Loggable;

    const PAGE_SIZE = 50;
    const MAX_PAGES = 400;
    /** Eine Sperre, die aelter ist, gilt als liegengeblieben (abgebrochener Lauf). */
    const LOCK_SECONDS = 1800;
    /** Ab so vielen Anzeigen wird ein Komplett-Loeschen ohne gelieferte Varianten verweigert. */
    const MASS_DELETE_GUARD = 5;

    /** @var MarktplaatsClient */
    private $client;
    /** @var PluginConfig */
    private $config;
    /** @var SettingsRepository */
    private $settings;
    /** @var ListingRepository */
    private $listings;
    /** @var VariationSource */
    private $source;

    /** @var int */
    private $apiBudget = 0;
    /** @var array */
    private $summary = [];

    public function __construct(
        MarktplaatsClient $client,
        PluginConfig $config,
        SettingsRepository $settings,
        ListingRepository $listings,
        VariationSource $source
    ) {
        $this->client = $client;
        $this->config = $config;
        $this->settings = $settings;
        $this->listings = $listings;
        $this->source = $source;
    }

    /**
     * Kompletter Abgleich (Cron und Knopf "Jetzt abgleichen").
     */
    public function run(): array
    {
        $this->resetSummary();

        $blocker = $this->blocker();
        if ($blocker !== '') {
            return $this->finish(false, $blocker);
        }

        $lock = (int)$this->settings->get(SettingsRepository::SYNC_LOCK, '0');
        if ($lock > 0 && time() - $lock < self::LOCK_SECONDS) {
            return $this->finish(false, 'Ein Abgleich laeuft bereits (seit ' . date('H:i', $lock) . ').', false);
        }
        $this->settings->set(SettingsRepository::SYNC_LOCK, (string)time());

        try {
            $settings = $this->config->mapperSettings();
            $referrerId = $this->settings->referrerId();
            $known = $this->listings->allByVariation();
            $seen = [];
            $complete = false;

            for ($page = 1; $page <= self::MAX_PAGES; $page++) {
                $result = $this->source->page($page, self::PAGE_SIZE, $referrerId, $this->config->requireStock());
                foreach ($result['variations'] as $variation) {
                    $id = (int)$variation['id'];
                    $seen[$id] = true;
                    $this->process($variation, isset($known[$id]) ? $known[$id] : null, $settings);
                }
                if ($result['lastPage'] || count($result['variations']) === 0) {
                    $complete = true;
                    break;
                }
            }

            // Nur nach vollstaendigem Durchlauf loeschen – sonst wuerden bei einem
            // Lesefehler Anzeigen verschwinden, die eigentlich bleiben sollen.
            $message = $complete ? '' : 'Abgleich nach ' . self::MAX_PAGES . ' Seiten abgebrochen.';
            if ($complete && $this->config->deleteWhenGone()) {
                $gone = [];
                foreach ($known as $id => $listing) {
                    if (!isset($seen[$id]) && SyncPlanner::decide($listing, false) === SyncPlanner::DELETE) {
                        $gone[] = $listing;
                    }
                }
                // Liefert Plenty gar keine Variante mehr, obwohl viele Anzeigen online sind,
                // ist eher die Abfrage kaputt als alles verkauft – dann nichts loeschen.
                if (count($seen) === 0 && count($gone) > self::MASS_DELETE_GUARD) {
                    $message = count($gone) . ' Anzeigen wurden NICHT entfernt: Plenty hat keine einzige freigegebene Variante geliefert. '
                        . 'Bitte die Freigabe unter Verfuegbarkeit > Maerkte pruefen.';
                } else {
                    foreach ($gone as $listing) {
                        if ($this->apiBudget <= 0) {
                            $this->summary['deferred']++;
                            continue;
                        }
                        $this->delete($listing);
                    }
                }
            }

            return $this->finish($complete, $message);
        } catch (\Exception $e) {
            $this->getLogger('SyncService')->error('Marktplaats::log.syncFailed', ['error' => $e->getMessage()]);

            return $this->finish(false, 'Abgleich abgebrochen: ' . $e->getMessage());
        } finally {
            $this->settings->set(SettingsRepository::SYNC_LOCK, '0');
        }
    }

    /**
     * Eine Variante sofort abgleichen (Knopf in der Uebersicht).
     */
    public function syncOne(int $variationId): array
    {
        $this->resetSummary();
        $blocker = $this->blocker();
        if ($blocker !== '') {
            return $this->finish(false, $blocker, false);
        }

        $variation = $this->source->one($variationId, $this->settings->referrerId(), $this->config->requireStock());
        $listing = $this->listingArray($variationId);
        if ($variation === null) {
            if ($listing !== null && SyncPlanner::decide($listing, false) === SyncPlanner::DELETE) {
                $this->delete($listing);
            }

            return $this->finish(false, 'Variante ' . $variationId . ' gibt es in Plenty nicht.', false);
        }

        $this->process($variation, $listing, $this->config->mapperSettings());

        return $this->finish(true, '', false) + ['listing' => $this->listingArray($variationId)];
    }

    /**
     * Anzeige einer Variante von Marktplaats nehmen.
     */
    public function removeOne(int $variationId): array
    {
        $this->resetSummary();
        $listing = $this->listingArray($variationId);
        if ($listing === null || SyncPlanner::decide($listing, false) !== SyncPlanner::DELETE) {
            return $this->finish(false, 'Zu dieser Variante gibt es keine Anzeige auf Marktplaats.', false);
        }
        $this->delete($listing);

        return $this->finish(true, '', false) + ['listing' => $this->listingArray($variationId)];
    }

    /**
     * Was wuerde hochgeladen? Ohne Aufruf bei Marktplaats.
     */
    public function preview(int $variationId): array
    {
        $variation = $this->source->one($variationId, $this->settings->referrerId(), $this->config->requireStock());
        if ($variation === null) {
            return ['found' => false];
        }

        $listing = $this->listingArray($variationId);
        $wanted = $this->wanted($variation);
        $mapped = AdMapper::map($variation, $this->config->mapperSettings());

        $reasons = [];
        if (empty($variation['isActive'])) {
            $reasons[] = 'Variante ist inaktiv.';
        }
        if (empty($variation['visibleForMarket'])) {
            $reasons[] = 'Variante ist unter Verfuegbarkeit > Maerkte nicht fuer "Marktplaats" freigegeben.';
        }
        if ($this->config->requireStock() && ($variation['stockNet'] === null || (float)$variation['stockNet'] <= 0)) {
            $reasons[] = 'Kein Netto-Warenbestand (Einstellung "Nur mit Bestand").';
        }

        return [
            'found'        => true,
            'wanted'       => $wanted,
            'notWantedBecause' => $reasons,
            'stockNet'     => $variation['stockNet'],
            'action'       => SyncPlanner::decide($listing, $wanted, $mapped),
            'ad'           => $mapped['ad'],
            'imageUrls'    => $mapped['imageUrls'],
            'problems'     => $mapped['problems'],
            'warnings'     => $mapped['warnings'],
            'configErrors' => $this->config->errors(),
            'listing'      => $listing,
        ];
    }

    // -----------------------------------------------------------------------

    private function process(array $variation, $listing, array $settings)
    {
        $this->summary['seen']++;
        $wanted = $this->wanted($variation);
        $mapped = $wanted ? AdMapper::map($variation, $settings) : null;
        $action = SyncPlanner::decide($listing, $wanted, $mapped);

        if ($action === SyncPlanner::NONE) {
            $this->summary['unchanged']++;

            return;
        }
        if ($action === SyncPlanner::INVALID) {
            $this->summary['invalid']++;
            list($adHash, $imageHash) = AdMapper::splitHash($mapped['hash']);
            $this->saveListing($variation, $mapped, [
                'status'    => SyncPlanner::STATUS_ERROR,
                'errorType' => SyncPlanner::ERROR_VALIDATION,
                'lastError' => implode("\n", $mapped['problems']),
                'adHash'    => $adHash,
                'imageHash' => $imageHash,
            ]);

            return;
        }
        if ($this->apiBudget <= 0) {
            $this->summary['deferred']++;

            return;
        }

        if ($action === SyncPlanner::DELETE) {
            $this->delete($listing);
        } elseif ($action === SyncPlanner::CREATE) {
            $this->create($variation, $mapped);
        } elseif ($action === SyncPlanner::UPDATE) {
            $this->update($variation, $mapped, $listing);
        } elseif ($action === SyncPlanner::IMAGES) {
            $this->images($variation, $mapped, $listing);
        }
    }

    private function wanted(array $variation): bool
    {
        return SyncPlanner::wanted(
            !empty($variation['isActive']),
            !empty($variation['visibleForMarket']),
            $variation['stockNet'],
            $this->config->requireStock()
        );
    }

    private function create(array $variation, array $mapped)
    {
        $warnings = $mapped['warnings'];
        $response = $this->sendAd('POST', 'advertisements', $mapped['ad'], $warnings);
        list($adHash, $imageHash) = AdMapper::splitHash($mapped['hash']);

        $body = is_array($response['body']) ? $response['body'] : [];
        if (!in_array($response['status'], [200, 201], true) || empty($body['itemId'])) {
            $this->fail($variation, $mapped, $response, $adHash, $imageHash, '');

            return;
        }

        $mpItemId = (string)$body['itemId'];
        $imageHash = $this->uploadImages($mpItemId, $mapped['imageUrls'], $imageHash, $warnings);
        $this->summary['created']++;
        $this->saveListing($variation, $mapped, [
            'mpItemId'  => $mpItemId,
            'status'    => SyncPlanner::STATUS_ONLINE,
            'errorType' => '',
            'lastError' => '',
            'warnings'  => implode("\n", $warnings),
            'adHash'    => $adHash,
            'imageHash' => $imageHash,
        ]);
    }

    private function update(array $variation, array $mapped, array $listing)
    {
        $warnings = $mapped['warnings'];
        $mpItemId = $listing['mpItemId'];
        $response = $this->sendAd('PUT', 'advertisements/' . rawurlencode($mpItemId), $mapped['ad'], $warnings);
        list($adHash, $imageHash) = AdMapper::splitHash($mapped['hash']);

        // Anzeige gibt es nicht mehr (abgelaufen oder bei Marktplaats geloescht) -> neu anlegen
        if ($response['status'] === 404) {
            $this->create($variation, $mapped);

            return;
        }
        if ($response['status'] !== 200) {
            $this->fail($variation, $mapped, $response, $adHash, $imageHash, $mpItemId);

            return;
        }

        if ($listing['imageHash'] !== $imageHash) {
            $imageHash = $this->uploadImages($mpItemId, $mapped['imageUrls'], $imageHash, $warnings);
        }
        $this->summary['updated']++;
        $this->saveListing($variation, $mapped, [
            'status'    => SyncPlanner::STATUS_ONLINE,
            'errorType' => '',
            'lastError' => '',
            'warnings'  => implode("\n", $warnings),
            'adHash'    => $adHash,
            'imageHash' => $imageHash,
        ]);
    }

    private function images(array $variation, array $mapped, array $listing)
    {
        $warnings = $mapped['warnings'];
        list(, $imageHash) = AdMapper::splitHash($mapped['hash']);
        $imageHash = $this->uploadImages($listing['mpItemId'], $mapped['imageUrls'], $imageHash, $warnings);
        $this->summary['images']++;
        $this->saveListing($variation, $mapped, ['imageHash' => $imageHash, 'warnings' => implode("\n", $warnings)]);
    }

    private function delete(array $listing)
    {
        $this->apiBudget--;
        $response = $this->client->request('DELETE', 'advertisements/' . rawurlencode($listing['mpItemId']));

        // 404: schon weg – Ziel erreicht
        if (in_array($response['status'], [200, 204, 404], true)) {
            $this->summary['deleted']++;
            $this->listings->save([
                'variationId' => $listing['variationId'],
                'status'      => SyncPlanner::STATUS_REMOVED,
                'errorType'   => '',
                'lastError'   => '',
                'syncedAt'    => time(),
            ]);

            return;
        }

        $this->summary['failed']++;
        $error = SyncPlanner::describeError($response['status'], $response['body']) . ($response['error'] !== '' ? ' ' . $response['error'] : '');
        $this->noteError($listing['variationId'], 'Entfernen: ' . $error);
        $this->listings->save([
            'variationId' => $listing['variationId'],
            'status'      => SyncPlanner::STATUS_ERROR,
            'errorType'   => SyncPlanner::ERROR_TRANSIENT,
            'lastError'   => 'Entfernen fehlgeschlagen: ' . $error,
            'syncedAt'    => time(),
        ]);
    }

    /**
     * Anzeige senden. Lehnt Marktplaats einzelne Zusatzfelder als unbekannt ab
     * (z. B. ein Standard-Attribut, das es in dieser Kategorie nicht gibt), wird
     * einmal ohne diese Felder wiederholt.
     */
    private function sendAd(string $method, string $path, array $ad, array &$warnings): array
    {
        $this->apiBudget--;
        $response = $this->client->request($method, $path, $ad);

        if ($response['status'] === 400) {
            $unknown = SyncPlanner::unknownFields($response['body']);
            if (count($unknown) > 0) {
                foreach ($unknown as $field) {
                    unset($ad[$field]);
                }
                $warnings[] = 'Von Marktplaats in dieser Kategorie nicht angenommen und weggelassen: ' . implode(', ', $unknown) . '.';
                $response = $this->client->request($method, $path, $ad);
            }
        }

        return $response;
    }

    /**
     * @return string Bilder-Hash, der gespeichert werden soll (leer = beim naechsten Lauf erneut versuchen)
     */
    private function uploadImages(string $mpItemId, array $urls, string $imageHash, array &$warnings): string
    {
        if (count($urls) === 0) {
            return $imageHash;
        }

        $response = $this->client->request('POST', 'advertisements/' . rawurlencode($mpItemId) . '/images', [
            'urls'       => array_values($urls),
            'replaceAll' => true,
        ]);
        if (in_array($response['status'], [200, 201, 202], true)) {
            return $imageHash;
        }

        $warnings[] = 'Bilder nicht uebertragen: ' . SyncPlanner::describeError($response['status'], $response['body']);

        return '';
    }

    private function fail(array $variation, array $mapped, array $response, string $adHash, string $imageHash, string $mpItemId)
    {
        $this->summary['failed']++;
        $error = SyncPlanner::describeError($response['status'], $response['body']) . ($response['error'] !== '' ? ' ' . $response['error'] : '');
        $this->noteError((int)$variation['id'], $error);
        $this->getLogger('SyncService')->warning('Marktplaats::log.adFailed', [
            'variationId' => $variation['id'],
            'error'       => $error,
        ]);

        $this->saveListing($variation, $mapped, [
            'mpItemId'  => $mpItemId,
            'status'    => SyncPlanner::STATUS_ERROR,
            'errorType' => SyncPlanner::errorType($response['status']),
            'lastError' => $error,
            'warnings'  => implode("\n", $mapped['warnings']),
            'adHash'    => $adHash,
            'imageHash' => $imageHash,
        ]);
    }

    private function saveListing(array $variation, array $mapped, array $data)
    {
        $ad = $mapped['ad'];
        $this->listings->save(array_merge([
            'variationId' => (int)$variation['id'],
            'itemId'      => (int)(isset($variation['itemId']) ? $variation['itemId'] : 0),
            'title'       => isset($ad['translations'][0]['title']) ? $ad['translations'][0]['title'] : '',
            'price'       => isset($ad['priceModel']['askingPrice']) ? (int)$ad['priceModel']['askingPrice'] : 0,
            'syncedAt'    => time(),
        ], $data));
    }

    private function listingArray(int $variationId)
    {
        $listing = $this->listings->find($variationId);

        return $listing === null ? null : ListingRepository::toArray($listing);
    }

    /**
     * Grund, warum gar nicht abgeglichen werden kann – leer, wenn alles bereit ist.
     */
    private function blocker(): string
    {
        if ($this->config->clientId() === '' || $this->config->clientSecret() === '') {
            return 'Client-ID und Client-Secret von Marktplaats fehlen in der Konfiguration.';
        }
        if (!$this->client->isConnected()) {
            return 'Noch nicht mit Marktplaats verbunden (Einrichtung > Maerkte > Marktplaats > Verbinden).';
        }
        $connected = $this->settings->get(SettingsRepository::CONNECTED_ENVIRONMENT);
        if ($connected !== '' && $connected !== $this->config->environment()) {
            return 'Die Verbindung gilt fuer "' . $connected . '", eingestellt ist "' . $this->config->environment() . '". Bitte neu verbinden.';
        }
        if ($this->settings->referrerId() <= 0) {
            return 'Die Herkunft "Marktplaats" fehlt. Plugin-Set erneut bereitstellen.';
        }

        return '';
    }

    private function noteError(int $variationId, string $error)
    {
        if (count($this->summary['errors']) < 20) {
            $this->summary['errors'][] = 'Variante ' . $variationId . ': ' . $error;
        }
    }

    private function resetSummary()
    {
        $this->apiBudget = $this->config->maxPerRun();
        $this->summary = [
            'startedAt' => time(),
            'seen'      => 0,
            'unchanged' => 0,
            'created'   => 0,
            'updated'   => 0,
            'images'    => 0,
            'deleted'   => 0,
            'invalid'   => 0,
            'failed'    => 0,
            'deferred'  => 0,
            'errors'    => [],
        ];
    }

    private function finish(bool $complete, string $message, bool $store = true): array
    {
        $summary = $this->summary;
        $summary['finishedAt'] = time();
        $summary['complete'] = $complete;
        $summary['message'] = $message;
        $summary['configErrors'] = $this->config->errors();
        if ($summary['deferred'] > 0) {
            $summary['message'] = trim($summary['message'] . ' ' . $summary['deferred']
                . ' Varianten werden beim naechsten Lauf abgeglichen (Hoechstzahl pro Lauf erreicht).');
        }
        if ($store) {
            $this->settings->setJson(SettingsRepository::LAST_SYNC, $summary);
        }

        return $summary;
    }
}
