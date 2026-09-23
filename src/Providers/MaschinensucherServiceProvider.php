<?php

namespace MaschinensucherMarkt\Providers;

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
        // Stündlich: Der Lauf liest den ganzen Artikelstamm, und
        // Maschinensucher holt die Datei ohnehin nur einmal je Nacht ab. Wer
        // schneller vom Markt nehmen will, stellt hier auf
        // CronContainer::EVERY_FIFTEEN_MINUTES.
        $cron->add(CronContainer::HOURLY, DateiBauen::class);
    }
}
