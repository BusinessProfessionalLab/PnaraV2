using RestoPOS.Common.TestKit;

namespace RestoPOS.API.Tests;

[CollectionDefinition("postgres-integration")]
public sealed class PostgresCollection : ICollectionFixture<PostgresDatabaseFixture>
{
    public const string Name = "postgres-integration";
}
