using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Application.Features.Menu;

public sealed class CreateCategoryCommandValidator : AbstractValidator<CreateCategoryCommand>
{
    public CreateCategoryCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(128);
        RuleFor(x => x.DiscountPercent).InclusiveBetween(0, 100);
    }
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
            DiscountPercent = request.DiscountPercent,
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
        entity.DiscountPercent = request.DiscountPercent;
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
        if (entity.IsSystem)
            throw new DomainException("دسته سیستمی قابل حذف نیست.");
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
            .Select(c => new CategoryDto(c.Id, c.Name, c.NameEn, c.DisplayPriority, c.IsVisible, c.IconUrl, c.ImageUrl, c.ParentId, c.DiscountPercent, c.IsSystem))
            .ToListAsync(cancellationToken);
    }
}

public sealed class CreateMenuItemCommandValidator : AbstractValidator<CreateMenuItemCommand>
{
    public CreateMenuItemCommandValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.BasePrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.CategoryId).NotEmpty();
        RuleFor(x => x.DiscountPercent).InclusiveBetween(0, 100);
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
            NameEn = request.NameEn,
            Description = request.Description,
            BasePrice = decimal.Round(request.BasePrice, 0, MidpointRounding.AwayFromZero),
            TaxInclusive = request.TaxInclusive,
            ImageUrl = request.ImageUrl,
            DisplayPriority = request.DisplayPriority,
            CategoryId = request.CategoryId,
            IsActive = request.IsActive,
            TicketStation = request.TicketStation,
            PrepTimeMinutes = request.PrepTimeMinutes
            ,DiscountPercent = request.DiscountPercent
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
        item.NameEn = request.NameEn;
        item.Description = request.Description;
        item.BasePrice = decimal.Round(request.BasePrice, 0, MidpointRounding.AwayFromZero);
        item.TaxInclusive = request.TaxInclusive;
        item.ImageUrl = request.ImageUrl;
        item.DisplayPriority = request.DisplayPriority;
        item.CategoryId = request.CategoryId;
        item.IsActive = request.IsActive;
        item.TicketStation = request.TicketStation;
        item.PrepTimeMinutes = request.PrepTimeMinutes;
        item.DiscountPercent = request.DiscountPercent;
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

