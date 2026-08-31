using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestoPOS.Application.Features.Orders;
using RestoPOS.Domain.Common;

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
