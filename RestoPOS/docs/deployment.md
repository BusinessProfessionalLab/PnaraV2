# Deployment verification and recovery checklist

Build the installer from the `RestoPOS` repository directory:

```powershell
.\scripts\build-installer.ps1
```

Expected artifact: `artifacts\CafeSetup.exe`. The build script runs frontend lint and type checks, Next.js static export, .NET Release build and tests, self-contained `win-x64` publish, and Inno Setup compilation. A signature is reported only when a configured code-signing certificate is present and verification succeeds.

## Clean Windows 10/11 x64 installation

1. Use a disposable test machine or VM with no customer data. Record Windows version and available disk space.
2. Install PostgreSQL 14 or later natively on the test machine, create the `pnara` database and application role, then run `CafeSetup.exe`. Enter the PostgreSQL connection string and confirm the first admin password page.
3. Confirm `CafeApiService` is automatic and running:

   ```powershell
   Get-CimInstance Win32_Service -Filter "Name='CafeApiService'" | Select-Object Name, StartName, State, StartMode, PathName
   ```

4. Confirm the endpoint is loopback-only and healthy:

   ```powershell
   Get-NetTCPConnection -State Listen -LocalPort 5077 | Select-Object LocalAddress, LocalPort
   Invoke-RestMethod http://127.0.0.1:5077/health
   ```

   The listener should be `127.0.0.1`; health should report `status: ok`.

5. Open the desktop shortcut, sign in as `admin` with the password chosen during setup, and verify representative menu, inventory, order, and cash-payment flows. Refresh `/pos/`, `/kds/`, and `/admin/` directly; each route should load from the installed static export.
6. Restart Windows and verify automatic service recovery and the desktop shortcut again.
7. Uninstall Pnara Cafe. Verify the service and shortcuts are removed, while `%ProgramData%\Pnara` and the `PnaraCafe` SQL database remain. Reinstall and confirm the existing admin account and data are retained.

## PostgreSQL prerequisite and recovery

- PostgreSQL is installed and started separately using its native Windows installer. The application installer does not install a database server and does not use Docker.
- Before setup, create a `pnara` database and an application role that owns the database and can create or update its schema. Provide that role's Npgsql connection string in the installer.
- Keep PostgreSQL command-line tools (`pg_dump` and `pg_restore`) installed and available in `PATH` or under `%ProgramFiles%\PostgreSQL` so upgrades can make and verify a custom-format backup.
- **Upgrade:** setup reuses the protected PostgreSQL connection string. It creates a verified backup before running migrations and blocks legacy SQL Server configurations rather than silently connecting to an empty PostgreSQL database.
- **Migration failure:** setup stops the service and retains any verified backup under `%ProgramData%\Pnara\backups`. Preserve the failed setup log and backup. Restore only after confirming the archive and target database.

## Upgrade and uninstall checks

On a disposable copy of a previous application version, verify that setup stops the service before file replacement, reuses the original PostgreSQL connection, creates and verifies a database backup before applying migrations, then starts the service only after migration succeeds. Simulate service and migration failures only on disposable data. Confirm that an interrupted upgrade can be retried without re-entering the existing admin password or deleting customer data.

Uninstallation must not remove PostgreSQL, the `pnara` database, or `%ProgramData%\Pnara`. For recovery, stop `CafeApiService`, copy the `.dump` outside the machine, and restore it with PostgreSQL's `pg_restore` utility. Do not restore over an unrelated database.

## Hardware and payment checks

The repository has no payment-terminal SDK or hardware model. Current card-terminal requests must fail as unavailable and must never be reported as approved. Before enabling card payments, integrate the vendor's certified adapter and verify approval, decline, timeout, interrupted response, status polling, and duplicate-charge prevention on a test terminal.

The printer implementation currently connects to the configured network host on port 9100 and sends ESC/POS bytes. With each supported printer model, verify discovery/configuration, Persian text/code page, receipt formatting, disconnected-device errors, timeout, and recovery after reconnect. USB and serial printing are not implemented in this backend path.

## Signing

Set `CAFE_SIGN_CERT_THUMBPRINT` to a valid code-signing certificate in `CurrentUser\My` or `LocalMachine\My`, and install the Windows SDK SignTool. `scripts/build-installer.ps1` signs and verifies the API executable, launcher, and final installer. Without that certificate the installer is unsigned; do not label it signed.
