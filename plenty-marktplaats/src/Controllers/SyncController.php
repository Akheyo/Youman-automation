<?php

namespace Marktplaats\Controllers;

use Marktplaats\Api\MarktplaatsClient;
use Marktplaats\Repositories\ListingRepository;
use Marktplaats\Services\SyncService;
use Plenty\Plugin\Controller;
use Plenty\Plugin\Http\Request;
use Plenty\Plugin\Http\Response;

class SyncController extends Controller
{
    /** @var SyncService */
    private $sync;

    public function __construct(SyncService $sync)
    {
        $this->sync = $sync;
    }

    /** POST /rest/markets/marktplaats/sync */
    public function run(): array
    {
        return $this->sync->run();
    }

    /** GET /rest/markets/marktplaats/listings?page=1&perPage=50&status=error */
    public function listings(Request $request, ListingRepository $listings): array
    {
        $perPage = min(250, max(1, (int)$request->get('perPage', 50)));

        return $listings->page((int)$request->get('page', 1), $perPage, (string)$request->get('status', ''));
    }

    /** GET /rest/markets/marktplaats/preview/{variationId} */
    public function preview(int $variationId): array
    {
        return $this->sync->preview($variationId);
    }

    /** POST /rest/markets/marktplaats/listings/{variationId}/sync */
    public function syncOne(int $variationId): array
    {
        return $this->sync->syncOne($variationId);
    }

    /** DELETE /rest/markets/marktplaats/listings/{variationId} */
    public function removeOne(int $variationId): array
    {
        return $this->sync->removeOne($variationId);
    }

    /** GET /rest/markets/marktplaats/categories – Kategoriebaum von Marktplaats zum Nachschlagen der IDs */
    public function categories(MarktplaatsClient $client, Response $response)
    {
        return $this->forward($client->request('GET', 'categories'), $response);
    }

    /** GET /rest/markets/marktplaats/categories/{l1}/{l2}/attributes */
    public function attributes(int $l1, int $l2, MarktplaatsClient $client, Response $response)
    {
        return $this->forward($client->request('GET', 'categories/' . $l1 . '/' . $l2 . '/attributes'), $response);
    }

    private function forward(array $result, Response $response)
    {
        if ($result['status'] !== 200) {
            return $response->json([
                'error'  => $result['error'] !== '' ? $result['error'] : 'Marktplaats antwortete mit HTTP ' . $result['status'],
                'body'   => $result['body'],
            ], $result['status'] >= 400 ? $result['status'] : 502);
        }

        return $result['body'];
    }
}