public sealed class CreateModifierCommandHandler(IApplicationDbContext db) : IRequestHandler<CreateModifierCommand, Guid>
{
    public async Task<Guid> Handle(CreateModifierCommand request, CancellationToken cancellationToken)
    {
        if (!await db.MenuItems.AnyAsync(m => m.Id == request.MenuItemId, cancellationToken))
            throw new NotFoundException(nameof(MenuItem), request.MenuItemId);

        var modifier = new MenuItemModifier
        {
            MenuItemId = request.MenuItemId,
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
        var modifier = await db.MenuItemModifiers.FirstOrDefaultAsync(x => x.Id == request.Id, cancellationToken)
            ?? throw new NotFoundException(nameof(MenuItemModifier), request.Id);
        modifier.Name = request.Name;
        modifier.ExtraPrice = decimal.Round(request.ExtraPrice, 0, MidpointRounding.AwayFromZero);
        modifier.TicketStation = request.TicketStation;
        modifier.DisplayPriority = request.DisplayPriority;
        modifier.IsActive = request.IsActive;
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class DeleteModifierCommandHandler(IApplicationDbContext db) : IRequestHandler<DeleteModifierCommand>
{
    public async Task Handle(DeleteModifierCommand request, CancellationToken cancellationToken)
    {
        var modifier = await db.MenuItemModifiers.FirstOrDefaultAsync(x => x.Id == request.Id, cancellationToken)
            ?? throw new NotFoundException(nameof(MenuItemModifier), request.Id);
        modifier.IsDeleted = true;
        modifier.IsActive = false;
        modifier.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class CreateAddonCommandHandler(IApplicationDbContext db) : IRequestHandler<CreateAddonCommand, Guid>
{
    public async Task<Guid> Handle(CreateAddonCommand request, CancellationToken cancellationToken)
    {
        var addon = new Addon { Name = request.Name, ExtraPrice = decimal.Round(request.ExtraPrice, 0, MidpointRounding.AwayFromZero), TicketStation = request.TicketStation, DisplayPriority = request.DisplayPriority };
        db.Addons.Add(addon);
        await db.SaveChangesAsync(cancellationToken);
        return addon.Id;
    }
}

public sealed class UpdateAddonCommandHandler(IApplicationDbContext db) : IRequestHandler<UpdateAddonCommand>
{
    public async Task Handle(UpdateAddonCommand request, CancellationToken cancellationToken)
    {
        var addon = await db.Addons.FirstOrDefaultAsync(x => x.Id == request.Id, cancellationToken) ?? throw new NotFoundException(nameof(Addon), request.Id);
        addon.Name = request.Name;
        addon.ExtraPrice = decimal.Round(request.ExtraPrice, 0, MidpointRounding.AwayFromZero);
        addon.TicketStation = request.TicketStation;
        addon.DisplayPriority = request.DisplayPriority;
        addon.IsActive = request.IsActive;
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class DeleteAddonCommandHandler(IApplicationDbContext db) : IRequestHandler<DeleteAddonCommand>
{
    public async Task Handle(DeleteAddonCommand request, CancellationToken cancellationToken)
    {
        var addon = await db.Addons.FirstOrDefaultAsync(x => x.Id == request.Id, cancellationToken) ?? throw new NotFoundException(nameof(Addon), request.Id);
        addon.IsDeleted = true;
        addon.IsActive = false;
        addon.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class GetAddonsQueryHandler(IApplicationDbContext db) : IRequestHandler<GetAddonsQuery, IReadOnlyList<AddonDto>>
{
    public async Task<IReadOnlyList<AddonDto>> Handle(GetAddonsQuery request, CancellationToken cancellationToken)
    {
        var query = db.Addons.AsNoTracking().Where(x => !x.IsDeleted);
        if (request.ActiveOnly) query = query.Where(x => x.IsActive);
        return await query.OrderBy(x => x.DisplayPriority).ThenBy(x => x.Name)
            .Select(x => new AddonDto(x.Id, x.Name, x.ExtraPrice, x.IsActive, x.TicketStation, x.DisplayPriority))
            .ToListAsync(cancellationToken);
    }
}

public sealed class AttachAddonCommandHandler(IApplicationDbContext db) : IRequestHandler<AttachAddonCommand>
{
    public async Task Handle(AttachAddonCommand request, CancellationToken cancellationToken)
    {
        if (!await db.MenuItems.AnyAsync(x => x.Id == request.MenuItemId, cancellationToken)) throw new NotFoundException(nameof(MenuItem), request.MenuItemId);
        if (!await db.Addons.AnyAsync(x => x.Id == request.AddonId && !x.IsDeleted, cancellationToken)) throw new NotFoundException(nameof(Addon), request.AddonId);
        if (!await db.MenuItemAddons.AnyAsync(x => x.MenuItemId == request.MenuItemId && x.AddonId == request.AddonId, cancellationToken))
        {
            db.MenuItemAddons.Add(new MenuItemAddon { MenuItemId = request.MenuItemId, AddonId = request.AddonId });
            await db.SaveChangesAsync(cancellationToken);
        }
    }
}

public sealed class DetachAddonCommandHandler(IApplicationDbContext db) : IRequestHandler<DetachAddonCommand>
{
    public async Task Handle(DetachAddonCommand request, CancellationToken cancellationToken)
    {
        var link = await db.MenuItemAddons.FirstOrDefaultAsync(x => x.MenuItemId == request.MenuItemId && x.AddonId == request.AddonId, cancellationToken);
        if (link is not null) { db.MenuItemAddons.Remove(link); await db.SaveChangesAsync(cancellationToken); }
    }
}

public sealed class UpsertRecipeCommandValidator : AbstractValidator<UpsertRecipeCommand>
{
    public UpsertRecipeCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x).Must(x => x.MenuItemId is not null || x.MenuItemModifierId is not null || x.AddonId is not null)
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
                (request.MenuItemModifierId != null && r.MenuItemModifierId == request.MenuItemModifierId) ||
                (request.AddonId != null && r.AddonId == request.AddonId), cancellationToken);

        recipe ??= new Recipe { MenuItemId = request.MenuItemId, MenuItemModifierId = request.MenuItemModifierId, AddonId = request.AddonId };
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

public sealed class GetMenuQueryHandler(IApplicationDbContext db) : IRequestHandler<GetMenuQuery, IReadOnlyList<MenuItemDto>>
{
    public async Task<IReadOnlyList<MenuItemDto>> Handle(GetMenuQuery request, CancellationToken cancellationToken)
    {
        var query = db.MenuItems.AsNoTracking()
            .Include(m => m.Category)
            .Include(m => m.Modifiers)
            .Include(m => m.Addons).ThenInclude(a => a.Addon)
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
            .Include(m => m.Addons).ThenInclude(a => a.Addon)
            .Include(m => m.Recipe)!.ThenInclude(r => r!.Lines)
            .FirstOrDefaultAsync(m => m.Id == request.Id, cancellationToken)
            ?? throw new NotFoundException(nameof(MenuItem), request.Id);
        return MenuMapping.ToDto(item);
    }
}

internal static class MenuMapping
{
    public static MenuItemDto ToDto(MenuItem m) => new(
        m.Id, m.Title, m.NameEn, m.Description, m.BasePrice, m.TaxInclusive, m.ImageUrl, m.DisplayPriority,
        m.CategoryId, m.Category.Name, m.IsActive, m.TicketStation, m.PrepTimeMinutes,
        m.Modifiers.Where(x => !x.IsDeleted).OrderBy(x => x.DisplayPriority)
            .Select(x => new ModifierDto(x.Id, x.MenuItemId, x.Name, x.ExtraPrice, x.IsActive, x.TicketStation, x.DisplayPriority)).ToList(),
        m.Recipe is null ? null : new RecipeDto(m.Recipe.Id, m.Recipe.MenuItemId, m.Recipe.MenuItemModifierId, m.Recipe.AddonId, m.Recipe.Name,
            m.Recipe.Lines.Select(l => new RecipeLineDto(l.InventoryItemId, l.Quantity, l.Unit)).ToList()),
        m.DiscountPercent, m.Category.DiscountPercent,
        m.Addons.Where(x => !x.Addon.IsDeleted && x.Addon.IsActive).OrderBy(x => x.Addon.DisplayPriority)
            .Select(x => new MenuItemAddonDto(x.Addon.Id, x.Addon.Name, x.Addon.ExtraPrice, null)).ToList());
}
