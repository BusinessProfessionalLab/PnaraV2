[CmdletBinding()]
param(
    [string]$InstallRoot,
    [string]$DataRoot = (Join-Path $env:ProgramData 'Pnara'),
    [string]$PostgreSqlConnectionFile,
    [string]$PostgreSqlAdminPasswordFile,
    [string]$PostgreSqlInstallerPath,
    [string]$AdminPasswordFile,
    [string]$LicenseFile,
    [string]$InstallationCode,
    [string]$ErrorFile,
    [string]$AppVersion = '1.4.0',
    [switch]$PrepareUpgrade,
    [switch]$UninstallService
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$serviceName = 'CafeApiService'
# Use the built-in low-privilege account so setup doesn't depend on virtual-account
# logon rights that may be restricted by the target computer's local security policy.
$serviceIdentity = 'NT AUTHORITY\LocalService'
$script:ResolvedConnectionString = $null
$script:DiagnosticLogPath = Join-Path $DataRoot 'installation-diagnostics.txt'
$script:SensitiveValues = [System.Collections.Generic.List[string]]::new()
$script:CurrentPhase = 'startup'

function Protect-DiagnosticText([string]$Text) {
    if ($null -eq $Text) { return '' }
    $safeText = $Text
    foreach ($secret in $script:SensitiveValues) {
        if (-not [string]::IsNullOrEmpty($secret)) { $safeText = $safeText.Replace($secret, '[REDACTED]') }
    }
    $safeText = [regex]::Replace($safeText, '(?i)(password\s*[=:]\s*)[^;\s,]+', '$1[REDACTED]')
    $safeText = [regex]::Replace($safeText, '(?i)(--superpassword\s+)\S+', '$1[REDACTED]')
    return $safeText
}

function Write-DiagnosticLog([string]$Message, [string]$Level = 'INFO') {
    try {
        New-Item -ItemType Directory -Force -Path $DataRoot | Out-Null
        $timestamp = [DateTimeOffset]::Now.ToString('yyyy-MM-dd HH:mm:ss.fff zzz')
        $entry = "[$timestamp] [$Level] [phase=$($script:CurrentPhase)] $(Protect-DiagnosticText $Message)" + [Environment]::NewLine
        [System.IO.File]::AppendAllText($script:DiagnosticLogPath, $entry, [System.Text.UTF8Encoding]::new($false))
    }
    catch { }
}

function Set-DiagnosticPhase([string]$Phase) {
    $script:CurrentPhase = $Phase
    Write-DiagnosticLog "BEGIN $Phase"
}

function Add-SensitiveValue([string]$Value) {
    if (-not [string]::IsNullOrEmpty($Value) -and -not $script:SensitiveValues.Contains($Value)) {
        $script:SensitiveValues.Add($Value)
    }
}

function Write-DiagnosticException([System.Exception]$Exception) {
    $depth = 0
    while ($null -ne $Exception -and $depth -lt 12) {
        Write-DiagnosticLog "Exception[$depth] type=$($Exception.GetType().FullName); HResult=$($Exception.HResult); message=$($Exception.Message)" 'ERROR'
        if ($Exception.StackTrace) { Write-DiagnosticLog "Exception[$depth] stack: $($Exception.StackTrace)" 'ERROR' }
        $Exception = $Exception.InnerException
        $depth++
    }
}

function Invoke-ServiceControl([string[]]$Arguments) {
    Write-DiagnosticLog "Running sc.exe $($Arguments -join ' ')"
    $output = (& "$env:SystemRoot\System32\sc.exe" @Arguments 2>&1 | Out-String).Trim()
    $exitCode = $LASTEXITCODE
    Write-DiagnosticLog "sc.exe exit=$exitCode; output: $output" $(if ($exitCode -eq 0) { 'INFO' } else { 'ERROR' })
    if ($exitCode -ne 0) {
        $detail = if ($output) { " Output: $output" } else { '' }
        throw "Windows service control failed for CafeApiService (exit code $exitCode). Command: sc.exe $($Arguments -join ' ').$detail"
    }
}

function Stop-CafeService {
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($null -eq $service) { return }
    if ($service.Status -ne [System.ServiceProcess.ServiceControllerStatus]::Stopped) {
        Stop-Service -Name $serviceName -Force -ErrorAction Stop
        $service.WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Stopped, [TimeSpan]::FromSeconds(45))
    }
}

function Remove-CafeService {
    $service = Get-CimInstance Win32_Service -Filter "Name='$serviceName'" -ErrorAction SilentlyContinue
    if ($null -eq $service) { return }
    if ($InstallRoot -and $service.PathName -notmatch [regex]::Escape((Join-Path $InstallRoot 'RestoPOS.API.exe'))) {
        throw "A service named $serviceName exists outside the selected Pnara install folder; it was left unchanged."
    }
    Stop-CafeService
    Invoke-ServiceControl @('delete', $serviceName)
}

function Get-FileTail([string]$Path, [int]$LineCount = 20) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return '' }
    return ((Get-Content -LiteralPath $Path -Tail $LineCount -ErrorAction SilentlyContinue) -join [Environment]::NewLine)
}

function Set-ExplicitFileSystemAcl([string]$Path, [object[]]$Entries, [bool]$IsDirectory) {
    Write-DiagnosticLog "Setting explicit Windows ACL using SID objects; path='$Path', directory=$IsDirectory, entries=$($Entries.Count)"
    $acl = Get-Acl -LiteralPath $Path -ErrorAction Stop
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($existingRule in @($acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))) {
        [void]$acl.RemoveAccessRuleSpecific($existingRule)
    }

    foreach ($entry in $Entries) {
        $inheritance = [System.Security.AccessControl.InheritanceFlags]::None
        if ($IsDirectory) { $inheritance = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit }
        $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
            [System.Security.Principal.SecurityIdentifier]$entry.Sid,
            [System.Security.AccessControl.FileSystemRights]$entry.Rights,
            $inheritance,
            [System.Security.AccessControl.PropagationFlags]::None,
            [System.Security.AccessControl.AccessControlType]::Allow
        )
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Path -AclObject $acl -ErrorAction Stop
    Write-DiagnosticLog "ACL applied successfully to '$Path'."
}

function Write-InstallationError([string]$Message) {
    try {
        New-Item -ItemType Directory -Force -Path $DataRoot | Out-Null
        $errorLogPath = Join-Path $DataRoot 'installation-error.txt'
        if (-not (Test-Path -LiteralPath $errorLogPath -PathType Leaf)) {
            $logMessage = "[$([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss zzz'))] $(Protect-DiagnosticText $Message)"
            [System.IO.File]::WriteAllText($errorLogPath, $logMessage, [System.Text.UTF8Encoding]::new($false))
        }
    }
    catch { }
}

