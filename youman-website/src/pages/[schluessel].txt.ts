import type { APIRoute } from 'astro';
import { indexNowSchluessel } from '../data/indexnow';

/**
 * Die Schlüsseldatei für IndexNow.
 *
 * IndexNow ist ein Protokoll, mit dem eine Website Suchmaschinen aktiv
 * mitteilt, dass sich etwas geändert hat, statt auf den nächsten Besuch des
 * Crawlers zu warten. Bing, Yandex, Seznam und Naver nehmen daran teil.
 * Google nicht: Dort bleibt es beim Crawlen und bei der Sitemap.
 *
 * Für youman ist vor allem Bing interessant, weil Microsoft Copilot seine
 * Antworten aus dem Bing-Index speist. Eine neue oder geänderte Seite ist
 * damit unter Umständen am selben Tag dort auffindbar statt erst nach
 * Wochen.
 *
 * So funktioniert der Nachweis: Wer eine Adresse meldet, muss belegen, dass
 * er die Domain kontrolliert. Dafür muss unter
 * https://www.youman-automation.de/<schluessel>.txt eine Datei liegen, die
 * genau den Schlüssel enthält. Diese Route erzeugt sie.
 *
 * Der Schlüssel ist kein Geheimnis. Er steht öffentlich im Netz, das ist
 * der Sinn der Sache. Er ist nur ein Nachweis, kein Zugang: Mit ihm lassen
 * sich ausschließlich Adressen dieser Domain melden.
 */

export const getStaticPaths = () => [{ params: { schluessel: indexNowSchluessel } }];

export const GET: APIRoute = () =>
  new Response(indexNowSchluessel, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
