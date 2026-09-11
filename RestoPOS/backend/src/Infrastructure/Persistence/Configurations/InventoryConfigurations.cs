using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestoPOS.Domain.Entities;

namespace RestoPOS.Infrastructure.Persistence.Configurations;

public class RecipeConfiguration : IEntityTypeConfiguration<Recipe>
{
    public void Configure(EntityTypeBuilder<Recipe> builder)
    {
        builder.ToTable("Recipes");
        builder.ConfigureSoftDelete();
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.HasIndex(x => x.MenuItemId).IsUnique().HasFilter("[MenuItemId] IS NOT NULL");
        builder.HasIndex(x => x.MenuItemModifierId).IsUnique().HasFilter("[MenuItemModifierId] IS NOT NULL");
    }
}

public class RecipeLineConfiguration : IEntityTypeConfiguration<RecipeLine>
{
    public void Configure(EntityTypeBuilder<RecipeLine> builder)
    {
        builder.ToTable("RecipeLines");
        builder.Property(x => x.Quantity).HasColumnType(MoneyConfig.StockQty);
        builder.HasOne(x => x.Recipe).WithMany(r => r.Lines).HasForeignKey(x => x.RecipeId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.InventoryItem).WithMany(i => i.RecipeLines).HasForeignKey(x => x.InventoryItemId).IsRequired(false).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(x => new { x.RecipeId, x.InventoryItemId }).IsUnique();
        builder.HasQueryFilter(x => !x.Recipe.IsDeleted);
    }
}

