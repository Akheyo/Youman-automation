<?php

namespace MaschinensucherMarkt\Providers;

use MaschinensucherMarkt\Crons\BestandLesen;
use MaschinensucherMarkt\Crons\DateiBauen;
use Plenty\Modules\Cron\Services\CronContainer;
use Plenty\Plugin\ServiceProvider;

/**
 * Der Einstiegspunkt des Plugins.
 *
 * Zwei Dinge werden angemeldet: der Zeitplan, der die Importdatei baut, und
 * die Route, über die Maschinensucher sie abholt. Mehr braucht die Strecke
 * nicht — die Markierung am Artikel entscheidet, was drinsteht.
 */
class MaschinensucherServiceProvider extends ServiceProvider
{
    public function register()
    {
        $this->getApplication()->register(MaschinensucherRouteServiceProvider::class);
    }

    /**
     * @param CronContainer $cron
     */
    public function boot(CronContainer $cron)
    {
        // Alle 15 Minuten. Der Lauf liest den ganzen Artikelstamm, ist also
        // nicht billig — aber die Datei muss in dem Moment stimmen, in dem
        // Maschinensucher sie abholt, und wann das ist, bestimmen nicht wir.
        // Eine Stunde alte Bestandszahlen hiessen: bis zu eine Stunde lang
        // steht etwas zum Verkauf, das es nicht mehr gibt.
        //
        // Schneller geht mit EVERY_FIVE_MINUTES, belastet Plenty aber
        // entsprechend. Langsamer und schonender mit HOURLY.
        $cron->add(CronContainer::EVERY_FIFTEEN_MINUTES, DateiBauen::class);

        // Stuendlich nachsehen, was drueben steht. Das haelt die Zuordnung
        // aktuell, auch wenn jemand ein Inserat von Hand anlegt oder
        // loescht, und es ist zugleich der einzige Ausloeser, der ohne
        // erreichbare PHP-Route auskommt.
        $cron->add(CronContainer::HOURLY, BestandLesen::class);
    }
}
