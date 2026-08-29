using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

    [HttpPost("open")]
    public async Task<ActionResult<Guid>> Open(OpenShiftCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPost("{shiftId:guid}/close")]
    public async Task<IActionResult> Close(Guid shiftId, CloseShiftCommand command, CancellationToken ct)
    {
        await sender.Send(command with { ShiftId = shiftId }, ct);
        return NoContent();
    }
}
