# CafeSetup deployment guide

`CafeSetup.exe` installs the Pnara Cafe application as a local Windows service. The frontend is exported by Next.js and served by the ASP.NET Core API from one origin. The installed computer needs no Node.js or .NET runtime.

## Build requirements

- Windows x64, Node.js 18.18 or later, npm, .NET SDK 8 or later, and Inno Setup 6 or 7.
- Internet access for npm and NuGet restore when building. The setup package bundles the signed PostgreSQL 17.11 Windows x64 installer, so the target computer does not need internet access or Docker.
- To sign the deliverables, install a code-signing certificate with its private key in the Windows certificate store and the Windows SDK SignTool.

From the repository's `RestoPOS` directory, build with:

```powershell
.\scripts\build-installer.ps1
```

The script runs `npm ci`, frontend lint and type checks, the static production build, .NET Release build and tests, self-contained `win-x64` publishes, and Inno Setup compilation. The installer is written to `artifacts\CafeSetup.exe`; intermediate payloads are under `artifacts\cafe-build` and are ignored by git.

Optional signing uses a certificate thumbprint in `CAFE_SIGN_CERT_THUMBPRINT`. The script signs and verifies the API executable, launcher, and installer. Set `CAFE_TIMESTAMP_URL` to override the default timestamp server. Without a certificate, the generated installer is unsigned.

## Installation

1. Run `CafeSetup.exe` as an administrator.
2. Leave the PostgreSQL connection field blank for automatic PostgreSQL 17 installation and database setup. If you already have PostgreSQL, enter the connection string for a database role that owns `pnara` and can create or update its schema. Existing PostgreSQL services, files, and databases are never replaced by the bundled install.
3. Choose the install directory and enter the first administrator password. The password must contain at least 12 characters, including an uppercase Latin letter, a lowercase Latin letter, and a digit; a symbol is optional. The account name is `admin`; its password is stored as an ASP.NET Identity hash.
4. Setup installs PostgreSQL 17 when requested, creates the `pnara` database and least-privilege `pnara_app` role with a randomly generated password, applies application migrations, starts `CafeApiService`, waits for the database-backed health endpoint, and reports failure if the service does not become healthy. On success, use the desktop or Start Menu shortcut to open the cafe application.

Existing SQL Server databases are not converted automatically. Export the data to PostgreSQL and verify it before upgrading an existing SQL Server installation; setup deliberately stops rather than connecting that installation to a new, empty database.

The service runs as the built-in low-privilege `NT AUTHORITY\LocalService` account. Its service SID receives only the file access needed by the app, while PostgreSQL credentials remain in the protected production configuration. The service listens only on `127.0.0.1:5077`; setup creates no firewall rules.

## Data, upgrades, and recovery

Mutable data is stored outside Program Files:

- `%ProgramData%\Pnara\appsettings.Production.json` contains the randomly generated JWT signing key and local connection string. Its ACL allows only SYSTEM, Administrators, and the service account.
- `%ProgramData%\Pnara\logs` contains service logs; `%ProgramData%\Pnara\tickets` contains printer ticket files.
- `%ProgramData%\Pnara\backups` stores a PostgreSQL custom-format backup before each upgrade. Setup verifies that `pg_restore` can read the archive. Keep PostgreSQL command-line tools (`pg_dump` and `pg_restore`) installed for upgrades.

Rerun a newer `CafeSetup.exe` to upgrade. Setup stops the service, keeps the database and configuration, backs up an existing Pnara database, applies pending migrations, restarts the service, and waits for health. It does not downgrade schemas. If a migration or service startup fails, setup stops the service and retains the database, configuration, and any verified backup. The setup error includes recent migration output and application-log lines when available; review `%ProgramData%\Pnara\logs` before retrying.

To restore after a failed migration, first stop `CafeApiService`, preserve a copy of the `.dump` file, then restore the PostgreSQL custom-format archive with `pg_restore` after confirming the target database.

Uninstall removes the Cafe API service, application files, and shortcuts. It leaves `%ProgramData%\Pnara` and the PostgreSQL database intact. Data removal is not part of normal uninstall; make and verify a separate backup before an administrator manually removes the database or data folder.

## Hardware and production limitations

- Card-terminal integration is not ready for live payment. The repository's terminal service has no certified PSP SDK and now returns a failed/unavailable result instead of fabricating an approval. Obtain and test the actual vendor SDK/protocol before enabling terminal payments.
- Receipt printing currently sends ESC/POS bytes to the configured LAN printer host and port 9100. No printer model, Persian text code page, USB/serial path, or reconnect behavior has been tested. The cafe must verify its model and driver with test receipts.
- Browser login, menu and inventory flows, sales, and PostgreSQL migration behavior can be validated in software tests. Physical printer, payment-terminal, restart/recovery, clean Windows installation, and upgrade tests still require a dedicated test computer and hardware.
- The setup wizard is localized in Persian, displays the per-installation 8-digit request code, and accepts an offline signed license. It creates a desktop shortcut after a successful installation.

## Manual verification checklist

Use [`../docs/deployment.md`](../docs/deployment.md) to validate a fresh Windows 10/11 x64 installation with bundled PostgreSQL, upgrades, data-preserving uninstall, browser refreshes, and hardware integration.
