# Deployment verification and recovery checklist

Build the installer from the `RestoPOS` repository directory:

```powershell
.\scripts\build-installer.ps1
```

Expected artifact: `artifacts\CafeSetup.exe`. The build script runs frontend lint and type checks, Next.js static export, .NET Release build and tests, self-contained `win-x64` publish, and Inno Setup compilation. A signature is reported only when a configured code-signing certificate is present and verification succeeds.

## Clean Windows 10/11 x64 installation

1. Use a disposable test machine or VM with no customer data. Record Windows version and available disk space.
2. Install from `CafeSetup.exe` interactively. Confirm the first admin password page and, if no `SQLEXPRESS` is present, the SQL license acceptance/download page.
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

## Existing or missing SQL Server

- **Compatible local `SQLEXPRESS` exists:** setup reuses only that instance and a separate `PnaraCafe` database. It checks that the installing account can provision the instance. Existing databases with a non-Pnara schema are left untouched and cause setup to stop.
- **No SQL Server exists:** setup requires Windows Package Manager, internet access, and several gigabytes of disk space to install Microsoft SQL Server 2025 Express. If the install is interrupted or Windows requests a restart, rerun setup after the SQL service is available.
- **Another SQL Server instance exists but no compatible `SQLEXPRESS`:** setup stops safely. An administrator must review and install/configure a compatible SQL Express instance before rerunning CafeSetup; the installer does not upgrade shared SQL Server files or select a generic existing instance.
- **Migration failure:** setup stops the service and retains any verified pre-upgrade backup under `%ProgramData%\Pnara\backups`. Preserve the failed setup log and backup. Restore only after confirming the backup belongs to `PnaraCafe`; never drop the database as a recovery shortcut.

## Upgrade and uninstall checks

On a disposable copy of a previous application version, verify that setup stops the service before file replacement, creates and verifies a database backup before applying migrations, then starts the service only after migration succeeds. Simulate service and migration failures only on disposable data. Confirm that an interrupted upgrade can be retried without re-entering the existing admin password or deleting customer data.

Uninstallation must not remove SQL Server, `PnaraCafe`, or `%ProgramData%\Pnara`. For recovery, stop `CafeApiService`, copy the `.bak` outside the machine, and restore through SQL Server Management Studio or a SQL Server administrator. Do not restore over unrelated databases.

## Hardware and payment checks

The repository has no payment-terminal SDK or hardware model. Current card-terminal requests must fail as unavailable and must never be reported as approved. Before enabling card payments, integrate the vendor's certified adapter and verify approval, decline, timeout, interrupted response, status polling, and duplicate-charge prevention on a test terminal.

The printer implementation currently connects to the configured network host on port 9100 and sends ESC/POS bytes. With each supported printer model, verify discovery/configuration, Persian text/code page, receipt formatting, disconnected-device errors, timeout, and recovery after reconnect. USB and serial printing are not implemented in this backend path.

## Signing

Set `CAFE_SIGN_CERT_THUMBPRINT` to a valid code-signing certificate in `CurrentUser\My` or `LocalMachine\My`, and install the Windows SDK SignTool. `scripts/build-installer.ps1` signs and verifies the API executable, launcher, and final installer. Without that certificate the installer is unsigned; do not label it signed.
