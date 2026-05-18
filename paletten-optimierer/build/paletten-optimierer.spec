# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller-Spec für den Paletten Optimierer.

Streamlit hat viele dynamische Imports und liest zur Laufzeit Package-
Metadaten — beides muss explizit eingesammelt werden, sonst startet das
gepackte Binary nicht.
"""

import os
from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_data_files, copy_metadata


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


# Streamlit's Frontend-Static-Files explizit nachziehen.
# `collect_all` packt sie in modernen PyInstaller-Versionen meist mit ein,
# aber wir sind robust und ergänzen sie noch einmal mit collect_data_files.
streamlit_static = collect_data_files("streamlit", include_py_files=False)
streamlit_runtime_static = collect_data_files(
    "streamlit.runtime", include_py_files=False
)


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


# Eigene App-Module + Beispieldatei + Logo als Daten mitpacken
app_datas = [
    ("../app.py", "."),
    ("../optimizer.py", "."),
    ("../license_config.py", "."),
    ("../_build_info.py", "."),
    ("../db.py", "."),
    ("../excel_handler.py", "."),
    ("../pdf_generator.py", "."),
    ("../storage_handler.py", "."),
    ("../data/beispiel_palettenliste.xlsx", "data"),
    ("../assets/youman_logo.png", "assets"),
]


extra_hidden = [
    "streamlit",
    "streamlit.web",
    "streamlit.web.cli",
    "streamlit.web.bootstrap",
    "streamlit.runtime",
    "streamlit.runtime.scriptrunner",
    "streamlit.runtime.scriptrunner.magic_funcs",
    "streamlit.runtime.caching",
    "streamlit.runtime.caching.cache_data_api",
    "streamlit.runtime.caching.cache_resource_api",
    "openpyxl.cell._writer",
    "pkg_resources.py2_warn",
    "pkg_resources.markers",
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
    + streamlit_static
    + streamlit_runtime_static
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
    name="Youman",
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
    name="Youman",
)
