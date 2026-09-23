<?php

namespace Marktplaats\Migrations;

use Marktplaats\Repositories\SettingsRepository;
use Plenty\Modules\Order\Referrer\Contracts\OrderReferrerRepositoryContract;
use Plenty\Plugin\Log\Loggable;

/**
 * Legt die Herkunft "Marktplaats" an. Ueber sie wird in der Variante unter
 * "Verfuegbarkeit > Maerkte" gesteuert, welche Artikel auf Marktplaats stehen.
 */
class CreateReferrer
{
    use Loggable;

    const NAME = 'Marktplaats';

    public function run(OrderReferrerRepositoryContract $referrerRepository, SettingsRepository $settings)
    {
        $referrerId = 0.0;

        // Bei Neuinstallation nach Deinstallation die vorhandene Herkunft weiterverwenden
        $list = $referrerRepository->getList(['id', 'backendName']);
        foreach (($list ?: []) as $referrer) {
            $backendName = is_array($referrer) ? ($referrer['backendName'] ?? '') : $referrer->backendName;
            if ($backendName === self::NAME) {
                $referrerId = (float)(is_array($referrer) ? $referrer['id'] : $referrer->id);
                break;
            }
        }

        if ($referrerId <= 0) {
            $referrer = $referrerRepository->create([
                'isEditable'   => false,
                'isFilterable' => true,
                'backendName'  => self::NAME,
                'name'         => self::NAME,
                'origin'       => self::NAME,
            ]);
            $referrerId = (float)$referrer->id;
        }

        $settings->set(SettingsRepository::REFERRER_ID, (string)$referrerId);

        $this->getLogger('CreateReferrer')->info('Marktplaats::log.referrerReady', ['referrerId' => $referrerId]);
    }
}
