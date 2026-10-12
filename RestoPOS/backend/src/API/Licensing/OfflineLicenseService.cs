using System.Security.Cryptography;
using System.Text.Json;

namespace RestoPOS.API.Licensing;

public sealed record LicensePayload(Guid LicenseId, string InstallationCode, DateTimeOffset ExpiresAtUtc);

public sealed class OfflineLicenseService(IConfiguration configuration)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    public LicensePayload? Validate()
    {
        var publicKeys = new List<string>();
        var activePublicKey = configuration["License:PublicKey"];
        if (!string.IsNullOrWhiteSpace(activePublicKey)) publicKeys.Add(activePublicKey.Replace("\\n", "\n", StringComparison.Ordinal));
        publicKeys.AddRange(configuration.GetSection("License:PreviousPublicKeys").Get<string[]>() ?? []);
        var licensePath = configuration["License:File"];
        var dataDirectory = Environment.GetEnvironmentVariable("PNARA_DATA_DIRECTORY") ?? Path.Combine(AppContext.BaseDirectory, "data");
        if (string.IsNullOrWhiteSpace(licensePath)) licensePath = Path.Combine(dataDirectory, "license.key");
        var installationCodePath = Path.Combine(dataDirectory, "installation-code");
        if (publicKeys.Count == 0 || !File.Exists(licensePath)) return null;

        try
        {
            var token = File.ReadAllText(licensePath);
            var installationCode = File.ReadAllText(installationCodePath).Trim();
            foreach (var publicKey in publicKeys)
            {
                var normalizedPublicKey = publicKey.Replace("\\n", "\n", StringComparison.Ordinal);
                var payload = ValidateToken(normalizedPublicKey, token, installationCode);
                if (payload is not null) return payload;
            }
            return null;
        }
        catch (Exception ex) when (ex is IOException or JsonException or CryptographicException or FormatException or ArgumentException)
        {
            return null;
        }
    }

    public static LicensePayload? ValidateToken(string publicKey, string token, string installationCode)
    {
        try
        {
            var tokenParts = token.Trim().Split('.');
            if (tokenParts.Length != 2 || tokenParts.Any(string.IsNullOrWhiteSpace)) return null;
            using var rsa = RSA.Create();
            rsa.ImportFromPem(publicKey);
            var payloadBytes = FromBase64Url(tokenParts[0]);
            if (!rsa.VerifyData(payloadBytes, FromBase64Url(tokenParts[1]), HashAlgorithmName.SHA256, RSASignaturePadding.Pss)) return null;
            var payload = JsonSerializer.Deserialize<LicensePayload>(payloadBytes, JsonOptions);
            if (payload is null || payload.LicenseId == Guid.Empty || payload.ExpiresAtUtc <= DateTimeOffset.UtcNow ||
                string.IsNullOrEmpty(payload.InstallationCode) || payload.InstallationCode.Length != 8 || payload.InstallationCode.Any(ch => ch < '0' || ch > '9') ||
                !string.Equals(payload.InstallationCode, installationCode, StringComparison.Ordinal)) return null;
            return payload;
        }
        catch (Exception ex) when (ex is IOException or JsonException or CryptographicException or FormatException or ArgumentException)
        {
            return null;
        }
    }

    private static byte[] FromBase64Url(string value) => Convert.FromBase64String(value.Replace('-', '+').Replace('_', '/') + new string('=', (4 - value.Length % 4) % 4));
}
