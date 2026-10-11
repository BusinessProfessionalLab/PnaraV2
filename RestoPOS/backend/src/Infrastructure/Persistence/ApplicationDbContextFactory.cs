using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using RestoPOS.Application.Common.Interfaces;

namespace RestoPOS.Infrastructure.Persistence;

public sealed class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(Environment.GetEnvironmentVariable("ConnectionStrings__PostgreSql")
                          ?? "Host=localhost;Port=5432;Database=pnara;Username=pnara_app;Password=change-me")
            .Options;

        return new ApplicationDbContext(options, new DesignTimeCurrentUser(), new NoOpDomainEventDispatcher());
    }

    private sealed class DesignTimeCurrentUser : ICurrentUserService
    {
        public Guid? UserId => null;
        public string? UserName => "design-time";
        public IReadOnlyCollection<string> Permissions => [];
        public bool IsAuthenticated => false;
        public string? IpAddress => null;
    }
}
