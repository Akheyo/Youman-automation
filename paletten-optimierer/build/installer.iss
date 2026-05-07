; Inno Setup-Skript für Paletten Optimierer
; Voraussetzung: Inno Setup 6.x
; Wird vom GitHub-Workflow per ISCC.exe aufgerufen.

#define MyAppName "Paletten Optimierer"
#ifndef MyAppVersion
  #define MyAppVersion GetEnv('APP_VERSION')
#endif
#if MyAppVersion == ""
  #define MyAppVersion "1.0.0"
#endif
#define MyAppPublisher "Paletten Optimierer"
#define MyAppExeName "PalettenOptimierer.exe"

[Setup]
AppId={{5CA9D01B-4DF5-41A6-9298-A501610FCA2F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL=https://github.com/akheyo/youman-automation
DefaultDirName={autopf}\PalettenOptimierer
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
OutputDir=..\dist\installer
OutputBaseFilename=PalettenOptimierer-Setup-{#MyAppVersion}
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName} {#MyAppVersion}
VersionInfoVersion={#MyAppVersion}.0
VersionInfoCompany={#MyAppPublisher}
VersionInfoProductName={#MyAppName}
CloseApplications=force

[Languages]
Name: "german"; MessagesFile: "compiler:Languages\German.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "dist\PalettenOptimierer\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{userdesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent

[Code]
function IsAppRunning(const FileName: string): Boolean;
var
  FSWbemLocator: Variant;
  FWMIService: Variant;
  FWbemObjectSet: Variant;
begin
  Result := False;
  try
    FSWbemLocator := CreateOleObject('WBEMScripting.SWBEMLocator');
    FWMIService := FSWbemLocator.ConnectServer('', 'root\CIMV2', '', '');
    FWbemObjectSet := FWMIService.ExecQuery(
      Format('SELECT Name FROM Win32_Process WHERE Name="%s"', [FileName]));
    Result := not VarIsNull(FWbemObjectSet) and (FWbemObjectSet.Count > 0);
    FWbemObjectSet := Unassigned;
    FWMIService := Unassigned;
    FSWbemLocator := Unassigned;
  except
    Result := False;
  end;
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  while IsAppRunning('{#MyAppExeName}') do
  begin
    if MsgBox(
      'Paletten Optimierer läuft noch. Bitte beenden Sie das Programm und klicken Sie OK.',
      mbConfirmation, MB_OKCANCEL) = IDCANCEL then
    begin
      Result := False;
      Exit;
    end;
  end;
end;
