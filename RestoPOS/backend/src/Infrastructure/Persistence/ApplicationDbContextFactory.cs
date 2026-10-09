using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using RestoPOS.Application.Common.Interfaces;

namespace RestoPOS.Infrastructure.Persistence;

public sealed class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer(Environment.GetEnvironmentVariable("ConnectionStrings__SqlServer")
                          ?? "Server=.\\SQLEXPRESS;Database=PnaraCafe;Integrated Security=True;Encrypt=True;TrustServerCertificate=True")
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
