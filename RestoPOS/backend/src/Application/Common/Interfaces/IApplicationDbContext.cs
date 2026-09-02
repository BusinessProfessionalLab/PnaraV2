using Microsoft.EntityFrameworkCore;
using RestoPOS.Domain.Entities;

namespace RestoPOS.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Permission> Permissions { get; }
    DbSet<RolePermission> RolePermissions { get; }
    DbSet<CashierShift> CashierShifts { get; }
    DbSet<Category> Categories { get; }
    DbSet<MenuItem> MenuItems { get; }
    DbSet<MenuItemModifier> MenuItemModifiers { get; }
    DbSet<MenuItemAddon> MenuItemAddons { get; }
    DbSet<Recipe> Recipes { get; }
    DbSet<RecipeLine> RecipeLines { get; }
    DbSet<InventoryItem> InventoryItems { get; }
    DbSet<InventoryTransaction> InventoryTransactions { get; }
    DbSet<Order> Orders { get; }
    DbSet<OrderItem> OrderItems { get; }
    DbSet<OrderItemModifier> OrderItemModifiers { get; }
    DbSet<Payment> Payments { get; }
    DbSet<PosDevice> PosDevices { get; }
    DbSet<Customer> Customers { get; }
    DbSet<StoreSettings> StoreSettings { get; }
    DbSet<AuditLog> AuditLogs { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
