using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestoPOS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MakeOrderLoyaltyEarningIdempotent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_LoyaltyPointLedgers_OrderId",
                table: "LoyaltyPointLedgers",
                column: "OrderId",
                unique: true,
                filter: "\"OrderId\" IS NOT NULL AND \"Type\" = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LoyaltyPointLedgers_OrderId",
                table: "LoyaltyPointLedgers");
        }
    }
}
