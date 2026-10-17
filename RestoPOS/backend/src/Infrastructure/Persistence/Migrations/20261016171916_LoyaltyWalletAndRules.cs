using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestoPOS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LoyaltyWalletAndRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CashbackMaxRials",
                table: "StoreSettings",
                type: "numeric(18,0)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CashbackMinSpendRials",
                table: "StoreSettings",
                type: "numeric(18,0)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CashbackPercent",
                table: "StoreSettings",
                type: "numeric(9,6)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string[]>(
                name: "CashbackProductIds",
                table: "StoreSettings",
                type: "text[]",
                nullable: false,
                defaultValue: new string[0]);

            migrationBuilder.AddColumn<int>(
                name: "LapsedCustomerDays",
                table: "StoreSettings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "LoyaltyEarnAmountRials",
                table: "StoreSettings",
                type: "numeric(18,0)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "LoyaltyEarnMode",
                table: "StoreSettings",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "LoyaltyEarnPercent",
                table: "StoreSettings",
                type: "numeric(9,6)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "LoyaltyEarnPoints",
                table: "StoreSettings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "LoyaltyTierRulesJson",
                table: "StoreSettings",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "RewardDiscountRials",
                table: "StoreSettings",
                type: "numeric(18,0)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "RewardPointsThreshold",
                table: "StoreSettings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "RewardProductName",
                table: "StoreSettings",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "ThankYouSmsEnabled",
                table: "StoreSettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ThankYouSmsTemplate",
                table: "StoreSettings",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "CustomerWalletLedgers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    AmountRials = table.Column<decimal>(type: "numeric(18,0)", nullable: false),
                    BalanceAfterRials = table.Column<decimal>(type: "numeric(18,0)", nullable: false),
                    Type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    OccurredAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomerWalletLedgers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomerWalletLedgers_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CustomerWalletLedgers_CustomerId_OccurredAtUtc",
                table: "CustomerWalletLedgers",
                columns: new[] { "CustomerId", "OccurredAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CustomerWalletLedgers_OrderId",
                table: "CustomerWalletLedgers",
                column: "OrderId",
                unique: true,
                filter: "\"OrderId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CustomerWalletLedgers");

            migrationBuilder.DropColumn(
                name: "CashbackMaxRials",
                table: "StoreSettings");

            migrationBuilder.DropColumn(
                name: "CashbackMinSpendRials",
                table: "StoreSettings");

            migrationBuilder.DropColumn(
                name: "CashbackPercent",
                table: "StoreSettings");

            migrationBuilder.DropColumn(
                name: "CashbackProductIds",
                table: "StoreSettings");

            migrationBuilder.DropColumn(
                name: "LapsedCustomerDays",
                table: "StoreSettings");

            migrationBuilder.DropColumn(
                name: "LoyaltyEarnAmountRials",
                table: "StoreSettings");

            migrationBuilder.DropColumn(
                name: "LoyaltyEarnMode",
                table: "StoreSettings");

            migrationBuilder.DropColumn(
                name: "LoyaltyEarnPercent",
                table: "StoreSettings");

            migrationBuilder.DropColumn(
                name: "LoyaltyEarnPoints",
                table: "StoreSettings");

            migrationBuilder.DropColumn(
                name: "LoyaltyTierRulesJson",
                table: "StoreSettings");

            migrationBuilder.DropColumn(
                name: "RewardDiscountRials",
                table: "StoreSettings");

            migrationBuilder.DropColumn(
                name: "RewardPointsThreshold",
                table: "StoreSettings");

            migrationBuilder.DropColumn(
                name: "RewardProductName",
                table: "StoreSettings");

            migrationBuilder.DropColumn(
                name: "ThankYouSmsEnabled",
                table: "StoreSettings");

            migrationBuilder.DropColumn(
                name: "ThankYouSmsTemplate",
                table: "StoreSettings");
        }
    }
}
