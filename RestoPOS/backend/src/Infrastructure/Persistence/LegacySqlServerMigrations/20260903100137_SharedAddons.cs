using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestoPOS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SharedAddons : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MenuItemAddons_MenuItems_AddonMenuItemId",
                table: "MenuItemAddons");

            migrationBuilder.RenameColumn(
                name: "AddonMenuItemId",
                table: "MenuItemAddons",
                newName: "AddonId");

            migrationBuilder.RenameIndex(
                name: "IX_MenuItemAddons_AddonMenuItemId",
                table: "MenuItemAddons",
                newName: "IX_MenuItemAddons_AddonId");

            migrationBuilder.AddColumn<Guid>(
                name: "AddonId",
                table: "Recipes",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "MenuItemModifierId",
                table: "OrderItemModifiers",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<Guid>(
                name: "AddonId",
                table: "OrderItemModifiers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Addons",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    ExtraPrice = table.Column<decimal>(type: "decimal(18,0)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    TicketStation = table.Column<int>(type: "int", nullable: false),
                    DisplayPriority = table.Column<int>(type: "int", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Addons", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Recipes_AddonId",
                table: "Recipes",
                column: "AddonId",
                unique: true,
                filter: "[AddonId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Addons_DisplayPriority",
                table: "Addons",
                column: "DisplayPriority");

            migrationBuilder.CreateIndex(
                name: "IX_Addons_IsDeleted",
                table: "Addons",
                column: "IsDeleted");

            migrationBuilder.AddForeignKey(
                name: "FK_MenuItemAddons_Addons_AddonId",
                table: "MenuItemAddons",
                column: "AddonId",
                principalTable: "Addons",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Recipes_Addons_AddonId",
                table: "Recipes",
                column: "AddonId",
                principalTable: "Addons",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MenuItemAddons_Addons_AddonId",
                table: "MenuItemAddons");

            migrationBuilder.DropForeignKey(
                name: "FK_Recipes_Addons_AddonId",
                table: "Recipes");

            migrationBuilder.DropTable(
                name: "Addons");

            migrationBuilder.DropIndex(
                name: "IX_Recipes_AddonId",
                table: "Recipes");

            migrationBuilder.DropColumn(
                name: "AddonId",
                table: "Recipes");

            migrationBuilder.DropColumn(
                name: "AddonId",
                table: "OrderItemModifiers");

            migrationBuilder.RenameColumn(
                name: "AddonId",
                table: "MenuItemAddons",
                newName: "AddonMenuItemId");

            migrationBuilder.RenameIndex(
                name: "IX_MenuItemAddons_AddonId",
                table: "MenuItemAddons",
                newName: "IX_MenuItemAddons_AddonMenuItemId");

            migrationBuilder.AlterColumn<Guid>(
                name: "MenuItemModifierId",
                table: "OrderItemModifiers",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_MenuItemAddons_MenuItems_AddonMenuItemId",
                table: "MenuItemAddons",
                column: "AddonMenuItemId",
                principalTable: "MenuItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
