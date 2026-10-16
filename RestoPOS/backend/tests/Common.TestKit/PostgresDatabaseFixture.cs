using Microsoft.EntityFrameworkCore;
using Npgsql;
using Respawn;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Infrastructure.Persistence;
using Testcontainers.PostgreSql;

namespace RestoPOS.Common.TestKit;

public sealed class PostgresDatabaseFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("pnara_test")
        .WithUsername("pnara_test")
        .WithPassword("pnara_test_password")
        .Build();

    private Respawner? _respawner;

    public string ConnectionString => _postgres.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        await using var db = CreateDbContext();
        await db.Database.MigrateAsync();

        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync();
        _respawner = await Respawner.CreateAsync(connection, new RespawnerOptions
        {
            DbAdapter = DbAdapter.Postgres,
            SchemasToInclude = ["public"],
            TablesToIgnore = ["__EFMigrationsHistory"]
        });
    }

    public async Task DisposeAsync() => await _postgres.DisposeAsync();

    public ApplicationDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;

        return new ApplicationDbContext(options, new TestCurrentUser(), new NoOpDomainEventDispatcher());
    }

    public async Task ResetAsync()
    {
        if (_respawner is null)
            throw new InvalidOperationException("Initialize the PostgreSQL fixture before resetting it.");

        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync();
        await _respawner.ResetAsync(connection);
    }

    private sealed class TestCurrentUser : ICurrentUserService
    {
        public Guid? UserId => null;
        public string? UserName => "integration-test";
        public IReadOnlyCollection<string> Permissions => [];
        public bool IsAuthenticated => false;
        public string? IpAddress => null;
    }
}
