/**
 * Zentrales Bildregister.
 *
 * Ablage: public/img/<schluessel>.<endung>
 * Erlaubte Endungen: .avif .webp .jpg .jpeg .png (in dieser Reihenfolge bevorzugt).
 * Die Datei muss also nur nach dem Schlüssel benannt werden – z. B. "halle.jpg".
 *
 * Fehlt eine Datei, rendert <Bild> eine gestaltete Farbfläche derselben Marke;
 * die Seite bleibt dadurch immer vollständig.
 */
export type BildKey =
  | 'halle'
  | 'paletten'
  | 'oberflaeche'
  | 'gitter'
  | 'buero'
  | 'maschinenbau'
  | 'logistik'
  | 'automobil'
  | 'handel'
  | 'material'
  | 'reporting'
  | 'architektur'
  | 'versandzentrum'
  | 'geschichte'
  | 'werte'
  | 'feinplanung'
  | 'versandsteuerung'
  | 'referenzprojekte';

/** Alt-Texte zentral, damit ein Bild überall gleich beschrieben wird. */
export const bilder: Record<BildKey, string> = {
  halle: 'Blick durch den Mittelgang einer Produktionshalle, Maschinen zu beiden Seiten',
  paletten: 'Gestapelte Paletten mit gebündelter Ware in einer Lagerhalle',
  oberflaeche: 'Bildschirm mit einer Softwareoberfläche in einer Produktionsumgebung',
  gitter: 'Nahaufnahme eines gleichmäßigen Rasters aus Stahldraht',
  buero: 'Ruhiger Büroraum mit Glaswand und Blick in die angrenzende Produktion',
  maschinenbau: 'Zerspanungsmaschine in einer Fertigung, präzise bearbeitete Metallteile',
  logistik: 'Gang zwischen hohen Regalreihen in einem Distributionslager',
  automobil: 'Blechteile auf Transportgestellen in einer Zulieferfertigung',
  handel: 'Kartons auf einer Förderstrecke in einem Verteilzentrum',
  material: 'Stahlcoils und Rohmaterial in einem Materiallager',
  reporting: 'Stapel aus Papierunterlagen und Formularen auf einem Schreibtisch',
  architektur: 'Stahlträger und hohe Fenster einer Industriehalle',
  versandzentrum:
    'Rollenförderer mit Kartons in einem Versandzentrum, dahinter Hochregale und ein Gabelstapler an der Verladetür',
  geschichte: 'Sanduhr vor schwarzem Grund, der Sand rinnt durch die enge Mitte',
  werte: 'Zwei Personen geben sich über einem Schreibtisch die Hand',
  feinplanung: 'Blick von oben auf eine Fahrzeugmontagelinie mit mehreren Karosserien auf Förderbahnen',
  versandsteuerung: 'Hallenkran hebt ein Bündel Metallprofile, im Vordergrund zwei Personen mit Schutzhelmen',
  referenzprojekte: 'Ausgebreitete Projektunterlagen mit Inhaltsverzeichnissen und Klammern, schwarzweiß',
};
