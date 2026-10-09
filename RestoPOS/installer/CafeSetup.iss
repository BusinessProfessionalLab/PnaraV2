#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif

[Setup]
AppId={{C3C38D0D-0318-4C4C-9BC5-D041A5E5AB29}
AppName=Pnara Cafe
AppVersion={#AppVersion}
AppVerName=Pnara Cafe {#AppVersion}
AppPublisher=Pnara
DefaultDirName={autopf}\Pnara Cafe
DefaultGroupName=Pnara Cafe
DisableProgramGroupPage=yes
UsePreviousAppDir=yes
Uninstallable=yes
OutputDir=..\artifacts\cafe-build\installer
OutputBaseFilename=CafeSetup
SetupIconFile=assets\Pnara.ico
UninstallDisplayIcon={app}\Pnara.ico
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
MinVersion=10.0
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
Compression=lzma2/ultra64
SolidCompression=yes
SetupLogging=yes
VersionInfoCompany=Pnara
VersionInfoDescription=Pnara Cafe installer
VersionInfoProductName=Pnara Cafe
VersionInfoProductVersion={#AppVersion}
VersionInfoVersion={#AppVersion}.0

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: checkedonce

[Files]
Source: "..\artifacts\cafe-build\payload\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "assets\Pnara.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Pnara Cafe"; Filename: "{app}\CafeLauncher.exe"; WorkingDir: "{app}"; IconFilename: "{app}\Pnara.ico"
Name: "{autodesktop}\Pnara Cafe"; Filename: "{app}\CafeLauncher.exe"; WorkingDir: "{app}"; IconFilename: "{app}\Pnara.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\CafeLauncher.exe"; Description: "Launch Pnara Cafe"; Flags: postinstall nowait skipifsilent; Check: IsInstallReady

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File ""{app}\Configure-Machine.ps1"" -InstallRoot ""{app}"" -UninstallService"; Flags: runhidden waituntilterminated; RunOnceId: "RemoveCafeApiService"

[Code]
var
  AdminPasswordPage: TInputQueryWizardPage;
  SqlLicensePage: TWizardPage;
  SqlLicenseCheck: TNewCheckBox;
  NeedsInitialPassword: Boolean;
  NeedsSqlLicense: Boolean;
  InstallReady: Boolean;

function SqlExpressServiceExists: Boolean;
begin
  Result := RegKeyExists(HKLM, 'SYSTEM\CurrentControlSet\Services\MSSQL$SQLEXPRESS');
end;

function ExistingCafeInstall: Boolean;
begin
  Result := FileExists(ExpandConstant('{commonappdata}\Pnara\install-state.json'));
end;

procedure SqlLicenseLinkClick(Sender: TObject);
var
  ErrorCode: Integer;
begin
  ShellExec('open',
    'https://www.microsoft.com/content/dam/microsoft/usetm/documents/sql-server/sql-server-2025-developer%2C-express%2C-evaluation/retail/SQL_Server_2025_Developer_Express_and_Evaluation_Edition_English.pdf',
    '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode);
end;

procedure InitializeWizard;
var
  Text: TNewStaticText;
begin
  NeedsSqlLicense := not SqlExpressServiceExists;
  NeedsInitialPassword := not ExistingCafeInstall;

  if NeedsSqlLicense then begin
    SqlLicensePage := CreateCustomPage(wpWelcome,
      'SQL Server Express prerequisite',
      'Pnara needs a local SQL Server database to store cafe data.');
    Text := TNewStaticText.Create(SqlLicensePage);
    Text.Parent := SqlLicensePage.Surface;
    Text.Left := ScaleX(0);
    Text.Top := ScaleY(8);
    Text.Width := SqlLicensePage.SurfaceWidth;
    Text.Height := ScaleY(52);
    Text.AutoSize := False;
    Text.WordWrap := True;
    Text.Caption := 'SQL Server Express 2025 will be downloaded from Microsoft only if no compatible local SQLEXPRESS instance is found. The download requires internet access and several gigabytes of free disk space.';

    SqlLicenseCheck := TNewCheckBox.Create(SqlLicensePage);
    SqlLicenseCheck.Parent := SqlLicensePage.Surface;
    SqlLicenseCheck.Left := ScaleX(0);
    SqlLicenseCheck.Top := ScaleY(76);
    SqlLicenseCheck.Width := SqlLicensePage.SurfaceWidth;
    SqlLicenseCheck.Height := ScaleY(30);
    SqlLicenseCheck.Caption := 'I have reviewed and accept the SQL Server 2025 Express license terms.';

    Text := TNewStaticText.Create(SqlLicensePage);
    Text.Parent := SqlLicensePage.Surface;
    Text.Left := ScaleX(0);
    Text.Top := ScaleY(112);
    Text.Width := SqlLicensePage.SurfaceWidth;
    Text.Height := ScaleY(24);
    Text.Font.Color := clBlue;
    Text.Cursor := crHand;
    Text.Caption := 'Open Microsoft SQL Server 2025 Express license terms';
    Text.OnClick := @SqlLicenseLinkClick;
  end;

  if NeedsInitialPassword then begin
    AdminPasswordPage := CreateInputQueryPage(wpSelectDir,
      'Create the first administrator password',
      'This password protects the initial Pnara Cafe administrator account.',
      'Enter a password of at least 12 characters. It is stored as an Identity password hash in the database.');
    AdminPasswordPage.Add('Administrator password:', True);
    AdminPasswordPage.Add('Confirm password:', True);
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Password: String;
begin
  Result := True;
  if NeedsSqlLicense and (CurPageID = SqlLicensePage.ID) and not SqlLicenseCheck.Checked then begin
    MsgBox('Review and accept the SQL Server Express terms before continuing.', mbError, MB_OK);
    Result := False;
    exit;
  end;

  if NeedsInitialPassword and (CurPageID = AdminPasswordPage.ID) then begin
    Password := AdminPasswordPage.Values[0];
    if Length(Password) < 12 then begin
      MsgBox('Choose a password with at least 12 characters.', mbError, MB_OK);
      Result := False;
      exit;
    end;
    if Password <> AdminPasswordPage.Values[1] then begin
      MsgBox('The passwords do not match.', mbError, MB_OK);
      Result := False;
      exit;
    end;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ExitCode: Integer;
  PowerShellPath: String;
  Parameters: String;
begin
  Result := '';
  if not RegKeyExists(HKLM, 'SYSTEM\CurrentControlSet\Services\CafeApiService') then exit;

  PowerShellPath := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
  Parameters := '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\Configure-Machine.ps1') + '" -InstallRoot "' + ExpandConstant('{app}') + '" -PrepareUpgrade';
  if not Exec(PowerShellPath, Parameters, '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then
    Result := 'Pnara Cafe could not stop its Windows service before the upgrade.'
  else if ExitCode <> 0 then
    Result := 'Pnara Cafe could not stop its Windows service before the upgrade. Restart Windows and run setup again.';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ExitCode: Integer;
  PowerShellPath: String;
  ScriptPath: String;
  PasswordPath: String;
  ErrorPath: String;
  Parameters: String;
  ErrorText: String;
  ErrorLines: TArrayOfString;
  Index: Integer;
begin
  if CurStep = ssPostInstall then begin
    InstallReady := False;
    WizardForm.StatusLabel.Caption := 'Configuring SQL Server, backing up existing data, applying migrations, and starting the local service...';
    WizardForm.ProgressGauge.Style := npbstMarquee;
    WizardForm.Update;

    PowerShellPath := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
    ScriptPath := ExpandConstant('{app}\Configure-Machine.ps1');
    PasswordPath := ExpandConstant('{tmp}\PnaraInitialAdminPassword.txt');
    ErrorPath := ExpandConstant('{tmp}\CafeSetup-error.txt');
    DeleteFile(ErrorPath);
    Parameters := '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ScriptPath + '" -InstallRoot "' + ExpandConstant('{app}') + '" -DataRoot "' + ExpandConstant('{commonappdata}\Pnara') + '" -SqlInstance "SQLEXPRESS" -AppVersion "{#AppVersion}" -ErrorFile "' + ErrorPath + '"';

    if NeedsInitialPassword then begin
      if not SaveStringToFile(PasswordPath, UTF8Encode(AdminPasswordPage.Values[0]), False) then
        RaiseException('The initial administrator password could not be passed securely to setup.');
      Parameters := Parameters + ' -AdminPasswordFile "' + PasswordPath + '"';
    end;
    if NeedsSqlLicense then
      Parameters := Parameters + ' -SqlLicenseAccepted';

    if not Exec(PowerShellPath, Parameters, ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ExitCode) then
      ExitCode := -1;
    DeleteFile(PasswordPath);

    if ExitCode <> 0 then begin
      ErrorText := 'Pnara Cafe setup could not complete. No success will be reported.';
      if LoadStringsFromFile(ErrorPath, ErrorLines) and (GetArrayLength(ErrorLines) > 0) then begin
        ErrorText := 'Pnara Cafe setup failed:';
        for Index := 0 to GetArrayLength(ErrorLines) - 1 do
          ErrorText := ErrorText + #13#10 + ErrorLines[Index];
      end;
      MsgBox(ErrorText, mbError, MB_OK);
      RaiseException('Service or database initialization failed. Review the message above and setup log before retrying.');
    end;

    InstallReady := True;
  end;

  if CurStep = ssDone then begin
    DeleteFile(ExpandConstant('{tmp}\PnaraInitialAdminPassword.txt'));
    DeleteFile(ExpandConstant('{tmp}\CafeSetup-error.txt'));
  end;
end;

function IsInstallReady: Boolean;
begin
  Result := InstallReady;
end;
