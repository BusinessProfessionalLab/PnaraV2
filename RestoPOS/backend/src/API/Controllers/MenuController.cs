using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestoPOS.Application.Features.Menu;
using RestoPOS.Domain.Common;

namespace RestoPOS.API.Controllers;

[ApiController]
[Route("api/menu")]
[Authorize]
public sealed class MenuController(ISender sender) : ControllerBase
{
    [HttpGet("categories")]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> Categories([FromQuery] bool includeHidden, CancellationToken ct) =>
        Ok(await sender.Send(new GetCategoriesQuery(includeHidden), ct));

    [HttpPost("categories")]
    [Authorize(Policy = Permissions.MenuManage)]
    public async Task<ActionResult<Guid>> CreateCategory(CreateCategoryCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPut("categories/{id:guid}")]
    [Authorize(Policy = Permissions.MenuManage)]
    public async Task<IActionResult> UpdateCategory(Guid id, UpdateCategoryCommand command, CancellationToken ct)
    {
        await sender.Send(command with { Id = id }, ct);
        return NoContent();
    }

    [HttpDelete("categories/{id:guid}")]
    [Authorize(Policy = Permissions.MenuManage)]
    public async Task<IActionResult> DeleteCategory(Guid id, CancellationToken ct)
    {
        await sender.Send(new DeleteCategoryCommand(id), ct);
        return NoContent();
    }

    [HttpPut("categories/order")]
    [Authorize(Policy = Permissions.MenuManage)]
    public async Task<IActionResult> ReorderCategories(ReorderCategoriesCommand command, CancellationToken ct)
    {
        await sender.Send(command, ct);
        return NoContent();
    }

    [HttpGet("items")]
    public async Task<ActionResult<IReadOnlyList<MenuItemDto>>> Items([FromQuery] bool activeOnly = true, CancellationToken ct = default) =>
        Ok(await sender.Send(new GetMenuQuery(activeOnly), ct));

    [HttpGet("items/{id:guid}")]
    public async Task<ActionResult<MenuItemDto>> Item(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new GetMenuItemQuery(id), ct));

    [HttpPost("items")]
    [Authorize(Policy = Permissions.MenuManage)]
    public async Task<ActionResult<Guid>> CreateItem(CreateMenuItemCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPut("items/{id:guid}")]
    [Authorize(Policy = Permissions.MenuManage)]
    public async Task<IActionResult> UpdateItem(Guid id, UpdateMenuItemCommand command, CancellationToken ct)
    {
        await sender.Send(command with { Id = id }, ct);
        return NoContent();
    }

    [HttpDelete("items/{id:guid}")]
    [Authorize(Policy = Permissions.MenuManage)]
    public async Task<IActionResult> DeleteItem(Guid id, CancellationToken ct)
    {
        await sender.Send(new DeleteMenuItemCommand(id), ct);
        return NoContent();
    }

    [HttpPut("items/order")]
    [Authorize(Policy = Permissions.MenuManage)]
    public async Task<IActionResult> ReorderItems(ReorderMenuItemsCommand command, CancellationToken ct)
    {
        await sender.Send(command, ct);
        return NoContent();
    }

    [HttpPost("modifiers")]
    [Authorize(Policy = Permissions.MenuManage)]
    public async Task<ActionResult<Guid>> CreateModifier(CreateModifierCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPut("modifiers/{id:guid}")]
    [Authorize(Policy = Permissions.MenuManage)]
    public async Task<IActionResult> UpdateModifier(Guid id, UpdateModifierCommand command, CancellationToken ct)
    {
        await sender.Send(command with { Id = id }, ct);
        return NoContent();
    }

    [HttpDelete("modifiers/{id:guid}")]
    [Authorize(Policy = Permissions.MenuManage)]
    public async Task<IActionResult> DeleteModifier(Guid id, CancellationToken ct)
    {
        await sender.Send(new DeleteModifierCommand(id), ct);
        return NoContent();
    }

    [HttpGet("addons")]
    public async Task<ActionResult<IReadOnlyList<AddonDto>>> GetAddons([FromQuery] bool activeOnly = true, CancellationToken ct = default) =>
        Ok(await sender.Send(new GetAddonsQuery(activeOnly), ct));

    [HttpPost("addons")]
    [Authorize(Policy = Permissions.MenuManage)]
    public async Task<ActionResult<Guid>> CreateAddon(CreateAddonCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));

    [HttpPut("addons/{id:guid}")]
    [Authorize(Policy = Permissions.MenuManage)]
    public async Task<IActionResult> UpdateAddon(Guid id, UpdateAddonCommand command, CancellationToken ct)
    {
        await sender.Send(command with { Id = id }, ct);
        return NoContent();
    }

    [HttpDelete("addons/{id:guid}")]
    [Authorize(Policy = Permissions.MenuManage)]
    public async Task<IActionResult> DeleteAddon(Guid id, CancellationToken ct)
    {
        await sender.Send(new DeleteAddonCommand(id), ct);
        return NoContent();
    }

    [HttpPost("items/{menuItemId:guid}/addons/{addonId:guid}")]
    [Authorize(Policy = Permissions.MenuManage)]
    public async Task<IActionResult> AttachAddon(Guid menuItemId, Guid addonId, CancellationToken ct)
    {
        await sender.Send(new AttachAddonCommand(menuItemId, addonId), ct);
        return NoContent();
    }

    [HttpDelete("items/{menuItemId:guid}/addons/{addonId:guid}")]
    [Authorize(Policy = Permissions.MenuManage)]
    public async Task<IActionResult> DetachAddon(Guid menuItemId, Guid addonId, CancellationToken ct)
    {
        await sender.Send(new DetachAddonCommand(menuItemId, addonId), ct);
        return NoContent();
    }

    [HttpPut("recipes")]
    [Authorize(Policy = Permissions.MenuManage)]
    public async Task<ActionResult<Guid>> UpsertRecipe(UpsertRecipeCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));
}
