<?php

namespace Marktplaats\Providers;

use Plenty\Plugin\RouteServiceProvider;
use Plenty\Plugin\Routing\ApiRouter;
use Plenty\Plugin\Routing\Router;

class MarktplaatsRouteServiceProvider extends RouteServiceProvider
{
    public function map(ApiRouter $api, Router $router)
    {
        // Backend-Aufrufe (/rest/...), nur mit Plenty-Anmeldung
        $api->version(['v1'], ['middleware' => ['oauth']], function ($api) {
            $api->get('markets/marktplaats/status', 'Marktplaats\Controllers\AuthController@status');
            $api->get('markets/marktplaats/auth/login-url', 'Marktplaats\Controllers\AuthController@loginUrl');
            $api->delete('markets/marktplaats/auth', 'Marktplaats\Controllers\AuthController@disconnect');

            $api->post('markets/marktplaats/sync', 'Marktplaats\Controllers\SyncController@run');
            $api->get('markets/marktplaats/listings', 'Marktplaats\Controllers\SyncController@listings');
            $api->post('markets/marktplaats/listings/{variationId}/sync', 'Marktplaats\Controllers\SyncController@syncOne')->where('variationId', '\d+');
            $api->delete('markets/marktplaats/listings/{variationId}', 'Marktplaats\Controllers\SyncController@removeOne')->where('variationId', '\d+');
            $api->get('markets/marktplaats/preview/{variationId}', 'Marktplaats\Controllers\SyncController@preview')->where('variationId', '\d+');
            $api->get('markets/marktplaats/categories', 'Marktplaats\Controllers\SyncController@categories');
            $api->get('markets/marktplaats/categories/{l1}/{l2}/attributes', 'Marktplaats\Controllers\SyncController@attributes')
                ->where('l1', '\d+')->where('l2', '\d+');
        });

        // Oeffentlich: Rueckruf von Marktplaats nach der Anmeldung (per state gesichert)
        $router->get('markets/marktplaats/auth/callback', 'Marktplaats\Controllers\AuthController@callback');
    }
}
