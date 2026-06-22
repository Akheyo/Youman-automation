from datetime import date

from pvengine.config import eeg_feed_in_ct_kwh


def test_eeg_uses_dated_rate_not_hardcoded():
    # Vor erster Stützstelle → erster bekannter Satz
    early = eeg_feed_in_ct_kwh(8.0, date(2022, 1, 1))
    assert early == 8.20

    # Späteres Datum → degressiv niedriger
    later = eeg_feed_in_ct_kwh(8.0, date(2026, 3, 1))
    assert later < early


def test_eeg_blended_rate_for_large_systems():
    small = eeg_feed_in_ct_kwh(10.0, date(2025, 8, 1))
    large = eeg_feed_in_ct_kwh(20.0, date(2025, 8, 1))
    # 20 kWp wird anteilig vergütet → Mischsatz zwischen klein und mittel
    assert 6.80 < large < small == 7.86


def test_eeg_monotonic_decreasing_over_time():
    rates = [
        eeg_feed_in_ct_kwh(9.0, date(y, 6, 1))
        for y in (2023, 2024, 2025, 2026)
    ]
    assert rates == sorted(rates, reverse=True)
