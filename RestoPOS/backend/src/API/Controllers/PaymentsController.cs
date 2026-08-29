using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestoPOS.Application.Features.Orders;
using RestoPOS.Application.Features.Payments;
using RestoPOS.Domain.Common;

namespace RestoPOS.API.Controllers;

[ApiController]
[Route("api/payments")]
[Authorize(Policy = Permissions.PaymentsSettle)]
public sealed class PaymentsController(ISender sender) : ControllerBase
{
    [HttpPost("pos/initiate")]
    public async Task<ActionResult<PaymentDto>> InitiatePos(InitiatePosPaymentCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpGet("pos/{paymentId:guid}/poll")]
    public async Task<ActionResult<PaymentDto>> Poll(Guid paymentId, CancellationToken ct) =>
        Ok(await sender.Send(new PollPosPaymentQuery(paymentId), ct));

    [HttpPost("cash")]
    public async Task<ActionResult<OrderDto>> Cash(ConfirmCashPaymentCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPost("card-to-card")]
    public async Task<ActionResult<OrderDto>> CardToCard(RecordCardToCardCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPost("online")]
    public async Task<ActionResult<OrderDto>> Online(RecordOnlineGatewayCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpGet("devices")]
    public async Task<ActionResult<IReadOnlyList<PosDeviceDto>>> Devices(CancellationToken ct) =>
        Ok(await sender.Send(new GetPosDevicesQuery(), ct));
}
