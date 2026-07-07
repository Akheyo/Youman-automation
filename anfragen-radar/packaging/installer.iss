; Inno-Setup-Skript für Anfragen-Radar
; Erwartet den PyInstaller-Output unter dist\AnfragenRadar (onedir).
; Build: ISCC.exe packaging\installer.iss /DAppVersion=1.0.0

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
AppId={{7F3B7C1E-9A44-4C1D-8B4E-2D5E9A7C4F10}}
AppName=Anfragen-Radar
AppVersion={#AppVersion}
AppPublisher=Komplett Konzept Verwertungs GmbH
DefaultDirName={autopf}\AnfragenRadar
DefaultGroupName=Anfragen-Radar
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=AnfragenRadar-Setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
UninstallDisplayName=Anfragen-Radar

[Languages]
Name: "german"; MessagesFile: "compiler:Languages\German.isl"

[Tasks]
Name: "desktopicon"; Description: "Desktop-Verknüpfung erstellen"; GroupDescription: "Zusätzliche Symbole:"
Name: "autostart"; Description: "Beim Windows-Start automatisch starten"; GroupDescription: "Autostart:"; Flags: unchecked

[Files]
Source: "..\dist\AnfragenRadar\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Anfragen-Radar"; Filename: "{app}\AnfragenRadar.exe"
Name: "{autodesktop}\Anfragen-Radar"; Filename: "{app}\AnfragenRadar.exe"; Tasks: desktopicon
Name: "{userstartup}\Anfragen-Radar"; Filename: "{app}\AnfragenRadar.exe"; Tasks: autostart

[Run]
Filename: "{app}\AnfragenRadar.exe"; Description: "Anfragen-Radar jetzt starten"; Flags: nowait postinstall skipifsilent
