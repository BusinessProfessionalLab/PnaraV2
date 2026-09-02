using RestoPOS.Domain.Enums;

namespace RestoPOS.Application.Features.Menu;

public sealed record CategoryDto(Guid Id, string Name, string? NameEn, int DisplayPriority, bool IsVisible, string? IconUrl, string? ImageUrl, Guid? ParentId, decimal DiscountPercent = 0, bool IsSystem = false);
public sealed record ModifierDto(Guid Id, Guid MenuItemId, string Name, decimal ExtraPrice, bool IsActive, TicketStation TicketStation, int DisplayPriority);
public sealed record RecipeLineDto(Guid InventoryItemId, decimal Quantity, UnitOfMeasure Unit);
public sealed record RecipeDto(Guid Id, Guid? MenuItemId, Guid? MenuItemModifierId, string Name, IReadOnlyList<RecipeLineDto> Lines);
public sealed record MenuItemAddonDto(Guid Id, string Title, decimal BasePrice, string? ImageUrl);
public sealed record MenuItemDto(
    Guid Id,
    string Title,
    string? NameEn,
    string? Description,
    decimal BasePrice,
    bool TaxInclusive,
    string? ImageUrl,
    int DisplayPriority,
    Guid CategoryId,
    string CategoryName,
    bool IsActive,
    TicketStation TicketStation,
    int PrepTimeMinutes,
    IReadOnlyList<ModifierDto> Modifiers,
    RecipeDto? Recipe,
    decimal DiscountPercent = 0,
    decimal CategoryDiscountPercent = 0,
    IReadOnlyList<MenuItemAddonDto>? Addons = null);

public sealed record CreateCategoryCommand(string Name, string? NameEn, int DisplayPriority, bool IsVisible, string? IconUrl, string? ImageUrl, Guid? ParentId, decimal DiscountPercent = 0) : MediatR.IRequest<Guid>;
public sealed record UpdateCategoryCommand(Guid Id, string Name, string? NameEn, int DisplayPriority, bool IsVisible, string? IconUrl, string? ImageUrl, Guid? ParentId, decimal DiscountPercent = 0) : MediatR.IRequest;
public sealed record DeleteCategoryCommand(Guid Id) : MediatR.IRequest;
public sealed record GetCategoriesQuery(bool IncludeHidden = false) : MediatR.IRequest<IReadOnlyList<CategoryDto>>;

public sealed record CreateMenuItemCommand(
    string Title,
    string? Description,
    decimal BasePrice,
    bool TaxInclusive,
    string? ImageUrl,
    int DisplayPriority,
    Guid CategoryId,
    bool IsActive,
    TicketStation TicketStation,
    int PrepTimeMinutes,
    string? NameEn = null,
    decimal DiscountPercent = 0) : MediatR.IRequest<Guid>;

public sealed record UpdateMenuItemCommand(
    Guid Id,
    string Title,
    string? Description,
    decimal BasePrice,
    bool TaxInclusive,
    string? ImageUrl,
    int DisplayPriority,
    Guid CategoryId,
    bool IsActive,
    TicketStation TicketStation,
    int PrepTimeMinutes,
    string? NameEn = null,
    decimal DiscountPercent = 0) : MediatR.IRequest;

public sealed record DeleteMenuItemCommand(Guid Id) : MediatR.IRequest;
public sealed record GetMenuQuery(bool ActiveOnly = true) : MediatR.IRequest<IReadOnlyList<MenuItemDto>>;
public sealed record GetMenuItemQuery(Guid Id) : MediatR.IRequest<MenuItemDto>;

public sealed record CreateModifierCommand(Guid MenuItemId, string Name, decimal ExtraPrice, TicketStation TicketStation, int DisplayPriority) : MediatR.IRequest<Guid>;
public sealed record UpdateModifierCommand(Guid Id, string Name, decimal ExtraPrice, TicketStation TicketStation, int DisplayPriority, bool IsActive) : MediatR.IRequest;
public sealed record DeleteModifierCommand(Guid Id) : MediatR.IRequest;
public sealed record UpsertRecipeCommand(Guid? MenuItemId, Guid? MenuItemModifierId, string Name, IReadOnlyList<RecipeLineDto> Lines) : MediatR.IRequest<Guid>;
