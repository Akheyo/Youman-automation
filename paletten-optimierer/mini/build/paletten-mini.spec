# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller-Spec für Paletten Mini (eigenständig)."""

from PyInstaller.utils.hooks import collect_all, collect_data_files, copy_metadata


streamlit_datas, streamlit_binaries, streamlit_hidden = collect_all("streamlit")
pandas_datas, pandas_binaries, pandas_hidden = collect_all("pandas")
openpyxl_datas, openpyxl_binaries, openpyxl_hidden = collect_all("openpyxl")
pulp_datas, pulp_binaries, pulp_hidden = collect_all("pulp")

try:
    pyarrow_datas, pyarrow_binaries, pyarrow_hidden = collect_all("pyarrow")
except Exception:
    pyarrow_datas, pyarrow_binaries, pyarrow_hidden = [], [], []

try:
    numpy_datas, numpy_binaries, numpy_hidden = collect_all("numpy")
except Exception:
    numpy_datas, numpy_binaries, numpy_hidden = [], [], []

streamlit_static = collect_data_files("streamlit", include_py_files=False)
streamlit_runtime_static = collect_data_files("streamlit.runtime", include_py_files=False)

metadata = (
    copy_metadata("streamlit")
    + copy_metadata("pandas")
    + copy_metadata("openpyxl")
    + copy_metadata("pulp")
    + copy_metadata("numpy")
)

# Eigene Mini-App-Module mitpacken
app_datas = [
    ("../app_mini.py", "."),
    ("../optimierer_kern.py", "."),
    ("../import_excel.py", "."),
    ("../_ui_chrome.py", "."),
    ("../_build_info.py", "."),
]

extra_hidden = [
    "streamlit", "streamlit.web", "streamlit.web.cli", "streamlit.web.bootstrap",
    "streamlit.runtime", "streamlit.runtime.scriptrunner",
    "streamlit.runtime.scriptrunner.magic_funcs",
    "streamlit.runtime.caching",
    "openpyxl.cell._writer",
    "pulp", "pulp.apis", "pulp.apis.coin_api",
]


a = Analysis(
    ["../run_mini.py"],
    pathex=["..", "."],
    binaries=streamlit_binaries + pandas_binaries + openpyxl_binaries
             + pulp_binaries + pyarrow_binaries + numpy_binaries,
    datas=app_datas + metadata + streamlit_datas
          + streamlit_static + streamlit_runtime_static
          + pandas_datas + openpyxl_datas + pulp_datas
          + pyarrow_datas + numpy_datas,
    hiddenimports=streamlit_hidden + pandas_hidden + openpyxl_hidden
                  + pulp_hidden + pyarrow_hidden + numpy_hidden + extra_hidden,
    hookspath=[], hooksconfig={}, runtime_hooks=[],
    excludes=["matplotlib", "tkinter", "PyQt5", "PyQt6", "PySide2",
              "PySide6", "IPython", "jupyter", "notebook", "pytest", "sphinx"],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz, a.scripts, [],
    exclude_binaries=True,
    name="PalettenMini",
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
    name="PalettenMini",
)
