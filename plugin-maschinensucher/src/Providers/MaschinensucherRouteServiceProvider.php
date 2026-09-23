<?php

namespace MaschinensucherMarkt\Providers;

use Plenty\Plugin\RouteServiceProvider;
use Plenty\Plugin\Routing\Router;

/**
 * Die Abholadresse.
 *
 * Sie liegt unter der Shop-Domain des Mandanten:
 *
 *     https://<shop>/maschinensucher/feed?token=…
 *
 * Genau diese Adresse wird im Maschinensucher-Konto unter
 * „Datenimport → Automatischer Import" hinterlegt.
 */
class MaschinensucherRouteServiceProvider extends RouteServiceProvider
{
    public function map(Router $router)
    {
        $router->get('maschinensucher/feed', 'MaschinensucherMarkt\Controllers\FeedController@feed');
    }
}
