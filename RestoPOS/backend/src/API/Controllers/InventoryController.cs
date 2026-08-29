using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestoPOS.Application.Features.Inventory;
using RestoPOS.Domain.Common;

namespace RestoPOS.API.Controllers;

[ApiController]
[Route("api/inventory")]
[Authorize]
public sealed class InventoryController(ISender sender) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = Permissions.InventoryView)]
    public async Task<ActionResult<IReadOnlyList<InventoryItemDto>>> List(CancellationToken ct) =>
        Ok(await sender.Send(new GetInventoryQuery(), ct));

    [HttpGet("low-stock")]
    [Authorize(Policy = Permissions.InventoryView)]
    public async Task<ActionResult<IReadOnlyList<InventoryItemDto>>> LowStock(CancellationToken ct) =>
        Ok(await sender.Send(new GetLowStockQuery(), ct));

    [HttpGet("transactions")]
    [Authorize(Policy = Permissions.InventoryView)]
    public async Task<ActionResult<IReadOnlyList<InventoryTransactionDto>>> Transactions([FromQuery] Guid? inventoryItemId, [FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc, CancellationToken ct) =>
        Ok(await sender.Send(new GetInventoryTransactionsQuery(inventoryItemId, fromUtc, toUtc), ct));

    [HttpPost("items")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public async Task<ActionResult<Guid>> Create(CreateInventoryItemCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPost("receive")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public async Task<ActionResult<Guid>> Receive(ReceiveStockCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPost("waste")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public async Task<ActionResult<Guid>> Waste(RecordWasteCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));
}
