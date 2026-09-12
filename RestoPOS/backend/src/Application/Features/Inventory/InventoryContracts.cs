using MediatR;
using RestoPOS.Application.Common.Models;
using RestoPOS.Domain.Enums;

namespace RestoPOS.Application.Features.Inventory;

public static class MoneyFormatting
{
    public static decimal ToToman(decimal rials) => rials / 10m;
}

public sealed record UnitConversionDto(Guid Id, string UnitName, BaseUnit TargetBaseUnit, decimal FactorToBase);

public sealed record InventoryItemListDto(
    Guid Id,
    string Name,
    string Sku,
    string? Barcode,
    string? Category,
    BaseUnit BaseUnit,
    decimal CurrentStock,
    decimal MinimumAlertStock,
    decimal OptimalStock,
    decimal WeightedAverageCostRials,
    decimal WeightedAverageCostToman,
    decimal LastPurchasePriceRials,
    decimal LastPurchasePriceToman,
    StorageLocation StorageLocation,
    bool IsActive,
    bool IsLowStock,
    decimal ValuationRials,
    decimal ValuationToman);

public sealed record InventoryItemDetailDto(
    Guid Id,
    string Name,
    string Sku,
    string? Barcode,
    string? Category,
    BaseUnit BaseUnit,
    decimal CurrentStock,
    decimal MinimumAlertStock,
    decimal OptimalStock,
    decimal WeightedAverageCostRials,
    decimal WeightedAverageCostToman,
    decimal LastPurchasePriceRials,
    decimal LastPurchasePriceToman,
    StorageLocation StorageLocation,
    bool IsActive,
    bool IsLowStock,
    decimal ValuationRials,
    decimal ValuationToman,
    IReadOnlyList<UnitConversionDto> Conversions);

public sealed record UnitConversionInput(string UnitName, decimal FactorToBase);

public sealed record CreateInventoryItemCommand(
    string Name,
    string Sku,
    string? Barcode,
    string? Category,
    BaseUnit BaseUnit,
    decimal MinimumAlertStock,
    decimal OptimalStock,
    decimal OpeningStock,
    decimal OpeningUnitCostRials,
    StorageLocation StorageLocation,
    IReadOnlyList<UnitConversionInput>? Conversions) : IRequest<Result<Guid>>;

public sealed record UpdateInventoryItemCommand(
    Guid Id,
    string Name,
    string? Barcode,
    string? Category,
    decimal MinimumAlertStock,
    decimal OptimalStock,
    StorageLocation StorageLocation,
    bool IsActive,
    IReadOnlyList<UnitConversionInput>? Conversions) : IRequest<Result>;

public sealed record DeactivateInventoryItemCommand(Guid Id) : IRequest<Result>;

public sealed record GetInventoryItemsQuery(
    int Page = 1,
    int PageSize = 50,
    string? Category = null,
    StorageLocation? StorageLocation = null,
    string? Search = null,
    bool ActiveOnly = true) : IRequest<Result<PaginatedList<InventoryItemListDto>>>;

public sealed record GetInventoryItemByIdQuery(Guid Id) : IRequest<Result<InventoryItemDetailDto>>;

public sealed record GetLowStockQuery : IRequest<Result<IReadOnlyList<InventoryItemListDto>>>;

public sealed record InventoryValuationGroupDto(
    string GroupKey,
    string GroupLabel,
    decimal TotalStock,
    decimal TotalValueRials,
    decimal TotalValueToman,
    int ItemCount);

public sealed record InventoryValuationDto(
    decimal GrandTotalRials,
    decimal GrandTotalToman,
    IReadOnlyList<InventoryValuationGroupDto> ByLocation,
    IReadOnlyList<InventoryValuationGroupDto> ByCategory);

public sealed record GetInventoryValuationQuery : IRequest<Result<InventoryValuationDto>>;

public sealed record PurchaseInvoiceLineInput(
    Guid InventoryItemId,
    decimal Quantity,
    decimal UnitPriceRials,
    BaseUnit? PurchaseUnit,
    string? NamedPurchaseUnit,
    decimal LineDiscountRials);

public sealed record CreatePurchaseInvoiceCommand(
    string InvoiceNumber,
    Guid? SupplierId,
    string? SupplierName,
    string? SupplierPhone,
    string? SupplierContactPerson,
    string? SupplierAddress,
    decimal TaxRials,
    decimal DiscountRials,
    PurchasePaymentStatus PaymentStatus,
    string? Notes,
    IReadOnlyList<PurchaseInvoiceLineInput> Items) : IRequest<Result<Guid>>;

