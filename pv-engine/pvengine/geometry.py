"""Komponente A — Geometrie-Layer.

Aufgabe: Standort + Dachflächen aufbereiten (Report S. 6–8, 20–22).

MVP: Dach manuell (tilt/azimuth/area). Optional Geocoding einer Adresse
über Nominatim (OpenStreetMap). Auto-Dachgeometrie aus LoD2/Google Solar
ist bewusst Phase 4 (siehe README) — die Schnittstelle (`RoofPlane.polygon`)
ist dafür schon vorgesehen.
"""
from __future__ import annotations

import math

import requests

from .models import Location, RoofPlane

_NOMINATIM = "https://nominatim.openstreetmap.org/search"


def geocode(address: str, timeout: float = 8.0) -> Location | None:
    """Adresse → Koordinaten via Nominatim. Gibt None bei Fehler/Offline."""
    if not address.strip():
        return None
    try:
        resp = requests.get(
            _NOMINATIM,
            params={"q": address, "format": "json", "limit": 1},
            headers={"User-Agent": "pvengine/0.1 (planning)"},
            timeout=timeout,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data:
            return None
        hit = data[0]
        return Location(
            address=hit.get("display_name", address),
            latitude=float(hit["lat"]),
            longitude=float(hit["lon"]),
        )
    except (requests.RequestException, ValueError, KeyError):
        return None


def polygon_area_m2(polygon: list[tuple[float, float]]) -> float:
    """Fläche eines lon/lat-Polygons in m² (äquirektangulare Projektion).

    Ausreichend genau für Dachflächen (< wenige hundert Meter Kantenlänge).
    """
    if len(polygon) < 3:
        return 0.0
    lat0 = math.radians(sum(p[1] for p in polygon) / len(polygon))
    r = 6_371_000.0
    pts = [
        (math.radians(lon) * r * math.cos(lat0), math.radians(lat) * r)
        for lon, lat in polygon
    ]
    area = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0


def resolve_roof_area(roof: RoofPlane) -> float:
    """Nutzbare *geneigte* Dachfläche bestimmen.

    Polygonflächen aus der Karte sind Grundrissflächen (horizontal) und
    werden mit 1/cos(tilt) auf die geneigte Dachfläche hochgerechnet.
    """
    if roof.area_m2 is not None:
        return roof.area_m2
    if roof.polygon:
        ground = polygon_area_m2(roof.polygon)
        return ground / max(math.cos(math.radians(roof.tilt_deg)), 0.1)
    return 0.0
