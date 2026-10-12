# Pnara Cafe

Pnara is a cafe point-of-sale and inventory system. The repository contains a Next.js frontend and an ASP.NET Core 8 API backed by PostgreSQL and Entity Framework Core.

## Development

Development requires Node.js 18.18 or later, npm, a .NET SDK 8 or later, and a local PostgreSQL server. The Windows installer bundles PostgreSQL 17.11 and installs it natively; Docker is not used. The POS frontend is in `frontend`; `LandingPage` is a separate Astro site.

Set local-only credentials with .NET user secrets before starting the API:

```powershell
$keyBytes = [byte[]]::new(48)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($keyBytes)
$jwtKey = [Convert]::ToBase64String($keyBytes)
dotnet user-secrets set --project backend/src/API/RestoPOS.API.csproj "Jwt:Key" $jwtKey
$adminPassword = Read-Host "Choose a development administrator password"
dotnet user-secrets set --project backend/src/API/RestoPOS.API.csproj "BootstrapAdmin:Password" $adminPassword
$env:ConnectionStrings__PostgreSql = "Host=localhost;Port=5432;Database=pnara;Username=pnara_app;Password=your-password"
```

Start the API and frontend in separate terminals:

```powershell
dotnet run --project backend/src/API/RestoPOS.API.csproj
```

```powershell
Set-Location frontend
npm ci
npm run dev
```

The Next.js development server proxies `/api`, `/hubs`, and `/health` to `http://localhost:5088` by default. Set `API_PROXY_TARGET` in `frontend/.env.local` if the API uses another local address. The API applies migrations and idempotent development seed data on startup.

## Build the Windows installer

From this directory, run:

```powershell
.\scripts\build-installer.ps1
```

The script restores the npm lockfile, runs frontend lint and type checks, builds the static export, builds and tests the .NET solution, publishes self-contained Windows x64 binaries, compiles the Inno Setup project, and writes `artifacts/CafeSetup.exe`.

Build requirements are Node.js 18.18 or later, a .NET SDK 8 or later, Inno Setup 6 or 7, and internet access for dependency restore and the official PostgreSQL installer download. The generated installer can install and configure PostgreSQL natively on the target computer; Docker is not used.

To sign the API, launcher, and installer with a code-signing certificate in the Windows certificate store, set `CAFE_SIGN_CERT_THUMBPRINT` before building. `CAFE_TIMESTAMP_URL` optionally selects a timestamp server. Without a certificate, the build succeeds unsigned and reports that status.

## Deployment notes

- Setup installs `CafeApiService` as a virtual service account, binds the web app and API to `127.0.0.1:5077`, and serves the exported frontend from the ASP.NET Core origin. Customer computers do not need Node.js or the .NET runtime.
- Protected production configuration, logs, ticket files, and verified pre-upgrade backups live under `%ProgramData%\Pnara`. Uninstall removes the application service and shortcuts but preserves this folder and the PostgreSQL database.
- New installations ask the owner to choose the first `admin` password. Production JWT keys are generated locally and stored with restricted file permissions.
- The repository contains no certified payment-terminal SDK. Card-terminal charges are rejected until the cafe's actual PSP adapter is installed and tested; cash sales remain available.
- Receipt printing currently sends ESC/POS bytes over the configured network host and port 9100. No USB/serial model, Persian code page, or physical printer has been verified.
- PostgreSQL connection details are stored in the protected production configuration under `%ProgramData%\Pnara`. Existing SQL Server databases are not converted automatically; export and validate their data before switching an installation. See [`installer/README.md`](installer/README.md) and [`docs/deployment.md`](docs/deployment.md) for setup, upgrade, and recovery steps.
