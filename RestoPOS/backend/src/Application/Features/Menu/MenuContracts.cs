using RestoPOS.Domain.Enums;

namespace RestoPOS.Application.Features.Menu;

public sealed record CategoryDto(Guid Id, string Name, string? NameEn, int DisplayPriority, bool IsVisible, string? IconUrl, string? ImageUrl, Guid? ParentId);

public sealed record ModifierDto(
    Guid Id,
    Guid MenuItemId,
    Guid? ModifierGroupId,
    string Name,
    decimal ExtraPrice,
    bool IsActive,
    TicketStation TicketStation,
    int DisplayPriority);

public sealed record ModifierGroupDto(
    Guid Id,
    Guid MenuItemId,
    string Name,
    int MinSelections,
    int MaxSelections,
    bool IsRequired,
    int DisplayPriority,
    bool IsActive,
    IReadOnlyList<ModifierDto> Options);

public sealed record RecipeLineDto(Guid InventoryItemId, decimal Quantity, BaseUnit Unit);
public sealed record RecipeDto(Guid Id, Guid? MenuItemId, Guid? MenuItemModifierId, string Name, IReadOnlyList<RecipeLineDto> Lines);

public sealed record MenuItemDto(
    Guid Id,
    string Title,
    string? Description,
    decimal BasePrice,
    bool TaxInclusive,
    string? ImageUrl,
    int DisplayPriority,
    Guid CategoryId,
    string CategoryName,
    bool IsActive,
    bool IsSoldOut,
    TicketStation TicketStation,
    int PrepTimeMinutes,
    IReadOnlyList<ModifierDto> Modifiers,
    IReadOnlyList<ModifierGroupDto> ModifierGroups,
    RecipeDto? Recipe);

public sealed record CreateCategoryCommand(string Name, string? NameEn, int DisplayPriority, bool IsVisible, string? IconUrl, string? ImageUrl, Guid? ParentId) : MediatR.IRequest<Guid>;
public sealed record UpdateCategoryCommand(Guid Id, string Name, string? NameEn, int DisplayPriority, bool IsVisible, string? IconUrl, string? ImageUrl, Guid? ParentId) : MediatR.IRequest;
public sealed record DeleteCategoryCommand(Guid Id) : MediatR.IRequest;
public sealed record GetCategoriesQuery(bool IncludeHidden = false) : MediatR.IRequest<IReadOnlyList<CategoryDto>>;
public sealed record GetCategoryByIdQuery(Guid Id) : MediatR.IRequest<CategoryDto>;
public sealed record ReorderCategoriesCommand(IReadOnlyList<CategoryOrderItem> Items) : MediatR.IRequest;
public sealed record CategoryOrderItem(Guid Id, int DisplayPriority);

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
    int PrepTimeMinutes) : MediatR.IRequest<Guid>;

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
    int PrepTimeMinutes) : MediatR.IRequest;

public sealed record DeleteMenuItemCommand(Guid Id) : MediatR.IRequest;
public sealed record ToggleMenuItemSoldOutCommand(Guid Id, bool IsSoldOut) : MediatR.IRequest;
public sealed record GetMenuQuery(bool ActiveOnly = true) : MediatR.IRequest<IReadOnlyList<MenuItemDto>>;
public sealed record GetMenuItemQuery(Guid Id) : MediatR.IRequest<MenuItemDto>;

public sealed record CreateModifierCommand(
    Guid MenuItemId,
    string Name,
    decimal ExtraPrice,
    TicketStation TicketStation,
    int DisplayPriority,
    Guid? ModifierGroupId = null) : MediatR.IRequest<Guid>;

public sealed record UpdateModifierCommand(
    Guid Id,
    string Name,
    decimal ExtraPrice,
    TicketStation TicketStation,
    int DisplayPriority,
    bool IsActive,
    Guid? ModifierGroupId) : MediatR.IRequest;

public sealed record DeleteModifierCommand(Guid Id) : MediatR.IRequest;

public sealed record CreateModifierGroupCommand(
    Guid MenuItemId,
    string Name,
    int MinSelections,
    int MaxSelections,
    bool IsRequired,
    int DisplayPriority) : MediatR.IRequest<Guid>;

public sealed record UpdateModifierGroupCommand(
    Guid Id,
    string Name,
    int MinSelections,
    int MaxSelections,
    bool IsRequired,
    int DisplayPriority,
    bool IsActive) : MediatR.IRequest;

public sealed record DeleteModifierGroupCommand(Guid Id) : MediatR.IRequest;
public sealed record ListModifierGroupsByProductQuery(Guid MenuItemId) : MediatR.IRequest<IReadOnlyList<ModifierGroupDto>>;
public sealed record AddOptionToGroupCommand(Guid ModifierGroupId, string Name, decimal ExtraPrice, TicketStation TicketStation, int DisplayPriority) : MediatR.IRequest<Guid>;

public sealed record UpsertRecipeCommand(Guid? MenuItemId, Guid? MenuItemModifierId, string Name, IReadOnlyList<RecipeLineDto> Lines) : MediatR.IRequest<Guid>;
public sealed record GetRecipeByMenuItemQuery(Guid MenuItemId) : MediatR.IRequest<RecipeDto?>;
public sealed record DeleteRecipeCommand(Guid Id) : MediatR.IRequest;
