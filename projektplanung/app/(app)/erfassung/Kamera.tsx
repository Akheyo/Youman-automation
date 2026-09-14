'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './kamera.module.css';

/**
 * Kamera in der Seite statt Kameradialog des Betriebssystems.
 *
 * WARUM: Der Dialog liefert genau EIN Foto und schließt sich. Für fünf
 * Aufnahmen heißt das fünfmal antippen, fünfmal warten, fünfmal "Foto
 * verwenden" bestätigen. Am Regal, mit einer freien Hand, ist das die Stelle,
 * an der die Erfassung langsam wird.
 *
 * Hier bleibt der Sucher offen: auslösen, auslösen, auslösen, fertig.
 *
 * Zur Auflösung: Angefragt wird 4K (rund 8 Megapixel). Das ist weniger als die
 * 12 der Kamera-App, aber deutlich mehr als für Verkaufsbilder und für ein
 * lesbares Typenschild nötig ist — und es ist um Längen mehr, als WhatsApp je
 * durchgelassen hat. Liefert das Gerät kein 4K, gibt der Browser von selbst das
 * Beste, was er hat.
 */

interface Props {
  offen: boolean;
  /** Wird je Auslösung gerufen. Darf dauern — der Sucher bleibt bedienbar. */
  onFoto: (datei: File) => void;
  onSchliessen: () => void;
  /** Rückfall auf den Kameradialog, wenn der Sucher nicht zu haben ist. */
  onDialog: () => void;
}

export default function Kamera({ offen, onFoto, onSchliessen, onDialog }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [bereit, setBereit] = useState(false);
  const [anzahl, setAnzahl] = useState(0);
  const [blitzt, setBlitzt] = useState(false);
  const [letztes, setLetztes] = useState<string | null>(null);

  const stoppen = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setBereit(false);
  }, []);

  useEffect(() => {
    if (!offen) {
      stoppen();
      return;
    }
    let abgebrochen = false;
    setFehler(null);
    setAnzahl(0);
    setLetztes(null);

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setFehler('Dieser Browser gibt keinen Kamerazugriff in der Seite frei.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            // Rückkamera, so hoch aufgelöst wie das Gerät hergibt.
            facingMode: { ideal: 'environment' },
            width: { ideal: 3840 },
            height: { ideal: 2160 },
          },
          audio: false,
        });
        if (abgebrochen) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {
            /* iOS meldet gelegentlich AbortError, das Bild läuft trotzdem */
          });
        }
        setBereit(true);
      } catch (e) {
        const name = e instanceof Error ? e.name : '';
        setFehler(
          name === 'NotAllowedError'
            ? 'Der Kamerazugriff wurde abgelehnt. In den Browser-Einstellungen für diese Seite erlauben — oder unten den Kameradialog benutzen.'
            : 'Die Kamera ließ sich nicht öffnen. Unten geht es über den Kameradialog.',
        );
      }
    })();

    return () => {
      abgebrochen = true;
      stoppen();
    };
  }, [offen, stoppen]);

  // Zurücktaste und Bildschirmsperre sauber behandeln.
  useEffect(() => {
    if (!offen) return;
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSchliessen();
    };
    window.addEventListener('keydown', beiTaste);
    return () => window.removeEventListener('keydown', beiTaste);
  }, [offen, onSchliessen]);

  const ausloesen = () => {
    const video = videoRef.current;
    if (!video || !bereit) return;
    const breite = video.videoWidth;
    const hoehe = video.videoHeight;
    if (!breite || !hoehe) return;

    const leinwand = document.createElement('canvas');
    leinwand.width = breite;
    leinwand.height = hoehe;
    const stift = leinwand.getContext('2d');
    if (!stift) return;
    stift.drawImage(video, 0, 0, breite, hoehe);

    // Kurzes Aufblitzen: ohne Rückmeldung tippt man am Regal zweimal.
    setBlitzt(true);
    window.setTimeout(() => setBlitzt(false), 120);

    leinwand.toBlob(
      (blob) => {
        if (!blob) return;
        const name = `aufnahme-${Date.now()}.jpg`;
        onFoto(new File([blob], name, { type: 'image/jpeg' }));
        setAnzahl((n) => n + 1);
        setLetztes((alt) => {
          if (alt) URL.revokeObjectURL(alt);
          return URL.createObjectURL(blob);
        });
      },
      'image/jpeg',
      0.92,
    );
  };

  useEffect(() => {
    return () => {
      if (letztes) URL.revokeObjectURL(letztes);
    };
  }, [letztes]);

  if (!offen) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Kamera">
      <video ref={videoRef} className={styles.bild} playsInline muted autoPlay />
      {blitzt && <div className={styles.blitz} aria-hidden />}

      {fehler && (
        <div className={styles.fehler}>
          <p>{fehler}</p>
          <button type="button" className={styles.fehlerKnopf} onClick={onDialog}>
            Kameradialog benutzen
          </button>
        </div>
      )}

      <button type="button" className={styles.zu} onClick={onSchliessen} aria-label="Kamera schließen">
        ✕
      </button>

      <div className={styles.leiste}>
        <div className={styles.zaehler}>
          {letztes ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={letztes} alt="" className={styles.letztes} />
          ) : (
            <span className={styles.zaehlerLeer} aria-hidden />
          )}
          <span>{anzahl}</span>
        </div>

        <button
          type="button"
          className={styles.ausloeser}
          onClick={ausloesen}
          disabled={!bereit}
          aria-label="Auslösen"
        >
          <span className={styles.ausloeserKern} />
        </button>

        <button type="button" className={styles.fertig} onClick={onSchliessen}>
          Fertig
        </button>
      </div>
    </div>
  );
}
