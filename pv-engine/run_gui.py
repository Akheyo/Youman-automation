"""Start der PV-Planungs-Engine als Desktop-App.

    python run_gui.py

Dient zugleich als Einstiegspunkt für den Windows-.exe-Build (PyInstaller).
"""
from pvengine.gui import main

if __name__ == "__main__":
    raise SystemExit(main())
