using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestoPOS.Domain.Entities;

namespace RestoPOS.Infrastructure.Persistence.Configurations;

public class PermissionConfiguration : IEntityTypeConfiguration<Permission>
{
    public void Configure(EntityTypeBuilder<Permission> builder)
    {
        builder.ToTable("Permissions");
        builder.Property(x => x.Code).HasMaxLength(64).IsRequired();
        builder.Property(x => x.DisplayNameFa).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Module).HasMaxLength(64).IsRequired();
        builder.HasIndex(x => x.Code).IsUnique();
    }
}

public class RolePermissionConfiguration : IEntityTypeConfiguration<RolePermission>
{
    public void Configure(EntityTypeBuilder<RolePermission> builder)
    {
        builder.ToTable("RolePermissions");
        builder.HasKey(x => new { x.RoleId, x.PermissionId });
        builder.HasOne(x => x.Permission).WithMany(p => p.RolePermissions).HasForeignKey(x => x.PermissionId);
        builder.HasIndex(x => x.RoleId);
    }
}

public class CashierShiftConfiguration : IEntityTypeConfiguration<CashierShift>
{
    public void Configure(EntityTypeBuilder<CashierShift> builder)
    {
        builder.ToTable("CashierShifts");
        builder.ConfigureSoftDelete();
        builder.Property(x => x.OpeningCash).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.ClosingCash).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.ExpectedCash).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.HasIndex(x => new { x.StaffId, x.Status });
    }
}

public class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("Categories");
        builder.ConfigureSoftDelete();
        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.Property(x => x.NameEn).HasMaxLength(128);
        builder.Property(x => x.IconUrl).HasMaxLength(500);
        builder.Property(x => x.ImageUrl).HasMaxLength(500);
        builder.HasOne(x => x.Parent).WithMany(x => x.Children).HasForeignKey(x => x.ParentId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(x => x.DisplayPriority);
        builder.Property(x => x.IsSystem).HasDefaultValue(false);
        builder.Property(x => x.DiscountPercent).HasColumnType("decimal(5,2)");
    }
}

public class MenuItemAddonConfiguration : IEntityTypeConfiguration<MenuItemAddon>
{
    public void Configure(EntityTypeBuilder<MenuItemAddon> builder)
    {
        builder.ToTable("MenuItemAddons");
        builder.HasKey(x => new { x.MenuItemId, x.AddonId });
        builder.HasOne(x => x.MenuItem).WithMany(x => x.Addons).HasForeignKey(x => x.MenuItemId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Addon).WithMany(x => x.MenuItems).HasForeignKey(x => x.AddonId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(x => x.AddonId);
    }
}

public class AddonConfiguration : IEntityTypeConfiguration<Addon>
{
    public void Configure(EntityTypeBuilder<Addon> builder)
    {
        builder.ToTable("Addons");
        builder.ConfigureSoftDelete();
        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.Property(x => x.ExtraPrice).HasColumnType(MoneyConfig.Rial);
        builder.HasOne(x => x.Recipe).WithOne(r => r.Addon).HasForeignKey<Recipe>(r => r.AddonId);
        builder.HasIndex(x => x.DisplayPriority);
    }
}

public class MenuItemConfiguration : IEntityTypeConfiguration<MenuItem>
{
    public void Configure(EntityTypeBuilder<MenuItem> builder)
    {
        builder.ToTable("MenuItems");
        builder.ConfigureSoftDelete();
        builder.Property(x => x.Title).HasMaxLength(200).IsRequired();
        builder.Property(x => x.NameEn).HasMaxLength(200);
        builder.Property(x => x.Description).HasMaxLength(2000);
        builder.Property(x => x.BasePrice).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.ImageUrl).HasColumnType("nvarchar(max)");
        builder.HasOne(x => x.Category).WithMany(c => c.MenuItems).HasForeignKey(x => x.CategoryId);
        builder.HasOne(x => x.Recipe).WithOne(r => r.MenuItem).HasForeignKey<Recipe>(r => r.MenuItemId);
        builder.HasIndex(x => new { x.CategoryId, x.DisplayPriority });
        builder.Property(x => x.DiscountPercent).HasColumnType("decimal(5,2)");
    }
}

public class MenuItemModifierConfiguration : IEntityTypeConfiguration<MenuItemModifier>
{
    public void Configure(EntityTypeBuilder<MenuItemModifier> builder)
    {
        builder.ToTable("MenuItemModifiers");
        builder.ConfigureSoftDelete();
        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.Property(x => x.ExtraPrice).HasColumnType(MoneyConfig.Rial);
        builder.HasOne(x => x.MenuItem).WithMany(m => m.Modifiers).HasForeignKey(x => x.MenuItemId);
        builder.HasOne(x => x.ModifierGroup).WithMany(g => g.Options).HasForeignKey(x => x.ModifierGroupId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne(x => x.Recipe).WithOne(r => r.MenuItemModifier).HasForeignKey<Recipe>(r => r.MenuItemModifierId);
    }
}

public class ModifierGroupConfiguration : IEntityTypeConfiguration<ModifierGroup>
{
    public void Configure(EntityTypeBuilder<ModifierGroup> builder)
    {
        builder.ToTable("ModifierGroups");
        builder.ConfigureSoftDelete();
        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.HasOne(x => x.MenuItem).WithMany(m => m.ModifierGroups).HasForeignKey(x => x.MenuItemId).OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(x => new { x.MenuItemId, x.DisplayPriority });
    }
}

public class CashDrawerMovementConfiguration : IEntityTypeConfiguration<CashDrawerMovement>
{
    public void Configure(EntityTypeBuilder<CashDrawerMovement> builder)
    {
        builder.ToTable("CashDrawerMovements");
        builder.Property(x => x.AmountRials).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.Reason).HasMaxLength(500).IsRequired();
        builder.HasOne(x => x.Shift).WithMany(s => s.Movements).HasForeignKey(x => x.ShiftId).OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(x => new { x.ShiftId, x.OccurredAtUtc });
    }
}

public class DiningAreaConfiguration : IEntityTypeConfiguration<DiningArea>
{
    public void Configure(EntityTypeBuilder<DiningArea> builder)
    {
        builder.ToTable("DiningAreas");
        builder.ConfigureSoftDelete();
        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(500);
        builder.HasIndex(x => x.DisplayPriority);
    }
}

public class DiningTableConfiguration : IEntityTypeConfiguration<DiningTable>
{
    public void Configure(EntityTypeBuilder<DiningTable> builder)
    {
        builder.ToTable("DiningTables");
        builder.ConfigureSoftDelete();
        builder.Property(x => x.Code).HasMaxLength(32).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(128);
        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasOne(x => x.DiningArea).WithMany(a => a.Tables).HasForeignKey(x => x.DiningAreaId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.CurrentOrder).WithMany().HasForeignKey(x => x.CurrentOrderId).OnDelete(DeleteBehavior.SetNull);
        builder.HasIndex(x => new { x.DiningAreaId, x.DisplayPriority });
        builder.HasIndex(x => x.Status);
    }
}

public class LoyaltyPointLedgerConfiguration : IEntityTypeConfiguration<LoyaltyPointLedger>
{
    public void Configure(EntityTypeBuilder<LoyaltyPointLedger> builder)
    {
        builder.ToTable("LoyaltyPointLedgers");
        builder.Property(x => x.Notes).HasMaxLength(500);
        builder.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(x => new { x.CustomerId, x.OccurredAtUtc });
    }
}
