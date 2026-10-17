using RestoPOS.Common.TestKit;

namespace RestoPOS.Infrastructure.Tests;

[CollectionDefinition("postgres-integration")]
public sealed class PostgresCollection : ICollectionFixture<PostgresDatabaseFixture>
{
    public const string Name = "postgres-integration";
}
