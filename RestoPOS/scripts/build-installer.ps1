[CmdletBinding()]
param(
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$AppVersion = '0.1.0'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$artifactRoot = Join-Path $projectRoot 'artifacts'
$buildRoot = Join-Path $artifactRoot 'cafe-build'
$frontendRoot = Join-Path $projectRoot 'frontend'
$backendRoot = Join-Path $projectRoot 'backend'
$payloadRoot = Join-Path $buildRoot 'payload'
$serverPublish = Join-Path $buildRoot 'server'
$launcherPublish = Join-Path $buildRoot 'launcher'
$frontendExport = Join-Path $frontendRoot 'out'
$installerStaging = Join-Path $buildRoot 'installer'
$installerOutput = Join-Path $artifactRoot 'CafeSetup.exe'
$installerScript = Join-Path $projectRoot 'installer\CafeSetup.iss'

function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory)][string]$Executable,
        [Parameter(Mandatory)][string[]]$Arguments,
        [Parameter(Mandatory)][string]$WorkingDirectory
    )

    Push-Location -LiteralPath $WorkingDirectory
    try {
        & $Executable @Arguments
        $exitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
    if ($exitCode -ne 0) {
        throw "Command failed with exit code ${exitCode}: $Executable $($Arguments -join ' ')"
    }
}

