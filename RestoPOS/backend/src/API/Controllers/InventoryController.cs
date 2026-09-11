using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestoPOS.Application.Common.Models;
using RestoPOS.Application.Features.Inventory;
using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;

namespace RestoPOS.API.Controllers;

/// <summary>
/// Inventory management: master data, purchases, waste, stock counts, transfers, and cardex ledger.
/// </summary>
[ApiController]
[Route("api/inventory")]
[Authorize]
[Produces("application/json")]
public sealed class InventoryController(ISender sender) : ControllerBase
{
    /// <summary>Paged inventory items with optional category, location, and SKU/name search.</summary>
    [HttpGet("items")]
    [Authorize(Policy = Permissions.InventoryView)]
    [ProducesResponseType(typeof(Result<PaginatedList<InventoryItemListDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<Result<PaginatedList<InventoryItemListDto>>>> ListItems(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? category = null,
        [FromQuery] StorageLocation? storageLocation = null,
        [FromQuery] string? search = null,
        [FromQuery] bool activeOnly = true,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new GetInventoryItemsQuery(page, pageSize, category, storageLocation, search, activeOnly), ct));

    /// <summary>Detailed inventory item including unit conversions.</summary>
    [HttpGet("items/{id:guid}")]
    [Authorize(Policy = Permissions.InventoryView)]
    [ProducesResponseType(typeof(Result<InventoryItemDetailDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<Result<InventoryItemDetailDto>>> GetItem(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new GetInventoryItemByIdQuery(id), ct));

    /// <summary>Create inventory item with optional opening stock and conversions.</summary>
    [HttpPost("items")]
    [Authorize(Policy = Permissions.InventoryManage)]
    [ProducesResponseType(typeof(Result<Guid>), StatusCodes.Status200OK)]
    public async Task<ActionResult<Result<Guid>>> CreateItem(CreateInventoryItemCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    /// <summary>Update item thresholds, location, and conversions.</summary>
    [HttpPut("items/{id:guid}")]
    [Authorize(Policy = Permissions.InventoryManage)]
    [ProducesResponseType(typeof(Result), StatusCodes.Status200OK)]
    public async Task<ActionResult<Result>> UpdateItem(Guid id, UpdateInventoryItemCommand command, CancellationToken ct)
    {
        if (id != command.Id)
            return BadRequest(Result.Failure("شناسه مسیر با بدنه درخواست یکسان نیست."));
        return Ok(await sender.Send(command, ct));
    }

    /// <summary>Soft-delete / deactivate an inventory item.</summary>
    [HttpDelete("items/{id:guid}")]
    [Authorize(Policy = Permissions.InventoryManage)]
    [ProducesResponseType(typeof(Result), StatusCodes.Status200OK)]
    public async Task<ActionResult<Result>> DeleteItem(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new DeactivateInventoryItemCommand(id), ct));

    /// <summary>Items where CurrentStock &lt;= MinimumAlertStock.</summary>
    [HttpGet("low-stock")]
    [Authorize(Policy = Permissions.InventoryView)]
    [ProducesResponseType(typeof(Result<IReadOnlyList<InventoryItemListDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<Result<IReadOnlyList<InventoryItemListDto>>>> LowStock(CancellationToken ct) =>
        Ok(await sender.Send(new GetLowStockQuery(), ct));

    /// <summary>Total inventory asset value (WAC × Stock) grouped by location and category.</summary>
    [HttpGet("valuation")]
    [Authorize(Policy = Permissions.InventoryView)]
    [ProducesResponseType(typeof(Result<InventoryValuationDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<Result<InventoryValuationDto>>> Valuation(CancellationToken ct) =>
        Ok(await sender.Send(new GetInventoryValuationQuery(), ct));

    /// <summary>Create and approve a multi-line purchase invoice (recalculates WAC and supplier balance).</summary>
    [HttpPost("purchases")]
    [Authorize(Policy = Permissions.InventoryManage)]
    [ProducesResponseType(typeof(Result<Guid>), StatusCodes.Status200OK)]
    public async Task<ActionResult<Result<Guid>>> CreatePurchase(CreatePurchaseInvoiceCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    /// <summary>Paged purchase invoices.</summary>
    [HttpGet("purchases")]
    [Authorize(Policy = Permissions.InventoryView)]
    [ProducesResponseType(typeof(Result<PaginatedList<PurchaseInvoiceListDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<Result<PaginatedList<PurchaseInvoiceListDto>>>> ListPurchases(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] Guid? supplierId = null,
        [FromQuery] PurchaseInvoiceStatus? status = null,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new GetPurchaseInvoicesQuery(page, pageSize, supplierId, status), ct));

    /// <summary>Purchase invoice details with lines.</summary>
    [HttpGet("purchases/{id:guid}")]
    [Authorize(Policy = Permissions.InventoryView)]
    [ProducesResponseType(typeof(Result<PurchaseInvoiceDetailDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<Result<PurchaseInvoiceDetailDto>>> GetPurchase(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new GetPurchaseInvoiceByIdQuery(id), ct));

    /// <summary>Record batch waste/spoilage with monetary loss at current WAC.</summary>
    [HttpPost("waste")]
    [Authorize(Policy = Permissions.InventoryManage)]
    [ProducesResponseType(typeof(Result<Guid>), StatusCodes.Status200OK)]
    public async Task<ActionResult<Result<Guid>>> RecordWaste(RecordWasteBatchCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    /// <summary>Waste history filtered by reason and date range.</summary>
    [HttpGet("waste/reports")]
    [Authorize(Policy = Permissions.InventoryView)]
    [ProducesResponseType(typeof(Result<IReadOnlyList<WasteReportRowDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<Result<IReadOnlyList<WasteReportRowDto>>>> WasteReports(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] WasteReason? reason,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new GetWasteReportsQuery(fromUtc, toUtc, reason), ct));

    /// <summary>Start a stock-count session and snapshot current stocks.</summary>
    [HttpPost("stock-counts/start")]
    [Authorize(Policy = Permissions.InventoryAudit)]
    [ProducesResponseType(typeof(Result<Guid>), StatusCodes.Status200OK)]
    public async Task<ActionResult<Result<Guid>>> StartStockCount(StartStockCountCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    /// <summary>Submit physical counts for stock-count items.</summary>
    [HttpPut("stock-counts/{id:guid}/counts")]
    [Authorize(Policy = Permissions.InventoryAudit)]
    [ProducesResponseType(typeof(Result), StatusCodes.Status200OK)]
    public async Task<ActionResult<Result>> SubmitStockCounts(Guid id, [FromBody] IReadOnlyList<StockCountPhysicalInput> counts, CancellationToken ct) =>
        Ok(await sender.Send(new SubmitStockCountCommand(id, counts), ct));

    /// <summary>Approve discrepancies and apply automatic stock adjustments.</summary>
    [HttpPost("stock-counts/{id:guid}/approve")]
    [Authorize(Policy = Permissions.InventoryAudit)]
    [ProducesResponseType(typeof(Result), StatusCodes.Status200OK)]
    public async Task<ActionResult<Result>> ApproveStockCount(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new ApproveStockCountCommand(id), ct));

    /// <summary>Discrepancy and variance report for a stock-count session.</summary>
    [HttpGet("stock-counts/{id:guid}")]
    [Authorize(Policy = Permissions.InventoryAudit)]
    [ProducesResponseType(typeof(Result<StockCountDetailDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<Result<StockCountDetailDto>>> GetStockCount(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new GetStockCountByIdQuery(id), ct));

    /// <summary>Transfer stock between storage locations / stations.</summary>
    [HttpPost("transfers")]
    [Authorize(Policy = Permissions.InventoryManage)]
    [ProducesResponseType(typeof(Result<Guid>), StatusCodes.Status200OK)]
    public async Task<ActionResult<Result<Guid>>> Transfer(CreateStockTransferCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    /// <summary>Full cardex (ledger timeline) for one inventory item.</summary>
    [HttpGet("cardex/{itemId:guid}")]
    [Authorize(Policy = Permissions.InventoryView)]
    [ProducesResponseType(typeof(Result<IReadOnlyList<CardexRowDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<Result<IReadOnlyList<CardexRowDto>>>> Cardex(
        Guid itemId,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new GetCardexQuery(itemId, fromUtc, toUtc), ct));

    /// <summary>Global inventory transactions list (کاردکس کلی).</summary>
    [HttpGet("transactions")]
    [Authorize(Policy = Permissions.InventoryView)]
    [ProducesResponseType(typeof(Result<PaginatedList<InventoryTransactionListDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<Result<PaginatedList<InventoryTransactionListDto>>>> Transactions(
        [FromQuery] Guid? inventoryItemId,
        [FromQuery] InventoryTransactionType? transactionType,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new GetInventoryTransactionsQuery(inventoryItemId, transactionType, fromUtc, toUtc, page, pageSize), ct));

    [HttpGet("suppliers")]
    [Authorize(Policy = Permissions.InventoryView)]
    public async Task<ActionResult<Result<PaginatedList<SupplierDto>>>> ListSuppliers(
        [FromQuery] bool activeOnly = true,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new ListSuppliersQuery(activeOnly, search, page, pageSize), ct));

    [HttpGet("suppliers/{id:guid}")]
    [Authorize(Policy = Permissions.InventoryView)]
    public async Task<ActionResult<Result<SupplierDto>>> GetSupplier(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new GetSupplierByIdQuery(id), ct));

    [HttpPost("suppliers")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public async Task<ActionResult<Result<Guid>>> CreateSupplier(CreateSupplierCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPut("suppliers/{id:guid}")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public async Task<ActionResult<Result>> UpdateSupplier(Guid id, UpdateSupplierCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command with { Id = id }, ct));

    [HttpDelete("suppliers/{id:guid}")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public async Task<ActionResult<Result>> DeleteSupplier(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new DeleteSupplierCommand(id), ct));

    [HttpPost("adjustments")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public async Task<ActionResult<Result<Guid>>> ManualAdjustment(CreateManualAdjustmentCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpGet("stock-counts")]
    [Authorize(Policy = Permissions.InventoryAudit)]
    public async Task<ActionResult<Result<PaginatedList<StockCountListDto>>>> ListStockCounts(
        [FromQuery] StockCountStatus? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new ListStockCountsQuery(status, page, pageSize), ct));

    [HttpGet("transfers")]
    [Authorize(Policy = Permissions.InventoryView)]
    public async Task<ActionResult<Result<PaginatedList<StockTransferDto>>>> ListTransfers(
        [FromQuery] StockTransferStatus? status = null,
        [FromQuery] Guid? inventoryItemId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new ListTransfersQuery(status, inventoryItemId, page, pageSize), ct));

    [HttpPost("transfers/{id:guid}/complete")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public async Task<ActionResult<Result>> CompleteTransfer(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new CompleteStockTransferCommand(id), ct));

    [HttpPost("transfers/{id:guid}/cancel")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public async Task<ActionResult<Result>> CancelTransfer(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new CancelStockTransferCommand(id), ct));

    [HttpPost("purchases/draft")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public async Task<ActionResult<Result<Guid>>> CreateDraftPurchase(CreateDraftPurchaseCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPut("purchases/{id:guid}/draft")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public async Task<ActionResult<Result>> UpdateDraftPurchase(Guid id, UpdateDraftPurchaseCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command with { Id = id }, ct));

    [HttpPost("purchases/{id:guid}/approve")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public async Task<ActionResult<Result>> ApprovePurchase(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new ApprovePurchaseCommand(id), ct));

    [HttpPost("purchases/{id:guid}/cancel")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public async Task<ActionResult<Result>> CancelPurchase(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new CancelPurchaseCommand(id), ct));

    [HttpGet("waste")]
    [Authorize(Policy = Permissions.InventoryView)]
    public async Task<ActionResult<Result<PaginatedList<WasteDetailDto>>>> ListWaste(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new ListWasteQuery(fromUtc, toUtc, page, pageSize), ct));

    [HttpGet("waste/{id:guid}")]
    [Authorize(Policy = Permissions.InventoryView)]
    public async Task<ActionResult<Result<WasteDetailDto>>> GetWaste(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new GetWasteByIdQuery(id), ct));
}