public class InventoryItemConfiguration : IEntityTypeConfiguration<InventoryItem>
{
    public void Configure(EntityTypeBuilder<InventoryItem> builder)
    {
        builder.ToTable("InventoryItems");
        builder.ConfigureSoftDelete();
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Sku).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Barcode).HasMaxLength(64);
        builder.Property(x => x.Category).HasMaxLength(100);
        builder.HasIndex(x => x.Sku).IsUnique();
        builder.HasIndex(x => x.Barcode);
        builder.HasIndex(x => x.StorageLocation);
        builder.HasIndex(x => x.Category);
        builder.Property(x => x.CurrentStock).HasColumnType(MoneyConfig.StockQty);
        builder.Property(x => x.MinimumAlertStock).HasColumnType(MoneyConfig.StockQty);
        builder.Property(x => x.OptimalStock).HasColumnType(MoneyConfig.StockQty);
        builder.Property(x => x.WeightedAverageCost).HasColumnType(MoneyConfig.CostRial);
        builder.Property(x => x.LastPurchasePrice).HasColumnType(MoneyConfig.CostRial);
        builder.Property(x => x.RowVersion).IsRowVersion();
        builder.Ignore(x => x.IsBelowAlertStock);
        builder.HasMany(x => x.Conversions).WithOne(c => c.InventoryItem).HasForeignKey(c => c.InventoryItemId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class InventoryUnitConversionConfiguration : IEntityTypeConfiguration<InventoryUnitConversion>
{
    public void Configure(EntityTypeBuilder<InventoryUnitConversion> builder)
    {
        builder.ToTable("InventoryUnitConversions");
        builder.Property(x => x.UnitName).HasMaxLength(64).IsRequired();
        builder.Property(x => x.FactorToBase).HasColumnType(MoneyConfig.StockQty);
        builder.HasIndex(x => new { x.InventoryItemId, x.UnitName }).IsUnique();
    }
}

public class InventoryTransactionConfiguration : IEntityTypeConfiguration<InventoryTransaction>
{
    public void Configure(EntityTypeBuilder<InventoryTransaction> builder)
    {
        builder.ToTable("InventoryTransactions");
        builder.Property(x => x.QuantityDelta).HasColumnType(MoneyConfig.StockQty);
        builder.Property(x => x.StockBefore).HasColumnType(MoneyConfig.StockQty);
        builder.Property(x => x.StockAfter).HasColumnType(MoneyConfig.StockQty);
        builder.Property(x => x.UnitCostRials).HasColumnType(MoneyConfig.CostRial);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.HasIndex(x => x.CreatedAtUtc);
        builder.HasIndex(x => x.TransactionType);
        builder.HasIndex(x => new { x.InventoryItemId, x.CreatedAtUtc });
        builder.HasIndex(x => x.ReferenceId);
        builder.HasOne(x => x.InventoryItem).WithMany(i => i.Transactions).HasForeignKey(x => x.InventoryItemId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class SupplierConfiguration : IEntityTypeConfiguration<Supplier>
{
    public void Configure(EntityTypeBuilder<Supplier> builder)
    {
        builder.ToTable("Suppliers");
        builder.ConfigureSoftDelete();
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Phone).HasMaxLength(32);
        builder.Property(x => x.ContactPerson).HasMaxLength(120);
        builder.Property(x => x.Address).HasMaxLength(500);
        builder.Property(x => x.CurrentBalanceRials).HasColumnType(MoneyConfig.Rial);
        builder.HasIndex(x => x.Name);
    }
}

public class PurchaseInvoiceConfiguration : IEntityTypeConfiguration<PurchaseInvoice>
{
    public void Configure(EntityTypeBuilder<PurchaseInvoice> builder)
    {
        builder.ToTable("PurchaseInvoices");
        builder.Property(x => x.InvoiceNumber).HasMaxLength(64).IsRequired();
        builder.HasIndex(x => x.InvoiceNumber).IsUnique();
        builder.Property(x => x.SubtotalRials).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.TaxRials).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.DiscountRials).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.GrandTotalRials).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.HasIndex(x => x.CreatedAt);
        builder.HasIndex(x => x.SupplierId);
        builder.HasOne(x => x.Supplier).WithMany(s => s.PurchaseInvoices).HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(x => x.Items).WithOne(i => i.PurchaseInvoice).HasForeignKey(i => i.PurchaseInvoiceId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class PurchaseInvoiceItemConfiguration : IEntityTypeConfiguration<PurchaseInvoiceItem>
{
    public void Configure(EntityTypeBuilder<PurchaseInvoiceItem> builder)
    {
        builder.ToTable("PurchaseInvoiceItems");
        builder.Property(x => x.Quantity).HasColumnType(MoneyConfig.StockQty);
        builder.Property(x => x.QuantityInBase).HasColumnType(MoneyConfig.StockQty);
        builder.Property(x => x.NamedPurchaseUnit).HasMaxLength(64);
        builder.Property(x => x.UnitPriceRials).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.UnitPriceInBaseRials).HasColumnType(MoneyConfig.CostRial);
        builder.Property(x => x.LineDiscountRials).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.LineTotalRials).HasColumnType(MoneyConfig.Rial);
        builder.HasOne(x => x.InventoryItem).WithMany().HasForeignKey(x => x.InventoryItemId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(x => x.InventoryItemId);
    }
}

public class InventoryWasteConfiguration : IEntityTypeConfiguration<InventoryWaste>
{
    public void Configure(EntityTypeBuilder<InventoryWaste> builder)
    {
        builder.ToTable("InventoryWastes");
        builder.Property(x => x.TotalLossRials).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.HasIndex(x => x.OccurredAtUtc);
        builder.HasMany(x => x.Items).WithOne(i => i.InventoryWaste).HasForeignKey(i => i.InventoryWasteId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class InventoryWasteItemConfiguration : IEntityTypeConfiguration<InventoryWasteItem>
{
    public void Configure(EntityTypeBuilder<InventoryWasteItem> builder)
    {
        builder.ToTable("InventoryWasteItems");
        builder.Property(x => x.QuantityInBase).HasColumnType(MoneyConfig.StockQty);
        builder.Property(x => x.UnitCostRials).HasColumnType(MoneyConfig.CostRial);
        builder.Property(x => x.LossRials).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.Notes).HasMaxLength(500);
        builder.HasIndex(x => x.Reason);
        builder.HasOne(x => x.InventoryItem).WithMany().HasForeignKey(x => x.InventoryItemId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class StockCountConfiguration : IEntityTypeConfiguration<StockCount>
{
    public void Configure(EntityTypeBuilder<StockCount> builder)
    {
        builder.ToTable("StockCounts");
        builder.Property(x => x.Title).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.HasIndex(x => x.StartedAtUtc);
        builder.HasIndex(x => x.Status);
        builder.HasMany(x => x.Items).WithOne(i => i.StockCount).HasForeignKey(i => i.StockCountId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class StockCountItemConfiguration : IEntityTypeConfiguration<StockCountItem>
{
    public void Configure(EntityTypeBuilder<StockCountItem> builder)
    {
        builder.ToTable("StockCountItems");
        builder.Property(x => x.SystemSnapshotQty).HasColumnType(MoneyConfig.StockQty);
        builder.Property(x => x.PhysicalCountQty).HasColumnType(MoneyConfig.StockQty);
        builder.Property(x => x.CostVarianceRials).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.SnapshotUnitCostRials).HasColumnType(MoneyConfig.CostRial);
        builder.Ignore(x => x.DiscrepancyQty);
        builder.HasOne(x => x.InventoryItem).WithMany().HasForeignKey(x => x.InventoryItemId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(x => new { x.StockCountId, x.InventoryItemId }).IsUnique();
    }
}

public class StockTransferConfiguration : IEntityTypeConfiguration<StockTransfer>
{
    public void Configure(EntityTypeBuilder<StockTransfer> builder)
    {
        builder.ToTable("StockTransfers");
        builder.Property(x => x.QuantityInBase).HasColumnType(MoneyConfig.StockQty);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.HasIndex(x => x.RequestedAtUtc);
        builder.HasIndex(x => x.Status);
        builder.HasOne(x => x.InventoryItem).WithMany().HasForeignKey(x => x.InventoryItemId).OnDelete(DeleteBehavior.Restrict);
    }
}