public sealed record PurchaseInvoiceListDto(
    Guid Id,
    string InvoiceNumber,
    Guid SupplierId,
    string SupplierName,
    DateTime InvoiceDateUtc,
    decimal GrandTotalRials,
    decimal GrandTotalToman,
    PurchasePaymentStatus PaymentStatus,
    PurchaseInvoiceStatus Status);

public sealed record PurchaseInvoiceItemDto(
    Guid Id,
    Guid InventoryItemId,
    string ItemName,
    string Sku,
    decimal Quantity,
    decimal QuantityInBase,
    BaseUnit PurchaseUnit,
    string? NamedPurchaseUnit,
    decimal UnitPriceRials,
    decimal UnitPriceInBaseRials,
    decimal LineDiscountRials,
    decimal LineTotalRials,
    decimal LineTotalToman);

public sealed record PurchaseInvoiceDetailDto(
    Guid Id,
    string InvoiceNumber,
    Guid SupplierId,
    string SupplierName,
    DateTime InvoiceDateUtc,
    decimal SubtotalRials,
    decimal TaxRials,
    decimal DiscountRials,
    decimal GrandTotalRials,
    decimal GrandTotalToman,
    PurchasePaymentStatus PaymentStatus,
    PurchaseInvoiceStatus Status,
    string? Notes,
    DateTime? ApprovedAtUtc,
    IReadOnlyList<PurchaseInvoiceItemDto> Items);

public sealed record GetPurchaseInvoicesQuery(int Page = 1, int PageSize = 50, Guid? SupplierId = null, PurchaseInvoiceStatus? Status = null)
    : IRequest<Result<PaginatedList<PurchaseInvoiceListDto>>>;

public sealed record GetPurchaseInvoiceByIdQuery(Guid Id) : IRequest<Result<PurchaseInvoiceDetailDto>>;

public sealed record WasteLineInput(Guid InventoryItemId, decimal QuantityInBase, WasteReason Reason, string? Notes);

public sealed record RecordWasteBatchCommand(string? Notes, IReadOnlyList<WasteLineInput> Items) : IRequest<Result<Guid>>;

public sealed record WasteReportRowDto(
    Guid WasteId,
    Guid WasteItemId,
    Guid InventoryItemId,
    string ItemName,
    string Sku,
    WasteReason Reason,
    decimal QuantityInBase,
    decimal UnitCostRials,
    decimal LossRials,
    decimal LossToman,
    DateTime OccurredAtUtc,
    string? Notes);

public sealed record GetWasteReportsQuery(DateTime? FromUtc, DateTime? ToUtc, WasteReason? Reason)
    : IRequest<Result<IReadOnlyList<WasteReportRowDto>>>;

public sealed record StartStockCountCommand(string Title, StorageLocation? LocationFilter, string? Notes) : IRequest<Result<Guid>>;

public sealed record StockCountPhysicalInput(Guid InventoryItemId, decimal PhysicalCountQty);

public sealed record SubmitStockCountCommand(Guid StockCountId, IReadOnlyList<StockCountPhysicalInput> Counts) : IRequest<Result>;

public sealed record ApproveStockCountCommand(Guid StockCountId) : IRequest<Result>;

public sealed record StockCountItemDto(
    Guid Id,
    Guid InventoryItemId,
    string ItemName,
    string Sku,
    decimal SystemSnapshotQty,
    decimal? PhysicalCountQty,
    decimal DiscrepancyQty,
    decimal CostVarianceRials,
    decimal CostVarianceToman,
    decimal SnapshotUnitCostRials);

public sealed record StockCountDetailDto(
    Guid Id,
    string Title,
    StockCountStatus Status,
    StorageLocation? LocationFilter,
    DateTime StartedAtUtc,
    DateTime? CompletedAtUtc,
    DateTime? ApprovedAtUtc,
    string? Notes,
    decimal TotalCostVarianceRials,
    decimal TotalCostVarianceToman,
    IReadOnlyList<StockCountItemDto> Items);

public sealed record GetStockCountByIdQuery(Guid Id) : IRequest<Result<StockCountDetailDto>>;

public sealed record CreateStockTransferCommand(
    Guid InventoryItemId,
    StorageLocation FromLocation,
    StorageLocation ToLocation,
    decimal QuantityInBase,
    string? Notes) : IRequest<Result<Guid>>;

public sealed record CardexRowDto(
    Guid Id,
    InventoryTransactionType TransactionType,
    Guid? ReferenceId,
    decimal QuantityDelta,
    decimal StockBefore,
    decimal StockAfter,
    decimal UnitCostRials,
    decimal UnitCostToman,
    Guid? UserId,
    DateTime CreatedAtUtc,
    string? Notes,
    StorageLocation? Location);

public sealed record GetCardexQuery(Guid ItemId, DateTime? FromUtc, DateTime? ToUtc) : IRequest<Result<IReadOnlyList<CardexRowDto>>>;

