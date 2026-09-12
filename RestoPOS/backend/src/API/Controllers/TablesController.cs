using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestoPOS.Application.Features.Tables;
using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;

namespace RestoPOS.API.Controllers;

[ApiController]
[Route("api/tables")]
[Authorize]
public sealed class TablesController(ISender sender) : ControllerBase
{
    [HttpGet("areas")]
    [Authorize(Policy = Permissions.TablesView)]
    public async Task<ActionResult<IReadOnlyList<DiningAreaDto>>> ListAreas([FromQuery] bool activeOnly = true, CancellationToken ct = default) =>
        Ok(await sender.Send(new ListDiningAreasQuery(activeOnly), ct));

    [HttpGet("areas/{id:guid}")]
    [Authorize(Policy = Permissions.TablesView)]
    public async Task<ActionResult<DiningAreaDto>> GetArea(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new GetDiningAreaByIdQuery(id), ct));

    [HttpPost("areas")]
    [Authorize(Policy = Permissions.TablesManage)]
    public async Task<ActionResult<Guid>> CreateArea(CreateDiningAreaCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPut("areas/{id:guid}")]
    [Authorize(Policy = Permissions.TablesManage)]
    public async Task<IActionResult> UpdateArea(Guid id, UpdateDiningAreaCommand command, CancellationToken ct)
    {
        await sender.Send(command with { Id = id }, ct);
        return NoContent();
    }

    [HttpDelete("areas/{id:guid}")]
    [Authorize(Policy = Permissions.TablesManage)]
    public async Task<IActionResult> DeleteArea(Guid id, CancellationToken ct)
    {
        await sender.Send(new DeleteDiningAreaCommand(id), ct);
        return NoContent();
    }

    [HttpGet]
    [Authorize(Policy = Permissions.TablesView)]
    public async Task<ActionResult<IReadOnlyList<DiningTableDto>>> List([FromQuery] bool activeOnly = true, CancellationToken ct = default) =>
        Ok(await sender.Send(new ListDiningTablesQuery(activeOnly), ct));

    [HttpGet("by-area/{areaId:guid}")]
    [Authorize(Policy = Permissions.TablesView)]
    public async Task<ActionResult<IReadOnlyList<DiningTableDto>>> ByArea(Guid areaId, [FromQuery] bool activeOnly = true, CancellationToken ct = default) =>
        Ok(await sender.Send(new ListTablesByAreaQuery(areaId, activeOnly), ct));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Permissions.TablesView)]
    public async Task<ActionResult<DiningTableDto>> Get(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new GetDiningTableByIdQuery(id), ct));

    [HttpPost]
    [Authorize(Policy = Permissions.TablesManage)]
    public async Task<ActionResult<Guid>> Create(CreateDiningTableCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Permissions.TablesManage)]
    public async Task<IActionResult> Update(Guid id, UpdateDiningTableCommand command, CancellationToken ct)
    {
        await sender.Send(command with { Id = id }, ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Permissions.TablesManage)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await sender.Send(new DeleteDiningTableCommand(id), ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/status")]
    [Authorize(Policy = Permissions.TablesManage)]
    public async Task<ActionResult<DiningTableDto>> UpdateStatus(Guid id, [FromBody] UpdateTableStatusRequest body, CancellationToken ct) =>
        Ok(await sender.Send(new UpdateTableStatusCommand(id, body.Status), ct));

    [HttpPost("transfer")]
    [Authorize(Policy = Permissions.TablesManage)]
    public async Task<IActionResult> Transfer(TransferTableCommand command, CancellationToken ct)
    {
        await sender.Send(command, ct);
        return NoContent();
    }
}

public sealed record UpdateTableStatusRequest(TableStatus Status);
