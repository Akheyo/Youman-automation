# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller-Spec für den Paletten Optimierer.

Streamlit hat viele dynamische Imports und liest zur Laufzeit Package-
Metadaten — beides muss explizit eingesammelt werden, sonst startet das
gepackte Binary nicht.
"""

from PyInstaller.utils.hooks import collect_all, copy_metadata


# Vollständig einsammeln (datas + binaries + hidden imports)
streamlit_datas, streamlit_binaries, streamlit_hidden = collect_all("streamlit")
plotly_datas, plotly_binaries, plotly_hidden = collect_all("plotly")
altair_datas, altair_binaries, altair_hidden = collect_all("altair")
pandas_datas, pandas_binaries, pandas_hidden = collect_all("pandas")
openpyxl_datas, openpyxl_binaries, openpyxl_hidden = collect_all("openpyxl")
reportlab_datas, reportlab_binaries, reportlab_hidden = collect_all("reportlab")

try:
    pyarrow_datas, pyarrow_binaries, pyarrow_hidden = collect_all("pyarrow")
except Exception:
    pyarrow_datas, pyarrow_binaries, pyarrow_hidden = [], [], []

try:
    numpy_datas, numpy_binaries, numpy_hidden = collect_all("numpy")
except Exception:
    numpy_datas, numpy_binaries, numpy_hidden = [], [], []


# Package-Metadaten (Streamlit liest sie zur Laufzeit über importlib.metadata)
metadata = (
    copy_metadata("streamlit")
    + copy_metadata("pandas")
    + copy_metadata("plotly")
    + copy_metadata("altair")
    + copy_metadata("openpyxl")
    + copy_metadata("reportlab")
    + copy_metadata("numpy")
)
try:
    metadata += copy_metadata("pyarrow")
except Exception:
    pass


# Eigene App-Module + Beispieldatei als Daten mitpacken (Pfade relativ zum Spec)
app_datas = [
    ("../app.py", "."),
    ("../optimizer.py", "."),
    ("../excel_handler.py", "."),
    ("../pdf_generator.py", "."),
    ("../storage_handler.py", "."),
    ("../data/beispiel_palettenliste.xlsx", "data"),
]


extra_hidden = [
    "streamlit.web.cli",
    "streamlit.runtime.scriptrunner.magic_funcs",
    "streamlit.web.bootstrap",
    "openpyxl.cell._writer",
]


a = Analysis(
    ["../run_app.py"],
    pathex=["..", "."],
    binaries=streamlit_binaries
    + plotly_binaries
    + altair_binaries
    + pandas_binaries
    + openpyxl_binaries
    + reportlab_binaries
    + pyarrow_binaries
    + numpy_binaries,
    datas=app_datas
    + metadata
    + streamlit_datas
    + plotly_datas
    + altair_datas
    + pandas_datas
    + openpyxl_datas
    + reportlab_datas
    + pyarrow_datas
    + numpy_datas,
    hiddenimports=streamlit_hidden
    + plotly_hidden
    + altair_hidden
    + pandas_hidden
    + openpyxl_hidden
    + reportlab_hidden
    + pyarrow_hidden
    + numpy_hidden
    + extra_hidden,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "matplotlib",
        "tkinter",
        "PyQt5",
        "PyQt6",
        "PySide2",
        "PySide6",
        "IPython",
        "jupyter",
        "notebook",
        "pytest",
        "sphinx",
    ],
    noarchive=False,
)


pyz = PYZ(a.pure, a.zipped_data, cipher=None)


exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="PalettenOptimierer",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon="icon.ico",
    version="version_info.txt",
)


coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="PalettenOptimierer",
)