public sealed record InventoryTransactionListDto(
    Guid Id,
    Guid InventoryItemId,
    string ItemName,
    string Sku,
    InventoryTransactionType TransactionType,
    Guid? ReferenceId,
    decimal QuantityDelta,
    decimal StockBefore,
    decimal StockAfter,
    decimal UnitCostRials,
    decimal UnitCostToman,
    Guid? UserId,
    DateTime CreatedAtUtc,
    string? Notes);

public sealed record GetInventoryTransactionsQuery(
    Guid? InventoryItemId,
    InventoryTransactionType? TransactionType,
    DateTime? FromUtc,
    DateTime? ToUtc,
    int Page = 1,
    int PageSize = 100) : IRequest<Result<PaginatedList<InventoryTransactionListDto>>>;

public sealed record SupplierDto(
    Guid Id,
    string Name,
    string? Phone,
    string? ContactPerson,
    string? Address,
    decimal CurrentBalanceRials,
    decimal CurrentBalanceToman,
    bool IsActive);

public sealed record CreateSupplierCommand(string Name, string? Phone, string? ContactPerson, string? Address, bool IsActive = true) : IRequest<Result<Guid>>;
public sealed record UpdateSupplierCommand(Guid Id, string Name, string? Phone, string? ContactPerson, string? Address, bool IsActive) : IRequest<Result>;
public sealed record DeleteSupplierCommand(Guid Id) : IRequest<Result>;
public sealed record GetSupplierByIdQuery(Guid Id) : IRequest<Result<SupplierDto>>;
public sealed record ListSuppliersQuery(bool ActiveOnly = true, string? Search = null, int Page = 1, int PageSize = 50)
    : IRequest<Result<PaginatedList<SupplierDto>>>;

public sealed record CreateManualAdjustmentCommand(Guid InventoryItemId, decimal QuantityDelta, string? Notes) : IRequest<Result<Guid>>;

public sealed record StockCountListDto(
    Guid Id,
    string Title,
    StockCountStatus Status,
    StorageLocation? LocationFilter,
    DateTime StartedAtUtc,
    DateTime? CompletedAtUtc,
    DateTime? ApprovedAtUtc);

public sealed record ListStockCountsQuery(StockCountStatus? Status = null, int Page = 1, int PageSize = 50)
    : IRequest<Result<PaginatedList<StockCountListDto>>>;

public sealed record StockTransferDto(
    Guid Id,
    Guid InventoryItemId,
    string ItemName,
    string Sku,
    StorageLocation FromLocation,
    StorageLocation ToLocation,
    decimal QuantityInBase,
    StockTransferStatus Status,
    DateTime RequestedAtUtc,
    DateTime? TransferredAtUtc,
    string? Notes);

public sealed record ListTransfersQuery(StockTransferStatus? Status = null, Guid? InventoryItemId = null, int Page = 1, int PageSize = 50)
    : IRequest<Result<PaginatedList<StockTransferDto>>>;

public sealed record CancelStockTransferCommand(Guid Id) : IRequest<Result>;
public sealed record CompleteStockTransferCommand(Guid Id) : IRequest<Result>;

public sealed record CreateDraftPurchaseCommand(
    string InvoiceNumber,
    Guid? SupplierId,
    string? SupplierName,
    string? SupplierPhone,
    string? SupplierContactPerson,
    string? SupplierAddress,
    decimal TaxRials,
    decimal DiscountRials,
    PurchasePaymentStatus PaymentStatus,
    string? Notes,
    IReadOnlyList<PurchaseInvoiceLineInput> Items) : IRequest<Result<Guid>>;

public sealed record UpdateDraftPurchaseCommand(
    Guid Id,
    decimal TaxRials,
    decimal DiscountRials,
    PurchasePaymentStatus PaymentStatus,
    string? Notes,
    IReadOnlyList<PurchaseInvoiceLineInput> Items) : IRequest<Result>;

public sealed record ApprovePurchaseCommand(Guid Id) : IRequest<Result>;
public sealed record CancelPurchaseCommand(Guid Id) : IRequest<Result>;

public sealed record WasteDetailDto(
    Guid Id,
    DateTime OccurredAtUtc,
    Guid? RecordedByUserId,
    string? Notes,
    decimal TotalLossRials,
    decimal TotalLossToman,
    IReadOnlyList<WasteReportRowDto> Items);

public sealed record ListWasteQuery(DateTime? FromUtc, DateTime? ToUtc, int Page = 1, int PageSize = 50)
    : IRequest<Result<PaginatedList<WasteDetailDto>>>;

public sealed record GetWasteByIdQuery(Guid Id) : IRequest<Result<WasteDetailDto>>;
