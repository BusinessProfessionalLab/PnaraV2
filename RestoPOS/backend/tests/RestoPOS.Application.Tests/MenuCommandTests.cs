using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Application.Features.Menu;
using RestoPOS.Domain.Entities;

namespace RestoPOS.Application.Tests;

public sealed class MenuCommandTests
{
    [Fact]
    public async Task Create_category_passes_the_entity_to_the_context_and_forwards_cancellation()
    {
        var db = Substitute.For<IApplicationDbContext>();
        var categories = Substitute.For<DbSet<Category>>();
        Category? added = null;
        categories.Add(Arg.Do<Category>(category => added = category))
            .Returns((Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry<Category>)null!);
        db.Categories.Returns(categories);
        var cancellationToken = new CancellationTokenSource().Token;
        db.SaveChangesAsync(cancellationToken).Returns(1);
        var handler = new CreateCategoryCommandHandler(db);

        var id = await handler.Handle(new CreateCategoryCommand("Coffee", "Coffee", 2, true, null, null, null), cancellationToken);

        added.Should().NotBeNull();
        added!.Id.Should().Be(id);
        added.Name.Should().Be("Coffee");
        await db.Received(1).SaveChangesAsync(cancellationToken);
    }

    [Theory]
    [InlineData("", 0)]
    [InlineData("Valid", -0.01)]
    [InlineData("Valid", 100.01)]
    public async Task Create_category_validator_rejects_invalid_input(string name, decimal discountPercent)
    {
        var result = await new CreateCategoryCommandValidator().ValidateAsync(
            new CreateCategoryCommand(name, null, 0, true, null, null, null, discountPercent),
            CancellationToken.None);

        result.IsValid.Should().BeFalse();
    }
}
