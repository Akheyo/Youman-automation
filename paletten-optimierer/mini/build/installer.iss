; Inno Setup Script — Paletten Mini
; Eigene AppId/GUID — parallel zu "Youman" installierbar.

#define MyAppName "Paletten Mini"
#define MyAppVersion GetEnv("APP_VERSION")
#if MyAppVersion == ""
  #define MyAppVersion "1.0.0"
#endif
#define MyAppPublisher "Youman"
#define MyAppExeName "PalettenMini.exe"

[Setup]
; EIGENE AppId — kollidiert nicht mit der Hauptapp "Youman"
AppId={{B9F6C2A1-7E4D-4C0B-A3D6-1F8D6E5A2B71}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\PalettenMini
DefaultGroupName=Paletten Mini
DisableProgramGroupPage=yes
OutputBaseFilename=PalettenMini-Setup-{#MyAppVersion}
OutputDir=output
Compression=lzma
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

[Languages]
Name: "german"; MessagesFile: "compiler:Languages\German.isl"

[Tasks]
Name: "desktopicon"; Description: "Desktop-Verknüpfung erstellen"; GroupDescription: "Verknüpfungen:"

[Files]
Source: "dist\PalettenMini\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Paletten Mini jetzt starten"; Flags: nowait postinstall skipifsilent
