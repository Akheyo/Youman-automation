import type { Metadata } from 'next';
import Fotostudio from './Fotostudio';
import { leseKonfig } from '@/lib/fotostudio/kern';
import { gtinAn, leseNummernkreis } from '@/lib/fotostudio/gtin';
import { aktuelleConfig, plentyConfigured } from '@/lib/plenty/client';

export const metadata: Metadata = { title: 'Fotostudio · Komplett Konzept Projektplanung' };
export const dynamic = 'force-dynamic';

export default async function FotostudioPage() {
  const konfig = leseKonfig();
  const plenty = await aktuelleConfig();
  const kreis = leseNummernkreis();
  return (
    <Fotostudio
      stammwerte={{
        ownerId: konfig.ownerId,
        kategorieId: konfig.kategorieId,
        ebayPresetId: konfig.ebayPresetId,
        unitId: konfig.unitId,
        flagOne: konfig.flagOne,
        flagTwo: konfig.flagTwo,
        warehouseId: konfig.warehouseId,
        eanBarcode: Boolean(plenty.eanBarcodeId),
        nummernkreis: kreis ? `${gtinAn(kreis, 0)} · ${kreis.anzahl} St.` : null,
        plentyBereit: plentyConfigured(plenty),
      }}
    />
  );
}
