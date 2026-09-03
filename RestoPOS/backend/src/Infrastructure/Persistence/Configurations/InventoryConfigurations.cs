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
        builder.HasIndex(x => x.AddonId).IsUnique().HasFilter("[AddonId] IS NOT NULL");
    }
}

public class RecipeLineConfiguration : IEntityTypeConfiguration<RecipeLine>
{
    public void Configure(EntityTypeBuilder<RecipeLine> builder)
    {
        builder.ToTable("RecipeLines");
        builder.Property(x => x.Quantity).HasColumnType(MoneyConfig.Quantity);
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
        builder.HasIndex(x => x.Sku).IsUnique();
        builder.Property(x => x.ReorderPoint).HasColumnType(MoneyConfig.Quantity);
        builder.Property(x => x.SafetyStock).HasColumnType(MoneyConfig.Quantity);
        builder.Property(x => x.CurrentStock).HasColumnType(MoneyConfig.Quantity);
        builder.Property(x => x.CostPrice).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.AverageCost).HasColumnType(MoneyConfig.Rial);
        builder.Ignore(x => x.IsBelowReorderPoint);
    }
}

public class InventoryTransactionConfiguration : IEntityTypeConfiguration<InventoryTransaction>
{
    public void Configure(EntityTypeBuilder<InventoryTransaction> builder)
    {
        builder.ToTable("InventoryTransactions");
        builder.Property(x => x.Quantity).HasColumnType(MoneyConfig.Quantity);
        builder.Property(x => x.UnitCost).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.Reference).HasMaxLength(128);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.HasOne(x => x.InventoryItem).WithMany(i => i.Transactions).HasForeignKey(x => x.InventoryItemId).IsRequired(false);
        builder.HasIndex(x => new { x.InventoryItemId, x.OccurredAt });
    }
}
