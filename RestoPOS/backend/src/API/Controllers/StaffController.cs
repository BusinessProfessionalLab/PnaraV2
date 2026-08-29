using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestoPOS.Application.Features.Auth;
using RestoPOS.Domain.Common;

namespace RestoPOS.API.Controllers;

[ApiController]
[Route("api/staff")]
[Authorize(Policy = Permissions.StaffManage)]
public sealed class StaffController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StaffDto>>> List(CancellationToken ct) =>
        Ok(await sender.Send(new GetStaffListQuery(), ct));

    [HttpPost]
    public async Task<ActionResult<Guid>> Create(CreateStaffCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPost("{staffId:guid}/roles")]
    public async Task<IActionResult> AssignRoles(Guid staffId, AssignRolesCommand command, CancellationToken ct)
    {
        await sender.Send(command with { StaffId = staffId }, ct);
        return NoContent();
    }

    [HttpPost("roles")]
    public async Task<ActionResult<Guid>> CreateRole(CreateRoleCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPut("roles/{roleId:guid}/permissions")]
    public async Task<IActionResult> UpdatePermissions(Guid roleId, UpdateRolePermissionsCommand command, CancellationToken ct)
    {
        await sender.Send(command with { RoleId = roleId }, ct);
        return NoContent();
    }
}
