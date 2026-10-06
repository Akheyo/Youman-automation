import type { Metadata } from 'next';
import Fotostudio from './Fotostudio';
import { leseKonfig } from '@/lib/fotostudio/kern';
import { aktuelleConfig, plentyConfigured } from '@/lib/plenty/client';

export const metadata: Metadata = { title: 'Fotostudio · Komplett Konzept Projektplanung' };
export const dynamic = 'force-dynamic';

export default async function FotostudioPage() {
  const konfig = leseKonfig();
  const plenty = await aktuelleConfig();
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
        plentyBereit: plentyConfigured(plenty),
      }}
    />
  );
}
