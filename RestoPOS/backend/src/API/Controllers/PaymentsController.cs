using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestoPOS.Application.Features.Orders;
using RestoPOS.Application.Features.Payments;
using RestoPOS.Domain.Common;

namespace RestoPOS.API.Controllers;

[ApiController]
[Route("api/payments")]
[Authorize]
public sealed class PaymentsController(ISender sender) : ControllerBase
{
    [HttpPost("pos/initiate")]
    [Authorize(Policy = Permissions.PaymentsSettle)]
    public async Task<ActionResult<PaymentDto>> InitiatePos(InitiatePosPaymentCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpGet("pos/{paymentId:guid}/poll")]
    [Authorize(Policy = Permissions.PaymentsSettle)]
    public async Task<ActionResult<PaymentDto>> Poll(Guid paymentId, CancellationToken ct) =>
        Ok(await sender.Send(new PollPosPaymentQuery(paymentId), ct));

    [HttpPost("cash")]
    [Authorize(Policy = Permissions.PaymentsSettle)]
    public async Task<ActionResult<OrderDto>> Cash(ConfirmCashPaymentCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPost("card-to-card")]
    [Authorize(Policy = Permissions.PaymentsSettle)]
    public async Task<ActionResult<OrderDto>> CardToCard(RecordCardToCardCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPost("online")]
    [Authorize(Policy = Permissions.PaymentsSettle)]
    public async Task<ActionResult<OrderDto>> Online(RecordOnlineGatewayCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpGet("by-order/{orderId:guid}")]
    [Authorize(Policy = Permissions.PaymentsSettle)]
    public async Task<ActionResult<IReadOnlyList<PaymentDto>>> ByOrder(Guid orderId, CancellationToken ct) =>
        Ok(await sender.Send(new ListPaymentsByOrderQuery(orderId), ct));

    [HttpPost("{paymentId:guid}/void")]
    [Authorize(Policy = Permissions.PaymentsRefund)]
    public async Task<ActionResult<PaymentDto>> Void(Guid paymentId, VoidPaymentCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command with { PaymentId = paymentId }, ct));

    [HttpPost("{paymentId:guid}/refund")]
    [Authorize(Policy = Permissions.PaymentsRefund)]
    public async Task<ActionResult<PaymentDto>> Refund(Guid paymentId, RefundPaymentCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command with { PaymentId = paymentId }, ct));

    [HttpGet("devices")]
    [Authorize(Policy = Permissions.PaymentsSettle)]
    public async Task<ActionResult<IReadOnlyList<PosDeviceDto>>> Devices([FromQuery] bool activeOnly = true, CancellationToken ct = default) =>
        Ok(await sender.Send(new GetPosDevicesQuery(activeOnly), ct));
}

[ApiController]
[Route("api/pos-devices")]
[Authorize(Policy = Permissions.PosDevicesManage)]
public sealed class PosDevicesController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PosDeviceDto>>> List([FromQuery] bool activeOnly = false, CancellationToken ct = default) =>
        Ok(await sender.Send(new GetPosDevicesQuery(activeOnly), ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PosDeviceDto>> Get(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new GetPosDeviceByIdQuery(id), ct));

    [HttpPost]
    public async Task<ActionResult<Guid>> Create(CreatePosDeviceCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdatePosDeviceCommand command, CancellationToken ct)
    {
        await sender.Send(command with { Id = id }, ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await sender.Send(new DeletePosDeviceCommand(id), ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/test")]
    public async Task<ActionResult<PosDeviceTestResult>> Test(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new TestPosDeviceConnectionCommand(id), ct));
}
