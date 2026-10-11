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
  PostgreSqlPage: TInputQueryWizardPage;
  PostgreSqlConnectionString: String;
  NeedsInitialPassword: Boolean;
  NeedsPostgreSqlConnection: Boolean;
  InstallReady: Boolean;

function HasRequiredPasswordCharacters(const Value: String): Boolean;
var
  Index: Integer;
  HasUppercase: Boolean;
  HasLowercase: Boolean;
  HasDigit: Boolean;
begin
  HasUppercase := False;
  HasLowercase := False;
  HasDigit := False;
  for Index := 1 to Length(Value) do begin
    if (Value[Index] >= 'A') and (Value[Index] <= 'Z') then HasUppercase := True;
    if (Value[Index] >= 'a') and (Value[Index] <= 'z') then HasLowercase := True;
    if (Value[Index] >= '0') and (Value[Index] <= '9') then HasDigit := True;
  end;
  Result := HasUppercase and HasLowercase and HasDigit;
end;

function ExistingCafeInstall: Boolean;
begin
  Result := FileExists(ExpandConstant('{commonappdata}\Pnara\install-state.json'));
end;

procedure InitializeWizard;
begin
  NeedsInitialPassword := not ExistingCafeInstall;
  NeedsPostgreSqlConnection := not ExistingCafeInstall;

  if NeedsPostgreSqlConnection then begin
    PostgreSqlPage := CreateInputQueryPage(wpWelcome,
      'Connect to PostgreSQL',
      'Install PostgreSQL locally and create the Pnara database and application role first.',
      'Enter an Npgsql connection string. Example: Host=localhost;Port=5432;Database=pnara;Username=pnara_app;Password=your-password. Grant this role ownership of the pnara database so migrations can create and update its schema.');
    PostgreSqlPage.Add('PostgreSQL connection string:', True);
  end;

  if NeedsInitialPassword then begin
    AdminPasswordPage := CreateInputQueryPage(wpSelectDir,
      'Create the first administrator password',
      'This password protects the initial Pnara Cafe administrator account.',
      'Enter at least 12 characters, including an uppercase Latin letter, a lowercase Latin letter, and a digit. A symbol is optional. The password is stored as an Identity password hash in the database.');
    AdminPasswordPage.Add('Administrator password:', True);
    AdminPasswordPage.Add('Confirm password:', True);
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Password: String;
  ConnectionStringLowercase: String;
begin
  Result := True;
  if NeedsPostgreSqlConnection and (CurPageID = PostgreSqlPage.ID) then begin
    PostgreSqlConnectionString := PostgreSqlPage.Values[0];
    ConnectionStringLowercase := Lowercase(PostgreSqlConnectionString);
    if (Pos('host=', ConnectionStringLowercase) = 0) or
       (Pos('database=', ConnectionStringLowercase) = 0) or
       (Pos('username=', ConnectionStringLowercase) = 0) or
       (Pos('password=', ConnectionStringLowercase) = 0) then begin
      MsgBox('Enter a PostgreSQL connection string containing Host, Database, Username, and Password.', mbError, MB_OK);
      Result := False;
      exit;
    end;
  end;

  if NeedsInitialPassword and (CurPageID = AdminPasswordPage.ID) then begin
    Password := AdminPasswordPage.Values[0];
    if Length(Password) < 12 then begin
      MsgBox('Choose a password with at least 12 characters.', mbError, MB_OK);
      Result := False;
      exit;
    end;
    if not HasRequiredPasswordCharacters(Password) then begin
      MsgBox('Include at least one uppercase Latin letter, one lowercase Latin letter, and one digit. A symbol is optional.', mbError, MB_OK);
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
  ConnectionPath: String;
  ErrorPath: String;
  Parameters: String;
  ErrorText: String;
  ErrorLines: TArrayOfString;
  Index: Integer;
begin
  if CurStep = ssPostInstall then begin
    InstallReady := False;
    WizardForm.StatusLabel.Caption := 'Connecting to PostgreSQL, backing up existing data, applying migrations, and starting the local service...';
    WizardForm.ProgressGauge.Style := npbstMarquee;
    WizardForm.Update;

    PowerShellPath := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
    ScriptPath := ExpandConstant('{app}\Configure-Machine.ps1');
    PasswordPath := ExpandConstant('{tmp}\PnaraInitialAdminPassword.txt');
    ConnectionPath := ExpandConstant('{tmp}\PnaraPostgreSqlConnection.txt');
    ErrorPath := ExpandConstant('{tmp}\CafeSetup-error.txt');
    DeleteFile(ErrorPath);
    Parameters := '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ScriptPath + '" -InstallRoot "' + ExpandConstant('{app}') + '" -DataRoot "' + ExpandConstant('{commonappdata}\Pnara') + '" -AppVersion "{#AppVersion}" -ErrorFile "' + ErrorPath + '"';

    if NeedsPostgreSqlConnection then begin
      if not SaveStringToFile(ConnectionPath, UTF8Encode(PostgreSqlPage.Values[0]), False) then
        RaiseException('The PostgreSQL connection string could not be passed securely to setup.');
      Parameters := Parameters + ' -PostgreSqlConnectionFile "' + ConnectionPath + '"';
    end;

    if NeedsInitialPassword then begin
      if not SaveStringToFile(PasswordPath, UTF8Encode(AdminPasswordPage.Values[0]), False) then
        RaiseException('The initial administrator password could not be passed securely to setup.');
      Parameters := Parameters + ' -AdminPasswordFile "' + PasswordPath + '"';
    end;
    if not Exec(PowerShellPath, Parameters, ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ExitCode) then
      ExitCode := -1;
    DeleteFile(PasswordPath);
    DeleteFile(ConnectionPath);

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
