using System.Text.Json;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Common;
using RestoPOS.Domain.Entities;
using RestoPOS.Infrastructure.Identity;

namespace RestoPOS.Infrastructure.Persistence;

public class ApplicationDbContext(
    DbContextOptions<ApplicationDbContext> options,
    ICurrentUserService currentUser,
    IDomainEventDispatcher dispatcher) : IdentityDbContext<ApplicationUser, ApplicationRole, Guid>(options), IApplicationDbContext
{
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<CashierShift> CashierShifts => Set<CashierShift>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<MenuItem> MenuItems => Set<MenuItem>();
    public DbSet<MenuItemModifier> MenuItemModifiers => Set<MenuItemModifier>();
    public DbSet<MenuItemAddon> MenuItemAddons => Set<MenuItemAddon>();
    public DbSet<Addon> Addons => Set<Addon>();
    public DbSet<Recipe> Recipes => Set<Recipe>();
    public DbSet<RecipeLine> RecipeLines => Set<RecipeLine>();
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<InventoryTransaction> InventoryTransactions => Set<InventoryTransaction>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderItemModifier> OrderItemModifiers => Set<OrderItemModifier>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<PosDevice> PosDevices => Set<PosDevice>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<StoreSettings> StoreSettings => Set<StoreSettings>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

        modelBuilder.Entity<ApplicationUser>(b =>
        {
            b.Property(u => u.FullName).HasMaxLength(200).IsRequired();
            b.Property(u => u.PersonnelCode).HasMaxLength(32);
            b.Property(u => u.RefreshToken).HasMaxLength(256);
        });

        modelBuilder.Entity<ApplicationRole>(b =>
        {
            b.Property(r => r.Description).HasMaxLength(256);
        });

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(BaseEntity).IsAssignableFrom(entityType.ClrType))
                modelBuilder.Entity(entityType.ClrType).Ignore(nameof(BaseEntity.DomainEvents));
        }
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var domainEvents = ChangeTracker.Entries<BaseEntity>()
            .Select(e => e.Entity)
            .Where(e => e.DomainEvents.Count > 0)
            .SelectMany(e =>
            {
                var captured = e.DomainEvents.ToList();
                e.ClearDomainEvents();
                return captured;
            })
            .ToList();

        StampAudit();
        WriteAuditLogs();

        var result = await base.SaveChangesAsync(cancellationToken);
        await dispatcher.DispatchAsync(domainEvents, cancellationToken);
        return result;
    }

    private void StampAudit()
    {
        var now = DateTime.UtcNow;
        var userId = currentUser.UserId;

        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = now;
                    entry.Entity.CreatedBy ??= userId;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = now;
                    entry.Entity.UpdatedBy = userId;
                    break;
            }
        }
    }

    private void WriteAuditLogs()
    {
        var userId = currentUser.UserId;
        var ip = currentUser.IpAddress;
        var now = DateTime.UtcNow;
        var logs = new List<AuditLog>();

        foreach (var entry in ChangeTracker.Entries().Where(e =>
                     e.Entity is not AuditLog &&
                     e.Entity is BaseEntity &&
                     e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted).ToList())
        {
            var entity = (BaseEntity)entry.Entity;
            logs.Add(new AuditLog
            {
                EntityName = entry.Entity.GetType().Name,
                EntityId = entity.Id.ToString(),
                Action = entry.State.ToString(),
                OldValues = entry.State == EntityState.Added ? null : JsonSerializer.Serialize(Original(entry)),
                NewValues = entry.State == EntityState.Deleted ? null : JsonSerializer.Serialize(Current(entry)),
                StaffId = userId,
                OccurredAt = now,
                IpAddress = ip
            });
        }

        if (logs.Count > 0)
            AuditLogs.AddRange(logs);
    }

    private static Dictionary<string, object?> Original(Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry) =>
        entry.Properties.ToDictionary(p => p.Metadata.Name, p => p.OriginalValue);

    private static Dictionary<string, object?> Current(Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry) =>
        entry.Properties.ToDictionary(p => p.Metadata.Name, p => p.CurrentValue);
}
