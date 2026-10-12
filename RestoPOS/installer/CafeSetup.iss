#ifndef AppVersion
  #define AppVersion "1.4.0"
#endif

[Setup]
AppId={{C3C38D0D-0318-4C4C-9BC5-D041A5E5AB29}
AppName=پنارا کافه
AppVersion={#AppVersion}
AppVerName=پنارا کافه {#AppVersion}
AppPublisher=Pnara
DefaultDirName={autopf}\Pnara Cafe
DefaultGroupName=پنارا کافه
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
ShowLanguageDialog=no
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
Name: "farsi"; MessagesFile: "Farsi.isl"

[Messages]
farsi.WelcomeLabel1=به راه‌انداز نصب پنارا کافه خوش آمدید
farsi.WelcomeLabel2=این برنامه، فایل‌های پنارا کافه را روی رایانهٔ شما نصب می‌کند.
farsi.WizardReady=آمادهٔ نصب
farsi.ReadyLabel1=پس از کلیک روی «نصب»، راه‌اندازی پنارا کافه آغاز می‌شود.
farsi.ReadyLabel2a=برای شروع نصب روی «نصب» کلیک کنید یا برای بازبینی تنظیمات روی «قبلی» کلیک کنید.
farsi.ReadyLabel2b=برای شروع نصب روی «نصب» کلیک کنید.
farsi.WizardInstalling=در حال نصب
farsi.InstallingLabel=لطفاً تا پایان نصب پنارا کافه صبر کنید.
farsi.FinishedLabel=نصب پنارا کافه پایان یافت. برای بازکردن نرم‌افزار، میانبر دسکتاپ را اجرا کنید.
farsi.FinishedLabelNoIcons=نصب پنارا کافه پایان یافت.
farsi.ClickFinish=برای خروج از نصب روی «پایان» کلیک کنید.

[Files]
Source: "..\artifacts\cafe-build\payload\postgresql-18.6-1-windows-x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "..\artifacts\cafe-build\payload\RestoPOS.API.exe"; DestDir: "{tmp}"; Flags: dontcopy
Source: "..\artifacts\cafe-build\payload\issuer-public.pem"; DestDir: "{tmp}"; Flags: dontcopy
Source: "..\artifacts\cafe-build\payload\issuer-previous-public.pem"; DestDir: "{tmp}"; Flags: dontcopy
Source: "..\artifacts\cafe-build\payload\*"; DestDir: "{app}"; Excludes: "postgresql-18.6-1-windows-x64.exe"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "assets\Pnara.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\پنارا کافه"; Filename: "{app}\CafeLauncher.exe"; WorkingDir: "{app}"; IconFilename: "{app}\Pnara.ico"
Name: "{autodesktop}\پنارا کافه"; Filename: "{app}\CafeLauncher.exe"; WorkingDir: "{app}"; IconFilename: "{app}\Pnara.ico"

[Run]
Filename: "{app}\CafeLauncher.exe"; Description: "اجرای پنارا کافه"; Flags: postinstall nowait skipifsilent; Check: IsInstallReady

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File ""{app}\Configure-Machine.ps1"" -InstallRoot ""{app}"" -UninstallService"; Flags: runhidden waituntilterminated; RunOnceId: "RemoveCafeApiService"

[Code]
var
  LicensePage: TInputQueryWizardPage;
  InstallationCode: String;
  AdminPasswordPage: TInputQueryWizardPage;
  PostgreSqlAdminPage: TInputQueryWizardPage;
  NeedsInitialPassword: Boolean;
  NeedsInitialLicense: Boolean;
  NeedsInitialDatabase: Boolean;
  InstallReady: Boolean;
  InstallFailed: Boolean;

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

function VerifyEnteredLicense(const LicenseCode: String): Boolean;
var
  LicensePath: String;
  PublicKeyPath: String;
  PreviousPublicKeyPath: String;
  VerifierPath: String;
  ExitCode: Integer;
begin
  Result := False;
  LicensePath := ExpandConstant('{tmp}\PnaraLicensePreflight.txt');
  PublicKeyPath := ExpandConstant('{tmp}\issuer-public.pem');
  PreviousPublicKeyPath := ExpandConstant('{tmp}\issuer-previous-public.pem');
  VerifierPath := ExpandConstant('{tmp}\RestoPOS.API.exe');
  if not SaveStringToFile(LicensePath, UTF8Encode(Trim(LicenseCode)), False) then exit;
  ExtractTemporaryFile('issuer-public.pem');
  ExtractTemporaryFile('issuer-previous-public.pem');
  ExtractTemporaryFile('RestoPOS.API.exe');
  if Exec(VerifierPath,
    '--verify-offline-license "' + PublicKeyPath + '" "' + LicensePath + '" "' + InstallationCode + '" "' + PreviousPublicKeyPath + '"',
    '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then
    Result := ExitCode = 0;
  DeleteFile(LicensePath);
  DeleteFile(VerifierPath);
  DeleteFile(PublicKeyPath);
  DeleteFile(PreviousPublicKeyPath);
end;

procedure InitializeWizard;
var
  ExistingLicenseCode: AnsiString;
  ExistingInstallationCode: AnsiString;
begin
  NeedsInitialPassword := not ExistingCafeInstall;
  NeedsInitialLicense := not ExistingCafeInstall;
  NeedsInitialDatabase := not ExistingCafeInstall;

  LicensePage := CreateInputQueryPage(wpWelcome,
    'فعال‌سازی و نصب آفلاین',
    'کد درخواست ۸ رقمی را به صادرکنندهٔ لایسنس بدهید. پس از دریافت، لایسنس را در کادر دوم وارد کنید.',
    'کد درخواست برای این نصب نگه‌داری می‌شود و در ارتقاهای بعدی تغییر نمی‌کند.');
  if LoadStringFromFile(ExpandConstant('{commonappdata}\Pnara\installation-code'), ExistingInstallationCode) and
     (Length(Trim(ExistingInstallationCode)) = 8) then
    InstallationCode := Trim(ExistingInstallationCode)
  else begin
    InstallationCode := IntToStr(10000000 + Random(90000000));
  end;
  if not ForceDirectories(ExpandConstant('{commonappdata}\Pnara')) then
    RaiseException('پوشهٔ داده‌های پنارا ساخته نشد؛ Setup را با دسترسی مدیر اجرا کنید.');
  if not SaveStringToFile(ExpandConstant('{commonappdata}\Pnara\installation-code'), UTF8Encode(InstallationCode), False) then
    RaiseException('کد درخواست نصب ذخیره نشد؛ Setup را دوباره با دسترسی مدیر اجرا کنید.');
  LicensePage.Add('کد درخواست این نصب (۸ رقم):', False);
  LicensePage.Values[0] := InstallationCode;
  LicensePage.Edits[0].ReadOnly := True;
  LicensePage.Add('کد لایسنس:', False);
  if LoadStringFromFile(ExpandConstant('{commonappdata}\Pnara\license.key'), ExistingLicenseCode) then
    LicensePage.Values[1] := Trim(ExistingLicenseCode);

  if NeedsInitialDatabase then begin
    PostgreSqlAdminPage := CreateInputQueryPage(LicensePage.ID,
      'پایگاه داده PostgreSQL',
      'اگر PostgreSQL از قبل روی این رایانه نصب است، گذرواژهٔ مدیر postgres را وارد کنید.',
      'اگر PostgreSQL نصب نیست، این کادر را خالی بگذارید تا نسخهٔ همراه نصب‌کننده به‌صورت آفلاین نصب شود. Setup پایگاه دادهٔ pnara را ایجاد و آماده می‌کند.');
    PostgreSqlAdminPage.Add('گذرواژهٔ مدیر PostgreSQL (در صورت نصب بودن):', True);
  end;

  if NeedsInitialPassword then begin
    AdminPasswordPage := CreateInputQueryPage(wpSelectDir,
      'ساخت گذرواژهٔ مدیر',
      'این گذرواژه برای ورود مدیر اصلی پنارا کافه استفاده می‌شود.',
      'حداقل ۱۲ نویسه شامل حروف لاتین کوچک و بزرگ و یک عدد وارد کنید.');
    AdminPasswordPage.Add('گذرواژهٔ مدیر:', True);
    AdminPasswordPage.Add('تکرار گذرواژه:', True);
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Password: String;
  LicenseCode: String;
  ExistingLicenseCode: AnsiString;
begin
  Result := True;
  if CurPageID = LicensePage.ID then begin
    LicenseCode := Trim(LicensePage.Values[1]);
    if (LicenseCode = '') and not NeedsInitialLicense and
       LoadStringFromFile(ExpandConstant('{commonappdata}\Pnara\license.key'), ExistingLicenseCode) then begin
      LicenseCode := Trim(ExistingLicenseCode);
      LicensePage.Values[1] := LicenseCode;
    end;
    if Length(InstallationCode) <> 8 then begin
      MsgBox('ساخت کد درخواست ۸ رقمی ناموفق بود. نصب را ببندید و دوباره اجرا کنید.', mbError, MB_OK);
      Result := False;
      exit;
    end;
    if NeedsInitialLicense and ((Length(LicenseCode) < 100) or (Pos('.', LicenseCode) = 0)) then begin
      MsgBox('کد کامل لایسنس صادرشده را وارد کنید.', mbError, MB_OK);
      Result := False;
      exit;
    end;
    if (LicenseCode <> '') and ((Length(LicenseCode) < 100) or (Pos('.', LicenseCode) = 0)) then begin
      MsgBox('قالب کد لایسنس معتبر نیست.', mbError, MB_OK);
      Result := False;
      exit;
    end;
    if LicenseCode = '' then begin
      MsgBox('برای ادامه، کد لایسنس را وارد کنید.', mbError, MB_OK);
      Result := False;
      exit;
    end;
    if not VerifyEnteredLicense(LicenseCode) then begin
      MsgBox('لایسنس معتبر نیست، منقضی شده یا برای کد درخواست این نصب صادر نشده است.', mbError, MB_OK);
      Result := False;
      exit;
    end;
  end;

  if NeedsInitialPassword and (CurPageID = AdminPasswordPage.ID) then begin
    Password := AdminPasswordPage.Values[0];
    if Length(Password) < 12 then begin
      MsgBox('گذرواژه باید دست‌کم ۱۲ نویسه داشته باشد.', mbError, MB_OK);
      Result := False;
      exit;
    end;
    if not HasRequiredPasswordCharacters(Password) then begin
      MsgBox('گذرواژه باید شامل حروف لاتین کوچک و بزرگ و دست‌کم یک عدد باشد.', mbError, MB_OK);
      Result := False;
      exit;
    end;
    if Password <> AdminPasswordPage.Values[1] then begin
      MsgBox('دو گذرواژه با هم مطابقت ندارند.', mbError, MB_OK);
      Result := False;
      exit;
    end;
  end;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if (CurPageID = wpFinished) and InstallFailed then begin
    WizardForm.FinishedHeadingLabel.Caption := 'نصب کامل نشد';
    WizardForm.FinishedLabel.Caption := 'فایل‌های برنامه نصب شدند، اما پیکربندی پایگاه داده یا سرویس کامل نشد. برنامه را اجرا نکنید. گزارش کامل در C:\ProgramData\Pnara\installation-diagnostics.txt قرار دارد.';
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
    Result := 'سرویس پنارا کافه پیش از ارتقا متوقف نشد.'
  else if ExitCode <> 0 then
    Result := 'سرویس پنارا کافه متوقف نشد. ویندوز را راه‌اندازی مجدد کنید و نصب را دوباره اجرا کنید.';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ExitCode: Integer;
  PowerShellPath: String;
  ScriptPath: String;
  PasswordPath: String;
  LicensePath: String;
  PostgreSqlAdminPasswordPath: String;
  PostgreSqlInstallerPath: String;
  ErrorPath: String;
  StableErrorPath: String;
  DiagnosticPath: String;
  Parameters: String;
  ErrorText: String;
  ErrorLines: TArrayOfString;
  Index: Integer;
begin
  if CurStep = ssPostInstall then begin
    InstallReady := False;
    WizardForm.StatusLabel.Caption := 'در حال پیکربندی PostgreSQL، اعمال تغییرات پایگاه داده و راه‌اندازی سرویس...';
    WizardForm.ProgressGauge.Style := npbstMarquee;
    WizardForm.Update;

    PowerShellPath := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
    ScriptPath := ExpandConstant('{app}\Configure-Machine.ps1');
    PasswordPath := ExpandConstant('{tmp}\PnaraInitialAdminPassword.txt');
    LicensePath := ExpandConstant('{tmp}\PnaraOfflineLicense.txt');
    PostgreSqlAdminPasswordPath := ExpandConstant('{tmp}\PnaraPostgreSqlAdminPassword.txt');
    PostgreSqlInstallerPath := ExpandConstant('{tmp}\postgresql-18.6-1-windows-x64.exe');
    ErrorPath := ExpandConstant('{tmp}\CafeSetup-error.txt');
    StableErrorPath := ExpandConstant('{commonappdata}\Pnara\installation-error.txt');
    DiagnosticPath := ExpandConstant('{commonappdata}\Pnara\installation-diagnostics.txt');
    DeleteFile(ErrorPath);
    Parameters := '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ScriptPath + '" -InstallRoot "' + ExpandConstant('{app}') + '" -DataRoot "' + ExpandConstant('{commonappdata}\Pnara') + '" -AppVersion "{#AppVersion}" -ErrorFile "' + ErrorPath + '"';

    if NeedsInitialDatabase then begin
      if Trim(PostgreSqlAdminPage.Values[0]) <> '' then begin
        if not SaveStringToFile(PostgreSqlAdminPasswordPath, UTF8Encode(PostgreSqlAdminPage.Values[0]), False) then
          RaiseException('گذرواژهٔ مدیر PostgreSQL برای ادامهٔ نصب ذخیره نشد.');
        Parameters := Parameters + ' -PostgreSqlAdminPasswordFile "' + PostgreSqlAdminPasswordPath + '"';
      end;
      Parameters := Parameters + ' -PostgreSqlInstallerPath "' + PostgreSqlInstallerPath + '"';
    end;

    if NeedsInitialPassword then begin
      if not SaveStringToFile(PasswordPath, UTF8Encode(AdminPasswordPage.Values[0]), False) then
        RaiseException('گذرواژهٔ مدیر برای ادامهٔ نصب ذخیره نشد.');
      Parameters := Parameters + ' -AdminPasswordFile "' + PasswordPath + '"';
    end;
    if Trim(LicensePage.Values[1]) <> '' then begin
      if not SaveStringToFile(LicensePath, UTF8Encode(Trim(LicensePage.Values[1])), False) then
        RaiseException('کد لایسنس برای ادامهٔ نصب ذخیره نشد.');
      Parameters := Parameters + ' -LicenseFile "' + LicensePath + '"';
    end;
    Parameters := Parameters + ' -InstallationCode "' + InstallationCode + '"';
    if not Exec(PowerShellPath, Parameters, ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ExitCode) then
      ExitCode := -1;
    DeleteFile(PasswordPath);
    DeleteFile(LicensePath);
    DeleteFile(PostgreSqlAdminPasswordPath);

    if ExitCode <> 0 then begin
      InstallFailed := True;
      ErrorText := 'نصب پنارا کافه کامل نشد.';
      if not LoadStringsFromFile(ErrorPath, ErrorLines) or (GetArrayLength(ErrorLines) = 0) then
        LoadStringsFromFile(StableErrorPath, ErrorLines);
      if GetArrayLength(ErrorLines) > 0 then begin
        ErrorText := 'نصب پنارا کافه ناموفق بود:';
        for Index := 0 to GetArrayLength(ErrorLines) - 1 do
          ErrorText := ErrorText + #13#10 + ErrorLines[Index];
      end;
      ErrorText := ErrorText + #13#10 + #13#10 + 'گزارش کامل نصب:' + #13#10 + DiagnosticPath;
      MsgBox(ErrorText, mbError, MB_OK);
      Exit;
    end;

    InstallReady := True;
  end;

  if CurStep = ssDone then begin
    DeleteFile(ExpandConstant('{tmp}\PnaraInitialAdminPassword.txt'));
    DeleteFile(ExpandConstant('{tmp}\PnaraOfflineLicense.txt'));
    DeleteFile(ExpandConstant('{tmp}\CafeSetup-error.txt'));
  end;
end;

function IsInstallReady: Boolean;
begin
  Result := InstallReady;
end;
