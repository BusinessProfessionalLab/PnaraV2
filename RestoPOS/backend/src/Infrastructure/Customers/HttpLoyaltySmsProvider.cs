using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using RestoPOS.Application.Common.Interfaces;

namespace RestoPOS.Infrastructure.Customers;

public sealed class HttpLoyaltySmsProvider(HttpClient client, IConfiguration configuration) : ILoyaltySmsProvider
{
    public async Task<string?> SendAsync(string phoneNumber, string message, CancellationToken cancellationToken)
    {
        var baseUrl = configuration["SmsProvider:BaseUrl"];
        var apiKey = configuration["SmsProvider:ApiKey"];
        if (string.IsNullOrWhiteSpace(baseUrl) || string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("SmsProvider:BaseUrl and SmsProvider:ApiKey must be configured before sending SMS.");

        client.BaseAddress = new Uri(baseUrl, UriKind.Absolute);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        using var response = await client.PostAsJsonAsync("messages", new
        {
            to = phoneNumber,
            from = configuration["SmsProvider:SenderNumber"],
            text = message
        }, cancellationToken);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<SmsProviderResponse>(cancellationToken: cancellationToken);
        return result?.MessageId;
    }

    private sealed record SmsProviderResponse(string? MessageId);
}
