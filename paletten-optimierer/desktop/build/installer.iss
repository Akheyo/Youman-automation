; Inno Setup Script — Youman Desktop-App
#define MyAppName "Youman"
#define MyAppVersion GetEnv("APP_VERSION")
#if MyAppVersion == ""
  #define MyAppVersion "2.0.0"
#endif
#define MyAppPublisher "Youman Automation"
#define MyAppExeName "Youman.exe"

[Setup]
AppId={{4A29B8C3-1F5D-4E7B-9A3F-2C8B7D6F1E45}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\Youman
DefaultGroupName=Youman
DisableProgramGroupPage=yes
OutputBaseFilename=Youman-Setup-{#MyAppVersion}
OutputDir=output
Compression=lzma
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
SetupIconFile=icon.ico

[Languages]
Name: "german"; MessagesFile: "compiler:Languages\German.isl"

[Tasks]
Name: "desktopicon"; Description: "Desktop-Verknüpfung erstellen"; GroupDescription: "Verknüpfungen:"

[Files]
Source: "dist\Youman\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Youman jetzt starten"; Flags: nowait postinstall skipifsilent
