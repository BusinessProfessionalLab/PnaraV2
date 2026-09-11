using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestoPOS.Application.Common.Models;
using RestoPOS.Application.Features.Shifts;
using RestoPOS.Domain.Common;

namespace RestoPOS.API.Controllers;

[ApiController]
[Route("api/shifts")]
[Authorize(Policy = Permissions.ShiftsManage)]
public sealed class ShiftsController(ISender sender) : ControllerBase
{
    [HttpGet("current")]
    public async Task<ActionResult<ShiftDto?>> Current(CancellationToken ct) =>
        Ok(await sender.Send(new GetCurrentShiftQuery(), ct));

    [HttpGet("history")]
    public async Task<ActionResult<PaginatedList<ShiftHistoryDto>>> History(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] Guid? staffId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new GetShiftHistoryQuery(fromUtc, toUtc, staffId, page, pageSize), ct));

    [HttpPost("open")]
    public async Task<ActionResult<Guid>> Open(OpenShiftCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPost("{shiftId:guid}/close")]
    public async Task<IActionResult> Close(Guid shiftId, CloseShiftCommand command, CancellationToken ct)
    {
        await sender.Send(command with { ShiftId = shiftId }, ct);
        return NoContent();
    }

    [HttpPost("{shiftId:guid}/cash-drop")]
    public async Task<ActionResult<Guid>> CashDrop(Guid shiftId, AddCashDropCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command with { ShiftId = shiftId }, ct));

    [HttpPost("{shiftId:guid}/paid-out")]
    public async Task<ActionResult<Guid>> PaidOut(Guid shiftId, AddPaidOutCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command with { ShiftId = shiftId }, ct));
}
