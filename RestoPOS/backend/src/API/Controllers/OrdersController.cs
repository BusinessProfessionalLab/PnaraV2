using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestoPOS.Application.Common.Models;
using RestoPOS.Application.Features.Orders;
using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;

namespace RestoPOS.API.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize]
public sealed class OrdersController(ISender sender) : ControllerBase
{
    [HttpGet("active")]
    [Authorize(Policy = Permissions.OrdersView)]
    public async Task<ActionResult<IReadOnlyList<OrderDto>>> Active(CancellationToken ct) =>
        Ok(await sender.Send(new GetActiveOrdersQuery(), ct));

    [HttpGet("history")]
    [Authorize(Policy = Permissions.OrdersView)]
    public async Task<ActionResult<PaginatedList<OrderDto>>> History(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] OrderStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new GetOrderHistoryQuery(fromUtc, toUtc, status, page, pageSize), ct));

    [HttpGet("drafts")]
    [Authorize(Policy = Permissions.OrdersView)]
    public async Task<ActionResult<IReadOnlyList<OrderDto>>> Drafts(CancellationToken ct) =>
        Ok(await sender.Send(new GetDraftOrdersQuery(), ct));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Permissions.OrdersView)]
    public async Task<ActionResult<OrderDto>> Get(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new GetOrderByIdQuery(id), ct));

    [HttpPost("drafts")]
    [Authorize(Policy = Permissions.OrdersCreate)]
    public async Task<ActionResult<OrderDto>> CreateDraft(CreateDraftOrderCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPost("{orderId:guid}/items")]
    [Authorize(Policy = Permissions.OrdersCreate)]
    public async Task<ActionResult<OrderDto>> AddItem(Guid orderId, AddOrderItemCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command with { OrderId = orderId }, ct));

    [HttpDelete("{orderId:guid}/items/{itemId:guid}")]
    [Authorize(Policy = Permissions.OrdersCreate)]
    public async Task<ActionResult<OrderDto>> RemoveItem(Guid orderId, Guid itemId, CancellationToken ct) =>
        Ok(await sender.Send(new RemoveOrderItemCommand(orderId, itemId), ct));

    [HttpPost("{orderId:guid}/discount")]
    [Authorize(Policy = Permissions.OrdersCreate)]
    public async Task<ActionResult<OrderDto>> Discount(Guid orderId, ApplyDiscountCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command with { OrderId = orderId }, ct));

    [HttpPost("{orderId:guid}/service-charge")]
    [Authorize(Policy = Permissions.OrdersCreate)]
    public async Task<ActionResult<OrderDto>> ServiceCharge(Guid orderId, ApplyServiceChargeCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command with { OrderId = orderId }, ct));

    [HttpPut("{orderId:guid}/notes")]
    [Authorize(Policy = Permissions.OrdersCreate)]
    public async Task<ActionResult<OrderDto>> Notes(Guid orderId, UpdateOrderNotesCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command with { OrderId = orderId }, ct));

    [HttpPost("{orderId:guid}/split")]
    [Authorize(Policy = Permissions.OrdersCreate)]
    public async Task<ActionResult<OrderDto>> Split(Guid orderId, SplitBillCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command with { OrderId = orderId }, ct));

    [HttpPost("merge")]
    [Authorize(Policy = Permissions.OrdersCreate)]
    public async Task<ActionResult<OrderDto>> Merge(MergeBillsCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPost("{orderId:guid}/submit")]
    [Authorize(Policy = Permissions.OrdersSubmit)]
    public async Task<ActionResult<OrderDto>> Submit(Guid orderId, CancellationToken ct) =>
        Ok(await sender.Send(new SubmitOrderCommand(orderId), ct));

    [HttpPost("{orderId:guid}/status")]
    [Authorize(Policy = Permissions.OrdersUpdateStatus)]
    public async Task<ActionResult<OrderDto>> Status(Guid orderId, UpdateOrderStatusCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command with { OrderId = orderId }, ct));

    [HttpDelete("{orderId:guid}/draft")]
    [Authorize(Policy = Permissions.OrdersCancelDraft)]
    public async Task<IActionResult> DiscardDraft(Guid orderId, CancellationToken ct)
    {
        await sender.Send(new CancelDraftOrderCommand(orderId), ct);
        return NoContent();
    }

    [HttpPost("{orderId:guid}/cancel")]
    [Authorize(Policy = Permissions.OrdersCancel)]
    public async Task<ActionResult<OrderDto>> Cancel(Guid orderId, CancelOrderCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command with { OrderId = orderId }, ct));
}
