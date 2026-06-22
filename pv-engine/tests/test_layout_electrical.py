from pvengine.electrical import size_strings
from pvengine.layout import plan_layout
from pvengine.models import InverterSpec, ModuleSpec, RoofPlane


def test_layout_scales_with_area():
    module = ModuleSpec()
    small = plan_layout([RoofPlane(area_m2=20)], module)
    big = plan_layout([RoofPlane(area_m2=80)], module)
    assert big.total_modules > small.total_modules
    assert big.kwp == round(big.total_modules * module.pmpp_wp / 1000, 3)


def test_layout_respects_fixed_module_count():
    res = plan_layout([RoofPlane(module_count=18)], ModuleSpec())
    assert res.total_modules == 18


def test_layout_multiple_roofs():
    res = plan_layout(
        [RoofPlane(module_count=10), RoofPlane(module_count=8)], ModuleSpec()
    )
    assert res.total_modules == 18
    assert res.modules_per_roof == [10, 8]


def test_string_sizing_within_voltage_window():
    module = ModuleSpec()
    inv = InverterSpec()
    res = size_strings(module, inv, total_modules=18)
    # String-Spannung muss im MPPT-Fenster liegen
    assert inv.mppt_v_min <= res.string_voltage_stc_v <= inv.mppt_v_max
    assert res.modules_per_string >= 1
    assert res.strings_total >= 1


def test_string_sizing_zero_modules():
    res = size_strings(ModuleSpec(), InverterSpec(), 0)
    assert res.modules_per_string == 0
    assert res.notes
