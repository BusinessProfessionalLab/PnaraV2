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
