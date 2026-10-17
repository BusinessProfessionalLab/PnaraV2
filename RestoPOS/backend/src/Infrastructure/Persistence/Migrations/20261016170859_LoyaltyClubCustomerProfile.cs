using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestoPOS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LoyaltyClubCustomerProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CustomerName",
                table: "Orders",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "BirthDate",
                table: "Customers",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string[]>(
                name: "FavoriteProducts",
                table: "Customers",
                type: "text[]",
                nullable: false,
                defaultValue: new string[0]);

            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "Customers",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "MarketingConsent",
                table: "Customers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "MarketingConsentUpdatedAtUtc",
                table: "Customers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "Customers",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PersonalityType",
                table: "Customers",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RegistrationSource",
                table: "Customers",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string[]>(
                name: "Tags",
                table: "Customers",
                type: "text[]",
                nullable: false,
                defaultValue: new string[0]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.DropColumn(
                name: "CustomerName",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "BirthDate",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "FavoriteProducts",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "Gender",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "MarketingConsent",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "MarketingConsentUpdatedAtUtc",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "PersonalityType",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "RegistrationSource",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "Tags",
                table: "Customers");
        }
    }
}
