using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestoPOS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LoyaltyRewards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsTransactional",
                table: "LoyaltySmsMessages",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "LoyaltyRewards",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    PointsCost = table.Column<int>(type: "integer", nullable: false),
                    DiscountRials = table.Column<decimal>(type: "numeric(18,0)", nullable: false),
                    DiscountPercent = table.Column<decimal>(type: "numeric(9,6)", nullable: false),
                    MaxDiscountRials = table.Column<decimal>(type: "numeric(18,0)", nullable: false),
                    ProductName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoyaltyRewards", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LoyaltyRewards_IsActive_PointsCost",
                table: "LoyaltyRewards",
                columns: new[] { "IsActive", "PointsCost" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LoyaltyRewards");

            migrationBuilder.DropColumn(
                name: "IsTransactional",
                table: "LoyaltySmsMessages");
        }
    }
}
