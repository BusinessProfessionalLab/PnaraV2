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
    DbSet<Addon> Addons { get; }
    DbSet<Recipe> Recipes { get; }
    DbSet<RecipeLine> RecipeLines { get; }
    DbSet<InventoryItem> InventoryItems { get; }
    DbSet<InventoryTransaction> InventoryTransactions { get; }
    DbSet<InventoryUnitConversion> InventoryUnitConversions { get; }
    DbSet<Supplier> Suppliers { get; }
    DbSet<PurchaseInvoice> PurchaseInvoices { get; }
    DbSet<PurchaseInvoiceItem> PurchaseInvoiceItems { get; }
    DbSet<InventoryWaste> InventoryWastes { get; }
    DbSet<InventoryWasteItem> InventoryWasteItems { get; }
    DbSet<StockCount> StockCounts { get; }
    DbSet<StockCountItem> StockCountItems { get; }
    DbSet<StockTransfer> StockTransfers { get; }
    DbSet<ModifierGroup> ModifierGroups { get; }
    DbSet<DiningArea> DiningAreas { get; }
    DbSet<DiningTable> DiningTables { get; }
    DbSet<CashDrawerMovement> CashDrawerMovements { get; }
    DbSet<LoyaltyPointLedger> LoyaltyPointLedgers { get; }
    DbSet<Order> Orders { get; }
    DbSet<OrderItem> OrderItems { get; }
    DbSet<OrderItemModifier> OrderItemModifiers { get; }
    DbSet<Payment> Payments { get; }
    DbSet<PosDevice> PosDevices { get; }
    DbSet<Customer> Customers { get; }
    DbSet<StoreSettings> StoreSettings { get; }
    DbSet<AuditLog> AuditLogs { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Runs <paramref name="operation"/> inside EF Core execution strategy + explicit transaction,
    /// then saves changes once and commits.
    /// </summary>
    Task ExecuteResilientTransactionAsync(Func<CancellationToken, Task> operation, CancellationToken cancellationToken = default);
}
