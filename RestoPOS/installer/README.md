# CafeSetup deployment guide

`CafeSetup.exe` installs the Pnara Cafe application as a local Windows service. The frontend is exported by Next.js and served by the ASP.NET Core API from one origin. The installed computer needs no Node.js or .NET runtime.

## Build requirements

- Windows x64, Node.js 18.18 or later, npm, .NET SDK 8 or later, and Inno Setup 6 or 7.
- Internet access for npm and NuGet restore. If the target has no compatible `SQLEXPRESS` instance, setup also needs Windows Package Manager and internet access to install Microsoft SQL Server 2025 Express 17.0.1000.7. Allow several gigabytes of free disk space for SQL Server.
- To sign the deliverables, install a code-signing certificate with its private key in the Windows certificate store and the Windows SDK SignTool.

From the repository's `RestoPOS` directory, build with:

```powershell
.\scripts\build-installer.ps1
```

The script runs `npm ci`, frontend lint and type checks, the static production build, .NET Release build and tests, self-contained `win-x64` publishes, and Inno Setup compilation. The installer is written to `artifacts\CafeSetup.exe`; intermediate payloads are under `artifacts\cafe-build` and are ignored by git.

Optional signing uses a certificate thumbprint in `CAFE_SIGN_CERT_THUMBPRINT`. The script signs and verifies the API executable, launcher, and installer. Set `CAFE_TIMESTAMP_URL` to override the default timestamp server. Without a certificate, the generated installer is unsigned.

## Installation

1. Run `CafeSetup.exe` as an administrator.
2. If setup needs to install SQL Server Express, review and accept Microsoft's SQL Server 2025 Express terms on the prerequisite page. Setup downloads the Microsoft package through Windows Package Manager and checks its exit code and resulting service.
3. Choose the install directory and enter the first administrator password. The account name is `admin`; the chosen password is saved as an ASP.NET Identity hash in the database.
4. Setup creates or reuses the local `SQLEXPRESS` instance and provisions a separate `PnaraCafe` database. It does not use the existing `Pnara` database. If another SQL Server instance exists but `SQLEXPRESS` does not, setup stops rather than adding a side-by-side SQL Server version or changing shared engine files.
5. Setup applies migrations, starts `CafeApiService`, waits for the database-backed health endpoint, and reports failure if the service does not become healthy. On success, use the desktop or Start Menu shortcut to open the cafe application.

The service runs as the virtual account `NT SERVICE\CafeApiService`. It receives read/write access to the `PnaraCafe` database and read access to its protected configuration. It listens only on `127.0.0.1:5077`; setup creates no firewall rules. SQL provisioning requires the installing Windows account to be a SQL Server sysadmin on the selected instance.

## Data, upgrades, and recovery

Mutable data is stored outside Program Files:

- `%ProgramData%\Pnara\appsettings.Production.json` contains the randomly generated JWT signing key and local connection string. Its ACL allows only SYSTEM, Administrators, and the service account.
- `%ProgramData%\Pnara\logs` contains service logs; `%ProgramData%\Pnara\tickets` contains printer ticket files.
- `%ProgramData%\Pnara\backups` stores a checksum-verified SQL backup before every migration of an existing Pnara database.

Rerun a newer `CafeSetup.exe` to upgrade. Setup stops the service, keeps the database and configuration, backs up an existing Pnara database, applies pending migrations, restarts the service, and waits for health. It does not downgrade schemas. If a migration or service startup fails, setup stops the service and retains the database, configuration, and any verified backup. Review the setup log and `%ProgramData%\Pnara\logs` before retrying.

To restore after a failed migration, first stop `CafeApiService`, preserve a copy of the `.bak` file, and restore `PnaraCafe` from that backup with SQL Server Management Studio or a SQL Server administrator. Do not restore over another database with the same name without verifying it is the Pnara Cafe database.

Uninstall removes the Cafe API service, application files, and shortcuts. It leaves `%ProgramData%\Pnara`, the `PnaraCafe` database, and the SQL Server instance intact. Data removal is not part of normal uninstall; make and verify a separate backup before any administrator manually removes the database or data folder.

## Hardware and production limitations

- Card-terminal integration is not ready for live payment. The repository's terminal service has no certified PSP SDK and now returns a failed/unavailable result instead of fabricating an approval. Obtain and test the actual vendor SDK/protocol before enabling terminal payments.
- Receipt printing currently sends ESC/POS bytes to the configured LAN printer host and port 9100. No printer model, Persian text code page, USB/serial path, or reconnect behavior has been tested. The cafe must verify its model and driver with test receipts.
- Browser login, menu and inventory flows, sales, and SQL migration behavior can be validated in software tests. Physical printer, payment-terminal, restart/recovery, clean Windows installation, and upgrade tests still require a dedicated test computer and hardware.
- The repository does not include an approved application license, so the CafeSetup wizard does not add a project license page.

## Manual verification checklist

Use [`../docs/deployment.md`](../docs/deployment.md) to validate a fresh Windows 10/11 x64 machine, existing SQL Express, missing SQL Express, upgrades, data-preserving uninstall, browser refreshes, and hardware integration.
