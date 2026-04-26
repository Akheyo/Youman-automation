# NRW LoD2 → 3D Tiles Pipeline

Konvertiert die offiziellen NRW LoD2-Gebäudemodelle (CityGML 2.0) in das
3D-Tiles-Format und lädt sie auf Cloudflare R2 hoch. Das Ergebnis wird
in `NEXT_PUBLIC_LOD2_TILESET_URL` eingetragen und vom 3D-Viewer geladen.

## Voraussetzungen

- **Python 3.11+** (für `py3dtiles`)
- **citygml-tools** (Java 17+): https://github.com/citygml4j/citygml-tools
- **rclone** für R2-Upload: https://rclone.org/install/
- ~50 GB freier Plattenplatz pro Regierungsbezirk
- Cloudflare-Account mit R2 aktiviert

## Pipeline-Übersicht

```
┌──────────────────────────┐
│  1_download_citygml.sh   │   NRW Open GeoData → ./citygml/<bezirk>/*.gml
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│  2_convert_to_3dtiles.py │   CityGML → CityJSON → 3D Tiles 1.1 (Draco)
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│  3_upload_to_r2.sh       │   ./3dtiles → R2-Bucket "lod2-nrw"
└──────────────────────────┘
```

## Ein-Befehl-Setup (Pilot Borken)

```bash
cd scripts/lod2-pipeline

# 1) Python-Venv und Dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2) CityGML für Borken (kleiner Pilot, ~80 MB) downloaden
./1_download_citygml.sh --bezirk muenster --gemeinde borken

# 3) Konvertieren (~5 min auf 8-Core)
python 2_convert_to_3dtiles.py \
    --input ./citygml/borken \
    --output ./3dtiles/borken \
    --draco

# 4) R2 hochladen (rclone-Konfig vorausgesetzt)
./3_upload_to_r2.sh --bucket lod2-nrw --path borken

# 5) URL in Vercel-Env setzen, deployen
echo "NEXT_PUBLIC_LOD2_TILESET_URL=https://lod2-nrw.r2.cloudflarestorage.com/borken/tileset.json"
```

## Volles NRW (alle Regierungsbezirke)

Geschätzte Compute-Zeit: 2–3 h auf 8-Core, ~30 GB nach Draco-Compression.

```bash
for bezirk in arnsberg detmold duesseldorf koeln muenster; do
  ./1_download_citygml.sh --bezirk $bezirk
  python 2_convert_to_3dtiles.py \
      --input ./citygml/$bezirk \
      --output ./3dtiles/$bezirk \
      --draco
  ./3_upload_to_r2.sh --bucket lod2-nrw --path $bezirk
done
```

Dann jeweils einen Top-Level-`tileset.json` erzeugen, der alle 5 Regierungsbezirke
referenziert:

```bash
python 4_merge_tilesets.py --inputs ./3dtiles/* --output ./3dtiles/_root/tileset.json
./3_upload_to_r2.sh --bucket lod2-nrw --path /
```

## R2-Konfiguration (rclone)

```bash
rclone config
# n) New remote
# name> r2-lod2
# type> 5  (s3)
# provider> Cloudflare
# access_key_id> <R2 Access Key>
# secret_access_key> <R2 Secret>
# region> auto
# endpoint> https://<account-id>.r2.cloudflarestorage.com
```

Public-Access aktivieren (Cloudflare Dashboard → R2 → Bucket → Settings →
Public access). CORS-Policy:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

## Aktualisierungen

NRW veröffentlicht jährlich ein Update der LoD2-Daten (typisch Q1).
Für Delta-Updates:

```bash
./1_download_citygml.sh --since 2026-01-01
# nur veränderte Kacheln werden neu konvertiert
python 2_convert_to_3dtiles.py --input ./citygml --output ./3dtiles --incremental
./3_upload_to_r2.sh --sync   # lädt nur geänderte Dateien hoch
```

## Troubleshooting

| Problem | Aktion |
|---------|--------|
| `py3dtiles: command not found` | `pip install py3dtiles` (in venv) |
| Konvertierung bricht mit OOM ab | `--workers 2` setzen (default 8) |
| Tileset lädt im Browser nicht | CORS-Policy am R2-Bucket prüfen |
| Draco-Decoder fehlt im Browser | Cesium >= 1.115 verwenden |

## Lizenz

NRW LoD2-Daten: Datenlizenz Deutschland Zero - Version 2.0 (DL-DE→Zero-2.0).
Frei kommerziell nutzbar, Quellangabe empfohlen:
"Geobasis NRW (https://www.opengeodata.nrw.de/)"
