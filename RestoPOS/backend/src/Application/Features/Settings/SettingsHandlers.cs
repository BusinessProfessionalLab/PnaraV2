using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Application.Features.Settings;

public sealed record StoreSettingsDto(
    Guid Id,
    string StoreName,
    string? LogoUrl,
    string? TaxIdentificationNumber,
    string? ReceiptHeader,
    string? ReceiptFooter,
    string PrimaryColor,
    string SecondaryColor,
    decimal VatRate,
    string CurrencyCode,
    int LoyaltyPointsPerMillionRial,
    string? ThermalPrinterHost,
    int ThermalPrinterPort);

public sealed record GetStoreSettingsQuery : IRequest<StoreSettingsDto>;

public sealed record UpdateStoreSettingsCommand(
    string StoreName,
    string? LogoUrl,
    string? TaxIdentificationNumber,
    string? ReceiptHeader,
    string? ReceiptFooter,
    string PrimaryColor,
    string SecondaryColor,
    decimal VatRate,
    int LoyaltyPointsPerMillionRial,
    string? ThermalPrinterHost,
    int ThermalPrinterPort) : IRequest<StoreSettingsDto>;

public sealed class UpdateStoreSettingsCommandValidator : AbstractValidator<UpdateStoreSettingsCommand>
{
    public UpdateStoreSettingsCommandValidator()
    {
        RuleFor(x => x.StoreName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.VatRate).InclusiveBetween(0, 1);
        RuleFor(x => x.PrimaryColor).Matches("^#([A-Fa-f0-9]{6})$");
        RuleFor(x => x.SecondaryColor).Matches("^#([A-Fa-f0-9]{6})$");
    }
}

public sealed class GetStoreSettingsQueryHandler(IApplicationDbContext db) : IRequestHandler<GetStoreSettingsQuery, StoreSettingsDto>
{
    public async Task<StoreSettingsDto> Handle(GetStoreSettingsQuery request, CancellationToken cancellationToken)
    {
        var s = await db.StoreSettings.AsNoTracking().FirstOrDefaultAsync(cancellationToken)
                ?? throw new NotFoundException("تنظیمات فروشگاه یافت نشد.");
        return Map(s);
    }

    internal static StoreSettingsDto Map(StoreSettings s) => new(
        s.Id, s.StoreName, s.LogoUrl, s.TaxIdentificationNumber, s.ReceiptHeader, s.ReceiptFooter,
        s.PrimaryColor, s.SecondaryColor, s.VatRate, s.CurrencyCode, s.LoyaltyPointsPerMillionRial,
        s.ThermalPrinterHost, s.ThermalPrinterPort);
}

public sealed class UpdateStoreSettingsCommandHandler(IApplicationDbContext db) : IRequestHandler<UpdateStoreSettingsCommand, StoreSettingsDto>
{
    public async Task<StoreSettingsDto> Handle(UpdateStoreSettingsCommand request, CancellationToken cancellationToken)
    {
        var s = await db.StoreSettings.FirstOrDefaultAsync(cancellationToken)
                ?? throw new NotFoundException("تنظیمات فروشگاه یافت نشد.");
        s.StoreName = request.StoreName;
        s.LogoUrl = request.LogoUrl;
        s.TaxIdentificationNumber = request.TaxIdentificationNumber;
        s.ReceiptHeader = request.ReceiptHeader;
        s.ReceiptFooter = request.ReceiptFooter;
        s.PrimaryColor = request.PrimaryColor;
        s.SecondaryColor = request.SecondaryColor;
        s.VatRate = request.VatRate;
        s.LoyaltyPointsPerMillionRial = request.LoyaltyPointsPerMillionRial;
        s.ThermalPrinterHost = request.ThermalPrinterHost;
        s.ThermalPrinterPort = request.ThermalPrinterPort;
        await db.SaveChangesAsync(cancellationToken);
        return GetStoreSettingsQueryHandler.Map(s);
    }
}