function Set-DataPermissions {
    Set-DiagnosticPhase 'permissions.resolve-service-sid'
    New-Item -ItemType Directory -Force -Path $DataRoot, (Join-Path $DataRoot 'logs'), (Join-Path $DataRoot 'tickets'), (Join-Path $DataRoot 'backups') | Out-Null
    $sidOutput = (& "$env:SystemRoot\System32\sc.exe" showsid $serviceName 2>&1 | Out-String).Trim()
    $sidExitCode = $LASTEXITCODE
    Write-DiagnosticLog "sc.exe showsid exit=$sidExitCode; output: $sidOutput"
    # Service SIDs contain five RID values after S-1-5-80.
    $sidMatch = [regex]::Match($sidOutput, 'S-1-5-80(?:-\d+){5}')
    if ($sidExitCode -ne 0 -or -not $sidMatch.Success) {
        throw "Windows did not return the service SID for $serviceName (sc.exe showsid exit code $sidExitCode). $sidOutput"
    }
    $serviceSid = $sidMatch.Value
    Write-DiagnosticLog "Resolved service SID: $serviceSid"
    $systemSid = [System.Security.Principal.SecurityIdentifier]::new('S-1-5-18')
    $administratorsSid = [System.Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
    $serviceIdentitySid = [System.Security.Principal.SecurityIdentifier]::new($serviceSid)
    Set-ExplicitFileSystemAcl $DataRoot @(
        @{ Sid = $systemSid; Rights = [System.Security.AccessControl.FileSystemRights]::FullControl },
        @{ Sid = $administratorsSid; Rights = [System.Security.AccessControl.FileSystemRights]::FullControl },
        @{ Sid = $serviceIdentitySid; Rights = [System.Security.AccessControl.FileSystemRights]::ReadAndExecute }
    ) $true
    foreach ($writePath in @((Join-Path $DataRoot 'logs'), (Join-Path $DataRoot 'tickets'), (Join-Path $DataRoot 'backups'))) {
        Set-ExplicitFileSystemAcl $writePath @(
            @{ Sid = $systemSid; Rights = [System.Security.AccessControl.FileSystemRights]::FullControl },
            @{ Sid = $administratorsSid; Rights = [System.Security.AccessControl.FileSystemRights]::FullControl },
            @{ Sid = $serviceIdentitySid; Rights = [System.Security.AccessControl.FileSystemRights]::Modify }
        ) $true
    }
}

function Install-CafeService([string]$ApiPath) {
    $existing = Get-CimInstance Win32_Service -Filter "Name='$serviceName'" -ErrorAction SilentlyContinue
    if ($null -ne $existing -and $existing.PathName -notmatch [regex]::Escape($ApiPath)) {
        throw "A service named $serviceName already points to another executable; it was left unchanged."
    }
    if ($null -eq $existing) {
        Invoke-ServiceControl @('create', $serviceName, 'binPath=', "`"$ApiPath`"", 'start=', 'delayed-auto', 'obj=', $serviceIdentity)
    }
    else {
        Stop-CafeService
        Invoke-ServiceControl @('config', $serviceName, 'binPath=', "`"$ApiPath`"", 'start=', 'delayed-auto', 'obj=', $serviceIdentity)
    }
    Invoke-ServiceControl @('sidtype', $serviceName, 'unrestricted')
    Invoke-ServiceControl @('description', $serviceName, 'Pnara Cafe local API and frontend service.')
    Invoke-ServiceControl @('failure', $serviceName, 'reset=', '86400', 'actions=', 'restart/5000/restart/15000/restart/60000')
    $serviceKey = "HKLM:\SYSTEM\CurrentControlSet\Services\$serviceName"
    New-ItemProperty -LiteralPath $serviceKey -Name Environment -PropertyType MultiString -Force -Value @(
        'ASPNETCORE_ENVIRONMENT=Production',
        'DOTNET_ENVIRONMENT=Production',
        "PNARA_DATA_DIRECTORY=$DataRoot"
    ) | Out-Null
}

function New-PostgreSqlPassword {
    $bytes = [byte[]]::new(48)
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    $alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    $password = [System.Text.StringBuilder]::new(40)
    [void]$password.Append([char](65 + ($bytes[0] % 26)))
    [void]$password.Append([char](97 + ($bytes[1] % 26)))
    [void]$password.Append([char](48 + ($bytes[2] % 10)))
    for ($index = 3; $index -lt 40; $index++) {
        [void]$password.Append($alphabet[$bytes[$index] % $alphabet.Length])
    }
    return $password.ToString()
}

function Install-LocalPostgreSql {
    if (-not $PostgreSqlInstallerPath -or -not (Test-Path -LiteralPath $PostgreSqlInstallerPath -PathType Leaf)) {
        throw 'The bundled PostgreSQL installer is missing. Rerun the complete Pnara setup package.'
    }
    $existingDatabaseService = Get-CimInstance Win32_Service -ErrorAction Stop |
        Where-Object { $_.Name -match '^postgresql' } |
        Select-Object -First 1
    if ($existingDatabaseService) {
        throw "A PostgreSQL service '$($existingDatabaseService.Name)' is already installed. Enter its application connection string in setup to use it; the existing service and data were left unchanged."
    }
    if (Test-Path -LiteralPath (Join-Path $env:ProgramFiles 'PostgreSQL')) {
        throw 'A PostgreSQL installation directory already exists. Setup left it unchanged; enter a connection string for its database or remove the previous installation before retrying.'
    }
    $portListener = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($portListener) {
        throw 'Port 5432 is already in use. Enter the connection string for that database server, or free the port before installing the bundled server.'
    }

    $superPassword = New-PostgreSqlPassword
    $appPassword = New-PostgreSqlPassword
    $optionPath = Join-Path $env:TEMP ("pnara-postgresql-options-{0}.txt" -f [guid]::NewGuid().ToString('N'))
    $sqlPath = Join-Path $env:TEMP ("pnara-postgresql-provision-{0}.sql" -f [guid]::NewGuid().ToString('N'))
    try {
        $options = @(
            'mode=unattended',
            'unattendedmodeui=none',
            'installer-language=en',
            'prefix=C:\Program Files\PostgreSQL\17',
            'datadir=C:\Program Files\PostgreSQL\17\data',
            'serverport=5432',
            'servicename=postgresql-x64-17',
            'serviceaccount=postgres',
            "servicepassword=$superPassword",
            'superaccount=postgres',
            "superpassword=$superPassword",
            'enable-components=server,commandlinetools',
            'install_runtimes=1',
            'create_shortcuts=0',
            'locale=C'
        ) -join [Environment]::NewLine
        [System.IO.File]::WriteAllText($optionPath, $options, [System.Text.Encoding]::ASCII)
        Invoke-Icacls $optionPath @('/inheritance:r', '/grant:r', '*S-1-5-18:(F)', '*S-1-5-32-544:(F)')

        Write-Host 'Installing PostgreSQL 17...'
        $installer = Start-Process -FilePath $PostgreSqlInstallerPath -ArgumentList @('--optionfile', ('"{0}"' -f $optionPath)) -Wait -PassThru -WindowStyle Hidden
        if ($installer.ExitCode -ne 0) {
            throw "The PostgreSQL 17 installer failed with exit code $($installer.ExitCode). Review the PostgreSQL installer log under the Windows temporary directory."
        }

        $serviceName = 'postgresql-x64-17'
        $deadline = (Get-Date).AddSeconds(90)
        do {
            $databaseService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
            if ($databaseService -and $databaseService.Status -eq [System.ServiceProcess.ServiceControllerStatus]::Running) { break }
            Start-Sleep -Seconds 1
        } while ((Get-Date) -lt $deadline)
        if (-not $databaseService -or $databaseService.Status -ne [System.ServiceProcess.ServiceControllerStatus]::Running) {
            throw 'PostgreSQL installed but its Windows service did not start. Review the PostgreSQL installer log and Windows Event Viewer.'
        }

        $psqlPath = Join-Path $env:ProgramFiles 'PostgreSQL\17\bin\psql.exe'
        if (-not (Test-Path -LiteralPath $psqlPath -PathType Leaf)) { throw 'PostgreSQL command-line tools were not installed; psql.exe is missing.' }
        $sql = @"
CREATE ROLE pnara_app LOGIN PASSWORD '$appPassword';
SELECT 'CREATE DATABASE pnara OWNER pnara_app ENCODING ''UTF8'' TEMPLATE template0'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'pnara')\gexec
"@
        [System.IO.File]::WriteAllText($sqlPath, $sql, [System.Text.Encoding]::ASCII)
        Invoke-Icacls $sqlPath @('/inheritance:r', '/grant:r', '*S-1-5-18:(F)', '*S-1-5-32-544:(F)')
        $env:PGPASSWORD = $superPassword
        try {
            & $psqlPath '--no-psqlrc' '--set=ON_ERROR_STOP=1' '--host=127.0.0.1' '--port=5432' '--username=postgres' '--dbname=postgres' '--file' $sqlPath
            if ($LASTEXITCODE -ne 0) { throw "PostgreSQL database setup failed with exit code $LASTEXITCODE." }
        }
        finally { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }

        return "Host=127.0.0.1;Port=5432;Database=pnara;Username=pnara_app;Password=$appPassword;Timeout=15;Command Timeout=30"
    }
    finally {
        Remove-Item -LiteralPath $optionPath, $sqlPath -Force -ErrorAction SilentlyContinue
        $superPassword = $null
        $appPassword = $null
    }
}

function Set-ProductionConfiguration {
    Set-DiagnosticPhase 'configuration.write-production-settings'
    $configPath = Join-Path $DataRoot 'appsettings.Production.json'
    $publicKeyPath = Join-Path $InstallRoot 'issuer-public.pem'
    if (-not (Test-Path -LiteralPath $publicKeyPath -PathType Leaf)) {
        throw 'The license verification public key was not found in the installer payload.'
    }
    $licensePublicKey = [System.IO.File]::ReadAllText($publicKeyPath, [System.Text.Encoding]::UTF8).Trim()
    if (-not $licensePublicKey.StartsWith('-----BEGIN PUBLIC KEY-----') -or -not $licensePublicKey.Contains('-----END PUBLIC KEY-----')) {
        throw 'The license verification public key in the installer payload is not a valid PEM public key.'
    }
    $previousPublicKeyPath = Join-Path $InstallRoot 'issuer-previous-public.pem'
    if (-not (Test-Path -LiteralPath $previousPublicKeyPath -PathType Leaf)) {
        throw 'The previous license verification key was not found in the installer payload.'
    }
    $bundledPreviousPublicKey = [System.IO.File]::ReadAllText($previousPublicKeyPath, [System.Text.Encoding]::UTF8).Trim()
    if (-not $bundledPreviousPublicKey.StartsWith('-----BEGIN PUBLIC KEY-----') -or -not $bundledPreviousPublicKey.Contains('-----END PUBLIC KEY-----')) {
        throw 'The previous license verification key in the installer payload is not a valid PEM public key.'
    }

    $connectionString = $script:ResolvedConnectionString
    if (Test-Path -LiteralPath $configPath) {
        $existingConfiguration = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
        if ($existingConfiguration.ConnectionStrings.PSObject.Properties['SqlServer'] -and $existingConfiguration.ConnectionStrings.SqlServer) {
            throw 'This installation still points to SQL Server. Setup will not replace it with an empty PostgreSQL database. Export and validate the existing data before completing the PostgreSQL cutover.'
        }
        if ($existingConfiguration.ConnectionStrings.PSObject.Properties['PostgreSql']) {
            $connectionString = [string]$existingConfiguration.ConnectionStrings.PostgreSql
        }
    }
    if ([string]::IsNullOrWhiteSpace($connectionString)) {
        if (-not $PostgreSqlConnectionFile -or -not (Test-Path -LiteralPath $PostgreSqlConnectionFile)) {
            throw 'A PostgreSQL connection string is required. Install PostgreSQL locally, create the pnara database and application role, then rerun setup.'
        }
        $connectionString = [System.IO.File]::ReadAllText($PostgreSqlConnectionFile, [System.Text.Encoding]::UTF8).TrimEnd("`r", "`n")
        if ($connectionString -notmatch '(?i)(^|;)\s*Host\s*=' -or $connectionString -notmatch '(?i)(^|;)\s*Database\s*=' -or $connectionString -notmatch '(?i)(^|;)\s*Username\s*=') {
            throw 'The PostgreSQL connection string must include Host, Database, and Username fields.'
        }
    }

    if (-not (Test-Path -LiteralPath $configPath)) {
        $keyBytes = [byte[]]::new(64)
        $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try { $random.GetBytes($keyBytes) } finally { $random.Dispose() }
        $configuration = [ordered]@{
            ConnectionStrings = @{ PostgreSql = $connectionString }
            Jwt = @{
                Issuer = 'Pnara'
                Audience = 'Pnara'
                Key = [Convert]::ToBase64String($keyBytes)
                ExpiryMinutes = 480
                RefreshExpiryDays = 14
            }
            License = @{ PublicKey = $licensePublicKey; PreviousPublicKeys = @($bundledPreviousPublicKey) }
            Urls = 'http://127.0.0.1:5077'
        }
        $json = $configuration | ConvertTo-Json -Depth 5
        [System.IO.File]::WriteAllText($configPath, $json, [System.Text.UTF8Encoding]::new($false))
    }
    elseif (-not $existingConfiguration.ConnectionStrings.PSObject.Properties['PostgreSql']) {
        $existingConfiguration.ConnectionStrings | Add-Member -NotePropertyName PostgreSql -NotePropertyValue $connectionString -Force
        $existingConfiguration | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $configPath -Encoding utf8
    }

    $existingConfiguration = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    if (-not $existingConfiguration.PSObject.Properties['License']) {
        $existingConfiguration | Add-Member -NotePropertyName License -NotePropertyValue ([pscustomobject]@{})
    }
    $previousPublicKeys = [System.Collections.Generic.List[string]]::new()
    if ($existingConfiguration.License.PSObject.Properties['PublicKey'] -and
        $existingConfiguration.License.PublicKey -and
        $existingConfiguration.License.PublicKey -ne $licensePublicKey) {
        $previousPublicKeys.Add([string]$existingConfiguration.License.PublicKey)
    }
    if ($existingConfiguration.License.PSObject.Properties['PreviousPublicKeys']) {
        foreach ($oldPublicKey in @($existingConfiguration.License.PreviousPublicKeys)) {
            if ($oldPublicKey -and -not $previousPublicKeys.Contains([string]$oldPublicKey) -and $oldPublicKey -ne $licensePublicKey) {
                $previousPublicKeys.Add([string]$oldPublicKey)
            }
        }
    }
    if ($bundledPreviousPublicKey -ne $licensePublicKey -and -not $previousPublicKeys.Contains($bundledPreviousPublicKey)) {
        $previousPublicKeys.Add($bundledPreviousPublicKey)
    }
    $existingConfiguration.License | Add-Member -NotePropertyName PublicKey -NotePropertyValue $licensePublicKey -Force
    $existingConfiguration.License | Add-Member -NotePropertyName PreviousPublicKeys -NotePropertyValue @($previousPublicKeys.ToArray()) -Force
    $existingConfiguration | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $configPath -Encoding utf8

    if ($LicenseFile -and (Test-Path -LiteralPath $LicenseFile -PathType Leaf)) {
    $licenseCode = [System.IO.File]::ReadAllText($LicenseFile, [System.Text.Encoding]::UTF8).Trim()
        Add-SensitiveValue $licenseCode
        if ($licenseCode -notmatch '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$') {
            throw 'The supplied license code has an invalid format.'
        }
        [System.IO.File]::WriteAllText((Join-Path $DataRoot 'license.key'), $licenseCode, [System.Text.Encoding]::ASCII)
    }
    elseif (-not (Test-Path -LiteralPath (Join-Path $DataRoot 'license.key') -PathType Leaf)) {
        throw 'A license code is required for a new installation.'
    }

    Set-DiagnosticPhase 'configuration.protect-settings-acl'
    $serviceSidOutput = (& "$env:SystemRoot\System32\sc.exe" showsid $serviceName 2>&1 | Out-String).Trim()
    $serviceSidForConfig = [regex]::Match($serviceSidOutput, 'S-1-5-80(?:-\d+){5}')
    if ($LASTEXITCODE -ne 0 -or -not $serviceSidForConfig.Success) { throw "Could not resolve $serviceName SID while protecting production configuration. $serviceSidOutput" }
    Set-ExplicitFileSystemAcl $configPath @(
        @{ Sid = [System.Security.Principal.SecurityIdentifier]::new('S-1-5-18'); Rights = [System.Security.AccessControl.FileSystemRights]::FullControl },
        @{ Sid = [System.Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'); Rights = [System.Security.AccessControl.FileSystemRights]::FullControl },
        @{ Sid = [System.Security.Principal.SecurityIdentifier]::new($serviceSidForConfig.Value); Rights = [System.Security.AccessControl.FileSystemRights]::Read }
    ) $false
}

function New-RandomSecret([int]$ByteCount = 36) {
    $bytes = [byte[]]::new($ByteCount)
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
}

function Get-PostgreSqlService {
    return Get-CimInstance Win32_Service -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '(?i)postgres' -or $_.DisplayName -match '(?i)postgresql' } |
        Sort-Object Name | Select-Object -First 1
}

function Find-PostgreSqlTool([string]$ToolName) {
    $commands = Get-Command $ToolName -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($commands -and (Test-Path -LiteralPath $commands.Source -PathType Leaf)) {
        Write-DiagnosticLog "PostgreSQL tool '$ToolName' resolved from PATH: '$($commands.Source)'"
        return $commands.Source
    }

    $searchRoots = [System.Collections.Generic.List[string]]::new()
    foreach ($programFilesRoot in @($env:ProgramW6432, $env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if ($programFilesRoot) {
            $postgresRoot = Join-Path $programFilesRoot 'PostgreSQL'
            if (-not $searchRoots.Contains($postgresRoot)) { $searchRoots.Add($postgresRoot) }
        }
    }

    $service = Get-PostgreSqlService
    if ($service) {
        Write-DiagnosticLog "PostgreSQL tool lookup found service '$($service.Name)' with executable path '$($service.PathName)'"
        $pgCtlMatch = [regex]::Match([string]$service.PathName, '(?i)(?<path>[A-Z]:\\[^\"]*?pg_ctl\.exe)')
        if ($pgCtlMatch.Success) {
            $serviceBinDirectory = Split-Path -Parent $pgCtlMatch.Groups['path'].Value
            $serviceTool = Join-Path $serviceBinDirectory $ToolName
            if (Test-Path -LiteralPath $serviceTool -PathType Leaf) {
                Write-DiagnosticLog "PostgreSQL tool '$ToolName' resolved beside the running cluster service: '$serviceTool'"
                return $serviceTool
            }
            Write-DiagnosticLog "PostgreSQL tool '$ToolName' was not present beside service pg_ctl.exe: '$serviceTool'"
        }
    }

    foreach ($registryPath in @(
        'HKLM:\SOFTWARE\PostgreSQL\Installations',
        'HKLM:\SOFTWARE\WOW6432Node\PostgreSQL\Installations'
    )) {
        if (-not (Test-Path -LiteralPath $registryPath)) { continue }
        foreach ($installationKey in @(Get-ChildItem -LiteralPath $registryPath -ErrorAction SilentlyContinue)) {
            $installation = Get-ItemProperty -LiteralPath $installationKey.PSPath -ErrorAction SilentlyContinue
            $baseDirectoryProperty = if ($installation) { $installation.PSObject.Properties['Base Directory'] } else { $null }
            $baseDirectory = if ($baseDirectoryProperty) { [string]$baseDirectoryProperty.Value } else { '' }
            if ($baseDirectory -and -not $searchRoots.Contains($baseDirectory)) {
                $searchRoots.Add($baseDirectory)
                Write-DiagnosticLog "PostgreSQL installation registry entry '$($installationKey.PSChildName)' reports base directory '$baseDirectory'"
            }
        }
    }

    $pathDirectories = @($env:Path -split ';' | Where-Object { $_ -and $_.Trim() })
    $candidateDirectories = [System.Collections.Generic.List[string]]::new()
    if ($service) {
        $pgCtlMatch = [regex]::Match([string]$service.PathName, '(?i)(?<path>[A-Z]:\\[^\"]*?pg_ctl\.exe)')
        if ($pgCtlMatch.Success) { $candidateDirectories.Add((Split-Path -Parent $pgCtlMatch.Groups['path'].Value)) }
    }
    foreach ($root in $searchRoots) {
        foreach ($relativeDirectory in @('bin', 'pgAdmin 4\runtime', 'pgAdmin 4\bin')) {
            $candidateDirectories.Add((Join-Path $root $relativeDirectory))
        }
    }
    foreach ($directory in $pathDirectories) { $candidateDirectories.Add($directory.Trim()) }

    foreach ($directory in @($candidateDirectories | Select-Object -Unique)) {
        $candidate = Join-Path $directory $ToolName
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            Write-DiagnosticLog "PostgreSQL tool '$ToolName' resolved from candidate directory: '$candidate'"
            return $candidate
        }
    }

    foreach ($root in $searchRoots) {
        if (Test-Path -LiteralPath $root -PathType Container) {
            $tool = Get-ChildItem -LiteralPath $root -Filter $ToolName -File -Recurse -ErrorAction SilentlyContinue |
                Sort-Object FullName -Descending | Select-Object -First 1
            if ($tool) {
                Write-DiagnosticLog "PostgreSQL tool '$ToolName' resolved by recursive search: '$($tool.FullName)'"
                return $tool.FullName
            }
        }
    }

    Write-DiagnosticLog "PostgreSQL tool '$ToolName' was not found. Searched roots: $($searchRoots -join '; '); PATH directories: $($pathDirectories -join '; ')" 'ERROR'
    return $null
}

function Invoke-Psql([string]$Psql, [string]$HostName, [string]$Port, [string]$User, [string]$Password, [string]$Database, [string]$Sql) {
    Add-SensitiveValue $Password
    Write-DiagnosticLog "Running PostgreSQL command: psql='$Psql', host='$HostName', port='$Port', user='$User', database='$Database' (SQL text withheld)"
    $env:PGPASSWORD = $Password
    try {
        $output = @(& $Psql --no-psqlrc --host $HostName --port $Port --username $User --dbname $Database --tuples-only --no-align --set ON_ERROR_STOP=1 --command $Sql 2>&1)
        $exitCode = $LASTEXITCODE
        $outputText = ($output | ForEach-Object { $_.ToString().Trim() } | Where-Object { $_ }) -join "`n"
        Write-DiagnosticLog "psql exit=$exitCode; output: $outputText" $(if ($exitCode -eq 0) { 'INFO' } else { 'ERROR' })
        if ($exitCode -ne 0) { throw "PostgreSQL command failed: $outputText" }
        return $outputText
    }
    finally { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }
}

function Invoke-PostgreSqlSetup {
    Set-DiagnosticPhase 'postgresql.detect-and-configure'
    $configPath = Join-Path $DataRoot 'appsettings.Production.json'
    $savedConnection = $null
    if (Test-Path -LiteralPath $configPath) {
        $saved = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
        if ($saved.ConnectionStrings.PSObject.Properties['PostgreSql']) { $savedConnection = [string]$saved.ConnectionStrings.PostgreSql }
    }
    if ($savedConnection) {
        Write-DiagnosticLog 'Using the PostgreSQL connection already saved in production settings; connection values are withheld.'
        $script:ResolvedConnectionString = $savedConnection
        $builder = [System.Data.Common.DbConnectionStringBuilder]::new(); $builder.ConnectionString = $savedConnection
        if ($builder.ContainsKey('Password')) { Add-SensitiveValue ([string]$builder['Password']) }
        $pgDump = Find-PostgreSqlTool 'pg_dump.exe'
        $pgRestore = Find-PostgreSqlTool 'pg_restore.exe'
        if (-not $pgDump -or -not $pgRestore) {
            $missingTools = @(
                if (-not $pgDump) { 'pg_dump.exe' }
                if (-not $pgRestore) { 'pg_restore.exe' }
            ) -join ', '
            Write-DiagnosticLog "Existing PostgreSQL upgrade blocked because required backup tool(s) are missing: $missingTools. No backup was created and no database migration was run." 'ERROR'
            throw "Required PostgreSQL backup tool(s) are missing: $missingTools. No backup was created and no database migration was run. Review the PostgreSQL paths in the installation diagnostics."
        }
        New-Item -ItemType Directory -Force -Path (Join-Path $DataRoot 'backups') | Out-Null
        $backup = Join-Path (Join-Path $DataRoot 'backups') ("pnara-before-upgrade-{0}.dump" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
        $env:PGPASSWORD = [string]$builder['Password']
        try {
            Write-DiagnosticLog "Creating upgrade database backup: $backup"
            & $pgDump --host ([string]$builder['Host']) --port ([string]$builder['Port']) --username ([string]$builder['Username']) --dbname ([string]$builder['Database']) --format=custom "--file=$backup"
            Write-DiagnosticLog "pg_dump exit=$LASTEXITCODE"
            if ($LASTEXITCODE -ne 0) { throw 'Could not back up pnara before applying migrations; the database was not migrated.' }
            & $pgRestore --list $backup | Out-Null
            Write-DiagnosticLog "pg_restore verification exit=$LASTEXITCODE"
            if ($LASTEXITCODE -ne 0) { throw "The pre-upgrade backup could not be verified: $backup" }
        }
        finally { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }
        Write-Host "Verified database backup: $backup"
        return
    }

    $service = Get-PostgreSqlService
    if ($service) { Write-DiagnosticLog "Detected PostgreSQL service '$($service.Name)' state='$($service.State)' path='$($service.PathName)'" }
    else { Write-DiagnosticLog 'No PostgreSQL Windows service detected; bundled offline installer will be used.' }
    $hostName = '127.0.0.1'
    $port = '5432'
    $adminUser = 'postgres'
    $adminPassword = ''
    if ($service) {
        if ($service.State -ne 'Running') { Write-DiagnosticLog "Starting PostgreSQL service '$($service.Name)'"; Start-Service -Name $service.Name; (Get-Service $service.Name).WaitForStatus('Running',[TimeSpan]::FromSeconds(60)) }
        $pgCtlPath = $null
        if ($service.PathName -match '"(?<exe>[^"]*pg_ctl\.exe)"') { $pgCtlPath = $Matches['exe'] }
        elseif ($service.PathName -match '(?<exe>[A-Za-z]:\\.*?\\pg_ctl\.exe)') { $pgCtlPath = $Matches['exe'] }
        if ($pgCtlPath) {
            $bin = Split-Path -Parent $pgCtlPath
            $psql = Join-Path $bin 'psql.exe'
            $pgDump = Join-Path $bin 'pg_dump.exe'
        } else { $psql = Find-PostgreSqlTool 'psql.exe'; $pgDump = Find-PostgreSqlTool 'pg_dump.exe' }
        if (-not $psql -or -not (Test-Path -LiteralPath $psql)) { throw 'PostgreSQL is installed but psql.exe was not found; Setup stopped without changing databases.' }
        if ($PostgreSqlAdminPasswordFile -and (Test-Path -LiteralPath $PostgreSqlAdminPasswordFile)) {
            $adminPassword = [System.IO.File]::ReadAllText($PostgreSqlAdminPasswordFile,[System.Text.Encoding]::UTF8).TrimEnd("`r","`n")
        }
    }
    else {
        if (-not $PostgreSqlInstallerPath -or -not (Test-Path -LiteralPath $PostgreSqlInstallerPath)) { throw 'The offline PostgreSQL installer is missing from this setup package.' }
        $signature = Get-AuthenticodeSignature -LiteralPath $PostgreSqlInstallerPath
        Write-DiagnosticLog "Offline PostgreSQL installer signature status='$($signature.Status)', signer='$($signature.SignerCertificate.Subject)', path='$PostgreSqlInstallerPath'"
        if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch '(?i)EnterpriseDB') { throw 'The bundled PostgreSQL installer signature is invalid.' }
        $pgPrefix = Join-Path $env:ProgramFiles 'PostgreSQL\18'
        $pgData = Join-Path $env:ProgramData 'PostgreSQL\18\data'
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $pgData) | Out-Null
        $adminPassword = New-RandomSecret
        Add-SensitiveValue $adminPassword
        $port = '5432'
        $installerArgs = @('--mode','unattended','--unattendedmodeui','none','--prefix',$pgPrefix,'--datadir',$pgData,'--servicename','PnaraPostgreSQL18','--serverport',$port,'--superaccount','postgres','--superpassword',$adminPassword,'--servicepassword',$adminPassword,'--enable-components','server,commandlinetools')
        # Start-Process joins argument arrays with spaces but does not quote array entries.
        # Quote each argument so paths such as Program Files remain one EDB option value.
        $installerArgumentString = ($installerArgs | ForEach-Object { '"' + ([string]$_).Replace('"', '\"') + '"' }) -join ' '
        Write-DiagnosticLog "Launching offline PostgreSQL installer with prefix='$pgPrefix', data='$pgData', service='PnaraPostgreSQL18', port='$port'; password values withheld."
        $installerStdout = Join-Path $DataRoot 'postgresql-installer-stdout.tmp'
        $installerStderr = Join-Path $DataRoot 'postgresql-installer-stderr.tmp'
        $process = Start-Process -FilePath $PostgreSqlInstallerPath -ArgumentList $installerArgumentString -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $installerStdout -RedirectStandardError $installerStderr
        foreach ($outputPath in @($installerStdout, $installerStderr)) {
            if (Test-Path -LiteralPath $outputPath) {
                $installerOutput = Get-Content -LiteralPath $outputPath -Raw -ErrorAction SilentlyContinue
                if ($installerOutput) { Write-DiagnosticLog "PostgreSQL installer output ($([System.IO.Path]::GetFileName($outputPath))): $installerOutput" }
                Remove-Item -LiteralPath $outputPath -Force -ErrorAction SilentlyContinue
            }
        }
        Write-DiagnosticLog "Offline PostgreSQL installer process exit=$($process.ExitCode)"
        if ($process.ExitCode -ne 0) { throw "Offline PostgreSQL installation failed (exit code $($process.ExitCode))." }
        $service = Get-Service -Name 'PnaraPostgreSQL18' -ErrorAction SilentlyContinue
        if (-not $service) { throw 'PostgreSQL installer completed but its Windows service was not found.' }
        if ($service.Status -ne 'Running') { Write-DiagnosticLog "Starting newly installed PostgreSQL service '$($service.Name)'"; Start-Service $service.Name; (Get-Service $service.Name).WaitForStatus('Running',[TimeSpan]::FromSeconds(60)) }
        $psql = Find-PostgreSqlTool 'psql.exe'; $pgDump = Find-PostgreSqlTool 'pg_dump.exe'
    if (-not $psql -or -not $pgDump) { throw 'PostgreSQL command-line tools were not installed.' }
    Write-DiagnosticLog "PostgreSQL tools resolved: psql='$psql', pg_dump='$pgDump'"
    }

    $dbExists = Invoke-Psql $psql $hostName $port $adminUser $adminPassword 'postgres' "SELECT 1 FROM pg_database WHERE datname='pnara';"
    Write-DiagnosticLog "Database pnara existence query result='$dbExists'"
    if ($dbExists -eq '1') {
        if (-not $pgDump) { $pgDump = Find-PostgreSqlTool 'pg_dump.exe' }
        if (-not $pgDump) { throw 'pnara already exists, but pg_dump.exe is unavailable; Setup stopped before migration.' }
        $backupDir = Join-Path $DataRoot 'backups'; New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
        $backup = Join-Path $backupDir ("pnara-before-install-{0}.dump" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
        $env:PGPASSWORD = $adminPassword
        try {
            Write-DiagnosticLog "Creating pre-install pnara database backup: $backup"
            & $pgDump --host $hostName --port $port --username $adminUser --dbname pnara --format=custom "--file=$backup"
            Write-DiagnosticLog "pg_dump exit=$LASTEXITCODE"
            if ($LASTEXITCODE -ne 0) { throw 'Could not back up the existing pnara database; no migration was run.' }
            $pgRestore = Find-PostgreSqlTool 'pg_restore.exe'
            if (-not $pgRestore) { throw 'pg_restore.exe is unavailable to verify the existing database backup.' }
            & $pgRestore --list $backup | Out-Null
            Write-DiagnosticLog "pg_restore verification exit=$LASTEXITCODE"
            if ($LASTEXITCODE -ne 0) { throw "The existing pnara backup could not be verified: $backup" }
        } finally { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }
    }
    $appPassword = New-RandomSecret
    Add-SensitiveValue $appPassword
    $hasRole = Invoke-Psql $psql $hostName $port $adminUser $adminPassword 'postgres' "SELECT 1 FROM pg_roles WHERE rolname='pnara_app';"
    if ($hasRole -eq '1') { [void](Invoke-Psql $psql $hostName $port $adminUser $adminPassword 'postgres' "ALTER ROLE pnara_app WITH LOGIN PASSWORD '$appPassword';") }
    else { [void](Invoke-Psql $psql $hostName $port $adminUser $adminPassword 'postgres' "CREATE ROLE pnara_app WITH LOGIN PASSWORD '$appPassword';") }
    if ($dbExists -ne '1') { [void](Invoke-Psql $psql $hostName $port $adminUser $adminPassword 'postgres' 'CREATE DATABASE pnara OWNER pnara_app;') }
    else {
        [void](Invoke-Psql $psql $hostName $port $adminUser $adminPassword 'postgres' 'ALTER DATABASE pnara OWNER TO pnara_app;')
        $ownershipSql = @'
GRANT ALL ON SCHEMA public TO pnara_app;
DO $pnara$ DECLARE item record; BEGIN
  FOR item IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO pnara_app', item.tablename);
  END LOOP;
  FOR item IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO pnara_app', item.sequencename);
  END LOOP;
END $pnara$;
'@
        [void](Invoke-Psql $psql $hostName $port $adminUser $adminPassword 'pnara' $ownershipSql)
    }
    $script:ResolvedConnectionString = "Host=$hostName;Port=$port;Database=pnara;Username=pnara_app;Password=$appPassword;"
    Write-DiagnosticLog 'PostgreSQL role and database configuration finished; generated credentials are withheld.'
}

function Backup-PostgreSqlDatabase {
    $statePath = Join-Path $DataRoot 'install-state.json'
    if (-not (Test-Path -LiteralPath $statePath)) { return }

    $config = Get-Content -LiteralPath (Join-Path $DataRoot 'appsettings.Production.json') -Raw | ConvertFrom-Json
    $connectionString = [string]$config.ConnectionStrings.PostgreSql
    $builder = [System.Data.Common.DbConnectionStringBuilder]::new()
    $builder.ConnectionString = $connectionString
    foreach ($requiredKey in @('Host', 'Port', 'Database', 'Username', 'Password')) {
        if (-not $builder.ContainsKey($requiredKey)) { throw "The PostgreSQL connection string is missing '$requiredKey'; no upgrade backup was created." }
    }

    $pgBin = Get-Command pg_dump.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source
    if (-not $pgBin) {
        $pgBin = Get-ChildItem (Join-Path $env:ProgramFiles 'PostgreSQL') -Filter pg_dump.exe -File -Recurse -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
    }
    if (-not $pgBin) { throw 'pg_dump.exe was not found. Install PostgreSQL command-line tools before upgrading so setup can create a verified backup.' }
    $pgRestore = Join-Path (Split-Path -Parent $pgBin) 'pg_restore.exe'
    if (-not (Test-Path -LiteralPath $pgRestore)) { throw 'pg_restore.exe was not found beside pg_dump.exe; no upgrade backup was created.' }

    $backupDirectory = Join-Path $DataRoot 'backups'
    New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null
    $backupFile = Join-Path $backupDirectory ("pnara-before-upgrade-{0}.dump" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
    $env:PGPASSWORD = [string]$builder['Password']
    try {
        & $pgBin '--host' ([string]$builder['Host']) '--port' ([string]$builder['Port']) '--username' ([string]$builder['Username']) '--dbname' ([string]$builder['Database']) '--format=custom' "--file=$backupFile"
        if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE." }
        & $pgRestore $backupFile | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'pg_restore could not read the backup archive.' }
        Write-Host "PostgreSQL backup verified: $backupFile"
    }
    finally { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }
}

function Wait-ForCafeHealth {
    Set-DiagnosticPhase 'service.start-and-health-check'
    Add-Type -AssemblyName System.Net.Http -ErrorAction Stop
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.UseProxy = $false
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(3)
    $deadline = (Get-Date).AddSeconds(75)
    try {
        do {
            $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
            if ($null -eq $service -or $service.Status -eq [System.ServiceProcess.ServiceControllerStatus]::Stopped) {
                $log = Get-ChildItem (Join-Path $DataRoot 'logs\pnara-*.log') -ErrorAction SilentlyContinue |
                    Sort-Object LastWriteTime -Descending | Select-Object -First 1
                $details = if ($log) { (Get-Content -LiteralPath $log.FullName -Tail 12) -join [Environment]::NewLine } else { 'No service log was written.' }
                Write-DiagnosticLog "Service stopped before health check; latest application log tail: $details" 'ERROR'
                throw "CafeApiService stopped before it became healthy. $details"
            }
            try {
                $response = $client.GetAsync('http://127.0.0.1:5077/health').GetAwaiter().GetResult()
                if ($response.StatusCode -eq [System.Net.HttpStatusCode]::OK) { return }
            }
            catch [System.Net.Http.HttpRequestException] { }
            catch [System.Threading.Tasks.TaskCanceledException] { }
            Start-Sleep -Seconds 1
        } while ((Get-Date) -lt $deadline)
        Write-DiagnosticLog 'Health endpoint did not return HTTP 200 within 75 seconds.' 'ERROR'
        throw 'CafeApiService did not pass its database health check within 75 seconds. Review ProgramData\Pnara\installation-diagnostics.txt and ProgramData\Pnara\logs.'
    }
    finally {
        $client.Dispose()
        $handler.Dispose()
    }
}

if ($UninstallService) {
    try { Remove-CafeService; exit 0 }
    catch { Write-Error $_.Exception.Message; exit 1 }
}

if ($PrepareUpgrade) {
    try {
        if (-not $InstallRoot) { throw 'The application installation path is missing.' }
        $service = Get-CimInstance Win32_Service -Filter "Name='$serviceName'" -ErrorAction SilentlyContinue
        if ($null -ne $service) {
            $expectedApiPath = [System.IO.Path]::GetFullPath((Join-Path $InstallRoot 'RestoPOS.API.exe'))
            if ($service.PathName -notmatch [regex]::Escape($expectedApiPath)) {
                throw "A service named $serviceName points outside the selected Pnara install folder; it was left running."
            }
            Stop-CafeService
        }
        exit 0
    }
    catch { Write-Error $_.Exception.Message; exit 1 }
}

$serviceExistedBefore = $null -ne (Get-CimInstance Win32_Service -Filter "Name='$serviceName'" -ErrorAction SilentlyContinue)
try {
    New-Item -ItemType Directory -Force -Path $DataRoot | Out-Null
    Write-DiagnosticLog '============================================================'
    Write-DiagnosticLog "New setup attempt; version='$AppVersion', computer='$env:COMPUTERNAME', user='$env:USERNAME', PowerShell='$($PSVersionTable.PSVersion)', OS='$([Environment]::OSVersion.VersionString)', installRoot='$InstallRoot', dataRoot='$DataRoot'"
    if (-not $InstallRoot) { throw 'The application installation path is missing.' }
    Remove-Item -LiteralPath (Join-Path $DataRoot 'installation-error.txt') -Force -ErrorAction SilentlyContinue
    $apiPath = Join-Path $InstallRoot 'RestoPOS.API.exe'
    Set-DiagnosticPhase 'license-preflight'
    if (-not (Test-Path -LiteralPath $apiPath)) { throw "Backend executable was not found at $apiPath." }

    if ($InstallationCode -notmatch '^\d{8}$') { throw 'Setup did not provide a valid 8-digit installation request code.' }
    $licensePath = if ($LicenseFile -and (Test-Path -LiteralPath $LicenseFile -PathType Leaf)) { $LicenseFile } else { Join-Path $DataRoot 'license.key' }
    $publicKeyPath = Join-Path $InstallRoot 'issuer-public.pem'
    if (-not (Test-Path -LiteralPath $licensePath -PathType Leaf) -or -not (Test-Path -LiteralPath $publicKeyPath -PathType Leaf)) { throw 'A license and its public verification key are required before setup can change services or databases.' }
    & $apiPath '--verify-offline-license' $publicKeyPath $licensePath $InstallationCode
    Write-DiagnosticLog "Offline license preflight exit=$LASTEXITCODE (license contents and installation code withheld)."
    if ($LASTEXITCODE -ne 0) { throw 'The license is invalid, expired, or was not issued for this installation code. No database migration was run.' }

    Set-DiagnosticPhase 'service-installation'
    Install-CafeService $apiPath
    Write-DiagnosticLog 'CafeApiService configuration completed.'
    Set-DataPermissions
    [System.IO.File]::WriteAllText((Join-Path $DataRoot 'installation-code'), $InstallationCode, [System.Text.Encoding]::ASCII)
    Invoke-PostgreSqlSetup
    Set-ProductionConfiguration
    Backup-PostgreSqlDatabase

    $bootstrapPassword = $null
    if ($AdminPasswordFile -and (Test-Path -LiteralPath $AdminPasswordFile)) {
        $bootstrapPassword = [System.IO.File]::ReadAllText($AdminPasswordFile, [System.Text.Encoding]::UTF8).TrimEnd("`r", "`n")
        Add-SensitiveValue $bootstrapPassword
    }
    $env:ASPNETCORE_ENVIRONMENT = 'Production'
    $env:DOTNET_ENVIRONMENT = 'Production'
    $env:PNARA_DATA_DIRECTORY = $DataRoot
    if ($bootstrapPassword) { $env:BootstrapAdmin__Password = $bootstrapPassword }
    else { Remove-Item Env:\BootstrapAdmin__Password -ErrorAction SilentlyContinue }

    Write-Host 'Backing up and applying the application database migrations...'
    Set-DiagnosticPhase 'database-migrations-and-seed'
    $priorErrorActionPreference = $ErrorActionPreference
    try {
        # Windows PowerShell 5.1 can turn redirected native stderr into a terminating
        # NativeCommandError when ErrorActionPreference is Stop. Continue long enough
        # to collect the complete .NET/Npgsql exception and the real process exit code.
        $ErrorActionPreference = 'Continue'
        $migrationOutput = @(& $apiPath '--migrate-and-seed' 2>&1 | ForEach-Object { $_.ToString() })
        $migrationExitCode = $LASTEXITCODE
    }
    finally { $ErrorActionPreference = $priorErrorActionPreference }
    Write-DiagnosticLog "Migration process exit=$migrationExitCode; captured output lines=$($migrationOutput.Count)" $(if ($migrationExitCode -eq 0) { 'INFO' } else { 'ERROR' })
    foreach ($migrationLine in @($migrationOutput | Select-Object -Last 120)) {
        Write-DiagnosticLog "Migration output: $migrationLine" $(if ($migrationExitCode -eq 0) { 'INFO' } else { 'ERROR' })
    }
    Remove-Item Env:\BootstrapAdmin__Password -ErrorAction SilentlyContinue
    $bootstrapPassword = $null
    if ($migrationExitCode -ne 0) {
        $details = [System.Collections.Generic.List[string]]::new()
        if ($migrationOutput.Count -gt 0) {
            $details.Add('Application output:')
            foreach ($line in @($migrationOutput | Select-Object -Last 8)) { $details.Add([string]$line) }
        }

        $logDirectory = Join-Path $DataRoot 'logs'
        $latestLog = $null
        if (Test-Path -LiteralPath $logDirectory) {
            $latestLog = Get-ChildItem -LiteralPath $logDirectory -Filter 'pnara-*.log' -File -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending |
                Select-Object -First 1
        }
        if ($latestLog) {
            $details.Add("Recent application log ($($latestLog.FullName)):")
            try {
                $applicationLogTail = @(Get-Content -LiteralPath $latestLog.FullName -Tail 100 -ErrorAction Stop)
                foreach ($line in $applicationLogTail) {
                    $details.Add([string]$line)
                    Write-DiagnosticLog "Application log: $line" 'ERROR'
                }
            }
            catch { $details.Add('The application log could not be read. Review it manually after setup closes.') }
        }
        else {
            $details.Add("No application log was found. Check $logDirectory after setup closes.")
        }

        $detailText = [Environment]::NewLine + ($details -join [Environment]::NewLine)
        throw "Application database migration or initial seed failed (exit code $migrationExitCode). The verified backup, if any, was preserved.$detailText"
    }
    if ($AdminPasswordFile -and (Test-Path -LiteralPath $AdminPasswordFile)) {
        Remove-Item -LiteralPath $AdminPasswordFile -Force
    }

    Install-CafeService $apiPath
    Set-DiagnosticPhase 'service-start'
    try {
        Start-Service -Name $serviceName -ErrorAction Stop
    }
    catch {
        $serviceSnapshot = Get-CimInstance Win32_Service -Filter "Name='$serviceName'" -ErrorAction SilentlyContinue
        if ($null -ne $serviceSnapshot) {
            Write-DiagnosticLog "Service snapshot at start failure: StartName='$($serviceSnapshot.StartName)', State='$($serviceSnapshot.State)', StartMode='$($serviceSnapshot.StartMode)', ExitCode='$($serviceSnapshot.ExitCode)', ServiceSpecificExitCode='$($serviceSnapshot.ServiceSpecificExitCode)', PathName='$($serviceSnapshot.PathName)'" 'ERROR'
        }
        try {
            $serviceQuery = (& "$env:SystemRoot\System32\sc.exe" qc $serviceName 2>&1 | Out-String).Trim()
            Write-DiagnosticLog "sc.exe qc at start failure: $serviceQuery" 'ERROR'
        }
        catch { Write-DiagnosticLog "sc.exe qc diagnostic failed: $($_.Exception.Message)" 'ERROR' }
        $innerException = $_.Exception
        while ($null -ne $innerException -and $innerException -isnot [System.ComponentModel.Win32Exception]) {
            $innerException = $innerException.InnerException
        }
        if ($innerException -is [System.ComponentModel.Win32Exception]) {
            $serviceStartMessage = "Windows could not start $serviceName. Win32 error $($innerException.NativeErrorCode): $($innerException.Message)"
            Write-DiagnosticLog $serviceStartMessage 'ERROR'
            Write-InstallationError $serviceStartMessage
            throw $serviceStartMessage
        }
        throw
    }
    Wait-ForCafeHealth

    [ordered]@{ Version = $AppVersion; Provider = 'PostgreSQL'; InstalledAtUtc = [DateTime]::UtcNow.ToString('o') } |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $DataRoot 'install-state.json') -Encoding UTF8
    Write-DiagnosticLog 'Installation finished successfully; service health check passed.'
    Remove-Item -LiteralPath (Join-Path $DataRoot 'installation-error.txt') -Force -ErrorAction SilentlyContinue
    Write-Host 'Pnara Cafe service is healthy.'
    exit 0
}
catch {
    Remove-Item Env:\BootstrapAdmin__Password -ErrorAction SilentlyContinue
    try { Stop-CafeService } catch { }
    if (-not $serviceExistedBefore) {
        try { Invoke-ServiceControl @('delete', $serviceName) } catch { }
    }
    $message = $_.Exception.Message
    Write-DiagnosticLog "Installation failed during phase '$($script:CurrentPhase)': $message" 'ERROR'
    Write-DiagnosticException $_.Exception
    Write-InstallationError $message
    if ($ErrorFile) {
        try { [System.IO.File]::WriteAllText($ErrorFile, (Protect-DiagnosticText $message), [System.Text.UTF8Encoding]::new($false)) } catch { }
    }
    Write-Error $message
    exit 1
}
