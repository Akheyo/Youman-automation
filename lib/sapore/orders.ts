/**
 * Sapore Grill — Bestellungen speichern, lesen und weiterreichen.
 *
 * Die Datenbank ist die Quelle der Wahrheit: eine Bestellung wird zuerst
 * gespeichert und erst danach gemeldet. Faellt eine Meldung aus (Tablet im
 * Standby, Telegram nicht erreichbar), ist die Bestellung trotzdem da und
 * taucht in der Kuechenansicht auf, sobald jemand hinschaut.
 *
 * Ohne konfiguriertes Supabase laeuft alles weiter, nur eben ohne Speicherung —
 * die Bestellung wird dann protokolliert und gemeldet. Das haelt die Seite
 * waehrend der Einrichtung benutzbar.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { BUSINESS, formatPrice } from './menu';

export type OrderStatus = 'neu' | 'in_arbeit' | 'fertig' | 'abgeschlossen' | 'storniert';

export type OrderLine = {
  id: string;
  name: string;
  qty: number;
  price: number;
  sum: number;
};

export type Order = {
  id?: string;
  order_no: string;
  created_at?: string;
  mode: 'liefern' | 'abholen';
  status?: OrderStatus;
  items: OrderLine[];
  subtotal: number;
  fee: number;
  total: number;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  street?: string;
  zip?: string;
  city?: string;
  wish_time: string;
  note?: string;
};

export const TABLE = 'sapore_orders';

/** Alle Status, die im Laden noch etwas zu tun bedeuten. */
export const OPEN_STATUSES: OrderStatus[] = ['neu', 'in_arbeit', 'fertig'];

/**
 * Speichert die Bestellung. Gibt die Zeilen-ID zurueck, oder null wenn keine
 * Datenbank konfiguriert ist bzw. das Schreiben fehlgeschlagen ist — der Gast
 * bekommt in beiden Faellen seine Bestellnummer, damit er anrufen kann.
 */
export async function storeOrder(order: Order): Promise<{ id: string | null; error: string | null }> {
  const supabase = createAdminClient();
  if (!supabase) return { id: null, error: 'Supabase ist nicht konfiguriert.' };

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      order_no: order.order_no,
      mode: order.mode,
      items: order.items,
      subtotal: order.subtotal,
      fee: order.fee,
      total: order.total,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_email: order.customer_email || null,
      street: order.street || null,
      zip: order.zip || null,
      city: order.city || null,
      wish_time: order.wish_time,
      note: order.note || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[sapore] Bestellung konnte nicht gespeichert werden:', error.message);
    return { id: null, error: error.message };
  }
  return { id: data.id as string, error: null };
}

/** Offene Bestellungen fuer die Kuechenansicht, aelteste zuerst. */
export async function listOpenOrders(limit = 50): Promise<Order[] | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .in('status', OPEN_STATUSES)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[sapore] Bestellungen konnten nicht gelesen werden:', error.message);
    return null;
  }
  return (data ?? []) as Order[];
}

/** Die zuletzt abgeschlossenen Bestellungen — zum Nachschauen im Laden. */
export async function listRecentClosed(limit = 15): Promise<Order[] | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .in('status', ['abgeschlossen', 'storniert'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[sapore] Abgeschlossene Bestellungen nicht lesbar:', error.message);
    return null;
  }
  return (data ?? []) as Order[];
}

export async function setOrderStatus(id: string, status: OrderStatus): Promise<boolean> {
  const supabase = createAdminClient();
  if (!supabase) return false;

  const { error } = await supabase.from(TABLE).update({ status }).eq('id', id);
  if (error) {
    console.error('[sapore] Status nicht aenderbar:', error.message);
    return false;
  }
  return true;
}

export async function markForwarded(id: string, error: string | null): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase
    .from(TABLE)
    .update({ forwarded_at: new Date().toISOString(), forward_error: error })
    .eq('id', id);
}

/** Bestellung als lesbarer Text — fuer Telegram und spaeter fuer den Bondruck. */
export function orderAsText(order: Order): string {
  const lines = order.items.map((i) => `${i.qty}× ${i.name}  ${formatPrice(i.sum)}`).join('\n');
  const where =
    order.mode === 'liefern'
      ? `LIEFERUNG\n${order.street}\n${order.zip} ${order.city}`
      : 'ABHOLUNG im Laden';
  const fee = order.fee > 0 ? `\nLiefergebühr: ${formatPrice(order.fee)}` : '';
  const note = order.note ? `\n\nAnmerkung: ${order.note}` : '';
  const time = order.wish_time === 'sofort' ? 'so schnell wie möglich' : `${order.wish_time} Uhr`;

  return (
    `NEUE BESTELLUNG ${order.order_no}\n` +
    `${BUSINESS.name}\n\n` +
    `${where}\nZeit: ${time}\n\n` +
    `${lines}${fee}\n` +
    `GESAMT: ${formatPrice(order.total)}\n\n` +
    `${order.customer_name}\n${order.customer_phone}${note}`
  );
}
