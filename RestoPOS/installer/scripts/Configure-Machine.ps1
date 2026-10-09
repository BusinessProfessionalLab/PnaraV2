[CmdletBinding()]
param(
    [string]$InstallRoot,
    [string]$DataRoot = (Join-Path $env:ProgramData 'Pnara'),
    [string]$SqlInstance = 'SQLEXPRESS',
    [string]$AdminPasswordFile,
    [string]$ErrorFile,
    [string]$AppVersion = '0.1.0',
    [switch]$SqlLicenseAccepted,
    [switch]$PrepareUpgrade,
    [switch]$UninstallService
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$serviceName = 'CafeApiService'
$databaseName = 'PnaraCafe'
$serviceIdentity = "NT SERVICE\$serviceName"

function Invoke-ServiceControl([string[]]$Arguments) {
    & "$env:SystemRoot\System32\sc.exe" @Arguments | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Windows service control failed for CafeApiService (exit code $LASTEXITCODE)."
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

function Get-SqlConnectionString([string]$Server, [string]$Catalog) {
    $builder = [System.Data.SqlClient.SqlConnectionStringBuilder]::new()
    $builder.DataSource = $Server
    $builder.InitialCatalog = $Catalog
    $builder.IntegratedSecurity = $true
    $builder.Encrypt = $true
    $builder.TrustServerCertificate = $true
    $builder.ConnectTimeout = 15
    return $builder.ConnectionString
}

function Invoke-SqlScalar([string]$Server, [string]$Query, [string]$Catalog = 'master') {
    $connection = [System.Data.SqlClient.SqlConnection]::new((Get-SqlConnectionString $Server $Catalog))
    try {
        $connection.Open()
        $command = $connection.CreateCommand()
        $command.CommandText = $Query
        $command.CommandTimeout = 120
        return $command.ExecuteScalar()
    }
    finally {
        $connection.Dispose()
    }
}

function Invoke-SqlNonQuery([string]$Server, [string]$Query, [string]$Catalog = 'master') {
    $connection = [System.Data.SqlClient.SqlConnection]::new((Get-SqlConnectionString $Server $Catalog))
    try {
        $connection.Open()
        $command = $connection.CreateCommand()
        $command.CommandText = $Query
        $command.CommandTimeout = 0
        [void]$command.ExecuteNonQuery()
    }
    finally {
        $connection.Dispose()
    }
}

function Get-InstalledSqlInstances {
    $instances = [System.Collections.Generic.List[string]]::new()
    foreach ($registryPath in @(
        'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Microsoft SQL Server\Instance Names\SQL'
    )) {
        if (Test-Path $registryPath) {
            $key = Get-ItemProperty -LiteralPath $registryPath
            foreach ($property in $key.PSObject.Properties) {
                if ($property.Name -notlike 'PS*') { $instances.Add($property.Name) }
            }
        }
    }
    foreach ($service in Get-Service -ErrorAction SilentlyContinue | Where-Object Name -Match '^MSSQL(?:\$.*)?$') {
        $instanceName = if ($service.Name -eq 'MSSQLSERVER') { 'MSSQLSERVER' } else { $service.Name.Substring(6) }
        if (-not $instances.Contains($instanceName)) { $instances.Add($instanceName) }
    }
    return $instances.ToArray()
}

function Ensure-SqlExpress {
    $serviceNameSql = "MSSQL`$$SqlInstance"
    $sqlService = Get-Service -Name $serviceNameSql -ErrorAction SilentlyContinue
    if ($null -eq $sqlService) {
        $existingInstances = @(Get-InstalledSqlInstances)
        if ($existingInstances.Count -gt 0) {
            throw "An existing SQL Server installation was detected ($($existingInstances -join ', ')), but no $SqlInstance Express service is present. To protect existing instances and databases, install or select a compatible Express instance yourself, then rerun CafeSetup."
        }
        if (-not $SqlLicenseAccepted) {
            throw 'SQL Server Express license terms were not accepted. No database changes were made.'
        }

        $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
        if ($null -eq $winget) {
            throw 'SQL Server Express is not installed and winget is unavailable. Install Microsoft SQL Server 2025 Express 17.0.1000.7 from the Microsoft download page, then rerun CafeSetup.'
        }

        Write-Host 'Installing the Microsoft SQL Server 2025 Express prerequisite...'
        $arguments = @(
            'install', '--id', 'Microsoft.SQLServer.2025.Express', '--version', '17.0.1000.7',
            '--exact', '--source', 'winget', '--silent', '--accept-source-agreements',
            '--accept-package-agreements', '--disable-interactivity'
        )
        $process = Start-Process -FilePath $winget.Source -ArgumentList $arguments -Wait -PassThru -NoNewWindow
        if ($process.ExitCode -ne 0) {
            throw "SQL Server Express setup returned exit code $($process.ExitCode). No Pnara database migration was started."
        }

        $deadline = (Get-Date).AddMinutes(5)
        do {
            $sqlService = Get-Service -Name $serviceNameSql -ErrorAction SilentlyContinue
            if ($null -ne $sqlService) { break }
            Start-Sleep -Seconds 2
        } while ((Get-Date) -lt $deadline)
        if ($null -eq $sqlService) {
            throw 'SQL Server Express setup finished, but the expected SQLEXPRESS service was not found. Restart Windows and rerun CafeSetup.'
        }
    }

    if ($sqlService.StartType -ne [System.ServiceProcess.ServiceStartMode]::Automatic) {
        Set-Service -Name $serviceNameSql -StartupType Automatic
    }
    if ($sqlService.Status -ne [System.ServiceProcess.ServiceControllerStatus]::Running) {
        Start-Service -Name $serviceNameSql
        $sqlService = Get-Service -Name $serviceNameSql
        $sqlService.WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Running, [TimeSpan]::FromSeconds(60))
    }

    $server = ".\$SqlInstance"
    $version = [string](Invoke-SqlScalar $server "SELECT CONVERT(varchar(40), SERVERPROPERTY('ProductVersion'));")
    $major = [int]$version.Split('.')[0]
    if ($major -lt 15) {
        throw "SQL Server $version is too old for this deployment. The instance was not upgraded or modified. Install a supported SQL Server Express version and rerun CafeSetup."
    }
    $isSysAdmin = [int](Invoke-SqlScalar $server 'SELECT IS_SRVROLEMEMBER(''sysadmin'');')
    if ($isSysAdmin -ne 1) {
        throw "The signed-in Windows account cannot provision the $SqlInstance SQL instance. Run CafeSetup as a SQL Server sysadmin; no schema changes were made."
    }
    return $server
}

function Set-DataPermissions {
    New-Item -ItemType Directory -Force -Path $DataRoot, (Join-Path $DataRoot 'logs'), (Join-Path $DataRoot 'tickets'), (Join-Path $DataRoot 'backups') | Out-Null
    & "$env:SystemRoot\System32\icacls.exe" $DataRoot '/inheritance:r' '/grant:r' `
        'SYSTEM:(OI)(CI)(F)' 'BUILTIN\Administrators:(OI)(CI)(F)' "${serviceIdentity}:(OI)(CI)(RX)" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not set permissions on the Pnara application-data folder.' }
    foreach ($writePath in @((Join-Path $DataRoot 'logs'), (Join-Path $DataRoot 'tickets'), (Join-Path $DataRoot 'backups'))) {
        & "$env:SystemRoot\System32\icacls.exe" $writePath '/grant' "${serviceIdentity}:(OI)(CI)(M)" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Could not grant the service access to $writePath." }
    }
}

function Install-CafeService([string]$ApiPath) {
    $existing = Get-CimInstance Win32_Service -Filter "Name='$serviceName'" -ErrorAction SilentlyContinue
    if ($null -ne $existing -and $existing.PathName -notmatch [regex]::Escape($ApiPath)) {
        throw "A service named $serviceName already points to another executable; it was left unchanged."
    }
    if ($null -eq $existing) {
        Invoke-ServiceControl @('create', $serviceName, "binPath= `"$ApiPath`"", 'start= delayed-auto', "obj= `"$serviceIdentity`"")
    }
    else {
        Stop-CafeService
        Invoke-ServiceControl @('config', $serviceName, "binPath= `"$ApiPath`"", 'start= delayed-auto', "obj= `"$serviceIdentity`"")
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

function Prepare-Database([string]$Server) {
    $databaseExists = [int](Invoke-SqlScalar $Server "SELECT CASE WHEN DB_ID(N'$databaseName') IS NULL THEN 0 ELSE 1 END;") -eq 1
    $hasTables = $false
    $hasMigrationHistory = $false
    if ($databaseExists) {
        $hasTables = [int](Invoke-SqlScalar $Server "SELECT CASE WHEN EXISTS (SELECT 1 FROM [$databaseName].sys.tables WHERE is_ms_shipped = 0) THEN 1 ELSE 0 END;") -eq 1
        $hasMigrationHistory = [int](Invoke-SqlScalar $Server "SELECT CASE WHEN EXISTS (SELECT 1 FROM [$databaseName].sys.tables t JOIN [$databaseName].sys.schemas s ON s.schema_id = t.schema_id WHERE s.name = N'dbo' AND t.name = N'__EFMigrationsHistory') THEN 1 ELSE 0 END;") -eq 1
        if ($hasTables -and -not $hasMigrationHistory) {
            throw "Database $databaseName already contains tables but is not identified as a Pnara EF database. It was left untouched; choose a different instance or have an administrator review it."
        }

        if ($hasMigrationHistory) {
            $knownMigrations = @(
                '20260828233359_InitialCreate',
                '20260831155452_AddMenuItemEnglishName',
                '20260831161759_StoreMenuImagesAsBase64',
                '20260902185055_AddMenuDiscountPercent',
                '20260902185234_ConfigureOrderItemDiscount',
                '20260902194458_AddSystemAddons',
                '20260903100137_SharedAddons',
                '20260911225131_ExpandInventoryModule',
                '20260911232822_CompleteApiSurface'
            )
            $knownMigrationValues = for ($index = 0; $index -lt $knownMigrations.Count; $index++) {
                "(N'$($knownMigrations[$index])', $($index + 1))"
            }
            $knownMigrationValueList = $knownMigrationValues -join ', '
            $unknownMigrationCount = [int](Invoke-SqlScalar $Server "SELECT COUNT(*) FROM [$databaseName].dbo.__EFMigrationsHistory h WHERE NOT EXISTS (SELECT 1 FROM (VALUES $knownMigrationValueList) AS k(MigrationId, Position) WHERE k.MigrationId = h.MigrationId);")
            $historyCount = [int](Invoke-SqlScalar $Server "SELECT COUNT(*) FROM [$databaseName].dbo.__EFMigrationsHistory;")
            $lastKnownPosition = [int](Invoke-SqlScalar $Server "SELECT COALESCE(MAX(k.Position), 0) FROM [$databaseName].dbo.__EFMigrationsHistory h JOIN (VALUES $knownMigrationValueList) AS k(MigrationId, Position) ON k.MigrationId = h.MigrationId;")
            if ($unknownMigrationCount -gt 0 -or $historyCount -eq 0 -or $historyCount -ne $lastKnownPosition) {
                throw "Database $databaseName has an unrecognized or incomplete migration history. It was left untouched; have an administrator verify that it is a Pnara database before upgrading."
            }
        }
    }

    if (-not $databaseExists) {
        Invoke-SqlNonQuery $Server "CREATE DATABASE [$databaseName];"
    }

    if ($hasMigrationHistory) {
        $sqlServiceName = "MSSQL`$$SqlInstance"
        $sqlServiceAccount = (Get-CimInstance Win32_Service -Filter "Name='$sqlServiceName'").StartName
        $backupDirectory = Join-Path $DataRoot 'backups'
        & "$env:SystemRoot\System32\icacls.exe" $backupDirectory '/grant' "${sqlServiceAccount}:(OI)(CI)(M)" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Could not grant SQL Server access to the database-backup folder.' }

        $backupFile = Join-Path $backupDirectory ("PnaraCafe-before-upgrade-{0}.bak" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
        $quotedBackup = $backupFile.Replace("'", "''")
        Invoke-SqlNonQuery $Server "BACKUP DATABASE [$databaseName] TO DISK = N'$quotedBackup' WITH COPY_ONLY, INIT, CHECKSUM, STATS = 5; RESTORE VERIFYONLY FROM DISK = N'$quotedBackup' WITH CHECKSUM;"
        Write-Host "Database backup verified: $backupFile"
    }

    $loginSql = @"
IF SUSER_ID(N'$serviceIdentity') IS NULL
    CREATE LOGIN [$serviceIdentity] FROM WINDOWS;
USE [$databaseName];
IF USER_ID(N'$serviceIdentity') IS NULL
    CREATE USER [$serviceIdentity] FOR LOGIN [$serviceIdentity];
IF IS_ROLEMEMBER(N'db_datareader', N'$serviceIdentity') <> 1
    ALTER ROLE [db_datareader] ADD MEMBER [$serviceIdentity];
IF IS_ROLEMEMBER(N'db_datawriter', N'$serviceIdentity') <> 1
    ALTER ROLE [db_datawriter] ADD MEMBER [$serviceIdentity];
GRANT EXECUTE ON SCHEMA::[dbo] TO [$serviceIdentity];
"@
    Invoke-SqlNonQuery $Server $loginSql
}

function Set-ProductionConfiguration {
    $configPath = Join-Path $DataRoot 'appsettings.Production.json'
    if (-not (Test-Path -LiteralPath $configPath)) {
        $keyBytes = [byte[]]::new(64)
        $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try { $random.GetBytes($keyBytes) } finally { $random.Dispose() }
        $configuration = [ordered]@{
            ConnectionStrings = @{ SqlServer = "Server=.\$SqlInstance;Database=$databaseName;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;Connect Timeout=15" }
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
    & "$env:SystemRoot\System32\icacls.exe" $configPath '/inheritance:r' '/grant:r' `
        'SYSTEM:(F)' 'BUILTIN\Administrators:(F)' "${serviceIdentity}:(R)" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not protect production configuration and JWT key permissions.' }
}

function Wait-ForCafeHealth {
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
    $server = Ensure-SqlExpress
    Set-ProductionConfiguration
    Prepare-Database $server

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
    & $apiPath '--migrate-and-seed'
    $migrationExitCode = $LASTEXITCODE
    Remove-Item Env:\BootstrapAdmin__Password -ErrorAction SilentlyContinue
    $bootstrapPassword = $null
    if ($migrationExitCode -ne 0) {
        throw "Application database migration or initial seed failed (exit code $migrationExitCode). The verified backup, if any, was preserved."
    }
    if ($AdminPasswordFile -and (Test-Path -LiteralPath $AdminPasswordFile)) {
        Remove-Item -LiteralPath $AdminPasswordFile -Force
    }

    Install-CafeService $apiPath
    Start-Service -Name $serviceName
    Wait-ForCafeHealth

    [ordered]@{ Version = $AppVersion; Instance = $SqlInstance; Database = $databaseName; InstalledAtUtc = [DateTime]::UtcNow.ToString('o') } |
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
