using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestoPOS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LoyaltySmsCampaignQueue : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LoyaltySmsCampaigns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Body = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    QueuedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ScheduledAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AttributionWindowDays = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoyaltySmsCampaigns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LoyaltySmsMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    PhoneNumber = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Body = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Status = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    AttemptCount = table.Column<int>(type: "integer", nullable: false),
                    NextAttemptAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SentAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ProviderMessageId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    LastError = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    DeliveredAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoyaltySmsMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LoyaltySmsMessages_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LoyaltySmsMessages_LoyaltySmsCampaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalTable: "LoyaltySmsCampaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LoyaltySmsCampaigns_QueuedAtUtc",
                table: "LoyaltySmsCampaigns",
                column: "QueuedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_LoyaltySmsMessages_CampaignId_CustomerId",
                table: "LoyaltySmsMessages",
                columns: new[] { "CampaignId", "CustomerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LoyaltySmsMessages_CustomerId",
                table: "LoyaltySmsMessages",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_LoyaltySmsMessages_Status_NextAttemptAtUtc",
                table: "LoyaltySmsMessages",
                columns: new[] { "Status", "NextAttemptAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LoyaltySmsMessages");

            migrationBuilder.DropTable(
                name: "LoyaltySmsCampaigns");
        }
    }
}
