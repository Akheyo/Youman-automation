<?php

namespace MaschinensucherMarkt\Providers;

use MaschinensucherMarkt\Crons\Abgleichen;
use MaschinensucherMarkt\Crons\BestandLesen;
use MaschinensucherMarkt\Procedures\SofortAbgleich;
use Plenty\Modules\Cron\Services\CronContainer;
use Plenty\Modules\EventProcedures\Services\Entries\ProcedureEntry;
use Plenty\Modules\EventProcedures\Services\EventProceduresService;
use Plenty\Plugin\ServiceProvider;

/**
 * Der Einstiegspunkt des Plugins.
 *
 * Drei Ausloeser, absichtlich unterschiedlich schnell:
 *
 *   Ereignisaktion   sofort, wenn ein Auftrag den Bestand senkt
 *   Abgleich         alle 15 Minuten ueber den ganzen Stamm
 *   Bestandsaufnahme alle 5 Minuten lesend, haelt die Zuordnung aktuell
 *
 * Der schnelle Weg allein genuegt nicht: Nicht jede Bestandsaenderung
 * haengt an einem Auftrag. Der langsame allein genuegt auch nicht: Eine
 * verkaufte Maschine soll nicht noch eine Viertelstunde am Markt stehen.
 */
class MaschinensucherServiceProvider extends ServiceProvider
{
    public function boot(CronContainer $cron, EventProceduresService $ereignisse)
    {
        $cron->add(CronContainer::EVERY_FIFTEEN_MINUTES, Abgleichen::class);

        // Lesend und guenstig: sieben Aufrufe je Lauf. Haelt die Zuordnung
        // aktuell, auch wenn jemand drueben ein Inserat von Hand anlegt
        // oder loescht.
        $cron->add(CronContainer::EVERY_FIVE_MINUTES, BestandLesen::class);

        // Der Echtzeitweg. Einzurichten unter Auftraege, Ereignisaktionen.
        $ereignisse->registerProcedure(
            'MaschinensucherMarkt',
            ProcedureEntry::EVENT_TYPE_ORDER,
            array(
                'de' => 'Maschinensucher: Inserate dieses Auftrags abgleichen',
                'en' => 'Machineseeker: sync the listings of this order',
            ),
            SofortAbgleich::class . '@run'
        );
    }
}
