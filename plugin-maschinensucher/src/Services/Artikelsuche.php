<?php

namespace MaschinensucherMarkt\Services;

use Plenty\Modules\Cloud\ElasticSearch\Lib\Processor\DocumentProcessor;
use Plenty\Modules\Cloud\ElasticSearch\Lib\Search\Document\DocumentSearch;
use Plenty\Modules\Item\Search\Contracts\VariationElasticSearchSearchRepositoryContract;
use Plenty\Modules\Item\Search\Filter\ItemFilter;
use Plenty\Modules\Item\Search\Filter\VariationBaseFilter;

/**
 * Findet Varianten ueber Plentys Suchindex.
 *
 * Nach dem Muster, mit dem Plentys eigenes Shop-Plugin (IO) Artikel laedt.
 * Die klassische Variantensuche lieferte auf diesem System fuer eine
 * vorhandene Variante nichts zurueck.
 *
 * Der Gewinn geht ueber die Reparatur hinaus: Der Suchindex kann nach der
 * Markierung filtern. Der Abgleich liest dadurch nur noch die markierten
 * Artikel — nicht mehr den ganzen Stamm mit zehntausenden, die mit dem
 * Marktplatz nichts zu tun haben.
 */
class Artikelsuche
{
    const PRO_SEITE = 100;
    const MAX_SEITEN = 200;

    /**
     * Bestimmte Varianten, egal ob markiert.
     */
    public function nachVariantenIds(array $ids)
    {
        $ids = self::zahlen($ids);
        if (count($ids) === 0) {
            return array();
        }
        return $this->suchen(array('variantenIds' => $ids));
    }

    /**
     * Bestimmte Varianten, aber nur, soweit ihr Artikel die Markierung traegt.
     * Die Differenz zu nachVariantenIds() sind die unmarkierten.
     */
    public function markierteUnter(array $ids, $flagId, $flagFeld)
    {
        $ids = self::zahlen($ids);
        if (count($ids) === 0 || (int) $flagId <= 0) {
            return array();
        }
        $heraus = array();
        foreach (self::flaggenfelder($flagFeld) as $feld) {
            $treffer = $this->suchen(array('variantenIds' => $ids, 'flagge' => (int) $flagId, 'feld' => $feld));
            foreach ($treffer as $dokument) {
                $heraus[self::dokumentId($dokument)] = $dokument;
            }
        }
        return array_values($heraus);
    }

    /**
     * Alle Varianten, deren Artikel die Markierung traegt.
     */
    public function alleMarkierten($flagId, $flagFeld)
    {
        if ((int) $flagId <= 0) {
            return array();
        }
        $heraus = array();
        foreach (self::flaggenfelder($flagFeld) as $feld) {
            $treffer = $this->suchen(array('flagge' => (int) $flagId, 'feld' => $feld));
            foreach ($treffer as $dokument) {
                $heraus[self::dokumentId($dokument)] = $dokument;
            }
        }
        return array_values($heraus);
    }

    /**
     * Alle Varianten bestimmter Artikel, egal ob markiert.
     */
    public function nachArtikelIds(array $ids)
    {
        $ids = self::zahlen($ids);
        if (count($ids) === 0) {
            return array();
        }
        return $this->suchen(array('artikelIds' => $ids));
    }

    // ------------------------------------------------------------------------

    /**
     * Seite fuer Seite, bis nichts mehr kommt.
     *
     * Die Filter werden als schlichte Beschreibung uebergeben und je Seite
     * frisch gebaut: Die Suchobjekte merken sich ihren Zustand, und der
     * Plugin-Build erlaubt keine Funktionen, die ueber eine Variable
     * aufgerufen werden — eine Closure als "Filterbauer" scheidet damit aus.
     *
     * @param array $was variantenIds | artikelIds | flagge + feld, beliebig kombiniert
     */
    private function suchen(array $was)
    {
        $alle = array();
        for ($seite = 1; $seite <= self::MAX_SEITEN; $seite++) {
            $verarbeitung = pluginApp(DocumentProcessor::class);
            $suche = pluginApp(DocumentSearch::class, array($verarbeitung));

            if (isset($was['variantenIds'])) {
                $varianten = pluginApp(VariationBaseFilter::class);
                $varianten->hasIds($was['variantenIds']);
                $suche->addFilter($varianten);
            }
            if (isset($was['artikelIds'])) {
                $artikel = pluginApp(VariationBaseFilter::class);
                $artikel->hasItemIds($was['artikelIds']);
                $suche->addFilter($artikel);
            }
            if (isset($was['flagge'])) {
                $flagge = pluginApp(ItemFilter::class);
                if (isset($was['feld']) && $was['feld'] === 'flagTwo') {
                    $flagge->hasFlag2((int) $was['flagge']);
                } else {
                    $flagge->hasFlag1((int) $was['flagge']);
                }
                $suche->addFilter($flagge);
            }

            $suche->setPage($seite, self::PRO_SEITE);

            $index = pluginApp(VariationElasticSearchSearchRepositoryContract::class);
            $index->addSearch($suche);
            $ergebnis = $index->execute();

            $dokumente = self::dokumente($ergebnis);
            foreach ($dokumente as $dokument) {
                $alle[] = $dokument;
            }

            $gesamt = is_array($ergebnis) && isset($ergebnis['total']) ? (int) $ergebnis['total'] : 0;
            if (count($dokumente) < self::PRO_SEITE || ($gesamt > 0 && count($alle) >= $gesamt)) {
                break;
            }
        }
        return $alle;
    }

    /**
     * Die Dokumente aus der Antwort. Je nach Aufruf liegen sie direkt unter
     * 'documents' oder eine Ebene tiefer unter dem Namen der Suche.
     */
    private static function dokumente($ergebnis)
    {
        if (!is_array($ergebnis)) {
            return array();
        }
        if (isset($ergebnis['documents']) && is_array($ergebnis['documents'])) {
            return $ergebnis['documents'];
        }
        foreach ($ergebnis as $teil) {
            if (is_array($teil) && isset($teil['documents']) && is_array($teil['documents'])) {
                return $teil['documents'];
            }
        }
        return array();
    }

    private static function flaggenfelder($flagFeld)
    {
        if ($flagFeld === 'beide') {
            return array('flagOne', 'flagTwo');
        }
        return array($flagFeld === 'flagTwo' ? 'flagTwo' : 'flagOne');
    }

    private static function dokumentId($dokument)
    {
        $dokument = (array) $dokument;
        if (isset($dokument['id'])) {
            return (string) $dokument['id'];
        }
        if (isset($dokument['data']['variation']['id'])) {
            return (string) $dokument['data']['variation']['id'];
        }
        return (string) count($dokument);
    }

    private static function zahlen(array $ids)
    {
        $heraus = array();
        foreach ($ids as $id) {
            if ((int) $id > 0) {
                $heraus[] = (int) $id;
            }
        }
        return $heraus;
    }
}
