/**
 * Sapore Grill — Meldung einer neuen Bestellung nach draussen.
 *
 * Zwei Wege, beide optional und unabhaengig voneinander:
 *
 *  - Telegram: schnellster Weg aufs Handy. Kostenlos, keine Freischaltung.
 *    Einrichtung: in Telegram @BotFather anschreiben, `/newbot`, Token kopieren
 *    → SAPORE_TELEGRAM_BOT_TOKEN. Dann dem eigenen Bot einmal schreiben und die
 *    Chat-ID bei @userinfobot holen → SAPORE_TELEGRAM_CHAT_ID.
 *  - Webhook: freie Ziel-URL fuer n8n, Make oder spaeter die Kasse. Bekommt die
 *    komplette Bestellung als JSON.
 *
 * Keine der beiden Meldungen darf die Bestellung scheitern lassen: der Gast hat
 * seine Bestellung abgeschickt, sie liegt in der Datenbank. Faellt eine Meldung
 * aus, wird das protokolliert und an der Bestellung vermerkt.
 */

import type { Order } from './orders';
import { orderAsText } from './orders';

const TIMEOUT_MS = 8000;

async function sendTelegram(order: Order): Promise<string | null> {
  const token = process.env.SAPORE_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.SAPORE_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: orderAsText(order) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      const body = await response.text();
      return `Telegram antwortete mit ${response.status}: ${body.slice(0, 200)}`;
    }
    return null;
  } catch (error) {
    return `Telegram nicht erreichbar: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function sendWebhook(order: Order): Promise<string | null> {
  const url = process.env.SAPORE_ORDER_WEBHOOK;
  if (!url) return null;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return `Webhook antwortete mit ${response.status}`;
    return null;
  } catch (error) {
    return `Webhook nicht erreichbar: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Meldet die Bestellung auf allen konfigurierten Wegen parallel.
 * Rueckgabe: null wenn alles geklappt hat (oder nichts konfiguriert ist),
 * sonst die gesammelten Fehler als ein Text.
 */
export async function notifyNewOrder(order: Order): Promise<string | null> {
  const results = await Promise.all([sendTelegram(order), sendWebhook(order)]);
  const errors = results.filter((r): r is string => Boolean(r));
  if (errors.length === 0) return null;
  errors.forEach((e) => console.error('[sapore] Meldung fehlgeschlagen:', e));
  return errors.join(' | ');
}
