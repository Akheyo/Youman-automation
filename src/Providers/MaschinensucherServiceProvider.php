<?php

namespace MaschinensucherMarkt\Providers;

use MaschinensucherMarkt\Crons\Abgleichen;
use MaschinensucherMarkt\Crons\AbgleichenSchnell;
use MaschinensucherMarkt\Crons\BestandLesen;
use MaschinensucherMarkt\Crons\RubrikenPflegen;
use MaschinensucherMarkt\Procedures\SofortAbgleich;
use Plenty\Modules\Cron\Services\CronContainer;
use Plenty\Modules\EventProcedures\Services\Entries\ProcedureEntry;
use Plenty\Modules\EventProcedures\Services\EventProceduresService;
use Plenty\Plugin\Log\Loggable;
use Plenty\Plugin\ServiceProvider;

/**
 * Der Einstiegspunkt des Plugins.
 *
 * Drei Ausloeser, absichtlich unterschiedlich schnell:
 *
 *   Ereignisaktion   sofort, wenn ein Auftrag den Bestand senkt
 *   Abgleich         alle 15 Minuten ueber den ganzen Stamm
 *   Bestandsaufnahme alle 15 Minuten lesend, haelt die Zuordnung aktuell
 *
 * Der schnelle Weg allein genuegt nicht: Nicht jede Bestandsaenderung
 * haengt an einem Auftrag. Der langsame allein genuegt auch nicht: Eine
 * verkaufte Maschine soll nicht noch eine Viertelstunde am Markt stehen.
 *
 * REIHENFOLGE IST ABSICHT: Erst die Zeitplaene, dann die Ereignisaktion,
 * und die in einem eigenen Fangnetz. Beides in einer Methode bedeutet
 * sonst: Scheitert die Ereignisaktion, wird auch kein Zeitplan angemeldet
 * — und man sieht davon nichts, weil einfach nie wieder etwas laeuft.
 */
class MaschinensucherServiceProvider extends ServiceProvider
{
    use Loggable;

    /**
     * Leer, aber NICHT entbehrlich.
     *
     * Plentys ServiceProvider baut auf Laravel auf, und dort verlangt die
     * Basisklasse diese Methode. Fehlt sie, laesst sich der Provider zur
     * Laufzeit nicht erzeugen — boot() wird nie aufgerufen, kein Zeitplan
     * angemeldet, und das Protokoll bleibt vollkommen still. Der Build
     * merkt davon nichts: Er prueft Syntax und erlaubte Aufrufe, nicht, ob
     * sich eine Klasse erzeugen laesst.
     *
     * Genau so ist es am 23.09. passiert, als mit den Routen auch diese
     * Methode verschwand.
     */
    public function register()
    {
    }

    public function boot(CronContainer $cron)
    {
        // Der Abgleich laeuft im Fuenf-Minuten-Takt, mit dem 15-Minuten-Plan
        // als Netz. Der Test vom 23.09., nach dem fuenf Minuten "nie
        // ausloesen", war nicht aussagekraeftig: Die Zeitplaene schrieben
        // damals "implements CronHandler" und konnten in keinem Takt laden
        // (behoben am 24.09.). Ob fuenf Minuten laufen, zeigt das Protokoll:
        // "Zeitplan gestartet" mit zeitplan "Abgleich (5 Minuten)".
        // Beide treffen sich jede Viertelstunde; die Sperre in Abgleichen
        // laesst dann nur einen arbeiten.
        $cron->add(CronContainer::EVERY_FIVE_MINUTES, AbgleichenSchnell::class);
        $cron->add(CronContainer::EVERY_FIFTEEN_MINUTES, Abgleichen::class);
        $cron->add(CronContainer::EVERY_FIFTEEN_MINUTES, BestandLesen::class);
        $cron->add(CronContainer::EVERY_FIFTEEN_MINUTES, RubrikenPflegen::class);

        $this->ereignisaktionAnmelden();
    }

    /**
     * Der Echtzeitweg, einzurichten unter Auftraege, Ereignisaktionen.
     *
     * Faellt sie aus, laeuft die Strecke weiter — nur eben im Takt der
     * Zeitplaene statt sofort. Das ist ein Rueckschritt, kein Ausfall, und
     * deshalb kein Grund, alles Uebrige mitzureissen.
     */
    private function ereignisaktionAnmelden()
    {
        try {
            $dienst = pluginApp(EventProceduresService::class);
            $dienst->registerProcedure(
                'MaschinensucherMarkt',
                ProcedureEntry::EVENT_TYPE_ORDER,
                array(
                    'de' => 'Maschinensucher: Inserate dieses Auftrags abgleichen',
                    'en' => 'Machineseeker: sync the listings of this order',
                ),
                SofortAbgleich::class . '@run'
            );
        } catch (\Throwable $e) {
            $this->getLogger(__METHOD__)->error('MaschinensucherMarkt::log.ereignisaktionFehlt', array(
                'meldung' => $e->getMessage(),
            ));
        }
    }
}
