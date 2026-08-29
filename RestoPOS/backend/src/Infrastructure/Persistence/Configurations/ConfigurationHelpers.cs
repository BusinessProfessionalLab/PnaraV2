using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestoPOS.Domain.Common;

namespace RestoPOS.Infrastructure.Persistence.Configurations;

internal static class MoneyConfig
{
    public const string Rial = "decimal(18,0)";
    public const string Quantity = "decimal(18,3)";
    public const string Rate = "decimal(9,6)";
}

internal static class SoftDeleteConfig
{
    public static void ConfigureSoftDelete<T>(this EntityTypeBuilder<T> builder) where T : class, ISoftDeletable
    {
        builder.HasQueryFilter(e => !e.IsDeleted);
        builder.HasIndex(e => e.IsDeleted);
    }
}
