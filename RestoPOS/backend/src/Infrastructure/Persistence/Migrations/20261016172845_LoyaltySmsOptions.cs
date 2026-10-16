using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestoPOS.Infrastructure.Persistence.Migrations;

public partial class LoyaltySmsOptions : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "LoyaltySmsEnabled",
            table: "StoreSettings",
            type: "boolean",
            nullable: false,
            defaultValue: false);
        migrationBuilder.AddColumn<string>(
            name: "SmsQuietHoursStart",
            table: "StoreSettings",
            type: "character varying(5)",
            maxLength: 5,
            nullable: false,
            defaultValue: "21:00");
        migrationBuilder.AddColumn<string>(
            name: "SmsQuietHoursEnd",
            table: "StoreSettings",
            type: "character varying(5)",
            maxLength: 5,
            nullable: false,
            defaultValue: "09:00");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "LoyaltySmsEnabled", table: "StoreSettings");
        migrationBuilder.DropColumn(name: "SmsQuietHoursStart", table: "StoreSettings");
        migrationBuilder.DropColumn(name: "SmsQuietHoursEnd", table: "StoreSettings");
    }
}
