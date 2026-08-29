using RestoPOS.Domain.Common;

namespace RestoPOS.Domain.Entities;

public class StoreSettings : BaseEntity
{
    public string StoreName { get; set; } = "ToastIran POS";
    public string? LogoUrl { get; set; }
    public string? TaxIdentificationNumber { get; set; }
    public string? ReceiptHeader { get; set; }
    public string? ReceiptFooter { get; set; }
    public string PrimaryColor { get; set; } = "#C41E3A";
    public string SecondaryColor { get; set; } = "#1F2937";
    public decimal VatRate { get; set; } = 0.10m;
    public string CurrencyCode { get; set; } = "IRR";
    public int LoyaltyPointsPerMillionRial { get; set; } = 10;
    public string? ThermalPrinterHost { get; set; }
    public int ThermalPrinterPort { get; set; } = 9100;
}