function Reset-BuildDirectory {
    param([Parameter(Mandatory)][string]$Path)

    $target = [System.IO.Path]::GetFullPath($Path)
    $allowedRoot = [System.IO.Path]::GetFullPath($buildRoot).TrimEnd('\')
    if ($target -ne $allowedRoot -and -not $target.StartsWith(($allowedRoot + '\'), [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to clear a path outside the installer build directory: $target"
    }
    if (Test-Path -LiteralPath $target) {
        Remove-Item -LiteralPath $target -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $target | Out-Null
}

function Find-InnoCompiler {
    $fromPath = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($fromPath) { return $fromPath.Source }

    $programFiles = [Environment]::GetFolderPath([Environment+SpecialFolder]::ProgramFiles)
    $programFilesX86 = [Environment]::GetFolderPath([Environment+SpecialFolder]::ProgramFilesX86)
    foreach ($candidate in @(
        (Join-Path $programFiles 'Inno Setup 7\ISCC.exe'),
        (Join-Path $programFiles 'Inno Setup 6\ISCC.exe'),
        (Join-Path $programFilesX86 'Inno Setup 7\ISCC.exe'),
        (Join-Path $programFilesX86 'Inno Setup 6\ISCC.exe')
    )) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    throw 'Inno Setup 6 or 7 is required to compile CafeSetup.exe.'
}

function Find-SignTool {
    $fromPath = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($fromPath) { return $fromPath.Source }
    $programFilesX86 = [Environment]::GetFolderPath([Environment+SpecialFolder]::ProgramFilesX86)
    $windowsKits = Join-Path $programFilesX86 'Windows Kits\10\bin'
    if (Test-Path -LiteralPath $windowsKits) {
        $candidate = Get-ChildItem -LiteralPath $windowsKits -Filter signtool.exe -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object FullName -Match '\\x64\\signtool\.exe$' |
            Sort-Object FullName -Descending |
            Select-Object -First 1
        if ($candidate) { return $candidate.FullName }
    }
    throw 'A Windows SDK SignTool installation is required when CAFE_SIGN_CERT_THUMBPRINT is set.'
}

function Sign-And-Verify {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$SignTool, [Parameter(Mandatory)][string]$Thumbprint)

    & $SignTool sign /fd SHA256 /tr $timestampUrl /td SHA256 /sha1 $Thumbprint $Path
    if ($LASTEXITCODE -ne 0) { throw "SignTool could not sign $Path." }
    & $SignTool verify /pa /all $Path
    if ($LASTEXITCODE -ne 0) { throw "SignTool signature verification failed for $Path." }
}

try {
    $nodeCommand = Get-Command node.exe -ErrorAction Stop
    $npmCommand = Get-Command npm.cmd -ErrorAction Stop
    $dotnetCommand = Get-Command dotnet.exe -ErrorAction Stop
    $innoCompiler = Find-InnoCompiler

    $nodeVersion = (& $nodeCommand.Source --version).Trim().TrimStart('v')
    if ([version]$nodeVersion -lt [version]'18.18.0') {
        throw "Node.js 18.18 or later is required for the locked Next.js version. Found $nodeVersion."
    }
    $sdkLines = & $dotnetCommand.Source --list-sdks
    $sdkVersions = @($sdkLines | ForEach-Object { if ($_ -match '^([0-9]+\.[0-9]+\.[0-9]+)') { [version]$Matches[1] } })
    if (-not ($sdkVersions | Where-Object Major -GE 8)) {
        throw 'A .NET SDK 8 or newer is required to build the net8.0 solution.'
    }
    foreach ($required in @($frontendRoot, $backendRoot, $installerScript, (Join-Path $projectRoot 'installer\assets\Pnara.ico'))) {
        if (-not (Test-Path -LiteralPath $required)) { throw "Required project file or directory is missing: $required" }
    }

    New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null
    Reset-BuildDirectory $buildRoot
    $nextBuildDirectory = [System.IO.Path]::GetFullPath((Join-Path $frontendRoot '.next'))
    $frontendFullPath = [System.IO.Path]::GetFullPath($frontendRoot).TrimEnd('\')
    if (-not $nextBuildDirectory.StartsWith(($frontendFullPath + '\'), [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Refusing to clear a path outside the frontend build output.'
    }
    if (Test-Path -LiteralPath $nextBuildDirectory) {
        Remove-Item -LiteralPath $nextBuildDirectory -Recurse -Force
    }
    foreach ($directory in @($payloadRoot, $serverPublish, $launcherPublish, $installerStaging)) {
        New-Item -ItemType Directory -Force -Path $directory | Out-Null
    }

    Write-Host "Using Node.js $nodeVersion, .NET SDK $($sdkVersions[-1]), and Inno Setup compiler $innoCompiler."
    Write-Host 'Restoring the frontend from package-lock.json...'
    Invoke-NativeCommand $npmCommand.Source @('ci') $frontendRoot
    Invoke-NativeCommand $npmCommand.Source @('run', 'lint') $frontendRoot
    Invoke-NativeCommand $npmCommand.Source @('run', 'typecheck') $frontendRoot
    Invoke-NativeCommand $npmCommand.Source @('audit', '--omit=dev', '--audit-level=high') $frontendRoot

    Write-Host 'Building the Next.js static export...'
    $oldStaticExport = $env:CAFE_STATIC_EXPORT
    $oldPublicApiUrl = $env:NEXT_PUBLIC_API_URL
    $oldApiProxyTarget = $env:API_PROXY_TARGET
    try {
        $env:CAFE_STATIC_EXPORT = '1'
        $env:NEXT_PUBLIC_API_URL = ''
        $env:API_PROXY_TARGET = ''
        Invoke-NativeCommand $npmCommand.Source @('run', 'build') $frontendRoot
    }
    finally {
        $env:CAFE_STATIC_EXPORT = $oldStaticExport
        $env:NEXT_PUBLIC_API_URL = $oldPublicApiUrl
        $env:API_PROXY_TARGET = $oldApiProxyTarget
    }

    $staticRoutes = @(
        'index.html', 'login\index.html', 'pos\index.html', 'kds\index.html', 'kds\kitchen\index.html',
        'admin\index.html', 'admin\tables\index.html', 'admin\staff\index.html', 'admin\menu\index.html',
        'admin\menu\products\index.html', 'admin\menu\categories\index.html', 'admin\menu\order\index.html',
        'admin\menu\addons\index.html', 'admin\settings\index.html', 'admin\reports\index.html',
        'admin\inventory\index.html', 'admin\customers\index.html', 'admin\discounts\index.html',
        'admin\version\index.html'
    )
    foreach ($route in $staticRoutes) {
        if (-not (Test-Path -LiteralPath (Join-Path $frontendExport $route))) {
            throw "Static export is missing route '$route'."
        }
    }
    if (-not (Get-ChildItem -LiteralPath (Join-Path $frontendExport '_next\static') -Filter '*.css' -Recurse -File | Select-Object -First 1)) {
        throw 'Static export is missing compiled CSS assets.'
    }
    if (-not (Get-ChildItem -LiteralPath (Join-Path $frontendExport '_next\static\media') -Filter '*.woff*' -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1)) {
        throw 'Static export is missing the bundled font assets.'
    }
    $textAssets = Get-ChildItem -LiteralPath $frontendExport -Recurse -File |
        Where-Object Extension -In @('.html', '.js', '.css', '.json', '.svg', '.txt', '.webmanifest')
    if (Select-String -Path $textAssets.FullName -SimpleMatch '192.168.100.249' -Quiet) {
        throw 'Static frontend assets contain the old hard-coded LAN API host.'
    }

    Write-Host 'Restoring, building, and testing the .NET solution...'
    Invoke-NativeCommand $dotnetCommand.Source @('restore', 'RestoPOS.sln') $backendRoot
    Invoke-NativeCommand $dotnetCommand.Source @('build', 'RestoPOS.sln', '--configuration', 'Release', '--no-restore') $backendRoot
    Invoke-NativeCommand $dotnetCommand.Source @('test', 'RestoPOS.sln', '--configuration', 'Release', '--no-build', '--logger', 'console;verbosity=normal') $backendRoot

    Write-Host 'Publishing the backend and desktop launcher as self-contained Windows x64 applications...'
    Invoke-NativeCommand $dotnetCommand.Source @(
        'publish', 'src\API\RestoPOS.API.csproj', '--configuration', 'Release', '--runtime', 'win-x64',
        '--self-contained', 'true', "-p:Version=$AppVersion", '--output', $serverPublish
    ) $backendRoot
    Invoke-NativeCommand $dotnetCommand.Source @(
        'publish', 'installer\launcher\CafeLauncher.csproj', '--configuration', 'Release', '--runtime', 'win-x64',
        '--self-contained', 'true', '-p:PublishSingleFile=true', '-p:IncludeNativeLibrariesForSelfExtract=true',
        "-p:Version=$AppVersion", '--output', $launcherPublish
    ) $projectRoot

    $wwwroot = Join-Path $serverPublish 'wwwroot'
    New-Item -ItemType Directory -Force -Path $wwwroot | Out-Null
    Copy-Item -Path (Join-Path $frontendExport '*') -Destination $wwwroot -Recurse -Force
    Copy-Item -LiteralPath (Join-Path $launcherPublish 'CafeLauncher.exe') -Destination (Join-Path $payloadRoot 'CafeLauncher.exe') -Force
    Copy-Item -LiteralPath (Join-Path $projectRoot 'installer\assets\Pnara.ico') -Destination (Join-Path $payloadRoot 'Pnara.ico') -Force
    Copy-Item -LiteralPath (Join-Path $projectRoot 'installer\scripts\Configure-Machine.ps1') -Destination (Join-Path $serverPublish 'Configure-Machine.ps1') -Force
    Copy-Item -LiteralPath (Join-Path $projectRoot 'installer\scripts\Configure-Machine.ps1') -Destination (Join-Path $payloadRoot 'Configure-Machine.ps1') -Force
    Copy-Item -Path (Join-Path $serverPublish '*') -Destination $payloadRoot -Recurse -Force
    Copy-Item -LiteralPath (Join-Path $projectRoot 'installer\README.md') -Destination (Join-Path $payloadRoot 'Installation-Guide.md') -Force

    foreach ($requiredPayload in @('RestoPOS.API.exe', 'CafeLauncher.exe', 'wwwroot\index.html', 'Configure-Machine.ps1', 'Pnara.ico')) {
        $path = Join-Path $payloadRoot $requiredPayload
        if (-not (Test-Path -LiteralPath $path)) { throw "Installer payload is missing '$requiredPayload'." }
    }

    $signThumbprint = ($env:CAFE_SIGN_CERT_THUMBPRINT -replace '\s', '').ToUpperInvariant()
    $signTool = $null
    $timestampUrl = if ($env:CAFE_TIMESTAMP_URL) { $env:CAFE_TIMESTAMP_URL } else { 'https://timestamp.digicert.com' }
    if ($signThumbprint) {
        $certificate = Get-ChildItem "Cert:\CurrentUser\My\$signThumbprint", "Cert:\LocalMachine\My\$signThumbprint" -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if (-not $certificate -or -not $certificate.HasPrivateKey -or $certificate.NotAfter -le (Get-Date)) {
            throw 'The configured signing certificate was not found, has no private key, or has expired.'
        }
        $signTool = Find-SignTool
        Sign-And-Verify (Join-Path $payloadRoot 'RestoPOS.API.exe') $signTool $signThumbprint
        Sign-And-Verify (Join-Path $payloadRoot 'CafeLauncher.exe') $signTool $signThumbprint
    }
    else {
        Write-Warning 'No CAFE_SIGN_CERT_THUMBPRINT was supplied; installer and application executables will be unsigned.'
    }

    Write-Host 'Compiling the Inno Setup installer...'
    Invoke-NativeCommand $innoCompiler @("/DAppVersion=$AppVersion", $installerScript) $projectRoot
    $compiledInstaller = Join-Path $installerStaging 'CafeSetup.exe'
    if (-not (Test-Path -LiteralPath $compiledInstaller)) {
        throw "Inno Setup did not create the expected installer at $compiledInstaller."
    }
    Copy-Item -LiteralPath $compiledInstaller -Destination $installerOutput -Force

    if ($signThumbprint) {
        Sign-And-Verify $installerOutput $signTool $signThumbprint
    }

    $installer = Get-Item -LiteralPath $installerOutput
    $hash = (Get-FileHash -LiteralPath $installerOutput -Algorithm SHA256).Hash
    $signature = Get-AuthenticodeSignature -LiteralPath $installerOutput
    Write-Host ''
    Write-Host "Build succeeded: $($installer.FullName)"
    Write-Host "Version: $AppVersion"
    Write-Host ("Size: {0:N1} MB" -f ($installer.Length / 1MB))
    Write-Host "SHA-256: $hash"
    Write-Host "Authenticode: $($signature.Status)"
}
catch {
    Write-Error $_
    exit 1
}
