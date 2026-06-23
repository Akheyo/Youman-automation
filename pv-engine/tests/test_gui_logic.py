"""Tests der GUI-freien Rechenlogik (ohne tkinter)."""
from pvengine.gui import build_project, compute, format_results
from pvengine.models import ProjectInput


def _values(**over):
    v = {
        "project_name": "Test", "tilt": "35", "azimuth": "180", "area": "60",
        "module_wp": "440", "inverter_kw": "8", "battery_kwh": "10",
        "consumption": "4500", "price": "35", "shading": "2.9",
        "lat": "51.84", "lon": "6.86",
    }
    v.update(over)
    return v


def test_build_project_from_fields():
    p = build_project(_values())
    assert isinstance(p, ProjectInput)
    assert p.roofs[0].tilt_deg == 35
    assert p.roofs[0].area_m2 == 60
    assert p.battery.capacity_kwh == 10
    assert p.inverter.pac_nom_w == 8000


def test_build_project_module_count_overrides_area():
    p = build_project(_values(module_count="18"))
    assert p.roofs[0].module_count == 18
    assert p.roofs[0].area_m2 is None


def test_build_project_handles_comma_decimals():
    p = build_project(_values(tilt="32,5", shading="2,9"))
    assert p.roofs[0].tilt_deg == 32.5
    assert p.shading_loss_pct == 2.9


def test_compute_and_format_offline():
    res = compute(_values(), allow_network=False)
    assert res.layout.kwp > 0
    text = format_results(res)
    assert "Spez. Ertrag" in text
    assert "Amortisation" in text
    assert "kWp" in text
