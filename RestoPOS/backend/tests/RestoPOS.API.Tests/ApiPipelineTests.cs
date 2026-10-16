using System.Net;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using RestoPOS.Common.TestKit;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Infrastructure.Persistence;

namespace RestoPOS.API.Tests;

[Collection(PostgresCollection.Name)]
public sealed class ApiPipelineTests(PostgresDatabaseFixture database) : IAsyncLifetime
{
    private const string TestJwtKey = "test-only-signing-key-for-pnara-integration-tests-32-bytes";
    private TestingWebApplicationFactory _factory = null!;
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        _factory = new TestingWebApplicationFactory(database.ConnectionString);
        _client = _factory.CreateClient();

        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
        await database.ResetAsync();
    }

    [Fact]
    public async Task Protected_orders_route_rejects_anonymous_requests()
    {
        using var response = await _client.GetAsync("/api/orders/active");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Authenticated_user_without_required_permission_is_forbidden()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/orders/active");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", CreateToken());

        using var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Super_admin_role_can_access_a_permission_protected_api()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/orders/active");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue(
            "Bearer",
            CreateToken(new Claim(ClaimTypes.Role, "SuperAdmin"), new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())));

        using var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Customer_loyalty_history_returns_saved_transactions()
    {
        var customer = Customer.Create("09123456789", "Loyalty API test");
        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Customers.Add(customer);
            db.LoyaltyPointLedgers.Add(new LoyaltyPointLedger
            {
                CustomerId = customer.Id,
                Type = LoyaltyLedgerType.Earn,
                PointsDelta = 8,
                BalanceAfter = 8,
                Notes = "API test transaction"
            });
            await db.SaveChangesAsync();
        }

        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/customers/{customer.Id}/loyalty/transactions");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue(
            "Bearer",
            CreateToken(new Claim(ClaimTypes.Role, "SuperAdmin"), new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())));

        using var response = await _client.SendAsync(request);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        json.RootElement.GetProperty("totalCount").GetInt32().Should().Be(1);
        json.RootElement.GetProperty("items")[0].GetProperty("pointsDelta").GetInt32().Should().Be(8);
    }

    [Theory]
    [InlineData("/health")]
    [InlineData("/api/health")]
    public async Task Health_response_uses_camel_case_json_properties(string route)
    {
        using var response = await _client.GetAsync(route);
        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        json.RootElement.TryGetProperty("product", out _).Should().BeTrue();
        json.RootElement.TryGetProperty("status", out _).Should().BeTrue();
    }

    [Fact]
    public async Task Every_controller_api_action_is_routed_and_enforces_its_anonymous_or_authorized_contract()
    {
        var endpoints = _factory.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.Metadata.GetMetadata<ControllerActionDescriptor>() is not null)
            .ToArray();
        endpoints.Should().NotBeEmpty();

        var failures = new List<string>();
        foreach (var endpoint in endpoints)
        {
            var rawPath = endpoint.RoutePattern.RawText ?? throw new InvalidOperationException("Controller route has no template.");
            var path = "/" + Regex.Replace(rawPath.TrimStart('/'), @"\{(?<name>[^}:?]+)(?::[^}?]+)?(?:\?)?\}", match =>
                match.Groups["name"].Value.Equals("phone", StringComparison.OrdinalIgnoreCase)
                    ? "09121234567"
                    : Guid.NewGuid().ToString());
            var methods = endpoint.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? ["GET"];
            var isProtected = endpoint.Metadata.GetMetadata<IAllowAnonymous>() is null
                && endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>().Count > 0;

            foreach (var method in methods)
            {
                using var request = new HttpRequestMessage(new HttpMethod(method), path);
                if (method is "POST" or "PUT" or "PATCH")
                    request.Content = new StringContent("{}", Encoding.UTF8, "application/json");

                using var response = await _client.SendAsync(request);
                if (isProtected && response.StatusCode != HttpStatusCode.Unauthorized)
                    failures.Add($"{method} {path}: expected 401 for anonymous request, got {(int)response.StatusCode}.");
                else if (!isProtected && (response.StatusCode == HttpStatusCode.NotFound || (int)response.StatusCode >= 500))
                    failures.Add($"{method} {path}: anonymous API action was not resolved or returned {(int)response.StatusCode}.");
            }
        }

        Assert.True(failures.Count == 0, string.Join(Environment.NewLine, failures));
    }

    private sealed class TestingWebApplicationFactory(string connectionString) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.ConfigureAppConfiguration((_, configuration) =>
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:PostgreSql"] = connectionString,
                    ["Jwt:Key"] = TestJwtKey
                }));
        }
    }

    private static string CreateToken(params Claim[] claims)
    {
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestJwtKey)),
            SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: "ToastIranPOS",
            audience: "ToastIranPOS",
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(5),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
