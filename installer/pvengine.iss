; Inno Setup Skript — erzeugt PV-Planungs-Engine-Setup.exe
; Installiert die Desktop-App (PyInstaller-Onefile) mit Startmenü-/Desktop-
; Verknüpfung und Deinstallation. Kein Admin nötig (Installation pro Benutzer).

#define MyAppName "PV-Planungs-Engine"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "Youman / A&B Solarenergy"
#define MyAppExeName "PV-Planungs-Engine.exe"

[Setup]
AppId={{8F3C7A21-5D4E-4B9A-9C2E-7A1B2C3D4E5F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=Output
OutputBaseFilename=PV-Planungs-Engine-Setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "de"; MessagesFile: "compiler:Languages\German.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\pv-engine\dist\PV-Planungs-Engine.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent
