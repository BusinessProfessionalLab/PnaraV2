using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using RestoPOS.Application.Common.Interfaces;

namespace RestoPOS.Infrastructure.Persistence;

public sealed class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer("Server=localhost;Database=ToastIranPOS;User Id=sa;Password=Your_password123;TrustServerCertificate=True")
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
