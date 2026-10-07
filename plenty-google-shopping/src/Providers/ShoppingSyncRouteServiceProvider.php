<?php

namespace ShoppingSync\Providers;

use Plenty\Plugin\RouteServiceProvider;
use Plenty\Plugin\Routing\ApiRouter;

class ShoppingSyncRouteServiceProvider extends RouteServiceProvider
{
    public function map(ApiRouter $api)
    {
        $api->version(['v1'], ['namespace' => 'ShoppingSync\Controllers', 'middleware' => 'oauth'], function ($router) {
            $router->get('shopping-sync/check', 'ShoppingSyncController@check');
            $router->get('shopping-sync/preview/{variationId}', 'ShoppingSyncController@preview')->where('variationId', '\d+');
            $router->post('shopping-sync/run', 'ShoppingSyncController@run');
            $router->post('shopping-sync/register-gcp', 'ShoppingSyncController@registerGcp');
            $router->get('shopping-sync/states', 'ShoppingSyncController@states');
            $router->get('shopping-sync/log', 'ShoppingSyncController@log');
        });
    }
}
