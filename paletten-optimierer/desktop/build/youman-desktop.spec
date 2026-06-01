# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller-Spec für die Youman Desktop-App (CustomTkinter)."""

from PyInstaller.utils.hooks import collect_all, collect_data_files, copy_metadata


# CustomTkinter braucht seine Themen + Fonts
try:
    ctk_datas, ctk_binaries, ctk_hidden = collect_all("customtkinter")
except Exception:
    ctk_datas, ctk_binaries, ctk_hidden = [], [], []

try:
    pil_datas, pil_binaries, pil_hidden = collect_all("PIL")
except Exception:
    pil_datas, pil_binaries, pil_hidden = [], [], []

# Engines aus mini/ brauchen ihre Dependencies
try:
    openpyxl_datas, openpyxl_binaries, openpyxl_hidden = collect_all("openpyxl")
except Exception:
    openpyxl_datas, openpyxl_binaries, openpyxl_hidden = [], [], []

try:
    pulp_datas, pulp_binaries, pulp_hidden = collect_all("pulp")
except Exception:
    pulp_datas, pulp_binaries, pulp_hidden = [], [], []

try:
    fpdf_datas, fpdf_binaries, fpdf_hidden = collect_all("fpdf")
except Exception:
    fpdf_datas, fpdf_binaries, fpdf_hidden = [], [], []

metadata = []
for mod in ("customtkinter", "openpyxl", "pulp", "fpdf2", "Pillow"):
    try:
        metadata += copy_metadata(mod)
    except Exception:
        pass


import os as _os
_status_quelle = "../../mini/selbsttest_status.json"
_has_status = _os.path.exists(_status_quelle)

# Eigene Module flach im Bundle ablegen — alle Imports sind absolut,
# also kein Package-Layout noetig.
desktop_datas = [
    # Desktop-App
    ("../app_window.py", "."),
    ("../engines.py", "."),
    ("../state.py", "."),
    ("../theme.py", "."),
    # tabs/ + widgets/ bleiben Packages mit __init__.py
    ("../tabs/__init__.py", "tabs"),
    ("../tabs/dashboard.py", "tabs"),
    ("../tabs/import_tab.py", "tabs"),
    ("../tabs/optimierung.py", "tabs"),
    ("../tabs/ergebnisse.py", "tabs"),
    ("../tabs/katalog.py", "tabs"),
    ("../tabs/auftraege.py", "tabs"),
    ("../widgets/__init__.py", "widgets"),
    ("../widgets/card.py", "widgets"),
    ("../widgets/kpi.py", "widgets"),
    # Engines aus mini/
    ("../../mini/palettenkatalog.py", "."),
    ("../../mini/auftraege.py", "."),
    ("../../mini/optimierer_kern.py", "."),
    ("../../mini/import_excel.py", "."),
    ("../../mini/import_verlauf.py", "."),
    ("../../mini/audit_log.py", "."),
    ("../../mini/_build_info.py", "."),
]

# Logo + Assets
_logo = "../../assets/youman_logo.png"
if _os.path.exists(_logo):
    desktop_datas.append((_logo, "assets"))


a = Analysis(
    ["../main.py"],
    pathex=["..", "../../mini"],
    binaries=ctk_binaries + pil_binaries + openpyxl_binaries
             + pulp_binaries + fpdf_binaries,
    datas=desktop_datas + metadata + ctk_datas + pil_datas
          + openpyxl_datas + pulp_datas + fpdf_datas,
    hiddenimports=(ctk_hidden + pil_hidden + openpyxl_hidden
                    + pulp_hidden + fpdf_hidden
                    + ["tkinter", "tkinter.ttk", "tkinter.filedialog",
                        "tkinter.messagebox",
                        "PIL", "PIL.Image", "PIL.ImageTk",
                        "openpyxl.cell._writer",
                        "pulp.apis", "pulp.apis.coin_api"]),
    hookspath=[], hooksconfig={}, runtime_hooks=[],
    excludes=["matplotlib", "PyQt5", "PyQt6", "PySide2", "PySide6",
              "IPython", "jupyter", "notebook", "pytest", "sphinx",
              "streamlit", "pywebview"],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz, a.scripts, [],
    exclude_binaries=True,
    name="Youman",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False, upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon="icon.ico",
)

coll = COLLECT(
    exe, a.binaries, a.zipfiles, a.datas,
    strip=False, upx=False, upx_exclude=[],
    name="Youman",
)
