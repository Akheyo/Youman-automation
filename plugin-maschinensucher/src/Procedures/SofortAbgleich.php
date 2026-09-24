<?php

namespace MaschinensucherMarkt\Procedures;

use MaschinensucherMarkt\Services\Abgleich;
use MaschinensucherMarkt\Services\Bestandsaufnahme;
use MaschinensucherMarkt\Services\Zuordnung;
use Plenty\Modules\EventProcedures\Events\EventProceduresTriggered;
use Plenty\Plugin\Log\Loggable;

/**
 * Der Echtzeitweg: Auftrag kommt herein, Inserat geht sofort raus.
 *
 * Plenty bietet Plugins kein Ereignis fuer "der Bestand hat sich
 * geaendert". Es bietet aber Ereignisaktionen auf Auftraege — und ein
 * Auftrag ist genau der Moment, in dem der Bestand sinkt. Wer die letzte
 * Maschine kauft, soll sie nicht noch fuenfzehn Minuten am Markt sehen.
 *
 * Abgeglichen wird nur, was in diesem Auftrag steckt: meist eine Handvoll
 * Positionen, also ein paar Aufrufe statt eines ganzen Durchlaufs.
 *
 * Einzurichten unter Auftraege, Ereignisaktionen: ein Ereignis waehlen
 * (etwa "Auftrag wurde erzeugt") und diese Aktion zuweisen. Sie laesst
 * sich dort auch von Hand auf einem einzelnen Auftrag ausloesen — das ist
 * zugleich der einzige Knopf, mit dem sich die Strecke sofort pruefen
 * laesst, solange der Shop keine Plugin-Adressen bedient.
 */
class SofortAbgleich
{
    use Loggable;

    // Kein Konstruktor mit Abhaengigkeiten: Scheitert einer davon, wird
    // run() nie erreicht, und nichts davon landet im Protokoll. Die Dienste
    // werden deshalb erst in run() geholt, innerhalb des Fangnetzes.

    public function run(EventProceduresTriggered $ereignis)
    {
        // Verlaufsmeldung (waehrend der Inbetriebnahme als Fehler geschrieben) — siehe Crons\BestandLesen.
        $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.diagnoseFlow', array());

        try {
            $abgleich = pluginApp(Abgleich::class);
            $aufnahme = pluginApp(Bestandsaufnahme::class);
            $zuordnung = pluginApp(Zuordnung::class);

            $auftrag = $ereignis->getOrder();
            $varianten = $this->variantenAus($auftrag);

            if (count($varianten) === 0) {
                // Nicht mehr still: Ein Auftrag ohne erkennbare Positionen ist
                // genau der Fall, der vorher unsichtbar ins Leere lief.
                $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.diagnoseOhnePositionen', array(
                    'auftrag' => isset($auftrag->id) ? (int) $auftrag->id : 0,
                ));
                return;
            }

            // Solange die Bestandsaufnahme nicht vollstaendig ist, treibt jede
            // Ausloesung sie ein Stueck voran — aber nur ein kurzes: Der Flow
            // laeuft als gewoehnliche Anfrage, und eine lange Aufnahme darin
            // wurde am 23.09. ohne jede Spur abgebrochen. Den Rest erledigen
            // weitere Ausloesungen oder der Zeitplan.
            // Verlaufsmeldung (waehrend der Inbetriebnahme als Fehler geschrieben): jeder Schritt einzeln, damit
            // ein Abbruch mittendrin zu verorten ist.
            $this->schritt('Positionen gefunden', array('varianten' => $varianten));

            $etappe = null;
            if (!$zuordnung->bestandGelesen()) {
                $this->schritt('Bestandsaufnahme beginnt', array());
                $etappe = $aufnahme->etappe(8);
                $this->schritt('Bestandsaufnahme-Etappe fertig', $etappe);
            }

            $this->schritt('Abgleich beginnt', array());
            $bericht = $abgleich->fuerVarianten($varianten);
            if ($etappe !== null) {
                $bericht['bestandsaufnahme'] = $etappe;
            }

            // Verlaufsmeldung (waehrend der Inbetriebnahme als Fehler geschrieben): das Ergebnis, sichtbar
            // unabhaengig von der Log-Einstellung.
            $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.diagnoseErgebnis', array(
                'auftrag'   => isset($auftrag->id) ? (int) $auftrag->id : 0,
                'varianten' => count($varianten),
                'bericht'   => $bericht,
            ));
        } catch (\Throwable $e) {
            // Eine Ausnahme darf die Auftragsverarbeitung nicht aufhalten.
            // Der Zeitplan holt nach, was hier liegen bleibt.
            $this->getLogger(__METHOD__)->error('MaschinensucherMarkt::log.laufAbgebrochen', array(
                'meldung' => $e->getMessage(),
                'datei'   => $e->getFile() . ':' . $e->getLine(),
            ));
        }
    }

    private function schritt($was, array $daten)
    {
        $daten['schritt'] = (string) $was;
        $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.diagnoseSchritt', $daten);
    }

    /**
     * Die Varianten-IDs der Auftragspositionen.
     *
     * Plenty liefert die Positionen als Sammlung von Objekten, nicht als
     * Liste von Arrays. Ein (array)-Cast darauf ergibt nur die internen
     * Eigenschaften der Sammlung — die Positionen selbst verschwinden, und
     * der Lauf hielt den Auftrag fuer leer. Deshalb wird hier ueber die
     * Sammlung iteriert und jede Position einzeln gelesen, als Objekt oder
     * als Array.
     */
    private function variantenAus($auftrag)
    {
        $ids = array();
        $positionen = isset($auftrag->orderItems) ? $auftrag->orderItems : array();
        if ($positionen === null) {
            return $ids;
        }

        foreach ($positionen as $position) {
            $id = 0;
            if (is_array($position)) {
                $id = isset($position['itemVariationId']) ? (int) $position['itemVariationId'] : 0;
            } elseif (isset($position->itemVariationId)) {
                $id = (int) $position->itemVariationId;
            }
            // Versandkosten, Gutscheine und Rabatte sind auch Positionen,
            // tragen aber keine Variante.
            if ($id > 0 && !in_array($id, $ids, true)) {
                $ids[] = $id;
            }
        }

        return $ids;
    }
}
