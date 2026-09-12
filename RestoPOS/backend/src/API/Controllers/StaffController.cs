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

    [HttpGet("{staffId:guid}")]
    public async Task<ActionResult<StaffDto>> Get(Guid staffId, CancellationToken ct) =>
        Ok(await sender.Send(new GetStaffByIdQuery(staffId), ct));

    [HttpPost]
    public async Task<ActionResult<Guid>> Create(CreateStaffCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPut("{staffId:guid}")]
    public async Task<IActionResult> Update(Guid staffId, UpdateStaffCommand command, CancellationToken ct)
    {
        await sender.Send(command with { StaffId = staffId }, ct);
        return NoContent();
    }

    [HttpPost("{staffId:guid}/deactivate")]
    public async Task<IActionResult> Deactivate(Guid staffId, CancellationToken ct)
    {
        await sender.Send(new DeactivateStaffCommand(staffId), ct);
        return NoContent();
    }

    [HttpPost("{staffId:guid}/password")]
    public async Task<IActionResult> ChangePassword(Guid staffId, ChangePasswordCommand command, CancellationToken ct)
    {
        await sender.Send(command with { StaffId = staffId }, ct);
        return NoContent();
    }

    [HttpPost("{staffId:guid}/roles")]
    public async Task<IActionResult> AssignRoles(Guid staffId, AssignRolesCommand command, CancellationToken ct)
    {
        await sender.Send(command with { StaffId = staffId }, ct);
        return NoContent();
    }

    [HttpGet("roles")]
    public async Task<ActionResult<IReadOnlyList<RoleDto>>> Roles(CancellationToken ct) =>
        Ok(await sender.Send(new ListRolesQuery(), ct));

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

[ApiController]
[Route("api/roles")]
[Authorize(Policy = Domain.Common.Permissions.StaffManage)]
public sealed class RolesController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RoleDto>>> List(CancellationToken ct) =>
        Ok(await sender.Send(new ListRolesQuery(), ct));

    [HttpGet("permissions")]
    public async Task<ActionResult<IReadOnlyList<PermissionCatalogDto>>> ListPermissions(CancellationToken ct) =>
        Ok(await sender.Send(new GetPermissionCatalogQuery(), ct));

    [HttpPost]
    public async Task<ActionResult<Guid>> Create(CreateRoleCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPut("{roleId:guid}/permissions")]
    public async Task<IActionResult> UpdatePermissions(Guid roleId, UpdateRolePermissionsCommand command, CancellationToken ct)
    {
        await sender.Send(command with { RoleId = roleId }, ct);
        return NoContent();
    }
}
