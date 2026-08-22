import { useState } from 'react';
import Zeichen from './Icons';

/*
 * Das Markenzeichen oben links.
 *
 * Liegt in `public` eine Datei `logo.jpg`, `logo.png` oder `logo.svg`, wird
 * die gezeigt. Fehlt sie oder lässt sie sich nicht laden, springt das alte
 * schwarze Quadrat mit dem Blitz ein. Dadurch sieht die Oberfläche auch dann
 * richtig aus, wenn jemand das Projekt ohne Logo auscheckt.
 */

const moegliche = ['/logo.svg', '/logo.png', '/logo.jpg'];

export default function Marke({ groesse = 34 }: { groesse?: number }) {
  const [versuch, setVersuch] = useState(0);

  if (versuch >= moegliche.length) {
    return (
      <span className="markeZeichen" style={{ width: groesse, height: groesse, flexBasis: groesse }}>
        <Zeichen name="blitz" groesse={Math.round(groesse / 2)} />
      </span>
    );
  }

  return (
    <img
      className="markeBild"
      src={moegliche[versuch]}
      alt="Komplett Konzept"
      style={{ height: groesse }}
      onError={() => setVersuch((v) => v + 1)}
    />
  );
}
