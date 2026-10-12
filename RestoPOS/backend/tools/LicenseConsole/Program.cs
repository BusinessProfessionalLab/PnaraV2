using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

var usage = "Commands:\n  LicenseConsole.exe                 (interactive license creation)\n  LicenseConsole.exe issue [options]\n  LicenseConsole.exe verify --license <license.txt> --installation-code <8 digits> [--public-key <path>]\n  LicenseConsole.exe keygen --private-key <path> --public-key <path>\nIssue options: --private-key <path> --installation-code <8 digits> --valid-days <days> --output <license.txt>";
var issuerDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "PnaraIssuer");
try
{
    var interactive = args.Length == 0;
    var command = interactive ? "issue" : args[0].ToLowerInvariant();
    var options = Parse(interactive ? [] : args.Skip(1).ToArray());
    switch (command)
    {
        case "keygen":
            using (var rsa = RSA.Create(3072))
            {
                File.WriteAllText(Required(options, "private-key"), rsa.ExportPkcs8PrivateKeyPem(), new UTF8Encoding(false));
                File.WriteAllText(Required(options, "public-key"), rsa.ExportSubjectPublicKeyInfoPem(), new UTF8Encoding(false));
            }
            Console.WriteLine("Key pair created. Keep the private key offline and secret; include the public key in each installer build.");
            break;
        case "verify":
            var licensePath = Required(options, "license");
            var expectedCode = Required(options, "installation-code");
            var verificationKeyPaths = options.TryGetValue("public-key", out var configuredPublicKey)
                ? new[] { configuredPublicKey }
                : new[] { Path.Combine(AppContext.BaseDirectory, "issuer-public.pem"), Path.Combine(AppContext.BaseDirectory, "issuer-previous-public.pem") };
            if (expectedCode.Length != 8 || expectedCode.Any(ch => ch < '0' || ch > '9'))
                throw new ArgumentException("--installation-code must contain exactly 8 digits.");
            var parts = File.ReadAllText(licensePath).Trim().Split('.');
            if (parts.Length != 2) throw new InvalidDataException("INVALID_FORMAT: License file must contain a signed token.");
            var signedPayload = FromBase64Url(parts[0]);
            var signature = FromBase64Url(parts[1]);
            var verifiedSignature = false;
            foreach (var verificationKeyPath in verificationKeyPaths.Where(File.Exists))
            {
                using var rsa = RSA.Create();
                rsa.ImportFromPem(File.ReadAllText(verificationKeyPath));
                if (rsa.VerifyData(signedPayload, signature, HashAlgorithmName.SHA256, RSASignaturePadding.Pss))
                {
                    verifiedSignature = true;
                    break;
                }
            }
            if (!verifiedSignature)
                throw new CryptographicException("INVALID_SIGNATURE: License signature does not match an issuer public key.");
            var verifiedPayload = JsonSerializer.Deserialize<LicensePayload>(signedPayload, new JsonSerializerOptions(JsonSerializerDefaults.Web));
            if (verifiedPayload is null || verifiedPayload.LicenseId == Guid.Empty)
                throw new InvalidDataException("INVALID_PAYLOAD: Signed license payload is incomplete.");
            if (!string.Equals(verifiedPayload.InstallationCode, expectedCode, StringComparison.Ordinal))
                throw new InvalidDataException("CODE_MISMATCH: License was issued for a different installation code.");
            if (verifiedPayload.ExpiresAtUtc <= DateTimeOffset.UtcNow)
                throw new InvalidDataException($"EXPIRED: License expired at {verifiedPayload.ExpiresAtUtc:yyyy-MM-dd HH:mm:ss} UTC.");
            Console.WriteLine($"VALID: Signature and installation code match. Expires {verifiedPayload.ExpiresAtUtc:yyyy-MM-dd HH:mm:ss} UTC.");
            break;
        case "issue":
            var privateKeyPath = options.TryGetValue("private-key", out var configuredPrivateKey)
                ? configuredPrivateKey
                : Path.Combine(issuerDirectory, "issuer-private.pem");
            if (!File.Exists(privateKeyPath))
                throw new FileNotFoundException($"Issuer private key not found: {privateKeyPath}. Create it once with the keygen command.");

            string installationCode;
            if (options.TryGetValue("installation-code", out var configuredInstallationCode))
                installationCode = configuredInstallationCode;
            else
                installationCode = Prompt("Enter the 8-digit installation request code shown by Setup: ");
            if (installationCode.Length != 8 || installationCode.Any(ch => ch < '0' || ch > '9'))
                throw new ArgumentException("The installation request code must contain exactly 8 digits.");

            int days;
            if (options.TryGetValue("valid-days", out var daysText))
            {
                if (!int.TryParse(daysText, out days) || days < 1)
                    throw new ArgumentException("--valid-days must be a positive whole number.");
            }
            else
            {
                var promptedDaysText = Prompt("Enter active days: ");
                if (!int.TryParse(promptedDaysText, out days) || days < 1) throw new ArgumentException("Active days must be a positive whole number.");
            }

            var expiresAt = DateTimeOffset.UtcNow.AddDays(days);
            var licenseId = Guid.NewGuid();
            var payload = JsonSerializer.SerializeToUtf8Bytes(new LicensePayload(licenseId, installationCode, expiresAt));
            using (var rsa = RSA.Create())
            {
                rsa.ImportFromPem(File.ReadAllText(privateKeyPath));
                var code = Base64Url(payload) + "." + Base64Url(rsa.SignData(payload, HashAlgorithmName.SHA256, RSASignaturePadding.Pss));
                var outputPath = options.TryGetValue("output", out var configuredOutput)
                    ? configuredOutput
                    : Path.Combine(issuerDirectory, $"license-{licenseId:N}.txt");
                Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(outputPath))!);
                File.WriteAllText(outputPath, code, new UTF8Encoding(false));
                Console.WriteLine($"Created unique license {licenseId}; bound to installation code {installationCode}; valid for {days} days (until {expiresAt:yyyy-MM-dd HH:mm:ss} UTC).");
                Console.WriteLine($"License code saved to: {outputPath}");
            }
            if (interactive) Console.WriteLine("Transfer this file to the matching Setup and paste its contents there.");
            break;
        default: throw new ArgumentException(usage);
    }
}
catch (Exception ex)
{
    Console.Error.WriteLine(ex.Message);
    Environment.ExitCode = 1;
}

Dictionary<string, string> Parse(string[] args)
{
    var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    for (var i = 0; i < args.Length; i += 2)
    {
        if (i + 1 >= args.Length || !args[i].StartsWith("--", StringComparison.Ordinal)) throw new ArgumentException(usage);
        result.Add(args[i][2..], args[i + 1]);
    }
    return result;
}
string Required(Dictionary<string, string> values, string key) => values.TryGetValue(key, out var value) ? value : throw new ArgumentException($"Missing --{key}.\n{usage}");
static string Prompt(string message)
{
    Console.Write(message);
    return Console.ReadLine()?.Trim() ?? string.Empty;
}
static string Base64Url(byte[] value) => Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');
static byte[] FromBase64Url(string value) => Convert.FromBase64String(value.Replace('-', '+').Replace('_', '/') + new string('=', (4 - value.Length % 4) % 4));
sealed record LicensePayload(Guid LicenseId, string InstallationCode, DateTimeOffset ExpiresAtUtc);
