using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Application.Features.Menu;

public sealed class CreateCategoryCommandValidator : AbstractValidator<CreateCategoryCommand>
{
    public CreateCategoryCommandValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(128);
}

public sealed class CreateCategoryCommandHandler(IApplicationDbContext db) : IRequestHandler<CreateCategoryCommand, Guid>
{
    public async Task<Guid> Handle(CreateCategoryCommand request, CancellationToken cancellationToken)
    {
        var entity = new Category
        {
            Name = request.Name,
            NameEn = request.NameEn,
            DisplayPriority = request.DisplayPriority,
            IsVisible = request.IsVisible,
            IconUrl = request.IconUrl,
            ImageUrl = request.ImageUrl,
            ParentId = request.ParentId
        };
        db.Categories.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return entity.Id;
    }
}

public sealed class UpdateCategoryCommandHandler(IApplicationDbContext db) : IRequestHandler<UpdateCategoryCommand>
{
    public async Task Handle(UpdateCategoryCommand request, CancellationToken cancellationToken)
    {
        var entity = await db.Categories.FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken)
                     ?? throw new NotFoundException(nameof(Category), request.Id);
        entity.Name = request.Name;
        entity.NameEn = request.NameEn;
        entity.DisplayPriority = request.DisplayPriority;
        entity.IsVisible = request.IsVisible;
        entity.IconUrl = request.IconUrl;
        entity.ImageUrl = request.ImageUrl;
        entity.ParentId = request.ParentId;
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class DeleteCategoryCommandHandler(IApplicationDbContext db) : IRequestHandler<DeleteCategoryCommand>
{
    public async Task Handle(DeleteCategoryCommand request, CancellationToken cancellationToken)
    {
        var entity = await db.Categories.FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken)
                     ?? throw new NotFoundException(nameof(Category), request.Id);

        var hasActiveProducts = await db.MenuItems.AnyAsync(
            m => m.CategoryId == request.Id && m.IsActive && !m.IsDeleted, cancellationToken);
        if (hasActiveProducts)
            throw new DomainException("حذف دسته‌بندی با محصولات فعال مجاز نیست.");

        entity.IsDeleted = true;
        entity.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class GetCategoriesQueryHandler(IApplicationDbContext db) : IRequestHandler<GetCategoriesQuery, IReadOnlyList<CategoryDto>>
{
    public async Task<IReadOnlyList<CategoryDto>> Handle(GetCategoriesQuery request, CancellationToken cancellationToken)
    {
        var query = db.Categories.AsNoTracking().AsQueryable();
        if (!request.IncludeHidden)
            query = query.Where(c => c.IsVisible);

        return await query.OrderBy(c => c.DisplayPriority).ThenBy(c => c.Name)
            .Select(c => new CategoryDto(c.Id, c.Name, c.NameEn, c.DisplayPriority, c.IsVisible, c.IconUrl, c.ImageUrl, c.ParentId))
            .ToListAsync(cancellationToken);
    }
}

public sealed class GetCategoryByIdQueryHandler(IApplicationDbContext db) : IRequestHandler<GetCategoryByIdQuery, CategoryDto>
{
    public async Task<CategoryDto> Handle(GetCategoryByIdQuery request, CancellationToken cancellationToken)
    {
        var c = await db.Categories.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.Id, cancellationToken)
                ?? throw new NotFoundException(nameof(Category), request.Id);
        return new CategoryDto(c.Id, c.Name, c.NameEn, c.DisplayPriority, c.IsVisible, c.IconUrl, c.ImageUrl, c.ParentId);
    }
}

public sealed class ReorderCategoriesCommandValidator : AbstractValidator<ReorderCategoriesCommand>
{
    public ReorderCategoriesCommandValidator() => RuleFor(x => x.Items).NotEmpty();
}

public sealed class ReorderCategoriesCommandHandler(IApplicationDbContext db) : IRequestHandler<ReorderCategoriesCommand>
{
    public async Task Handle(ReorderCategoriesCommand request, CancellationToken cancellationToken)
    {
        var ids = request.Items.Select(i => i.Id).ToList();
        var categories = await db.Categories.Where(c => ids.Contains(c.Id)).ToListAsync(cancellationToken);
        if (categories.Count != ids.Count)
            throw new NotFoundException(nameof(Category), "یک یا چند دسته‌بندی یافت نشد.");

        var map = request.Items.ToDictionary(i => i.Id, i => i.DisplayPriority);
        foreach (var category in categories)
            category.DisplayPriority = map[category.Id];

        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class CreateMenuItemCommandValidator : AbstractValidator<CreateMenuItemCommand>
{
    public CreateMenuItemCommandValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.BasePrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.CategoryId).NotEmpty();
    }
}

public sealed class CreateMenuItemCommandHandler(IApplicationDbContext db) : IRequestHandler<CreateMenuItemCommand, Guid>
{
    public async Task<Guid> Handle(CreateMenuItemCommand request, CancellationToken cancellationToken)
    {
        if (!await db.Categories.AnyAsync(c => c.Id == request.CategoryId, cancellationToken))
            throw new NotFoundException(nameof(Category), request.CategoryId);

        var item = new MenuItem
        {
            Title = request.Title,
            Description = request.Description,
            BasePrice = decimal.Round(request.BasePrice, 0, MidpointRounding.AwayFromZero),
            TaxInclusive = request.TaxInclusive,
            ImageUrl = request.ImageUrl,
            DisplayPriority = request.DisplayPriority,
            CategoryId = request.CategoryId,
            IsActive = request.IsActive,
            TicketStation = request.TicketStation,
            PrepTimeMinutes = request.PrepTimeMinutes
        };
        db.MenuItems.Add(item);
        await db.SaveChangesAsync(cancellationToken);
        return item.Id;
    }
}

public sealed class UpdateMenuItemCommandHandler(IApplicationDbContext db) : IRequestHandler<UpdateMenuItemCommand>
{
    public async Task Handle(UpdateMenuItemCommand request, CancellationToken cancellationToken)
    {
        var item = await db.MenuItems.FirstOrDefaultAsync(m => m.Id == request.Id, cancellationToken)
                   ?? throw new NotFoundException(nameof(MenuItem), request.Id);
        item.Title = request.Title;
        item.Description = request.Description;
        item.BasePrice = decimal.Round(request.BasePrice, 0, MidpointRounding.AwayFromZero);
        item.TaxInclusive = request.TaxInclusive;
        item.ImageUrl = request.ImageUrl;
        item.DisplayPriority = request.DisplayPriority;
        item.CategoryId = request.CategoryId;
        item.IsActive = request.IsActive;
        item.TicketStation = request.TicketStation;
        item.PrepTimeMinutes = request.PrepTimeMinutes;
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class DeleteMenuItemCommandHandler(IApplicationDbContext db) : IRequestHandler<DeleteMenuItemCommand>
{
    public async Task Handle(DeleteMenuItemCommand request, CancellationToken cancellationToken)
    {
        var item = await db.MenuItems.FirstOrDefaultAsync(m => m.Id == request.Id, cancellationToken)
                   ?? throw new NotFoundException(nameof(MenuItem), request.Id);
        item.IsDeleted = true;
        item.IsActive = false;
        item.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class ToggleMenuItemSoldOutCommandHandler(IApplicationDbContext db) : IRequestHandler<ToggleMenuItemSoldOutCommand>
{
    public async Task Handle(ToggleMenuItemSoldOutCommand request, CancellationToken cancellationToken)
    {
        var item = await db.MenuItems.FirstOrDefaultAsync(m => m.Id == request.Id, cancellationToken)
                   ?? throw new NotFoundException(nameof(MenuItem), request.Id);
        item.IsSoldOut = request.IsSoldOut;
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class CreateModifierCommandHandler(IApplicationDbContext db) : IRequestHandler<CreateModifierCommand, Guid>
{
    public async Task<Guid> Handle(CreateModifierCommand request, CancellationToken cancellationToken)
    {
        if (!await db.MenuItems.AnyAsync(m => m.Id == request.MenuItemId, cancellationToken))
            throw new NotFoundException(nameof(MenuItem), request.MenuItemId);

        if (request.ModifierGroupId is Guid groupId)
        {
            var group = await db.ModifierGroups.FirstOrDefaultAsync(g => g.Id == groupId, cancellationToken)
                        ?? throw new NotFoundException(nameof(ModifierGroup), groupId);
            if (group.MenuItemId != request.MenuItemId)
                throw new DomainException("گروه افزودنی متعلق به این محصول نیست.");
        }

        var modifier = new MenuItemModifier
        {
            MenuItemId = request.MenuItemId,
            ModifierGroupId = request.ModifierGroupId,
            Name = request.Name,
            ExtraPrice = decimal.Round(request.ExtraPrice, 0, MidpointRounding.AwayFromZero),
            TicketStation = request.TicketStation,
            DisplayPriority = request.DisplayPriority
        };
        db.MenuItemModifiers.Add(modifier);
        await db.SaveChangesAsync(cancellationToken);
        return modifier.Id;
    }
}

public sealed class UpdateModifierCommandHandler(IApplicationDbContext db) : IRequestHandler<UpdateModifierCommand>
{
    public async Task Handle(UpdateModifierCommand request, CancellationToken cancellationToken)
    {
        var modifier = await db.MenuItemModifiers.FirstOrDefaultAsync(m => m.Id == request.Id, cancellationToken)
                       ?? throw new NotFoundException(nameof(MenuItemModifier), request.Id);
        modifier.Name = request.Name;
        modifier.ExtraPrice = decimal.Round(request.ExtraPrice, 0, MidpointRounding.AwayFromZero);
        modifier.TicketStation = request.TicketStation;
        modifier.DisplayPriority = request.DisplayPriority;
        modifier.IsActive = request.IsActive;
        modifier.ModifierGroupId = request.ModifierGroupId;
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class DeleteModifierCommandHandler(IApplicationDbContext db) : IRequestHandler<DeleteModifierCommand>
{
    public async Task Handle(DeleteModifierCommand request, CancellationToken cancellationToken)
    {
        var modifier = await db.MenuItemModifiers.FirstOrDefaultAsync(m => m.Id == request.Id, cancellationToken)
                       ?? throw new NotFoundException(nameof(MenuItemModifier), request.Id);
        modifier.IsDeleted = true;
        modifier.IsActive = false;
        modifier.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class CreateModifierGroupCommandValidator : AbstractValidator<CreateModifierGroupCommand>
{
    public CreateModifierGroupCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(128);
        RuleFor(x => x.MenuItemId).NotEmpty();
        RuleFor(x => x.MinSelections).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MaxSelections).GreaterThanOrEqualTo(x => x.MinSelections);
    }
}

public sealed class CreateModifierGroupCommandHandler(IApplicationDbContext db) : IRequestHandler<CreateModifierGroupCommand, Guid>
{
    public async Task<Guid> Handle(CreateModifierGroupCommand request, CancellationToken cancellationToken)
    {
        if (!await db.MenuItems.AnyAsync(m => m.Id == request.MenuItemId, cancellationToken))
            throw new NotFoundException(nameof(MenuItem), request.MenuItemId);

        var group = new ModifierGroup
        {
            MenuItemId = request.MenuItemId,
            Name = request.Name.Trim(),
            MinSelections = request.MinSelections,
            MaxSelections = request.MaxSelections,
            IsRequired = request.IsRequired,
            DisplayPriority = request.DisplayPriority
        };
        group.EnsureValid();
        db.ModifierGroups.Add(group);
        await db.SaveChangesAsync(cancellationToken);
        return group.Id;
    }
}

public sealed class UpdateModifierGroupCommandHandler(IApplicationDbContext db) : IRequestHandler<UpdateModifierGroupCommand>
{
    public async Task Handle(UpdateModifierGroupCommand request, CancellationToken cancellationToken)
    {
        var group = await db.ModifierGroups.FirstOrDefaultAsync(g => g.Id == request.Id, cancellationToken)
                    ?? throw new NotFoundException(nameof(ModifierGroup), request.Id);
        group.Name = request.Name.Trim();
        group.MinSelections = request.MinSelections;
        group.MaxSelections = request.MaxSelections;
        group.IsRequired = request.IsRequired;
        group.DisplayPriority = request.DisplayPriority;
        group.IsActive = request.IsActive;
        group.EnsureValid();
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class DeleteModifierGroupCommandHandler(IApplicationDbContext db) : IRequestHandler<DeleteModifierGroupCommand>
{
    public async Task Handle(DeleteModifierGroupCommand request, CancellationToken cancellationToken)
    {
        var group = await db.ModifierGroups.FirstOrDefaultAsync(g => g.Id == request.Id, cancellationToken)
                    ?? throw new NotFoundException(nameof(ModifierGroup), request.Id);
        group.IsDeleted = true;
        group.IsActive = false;
        group.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class ListModifierGroupsByProductQueryHandler(IApplicationDbContext db)
    : IRequestHandler<ListModifierGroupsByProductQuery, IReadOnlyList<ModifierGroupDto>>
{
    public async Task<IReadOnlyList<ModifierGroupDto>> Handle(ListModifierGroupsByProductQuery request, CancellationToken cancellationToken)
    {
        var groups = await db.ModifierGroups.AsNoTracking()
            .Include(g => g.Options)
            .Where(g => g.MenuItemId == request.MenuItemId)
            .OrderBy(g => g.DisplayPriority)
            .ToListAsync(cancellationToken);
        return groups.Select(MenuMapping.ToGroupDto).ToList();
    }
}

public sealed class AddOptionToGroupCommandHandler(IApplicationDbContext db) : IRequestHandler<AddOptionToGroupCommand, Guid>
{
    public async Task<Guid> Handle(AddOptionToGroupCommand request, CancellationToken cancellationToken)
    {
        var group = await db.ModifierGroups.FirstOrDefaultAsync(g => g.Id == request.ModifierGroupId, cancellationToken)
                    ?? throw new NotFoundException(nameof(ModifierGroup), request.ModifierGroupId);

        var modifier = new MenuItemModifier
        {
            MenuItemId = group.MenuItemId,
            ModifierGroupId = group.Id,
            Name = request.Name,
            ExtraPrice = decimal.Round(request.ExtraPrice, 0, MidpointRounding.AwayFromZero),
            TicketStation = request.TicketStation,
            DisplayPriority = request.DisplayPriority
        };
        db.MenuItemModifiers.Add(modifier);
        await db.SaveChangesAsync(cancellationToken);
        return modifier.Id;
    }
}

public sealed class UpsertRecipeCommandValidator : AbstractValidator<UpsertRecipeCommand>
{
    public UpsertRecipeCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x).Must(x => x.MenuItemId is not null || x.MenuItemModifierId is not null)
            .WithMessage("رسپی باید به آیتم یا افزودنی وصل شود.");
        RuleForEach(x => x.Lines).ChildRules(l =>
        {
            l.RuleFor(i => i.InventoryItemId).NotEmpty();
            l.RuleFor(i => i.Quantity).GreaterThan(0);
        });
    }
}

public sealed class UpsertRecipeCommandHandler(IApplicationDbContext db) : IRequestHandler<UpsertRecipeCommand, Guid>
{
    public async Task<Guid> Handle(UpsertRecipeCommand request, CancellationToken cancellationToken)
    {
        var recipe = await db.Recipes
            .Include(r => r.Lines)
            .FirstOrDefaultAsync(r =>
                (request.MenuItemId != null && r.MenuItemId == request.MenuItemId) ||
                (request.MenuItemModifierId != null && r.MenuItemModifierId == request.MenuItemModifierId), cancellationToken);

        recipe ??= new Recipe { MenuItemId = request.MenuItemId, MenuItemModifierId = request.MenuItemModifierId };
        recipe.Name = request.Name;
        recipe.ReplaceLines(request.Lines.Select(l => new RecipeLine
        {
            InventoryItemId = l.InventoryItemId,
            Quantity = l.Quantity,
            Unit = l.Unit
        }));

        if (recipe.Id == Guid.Empty || !await db.Recipes.AnyAsync(r => r.Id == recipe.Id, cancellationToken))
            db.Recipes.Add(recipe);

        await db.SaveChangesAsync(cancellationToken);
        return recipe.Id;
    }
}

public sealed class GetRecipeByMenuItemQueryHandler(IApplicationDbContext db) : IRequestHandler<GetRecipeByMenuItemQuery, RecipeDto?>
{
    public async Task<RecipeDto?> Handle(GetRecipeByMenuItemQuery request, CancellationToken cancellationToken)
    {
        var recipe = await db.Recipes.AsNoTracking()
            .Include(r => r.Lines)
            .FirstOrDefaultAsync(r => r.MenuItemId == request.MenuItemId, cancellationToken);
        return recipe is null ? null : MenuMapping.ToRecipeDto(recipe);
    }
}

public sealed class DeleteRecipeCommandHandler(IApplicationDbContext db) : IRequestHandler<DeleteRecipeCommand>
{
    public async Task Handle(DeleteRecipeCommand request, CancellationToken cancellationToken)
    {
        var recipe = await db.Recipes.FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken)
                     ?? throw new NotFoundException(nameof(Recipe), request.Id);
        recipe.IsDeleted = true;
        recipe.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class GetMenuQueryHandler(IApplicationDbContext db) : IRequestHandler<GetMenuQuery, IReadOnlyList<MenuItemDto>>
{
    public async Task<IReadOnlyList<MenuItemDto>> Handle(GetMenuQuery request, CancellationToken cancellationToken)
    {
        var query = db.MenuItems.AsNoTracking()
            .Include(m => m.Category)
            .Include(m => m.Modifiers)
            .Include(m => m.ModifierGroups).ThenInclude(g => g.Options)
            .Include(m => m.Recipe)!.ThenInclude(r => r!.Lines)
            .AsQueryable();

        if (request.ActiveOnly)
            query = query.Where(m => m.IsActive);

        var items = await query.OrderBy(m => m.DisplayPriority).ThenBy(m => m.Title).ToListAsync(cancellationToken);
        return items.Select(MenuMapping.ToDto).ToList();
    }
}

public sealed class GetMenuItemQueryHandler(IApplicationDbContext db) : IRequestHandler<GetMenuItemQuery, MenuItemDto>
{
    public async Task<MenuItemDto> Handle(GetMenuItemQuery request, CancellationToken cancellationToken)
    {
        var item = await db.MenuItems.AsNoTracking()
            .Include(m => m.Category)
            .Include(m => m.Modifiers)
            .Include(m => m.ModifierGroups).ThenInclude(g => g.Options)
            .Include(m => m.Recipe)!.ThenInclude(r => r!.Lines)
            .FirstOrDefaultAsync(m => m.Id == request.Id, cancellationToken)
            ?? throw new NotFoundException(nameof(MenuItem), request.Id);
        return MenuMapping.ToDto(item);
    }
}

internal static class MenuMapping
{
    public static MenuItemDto ToDto(MenuItem m) => new(
        m.Id, m.Title, m.Description, m.BasePrice, m.TaxInclusive, m.ImageUrl, m.DisplayPriority,
        m.CategoryId, m.Category.Name, m.IsActive, m.IsSoldOut, m.TicketStation, m.PrepTimeMinutes,
        m.Modifiers.Where(x => !x.IsDeleted).OrderBy(x => x.DisplayPriority).Select(ToModifierDto).ToList(),
        m.ModifierGroups.Where(g => !g.IsDeleted).OrderBy(g => g.DisplayPriority).Select(ToGroupDto).ToList(),
        m.Recipe is null ? null : ToRecipeDto(m.Recipe));

    public static ModifierGroupDto ToGroupDto(ModifierGroup g) => new(
        g.Id, g.MenuItemId, g.Name, g.MinSelections, g.MaxSelections, g.IsRequired, g.DisplayPriority, g.IsActive,
        g.Options.Where(o => !o.IsDeleted).OrderBy(o => o.DisplayPriority).Select(ToModifierDto).ToList());

    public static ModifierDto ToModifierDto(MenuItemModifier x) =>
        new(x.Id, x.MenuItemId, x.ModifierGroupId, x.Name, x.ExtraPrice, x.IsActive, x.TicketStation, x.DisplayPriority);

    public static RecipeDto ToRecipeDto(Recipe r) =>
        new(r.Id, r.MenuItemId, r.MenuItemModifierId, r.Name,
            r.Lines.Select(l => new RecipeLineDto(l.InventoryItemId, l.Quantity, l.Unit)).ToList());
}
