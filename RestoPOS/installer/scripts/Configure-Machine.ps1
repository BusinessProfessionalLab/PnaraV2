[CmdletBinding()]
param(
    [string]$InstallRoot,
    [string]$DataRoot = (Join-Path $env:ProgramData 'Pnara'),
    [string]$PostgreSqlConnectionFile,
    [string]$PostgreSqlInstallerPath,
    [string]$AdminPasswordFile,
    [string]$ErrorFile,
    [string]$AppVersion = '0.1.0',
    [switch]$PrepareUpgrade,
    [switch]$UninstallService
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$serviceName = 'CafeApiService'
$serviceIdentity = "NT SERVICE\$serviceName"

function Invoke-ServiceControl([string[]]$Arguments) {
    $output = (& "$env:SystemRoot\System32\sc.exe" @Arguments 2>&1 | Out-String).Trim()
    $exitCode = $LASTEXITCODE
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

function Invoke-Icacls([string]$Path, [string[]]$Arguments) {
    $output = (& "$env:SystemRoot\System32\icacls.exe" $Path @Arguments 2>&1 | Out-String).Trim()
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "icacls failed for '$Path' (exit code $exitCode). $output"
    }
}

function Set-DataPermissions {
    New-Item -ItemType Directory -Force -Path $DataRoot, (Join-Path $DataRoot 'logs'), (Join-Path $DataRoot 'tickets'), (Join-Path $DataRoot 'backups') | Out-Null
    $serviceSid = [System.Security.Principal.NTAccount]::new($serviceIdentity).Translate([System.Security.Principal.SecurityIdentifier]).Value
    Invoke-Icacls $DataRoot @(
        '/inheritance:r',
        '/grant:r', '*S-1-5-18:(OI)(CI)(F)',
        '/grant:r', '*S-1-5-32-544:(OI)(CI)(F)',
        '/grant:r', "*${serviceSid}:(OI)(CI)(RX)"
    )
    foreach ($writePath in @((Join-Path $DataRoot 'logs'), (Join-Path $DataRoot 'tickets'), (Join-Path $DataRoot 'backups'))) {
        Invoke-Icacls $writePath @('/grant:r', "*${serviceSid}:(OI)(CI)(M)")
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
    $configPath = Join-Path $DataRoot 'appsettings.Production.json'
    $connectionString = $null
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
            Urls = 'http://127.0.0.1:5077'
        }
        $json = $configuration | ConvertTo-Json -Depth 5
        [System.IO.File]::WriteAllText($configPath, $json, [System.Text.UTF8Encoding]::new($false))
    }
    elseif (-not $existingConfiguration.ConnectionStrings.PSObject.Properties['PostgreSql']) {
        $existingConfiguration.ConnectionStrings | Add-Member -NotePropertyName PostgreSql -NotePropertyValue $connectionString -Force
        $existingConfiguration | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $configPath -Encoding utf8
    }
    & "$env:SystemRoot\System32\icacls.exe" $configPath '/inheritance:r' '/grant:r' `
        'SYSTEM:(F)' 'BUILTIN\Administrators:(F)' "${serviceIdentity}:(R)" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not protect production configuration and JWT key permissions.' }
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
        throw 'CafeApiService did not pass its database health check within 75 seconds. Review the logs in ProgramData\Pnara\logs.'
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
    if (-not $InstallRoot) { throw 'The application installation path is missing.' }
    $apiPath = Join-Path $InstallRoot 'RestoPOS.API.exe'
    if (-not (Test-Path -LiteralPath $apiPath)) { throw "Backend executable was not found at $apiPath." }

    Install-CafeService $apiPath
    Set-DataPermissions
    $productionConfigPath = Join-Path $DataRoot 'appsettings.Production.json'
    $hasPostgreSqlConfiguration = $false
    if (Test-Path -LiteralPath $productionConfigPath) {
        $currentProductionConfig = Get-Content -LiteralPath $productionConfigPath -Raw | ConvertFrom-Json
        if ($currentProductionConfig.ConnectionStrings.PSObject.Properties['SqlServer'] -and
            $currentProductionConfig.ConnectionStrings.SqlServer) {
            throw 'This installation still points to SQL Server. Setup will not install PostgreSQL or replace that database connection. Export and validate the existing data before completing the PostgreSQL cutover.'
        }
        $hasPostgreSqlConfiguration = $null -ne $currentProductionConfig.ConnectionStrings.PSObject.Properties['PostgreSql'] -and
            -not [string]::IsNullOrWhiteSpace([string]$currentProductionConfig.ConnectionStrings.PostgreSql)
    }
    if (-not $hasPostgreSqlConfiguration -and -not $PostgreSqlConnectionFile) {
        $provisionedConnectionString = Install-LocalPostgreSql
        $PostgreSqlConnectionFile = Join-Path $env:TEMP ("pnara-postgresql-connection-{0}.txt" -f [guid]::NewGuid().ToString('N'))
        [System.IO.File]::WriteAllText($PostgreSqlConnectionFile, $provisionedConnectionString, [System.Text.Encoding]::UTF8)
        Invoke-Icacls $PostgreSqlConnectionFile @('/inheritance:r', '/grant:r', '*S-1-5-18:(F)', '*S-1-5-32-544:(F)')
    }
    Set-ProductionConfiguration
    if ($PostgreSqlConnectionFile -like '*pnara-postgresql-connection-*.txt') {
        Remove-Item -LiteralPath $PostgreSqlConnectionFile -Force -ErrorAction SilentlyContinue
    }
    Backup-PostgreSqlDatabase

    $bootstrapPassword = $null
    if ($AdminPasswordFile -and (Test-Path -LiteralPath $AdminPasswordFile)) {
        $bootstrapPassword = [System.IO.File]::ReadAllText($AdminPasswordFile, [System.Text.Encoding]::UTF8).TrimEnd("`r", "`n")
    }
    $env:ASPNETCORE_ENVIRONMENT = 'Production'
    $env:DOTNET_ENVIRONMENT = 'Production'
    $env:PNARA_DATA_DIRECTORY = $DataRoot
    if ($bootstrapPassword) { $env:BootstrapAdmin__Password = $bootstrapPassword }
    else { Remove-Item Env:\BootstrapAdmin__Password -ErrorAction SilentlyContinue }

    Write-Host 'Backing up and applying the application database migrations...'
    $migrationOutput = @(& $apiPath '--migrate-and-seed' 2>&1 | ForEach-Object { $_.ToString() })
    $migrationExitCode = $LASTEXITCODE
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
                foreach ($line in @(Get-Content -LiteralPath $latestLog.FullName -Tail 14 -ErrorAction Stop)) { $details.Add([string]$line) }
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
    Start-Service -Name $serviceName
    Wait-ForCafeHealth

    [ordered]@{ Version = $AppVersion; Provider = 'PostgreSQL'; InstalledAtUtc = [DateTime]::UtcNow.ToString('o') } |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $DataRoot 'install-state.json') -Encoding UTF8
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
    if ($ErrorFile) {
        try { [System.IO.File]::WriteAllText($ErrorFile, $message, [System.Text.UTF8Encoding]::new($false)) } catch { }
    }
    Write-Error $message
    exit 1
}
