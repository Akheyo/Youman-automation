<?php

namespace MaschinensucherMarkt\Controllers;

use MaschinensucherMarkt\Services\Einstellungen;
use MaschinensucherMarkt\Services\Feedbauer;
use MaschinensucherMarkt\Services\Standspeicher;
use Plenty\Modules\Plugin\Storage\Contracts\StorageRepositoryContract;
use Plenty\Plugin\Controller;
use Plenty\Plugin\Http\Request;
use Plenty\Plugin\Http\Response;

/**
 * Die Adresse, die Maschinensucher abholt.
 *
 * Sie LIEFERT NUR AUS, was der Cron gebaut hat. Dass der Abruf nichts
 * anstößt, ist Absicht: Maschinensucher wartet nicht minutenlang auf eine
 * Datei, und ein Timeout sieht für die Gegenstelle aus wie ein Ausfall.
 *
 * KEIN LOGIN: Maschinensucher kann sich nirgends anmelden. Das Geheimnis
 * steckt deshalb in der Adresse (?token=…, alternativ Bearer oder
 * HTTP-Basic). Sie zeigt unseren markierten Bestand samt Preisen — sie ist
 * wie ein Passwort zu behandeln, und ein neues Token macht jede alte Adresse
 * sofort wertlos.
 */
class FeedController extends Controller
{
    public function feed(
        Request $request,
        Response $response,
        StorageRepositoryContract $storage,
        Einstellungen $einstellungen,
        Standspeicher $speicher
    ) {
        $absender = (string) $request->header('x-forwarded-for');
        $kennung = (string) $request->header('user-agent');

        if (!$einstellungen->eingerichtet()) {
            return $response->make('Maschinensucher ist nicht eingerichtet (Token fehlt).', 503);
        }

        if (!$this->tokenStimmt($request, $einstellungen->token())) {
            // Bewusst protokolliert: Ein falsches Token in der hinterlegten
            // Adresse ist der wahrscheinlichste Fehler dieser Strecke und
            // sonst von innen unsichtbar.
            $speicher->abholungMerken(false, 0, 0, $absender, $kennung, 'Token stimmt nicht.');
            return $response->make('Zugang verweigert.', 401);
        }

        try {
            $objekt = $storage->getObject(Einstellungen::PLUGIN, Feedbauer::DATEI);
            $inhalt = $objekt->body;
            if (is_resource($inhalt)) {
                $inhalt = stream_get_contents($inhalt);
            }
            $inhalt = (string) $inhalt;
        } catch (\Throwable $e) {
            $speicher->abholungMerken(false, 0, 0, $absender, $kennung, 'Noch keine Datei gebaut.');
            // 503 und nicht 404: "kommt später wieder" ist die richtige
            // Auskunft, solange der erste Lauf noch nicht durch ist.
            return $response->make('Die Datei ist noch nicht gebaut. Der nächste Lauf erstellt sie.', 503);
        }

        if ($inhalt === '') {
            $speicher->abholungMerken(false, 0, 0, $absender, $kennung, 'Datei ist leer.');
            return $response->make('Die Datei ist leer — es wird nichts ausgeliefert.', 503);
        }

        $zeilen = max(0, substr_count($inhalt, "\n") - 1); // ohne Kopfzeile
        $speicher->abholungMerken(true, $zeilen, strlen($inhalt), $absender, $kennung);

        $kodierung = $einstellungen->kodierung() === 'latin1' ? 'ISO-8859-1' : 'utf-8';
        return $response->make($inhalt, 200, array(
            'Content-Type' => 'text/csv; charset=' . $kodierung,
            'Content-Disposition' => 'attachment; filename="maschinensucher-' . date('Y-m-d') . '.csv"',
            // Eine zwischengespeicherte Preisliste wäre schlimmer als eine
            // langsame.
            'Cache-Control' => 'no-store, max-age=0',
            'X-Inserate' => (string) $zeilen,
        ));
    }

    /**
     * Vergleicht die Token, ohne über die Laufzeit zu verraten, wie weit sie
     * übereinstimmen (hash_equals).
     */
    private function tokenStimmt(Request $request, $echt)
    {
        if (strlen($echt) < 16) {
            return false;
        }

        $angeboten = (string) $request->get('token', '');
        if ($angeboten === '') {
            $kopf = (string) $request->header('authorization');
            if (stripos($kopf, 'bearer ') === 0) {
                $angeboten = trim(substr($kopf, 7));
            } elseif (stripos($kopf, 'basic ') === 0) {
                $entschluesselt = base64_decode(trim(substr($kopf, 6)), true);
                if ($entschluesselt !== false) {
                    $doppelpunkt = strpos($entschluesselt, ':');
                    $angeboten = $doppelpunkt === false ? $entschluesselt : substr($entschluesselt, $doppelpunkt + 1);
                }
            }
        }

        return $angeboten !== '' && hash_equals($echt, $angeboten);
    }
}
