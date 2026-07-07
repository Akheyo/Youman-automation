# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller-Spec für Anfragen-Radar (onedir, Streamlit-kompatibel).

Streamlit führt app.py als Skript aus, deshalb werden app.py und die
Quellpakete (core/db/sources/ui) als Daten mitgeliefert und zur Laufzeit
aus _MEIPASS importiert.

Build (aus dem Ordner anfragen-radar/):
    pyinstaller packaging/anfragen_radar.spec --noconfirm
"""
import os

from PyInstaller.utils.hooks import collect_all

block_cipher = None
project_root = os.path.abspath(os.path.join(SPECPATH, ".."))

datas = [
    (os.path.join(project_root, "app.py"), "."),
    (os.path.join(project_root, "core"), "core"),
    (os.path.join(project_root, "db"), "db"),
    (os.path.join(project_root, "sources"), "sources"),
    (os.path.join(project_root, "ui"), "ui"),
]
binaries = []
hiddenimports = [
    "imaplib",
    "email.policy",
    "core", "db", "sources", "ui",
]

# Streamlit & Co. brauchen ihre Paket-Daten (Static Files, Metadata)
for package in ["streamlit", "altair", "anthropic", "bs4", "lxml",
                "cryptography", "requests", "pandas"]:
    pkg_datas, pkg_binaries, pkg_hidden = collect_all(package)
    datas += pkg_datas
    binaries += pkg_binaries
    hiddenimports += pkg_hidden

a = Analysis(
    [os.path.join(project_root, "run.py")],
    pathex=[project_root],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "pytest"],
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="AnfragenRadar",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,  # Konsole sichtbar lassen: Server-Log, sauberes Beenden
    disable_windowed_traceback=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    name="AnfragenRadar",
)
