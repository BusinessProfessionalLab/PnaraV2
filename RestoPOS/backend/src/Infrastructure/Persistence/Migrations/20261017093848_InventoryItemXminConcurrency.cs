using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestoPOS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InventoryItemXminConcurrency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // PostgreSQL maintains xmin itself; the previous bytea RowVersion column was
            // marked as generated but PostgreSQL never populated it, making item inserts fail.
            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "InventoryItems");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "InventoryItems",
                type: "bytea",
                nullable: false,
                defaultValue: Array.Empty<byte>(),
                rowVersion: true);
        }
    }
}
