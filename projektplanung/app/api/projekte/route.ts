/**
 * GET  → Liste/Suche der eigenen Projekte (Suchverlauf). Query: ?q=<suche>
 * POST → Neues Projekt anlegen: Unterkategorie + Artikel in Plenty, EAN erzeugen,
 *        Datensatz speichern. Body: { company, location, contactInternal?, contactExternal? }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncProjektToPlenty, type InvoiceFile } from '@/lib/plenty/client';
import { validateProjekt, buildCategoryName, normalizeOrderType, type ProjektInput } from '@/lib/projekte/logic';

const MAX_INVOICE_BYTES = 8 * 1024 * 1024; // 8 MB
const INVOICE_BUCKET = 'rechnungen';
const SIGNED_URL_TTL = 60 * 60 * 24 * 3650; // ~10 Jahre

/** Lädt die Rechnung in den Supabase-Storage und gibt Pfad + Signed-URL zurück. */
async function storeInvoice(
  userId: string,
  projektId: string,
  invoice: InvoiceFile,
): Promise<{ path?: string; url?: string; error?: string }> {
  // Häufiger Fehler: der Service-Role-Key wurde MASKIERT (mit •-Zeichen) aus dem
  // Supabase-Dashboard kopiert. Solche Zeichen sprengen den HTTP-Header ("ByteString").
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (rawKey && !/^[\x20-\x7E]+$/.test(rawKey)) {
    return {
      error:
        'SUPABASE_SERVICE_ROLE_KEY enthält ungültige Zeichen (vermutlich maskiert kopiert, „•"). ' +
        'Im Supabase-Dashboard den Schlüssel erst EINBLENDEN, dann kopieren und in Vercel neu setzen.',
    };
  }

  const admin = createAdminClient();
  if (!admin) return { error: 'SUPABASE_SERVICE_ROLE_KEY fehlt' };
  // Bucket bei Bedarf anlegen (idempotent; Fehler wird ignoriert, falls er schon existiert).
  try {
    await admin.storage.createBucket(INVOICE_BUCKET, { public: false });
  } catch {
    /* existiert bereits – ignorieren */
  }
  // Nur ASCII im Dateinamen (Pfad landet in Headern/URLs).
  const safe = invoice.filename.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-100) || 'rechnung';
  const path = `${userId}/${projektId}-${safe}`;
  // Content-Type auf reines ASCII begrenzen (sonst „ByteString"-Fehler im Header).
  const contentType = /^[\x20-\x7E]+$/.test(invoice.contentType) ? invoice.contentType : 'application/octet-stream';
  // Als Blob hochladen: dadurch geht der Content-Type NICHT als roher Header raus,
  // sondern über multipart/form-data — umgeht den ByteString-Header-Fehler komplett.
  try {
    const blob = new Blob([new Uint8Array(invoice.bytes)], { type: contentType });
    const up = await admin.storage.from(INVOICE_BUCKET).upload(path, blob, { contentType, upsert: true });
    if (up.error) return { error: `Upload: ${up.error.message}` };
  } catch (e) {
    return { error: `Upload-Ausnahme: ${e instanceof Error ? e.message : String(e)}` };
  }
  try {
    const signed = await admin.storage.from(INVOICE_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
    return { path, url: signed.data?.signedUrl ?? '' };
  } catch (e) {
    // Upload hat geklappt – nur die Signed-URL nicht. Pfad zählt als Erfolg.
    return { path, url: '', error: `Signed-URL: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';

  let query = supabase
    .from('projekte')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (q) {
    // Suche über Firma, Ort und Ansprechpartner.
    const like = `%${q.replace(/[%_]/g, '')}%`;
    query = query.or(
      [
        `company.ilike.${like}`,
        `location.ilike.${like}`,
        `contact_internal.ilike.${like}`,
        `contact_external.ilike.${like}`,
        `notes.ilike.${like}`,
        `order_type.ilike.${like}`,
        `category_name.ilike.${like}`,
        `ean.ilike.${like}`,
      ].join(','),
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ projekte: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  // Multipart (mit optionaler Rechnungsdatei) oder JSON akzeptieren.
  const contentType = request.headers.get('content-type') ?? '';
  let body: Partial<ProjektInput> = {};
  let invoice: InvoiceFile | null = null;
  let invoiceName: string | null = null;

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'Ungültiges Formular.' }, { status: 400 });
    body = {
      company: (form.get('company') as string) ?? '',
      location: (form.get('location') as string) ?? '',
      contactInternal: (form.get('contactInternal') as string) ?? '',
      contactExternal: (form.get('contactExternal') as string) ?? '',
      notes: (form.get('notes') as string) ?? '',
      orderType: (form.get('orderType') as string) ?? '',
    };
    const file = form.get('invoice');
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_INVOICE_BYTES) {
        return NextResponse.json({ error: 'Rechnung zu groß (max. 8 MB).' }, { status: 413 });
      }
      invoice = {
        bytes: Buffer.from(await file.arrayBuffer()),
        filename: file.name || 'rechnung.pdf',
        contentType: file.type || 'application/octet-stream',
      };
      invoiceName = file.name || 'rechnung.pdf';
    }
  } else {
    body = (await request.json().catch(() => ({}))) as Partial<ProjektInput>;
  }

  const validationError = validateProjekt(body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const orderType = normalizeOrderType(body.orderType);
  const input: ProjektInput = {
    company: body.company!.trim(),
    location: body.location!.trim(),
    contactInternal: body.contactInternal?.trim() || undefined,
    contactExternal: body.contactExternal?.trim() || undefined,
    notes: body.notes?.trim() || undefined,
    orderType: orderType ?? undefined,
  };
  const now = new Date();
  const categoryName = buildCategoryName(input.company, input.location);

  // 1) Datensatz sofort anlegen (Status pending) — nichts geht verloren.
  const { data: row, error: insertError } = await supabase
    .from('projekte')
    .insert({
      user_id: user.id,
      company: input.company,
      location: input.location,
      contact_internal: input.contactInternal ?? null,
      contact_external: input.contactExternal ?? null,
      notes: input.notes ?? null,
      order_type: input.orderType ?? null,
      invoice_name: invoiceName,
      category_name: categoryName,
      plenty_status: 'pending',
    })
    .select()
    .single();
  if (insertError || !row) {
    return NextResponse.json({ error: insertError?.message ?? 'Speichern fehlgeschlagen.' }, { status: 400 });
  }

  // 1b) Rechnung sicher im Storage ablegen (die eigentliche Datei) und Link erzeugen.
  let invoicePath: string | null = null;
  let invoiceUrl: string | undefined;
  let storageError: string | null = null;
  if (invoice) {
    const stored = await storeInvoice(user.id, row.id, invoice);
    if (stored.path) {
      invoicePath = stored.path;
      invoiceUrl = stored.url || undefined;
    } else {
      storageError = stored.error ?? 'unbekannter Fehler';
    }
  }

  // 2) Plenty-Sync (best effort) — eindeutiger EAN-Seed aus Zeit + Zufall.
  const eanSeed = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const sync = await syncProjektToPlenty(input, now, eanSeed, null, invoice);
  if (storageError) sync.warnings.push(`Rechnung-Speicherung (App) fehlgeschlagen: ${storageError}`);

  // 3) Ergebnis in den Datensatz zurückschreiben.
  const status = sync.skipped ? 'skipped' : sync.ok ? 'ok' : 'error';
  const { data: updated } = await supabase
    .from('projekte')
    .update({
      ean: sync.ean,
      category_name: sync.categoryName,
      plenty_category_id: sync.dateCategoryId ?? sync.categoryId,
      plenty_item_id: sync.itemId,
      plenty_status: status,
      plenty_error: sync.error,
      invoice_path: invoicePath,
    })
    .eq('id', row.id)
    .eq('user_id', user.id)
    .select()
    .single();

  return NextResponse.json({
    projekt: updated ?? row,
    sync: {
      ok: sync.ok,
      skipped: sync.skipped,
      status,
      ean: sync.ean,
      categoryCreated: sync.categoryCreated,
      dateCategoryName: sync.dateCategoryName,
      dateCategoryCreated: sync.dateCategoryCreated,
      eanAttached: sync.eanAttached,
      invoiceAttached: sync.invoiceAttached,
      invoiceLog: sync.invoiceLog,
      invoiceStored: Boolean(invoicePath),
      invoiceUrl: invoiceUrl ?? null,
      warnings: sync.warnings,
      error: sync.error,
    },
  });
}
