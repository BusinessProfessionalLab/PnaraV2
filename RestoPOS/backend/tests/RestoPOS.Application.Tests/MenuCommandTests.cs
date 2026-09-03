using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Application.Features.Menu;
using RestoPOS.Domain.Entities;
using RestoPOS.Infrastructure.Persistence;

namespace RestoPOS.Application.Tests;

public class MenuCommandTests
{
    [Fact]
    public async Task CreateCategory_persists_entity()
    {
        var db = CreateDb();
        var handler = new CreateCategoryCommandHandler(db);

        var id = await handler.Handle(new CreateCategoryCommand("قهوه", "Coffee", 1, true, null, null, null), CancellationToken.None);

        var stored = await db.Categories.SingleAsync();
        stored.Id.Should().Be(id);
        stored.Name.Should().Be("قهوه");
    }

    [Fact]
    public async Task CreateMenuItem_requires_existing_category()
    {
        var db = CreateDb();
        var handler = new CreateMenuItemCommandHandler(db);
        var act = () => handler.Handle(new CreateMenuItemCommand("لاته", null, 180000, false, null, 1, Guid.NewGuid(), true, Domain.Enums.TicketStation.Bar, 4), CancellationToken.None);
        await act.Should().ThrowAsync<Domain.Exceptions.NotFoundException>();
    }

    [Fact]
    public async Task ReorderCategories_updates_existing_hidden_categories()
    {
        var db = CreateDb();
        var first = new Category { Name = "قدیمی", DisplayPriority = 1, IsVisible = false };
        var second = new Category { Name = "جدید", DisplayPriority = 2, IsVisible = true };
        db.Categories.AddRange(first, second);
        await db.SaveChangesAsync();

        var handler = new ReorderCategoriesCommandHandler(db);
        await handler.Handle(new ReorderCategoriesCommand([second.Id, first.Id]), CancellationToken.None);

        first.DisplayPriority.Should().Be(2);
        second.DisplayPriority.Should().Be(1);
    }

    [Fact]
    public async Task ReorderMenuItems_updates_inactive_items_inside_category()
    {
        var db = CreateDb();
        var category = new Category { Name = "نوشیدنی", DisplayPriority = 1, IsVisible = true };
        var oldItem = new MenuItem { Title = "قدیمی", Category = category, DisplayPriority = 1, IsActive = false };
        var newItem = new MenuItem { Title = "جدید", Category = category, DisplayPriority = 2, IsActive = true };
        db.MenuItems.AddRange(oldItem, newItem);
        await db.SaveChangesAsync();

        var handler = new ReorderMenuItemsCommandHandler(db);
        await handler.Handle(
            new ReorderMenuItemsCommand(category.Id, [newItem.Id, oldItem.Id]),
            CancellationToken.None);

        oldItem.DisplayPriority.Should().Be(2);
        newItem.DisplayPriority.Should().Be(1);
    }

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var current = new Mock<ICurrentUserService>();
        current.SetupGet(c => c.UserId).Returns(Guid.NewGuid());
        return new ApplicationDbContext(options, current.Object, new NoOpDomainEventDispatcher());
    }
}
