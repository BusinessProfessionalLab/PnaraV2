using RestoPOS.Domain.Common;

namespace RestoPOS.Domain.Entities;

public enum LoyaltyRewardType
{
    FixedDiscount = 0,
    PercentDiscount = 1,
    FreeProduct = 2
}

public class LoyaltyReward : BaseEntity
{
    public string Name { get; set; } = default!;
    public LoyaltyRewardType Type { get; set; }
    public int PointsCost { get; set; }
    public decimal DiscountRials { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal MaxDiscountRials { get; set; }
    public string? ProductName { get; set; }
    public bool IsActive { get; set; } = true;
}
