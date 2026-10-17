using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Features.Menu;
using RestoPOS.Application.Features.Inventory;
using RestoPOS.Common.TestKit;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;

namespace RestoPOS.Infrastructure.Tests;

[Collection(PostgresCollection.Name)]
public sealed class PostgresPersistenceTests(PostgresDatabaseFixture database)
{
    [Fact]
    public async Task Model_matches_the_applied_migrations()
    {
        await using var db = database.CreateDbContext();

        db.Database.HasPendingModelChanges().Should().BeFalse();
    }

    [Fact]
    public async Task Creating_inventory_item_with_opening_stock_persists_item_and_ledger()
    {
        await database.ResetAsync();
        await using (var db = database.CreateDbContext())
        {
            var result = await new CreateInventoryItemCommandHandler(db, new TestCurrentUser()).Handle(
                new CreateInventoryItemCommand(
                    "Inventory smoke test", $"SMOKE-{Guid.NewGuid():N}", "SMOKE-BARCODE", "Test",
                    BaseUnit.Piece, 2, 2, 30, 300, StorageLocation.CentralStorage, null),
                CancellationToken.None);

            result.Succeeded.Should().BeTrue(string.Join("; ", result.Errors));
            result.Value.Should().NotBeEmpty();
        }

        await using var verify = database.CreateDbContext();
        var item = await verify.InventoryItems.Include(x => x.Transactions)
            .SingleAsync(x => x.Name == "Inventory smoke test");
        item.CurrentStock.Should().Be(30);
        item.WeightedAverageCost.Should().Be(300);
        item.Transactions.Should().ContainSingle(x => x.TransactionType == InventoryTransactionType.OpeningBalance);
    }

    private sealed class TestCurrentUser : RestoPOS.Application.Common.Interfaces.ICurrentUserService
    {
        public Guid? UserId => null;
        public string? UserName => "integration-test";
        public IReadOnlyCollection<string> Permissions => [];
        public bool IsAuthenticated => false;
        public string? IpAddress => null;
    }

    [Fact]
    public async Task Soft_deleted_categories_are_filtered_from_normal_queries()
    {
        await database.ResetAsync();
        var id = Guid.NewGuid();

        await using (var db = database.CreateDbContext())
        {
            var category = new CategoryBuilder().Named("retired").SoftDeleted().Build();
            category.Id = id;
            db.Categories.Add(category);
            await db.SaveChangesAsync();
        }

        await using var queryDb = database.CreateDbContext();
        (await queryDb.Categories.AnyAsync(x => x.Id == id)).Should().BeFalse();
        (await queryDb.Categories.IgnoreQueryFilters().AnyAsync(x => x.Id == id)).Should().BeTrue();
    }

    [Fact]
    public async Task Category_foreign_key_rejects_a_missing_parent()
    {
        await database.ResetAsync();
        await using var db = database.CreateDbContext();
        db.Categories.Add(new Category { Name = "orphan", ParentId = Guid.NewGuid() });

        var act = () => db.SaveChangesAsync();

        await act.Should().ThrowAsync<DbUpdateException>();
    }

    [Fact]
    public async Task Category_query_projects_visible_rows_in_display_order()
    {
        await database.ResetAsync();
        await using (var seed = database.CreateDbContext())
        {
            seed.Categories.AddRange(
                new CategoryBuilder().Named("Tea").WithPriority(2).Build(),
                new CategoryBuilder().Named("Coffee").WithPriority(1).Build(),
                new CategoryBuilder().Named("Hidden").WithPriority(0).Hidden().Build());
            await seed.SaveChangesAsync();
        }

        await using var db = database.CreateDbContext();
        var categories = await new GetCategoriesQueryHandler(db).Handle(new GetCategoriesQuery(), CancellationToken.None);

        categories.Select(category => category.Name).Should().Equal("Coffee", "Tea");
    }

    [Fact]
    public async Task Category_soft_delete_index_is_present_in_postgres()
    {
        await using var db = database.CreateDbContext();
        await db.Database.OpenConnectionAsync();
        await using var command = db.Database.GetDbConnection().CreateCommand();
        command.CommandText = "SELECT to_regclass('public.\"IX_Categories_IsDeleted\"') IS NOT NULL";

        (await command.ExecuteScalarAsync()).Should().Be(true);
    }

    [Fact]
    public async Task Resilient_transaction_rolls_back_changes_when_operation_fails()
    {
        await database.ResetAsync();
        var categoryId = Guid.NewGuid();
        await using (var db = database.CreateDbContext())
        {
            var act = () => db.ExecuteResilientTransactionAsync(async cancellationToken =>
            {
                db.Categories.Add(new Category { Id = categoryId, Name = "Must roll back" });
                await db.SaveChangesAsync(cancellationToken);
                throw new InvalidOperationException("force rollback");
            });

            await act.Should().ThrowAsync<InvalidOperationException>();
        }

        await using var verification = database.CreateDbContext();
        (await verification.Categories.AnyAsync(category => category.Id == categoryId)).Should().BeFalse();
    }
}
