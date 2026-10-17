using RestoPOS.Domain.Common;

namespace RestoPOS.Domain.Entities;

public class StoreSettings : BaseEntity
{
    public string StoreName { get; set; } = "Pnara";
    public string? LogoUrl { get; set; }
    public string? TaxIdentificationNumber { get; set; }
    public string? ReceiptHeader { get; set; }
    public string? ReceiptFooter { get; set; }
    public string PrimaryColor { get; set; } = "#C41E3A";
    public string SecondaryColor { get; set; } = "#1F2937";
    public decimal VatRate { get; set; } = 0.10m;
    public string CurrencyCode { get; set; } = "IRR";
    public int LoyaltyPointsPerMillionRial { get; set; } = 10;
    public string LoyaltyEarnMode { get; set; } = "Amount";
    public decimal LoyaltyEarnAmountRials { get; set; } = 1_000_000m;
    public int LoyaltyEarnPoints { get; set; } = 10;
    public int LoyaltyEarnEveryVisits { get; set; } = 1;
    public decimal LoyaltyEarnPercent { get; set; }
    public bool ThankYouSmsEnabled { get; set; }
    public bool LoyaltySmsEnabled { get; set; }
    public string SmsQuietHoursStart { get; set; } = "21:00";
    public string SmsQuietHoursEnd { get; set; } = "09:00";
    public string ThankYouSmsTemplate { get; set; } = "{name} عزیز، از خرید شما سپاسگزاریم. {points} امتیاز به حساب شما اضافه شد.";
    public decimal CashbackPercent { get; set; }
    public decimal CashbackMaxRials { get; set; }
    public decimal CashbackMinSpendRials { get; set; }
    public string[] CashbackProductIds { get; set; } = [];
    public int RewardPointsThreshold { get; set; } = 500;
    public decimal RewardDiscountRials { get; set; } = 50_000m;
    public string RewardProductName { get; set; } = "";
    public string LoyaltyTierRulesJson { get; set; } = "[]";
    public int LapsedCustomerDays { get; set; } = 30;
    public string? ThermalPrinterHost { get; set; }
    public int ThermalPrinterPort { get; set; } = 9100;
}
