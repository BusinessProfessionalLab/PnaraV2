# Backend test strategy

The solution targets .NET 8 and currently has Domain, Application, Infrastructure, and API projects. Repository implementations live in Infrastructure, so `RestoPOS.Infrastructure.Tests` owns real-provider persistence tests. Test project names follow those existing boundaries rather than introducing a production Repository project.

The suite contains 29 xUnit cases: 16 do not use a database (8 Domain, 4 Application, 4 Architecture) and 13 require PostgreSQL (7 Infrastructure, 6 API).

| Project | Scope | Database / network |
| --- | --- | --- |
| `RestoPOS.Domain.Tests` | Domain rules and value objects | None |
| `RestoPOS.Application.Tests` | Handlers and validators with substituted ports | None |
| `RestoPOS.Architecture.Tests` | Project and framework dependency rules | None |
| `RestoPOS.Infrastructure.Tests` | EF mappings, migrations, filters, and adapters | PostgreSQL Testcontainer |
| `RestoPOS.API.Tests` | `WebApplicationFactory`, auth pipeline, JSON, and route coverage for every controller action | PostgreSQL Testcontainer |
| `Common.TestKit` | Shared PostgreSQL fixture, migrations, and Respawn cleanup | PostgreSQL Testcontainer |

The API is the composition root and currently references Infrastructure to register it. The architecture suite therefore permits that one project-level composition dependency and guards API-facing services/controllers from Infrastructure references by keeping their dependencies behind Application contracts. Domain must remain free of EF Core and ASP.NET references; Application and Infrastructure must not reference the API assembly.

## Run locally

Unit, domain, and architecture tests do not need Docker:

```powershell
dotnet test tests/RestoPOS.Domain.Tests/RestoPOS.Domain.Tests.csproj
dotnet test tests/RestoPOS.Application.Tests/RestoPOS.Application.Tests.csproj
dotnet test tests/RestoPOS.Architecture.Tests/RestoPOS.Architecture.Tests.csproj
```

Infrastructure and API tests start PostgreSQL 16 through Testcontainers and need a running Docker engine:

```powershell
dotnet test tests/RestoPOS.Infrastructure.Tests/RestoPOS.Infrastructure.Tests.csproj
dotnet test tests/RestoPOS.API.Tests/RestoPOS.API.Tests.csproj
```

Run the full CI gate from `RestoPOS/backend`:

```powershell
dotnet restore RestoPOS.sln
dotnet build RestoPOS.sln --configuration Release --no-restore
dotnet test RestoPOS.sln --configuration Release --no-build --collect:"XPlat Code Coverage"
```

CI fails on restore, compilation, or any test failure. PostgreSQL is ephemeral, uses test-only credentials, applies the checked-in EF migrations, and is reset between tests. No local production credentials are used.

## Current coverage gaps

The API route coverage test discovers every registered controller action from ASP.NET Core endpoint metadata. The current source has 13 controller classes and 144 HTTP action declarations; the test derives its coverage list at runtime so newly registered actions are included automatically. It sends an anonymous request to every action, requires `401` for protected actions, and rejects server failures for anonymous actions. The health endpoints also have JSON casing assertions. This gives every current API action an HTTP-level check; business success and permission-matrix checks remain separate coverage gaps.

The suite also checks architecture boundaries, an Application command/validator path, model-to-migration drift, a projected/sorted category query, soft-delete filtering, an FK constraint, the soft-delete index, transaction rollback, authenticated permission denial, SuperAdmin role access, and refusal to approve a payment without a terminal adapter. Broader query and projection cases, unique-constraint guarantees, transaction commit/retry behavior, full JWT permission/role matrices, validation error payloads, and external HTTP stubs remain coverage gaps. `TimeProvider` is not wired into the current application; handlers use `DateTime.UtcNow`, so deterministic clock injection needs a production seam before those behaviors can be tested reliably.
