#!/usr/bin/env python3
"""
CityGML → 3D Tiles 1.1 conversion pipeline.

Pipeline:
    1. CityGML 2.0 (NRW LoD2)
    2. → CityJSON via cjio (handles roof faces, attributes, height)
    3. → 3D Tiles 1.1 with Draco compression via py3dtiles

Usage:
    python 2_convert_to_3dtiles.py \\
        --input ./citygml/borken \\
        --output ./3dtiles/borken \\
        --draco
"""

from __future__ import annotations

import argparse
import gzip
import json
import os
import shutil
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

try:
    from tqdm import tqdm
except ImportError:
    print("Error: pip install -r requirements.txt first.", file=sys.stderr)
    sys.exit(1)


def decompress_if_needed(path: Path, work_dir: Path) -> Path:
    """If `path` is .gml.gz, decompress to a temp .gml inside work_dir."""
    if path.suffix == ".gz":
        out = work_dir / path.with_suffix("").name
        with gzip.open(path, "rb") as src, open(out, "wb") as dst:
            shutil.copyfileobj(src, dst)
        return out
    return path


def citygml_to_cityjson(gml_path: Path, out_dir: Path) -> Path:
    """Use cjio to convert CityGML → CityJSON."""
    out = out_dir / (gml_path.stem + ".json")
    cmd = ["cjio", str(gml_path), "save", str(out)]
    subprocess.run(cmd, check=True, capture_output=True)
    return out


def cityjson_to_3dtiles(cj_path: Path, out_dir: Path, use_draco: bool) -> None:
    """Use py3dtiles to convert CityJSON → 3D Tiles."""
    cmd = [
        "py3dtiles",
        "convert",
        str(cj_path),
        "--out",
        str(out_dir),
        "--overwrite",
    ]
    if use_draco:
        cmd.append("--draco")
    subprocess.run(cmd, check=True, capture_output=True)


def process_tile(args: tuple[Path, Path, Path, bool]) -> tuple[str, bool, str]:
    gml_path, work_dir, output_dir, use_draco = args
    try:
        decompressed = decompress_if_needed(gml_path, work_dir)
        cj = citygml_to_cityjson(decompressed, work_dir)
        sub_out = output_dir / gml_path.stem
        sub_out.mkdir(parents=True, exist_ok=True)
        cityjson_to_3dtiles(cj, sub_out, use_draco)
        return (gml_path.name, True, "")
    except subprocess.CalledProcessError as e:
        return (gml_path.name, False, e.stderr.decode("utf-8", errors="replace")[:300])
    except Exception as e:  # noqa: BLE001 - surface root cause to operator
        return (gml_path.name, False, f"{type(e).__name__}: {e}")


def merge_root_tileset(output_dir: Path) -> None:
    """Stitch per-tile tileset.json files into one root tileset.json."""
    children = []
    for sub in output_dir.iterdir():
        if not sub.is_dir():
            continue
        ts = sub / "tileset.json"
        if not ts.exists():
            continue
        with open(ts) as f:
            data = json.load(f)
        if "root" not in data:
            continue
        children.append({
            "boundingVolume": data["root"]["boundingVolume"],
            "geometricError": data["root"].get("geometricError", 100),
            "content": {"uri": f"{sub.name}/tileset.json"},
        })

    root_ts = {
        "asset": {"version": "1.1"},
        "geometricError": 500,
        "root": {
            "boundingVolume": {"region": [-3.14, -1.57, 3.14, 1.57, 0, 1000]},
            "geometricError": 500,
            "refine": "REPLACE",
            "children": children,
        },
    }
    with open(output_dir / "tileset.json", "w") as f:
        json.dump(root_ts, f)
    print(f"[merge] Wrote root tileset.json with {len(children)} children.")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--input", required=True, type=Path, help="Directory with .gml or .gml.gz")
    ap.add_argument("--output", required=True, type=Path, help="Output directory for 3D Tiles")
    ap.add_argument("--draco", action="store_true", help="Enable Draco compression (recommended)")
    ap.add_argument("--workers", type=int, default=os.cpu_count() or 4)
    ap.add_argument("--incremental", action="store_true", help="Skip tiles whose output already exists")
    args = ap.parse_args()

    if not args.input.exists():
        print(f"Error: {args.input} does not exist.", file=sys.stderr)
        return 1

    args.output.mkdir(parents=True, exist_ok=True)
    work_dir = args.output / ".work"
    work_dir.mkdir(exist_ok=True)

    gml_files = sorted([*args.input.glob("*.gml"), *args.input.glob("*.gml.gz")])
    if not gml_files:
        print(f"No .gml files in {args.input}.", file=sys.stderr)
        return 1

    if args.incremental:
        gml_files = [g for g in gml_files if not (args.output / g.stem / "tileset.json").exists()]
        print(f"[incremental] {len(gml_files)} tiles to (re)convert.")

    failures: list[tuple[str, str]] = []
    with ProcessPoolExecutor(max_workers=args.workers) as exe:
        futures = {
            exe.submit(process_tile, (g, work_dir, args.output, args.draco)): g for g in gml_files
        }
        for f in tqdm(as_completed(futures), total=len(futures), desc="Converting"):
            name, ok, err = f.result()
            if not ok:
                failures.append((name, err))

    merge_root_tileset(args.output)
    shutil.rmtree(work_dir, ignore_errors=True)

    if failures:
        print(f"[lod2] {len(failures)} tiles failed:", file=sys.stderr)
        for name, err in failures[:10]:
            print(f"  - {name}: {err}", file=sys.stderr)
        return 2

    print(f"[lod2] Done. Tileset: {args.output}/tileset.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
