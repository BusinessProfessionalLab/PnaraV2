using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestoPOS.Domain.Entities;

namespace RestoPOS.Infrastructure.Persistence.Configurations;

public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("Orders");
        builder.Property(x => x.OrderNumber).HasMaxLength(32).IsRequired();
        builder.HasIndex(x => x.OrderNumber).IsUnique();
        builder.Property(x => x.TableNumber).HasMaxLength(16);
        builder.Property(x => x.CustomerPhone).HasMaxLength(16);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.CancelReason).HasMaxLength(500);
        builder.Property(x => x.Subtotal).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.ModifiersTotal).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.DiscountAmount).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.DiscountPercent).HasColumnType("decimal(5,2)");
        builder.Property(x => x.TaxRate).HasColumnType(MoneyConfig.Rate);
        builder.Property(x => x.TaxAmount).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.GrandTotal).HasColumnType(MoneyConfig.Rial);
        builder.HasOne(x => x.Customer).WithMany(c => c.Orders).HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.SetNull);
        builder.HasIndex(x => new { x.Status, x.CreatedAt });
        builder.HasIndex(x => x.CashierId);
        builder.HasIndex(x => x.PaidAt);
        builder.Ignore(x => x.DomainEvents);
    }
}

public class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.ToTable("OrderItems");
        builder.Property(x => x.Title).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Notes).HasMaxLength(500);
        builder.Property(x => x.UnitPrice).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.LineSubtotal).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.LineModifiersTotal).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.LineTotal).HasColumnType(MoneyConfig.Rial);
        builder.HasOne(x => x.Order).WithMany(o => o.Items).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.MenuItem).WithMany().HasForeignKey(x => x.MenuItemId).IsRequired(false).OnDelete(DeleteBehavior.Restrict);
    }
}

public class OrderItemModifierConfiguration : IEntityTypeConfiguration<OrderItemModifier>
{
    public void Configure(EntityTypeBuilder<OrderItemModifier> builder)
    {
        builder.ToTable("OrderItemModifiers");
        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.Property(x => x.ExtraPrice).HasColumnType(MoneyConfig.Rial);
        builder.HasOne(x => x.OrderItem).WithMany(i => i.Modifiers).HasForeignKey(x => x.OrderItemId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("Payments");
        builder.Property(x => x.Amount).HasColumnType(MoneyConfig.Rial);
        builder.Property(x => x.TraceNumber).HasMaxLength(64);
        builder.Property(x => x.ReferenceNumber).HasMaxLength(64);
        builder.Property(x => x.Rrn).HasMaxLength(64);
        builder.Property(x => x.TerminalId).HasMaxLength(32);
        builder.Property(x => x.CardMask).HasMaxLength(32);
        builder.Property(x => x.FailureReason).HasMaxLength(500);
        builder.HasOne(x => x.Order).WithMany(o => o.Payments).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.PosDevice).WithMany().HasForeignKey(x => x.PosDeviceId).OnDelete(DeleteBehavior.SetNull);
        builder.HasIndex(x => x.TraceNumber);
    }
}

public class PosDeviceConfiguration : IEntityTypeConfiguration<PosDevice>
{
    public void Configure(EntityTypeBuilder<PosDevice> builder)
    {
        builder.ToTable("PosDevices");
        builder.ConfigureSoftDelete();
        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.Property(x => x.IpAddress).HasMaxLength(64);
        builder.Property(x => x.ComPort).HasMaxLength(32);
        builder.Property(x => x.TerminalId).HasMaxLength(32).IsRequired();
        builder.Property(x => x.MerchantId).HasMaxLength(32).IsRequired();
    }
}

public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("Customers");
        builder.ConfigureSoftDelete();
        builder.Property(x => x.PhoneNumber).HasMaxLength(16).IsRequired();
        builder.HasIndex(x => x.PhoneNumber).IsUnique();
        builder.Property(x => x.FullName).HasMaxLength(200);
        builder.Property(x => x.TotalSpent).HasColumnType(MoneyConfig.Rial);
    }
}

public class StoreSettingsConfiguration : IEntityTypeConfiguration<StoreSettings>
{
    public void Configure(EntityTypeBuilder<StoreSettings> builder)
    {
        builder.ToTable("StoreSettings");
        builder.Property(x => x.StoreName).HasMaxLength(200).IsRequired();
        builder.Property(x => x.LogoUrl).HasMaxLength(500);
        builder.Property(x => x.TaxIdentificationNumber).HasMaxLength(32);
        builder.Property(x => x.ReceiptHeader).HasMaxLength(500);
        builder.Property(x => x.ReceiptFooter).HasMaxLength(500);
        builder.Property(x => x.PrimaryColor).HasMaxLength(7);
        builder.Property(x => x.SecondaryColor).HasMaxLength(7);
        builder.Property(x => x.VatRate).HasColumnType(MoneyConfig.Rate);
        builder.Property(x => x.CurrencyCode).HasMaxLength(8);
        builder.Property(x => x.ThermalPrinterHost).HasMaxLength(128);
    }
}

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("AuditLogs");
        builder.Property(x => x.EntityName).HasMaxLength(128).IsRequired();
        builder.Property(x => x.EntityId).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Action).HasMaxLength(32).IsRequired();
        builder.Property(x => x.IpAddress).HasMaxLength(64);
        builder.HasIndex(x => new { x.EntityName, x.OccurredAt });
    }
}
