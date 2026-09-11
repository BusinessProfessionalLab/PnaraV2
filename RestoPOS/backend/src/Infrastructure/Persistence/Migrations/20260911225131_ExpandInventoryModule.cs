using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestoPOS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ExpandInventoryModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InventoryTransactions_InventoryItems_InventoryItemId",
                table: "InventoryTransactions");

            // --- InventoryItems: preserve data via rename + map BaseUnit ---
            migrationBuilder.RenameColumn(
                name: "AverageCost",
                table: "InventoryItems",
                newName: "WeightedAverageCost");

            migrationBuilder.RenameColumn(
                name: "CostPrice",
                table: "InventoryItems",
                newName: "LastPurchasePrice");

            migrationBuilder.RenameColumn(
                name: "ReorderPoint",
                table: "InventoryItems",
                newName: "MinimumAlertStock");

            migrationBuilder.RenameColumn(
                name: "SafetyStock",
                table: "InventoryItems",
                newName: "OptimalStock");

            migrationBuilder.RenameColumn(
                name: "UnitOfMeasure",
                table: "InventoryItems",
                newName: "BaseUnit");

            migrationBuilder.AlterColumn<decimal>(
                name: "WeightedAverageCost",
                table: "InventoryItems",
                type: "decimal(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,0)");

            migrationBuilder.AlterColumn<decimal>(
                name: "LastPurchasePrice",
                table: "InventoryItems",
                type: "decimal(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,0)");

            migrationBuilder.AlterColumn<decimal>(
                name: "MinimumAlertStock",
                table: "InventoryItems",
                type: "decimal(18,4)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,3)");

            migrationBuilder.AlterColumn<decimal>(
                name: "OptimalStock",
                table: "InventoryItems",
                type: "decimal(18,4)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,3)");

            migrationBuilder.AlterColumn<decimal>(
                name: "CurrentStock",
                table: "InventoryItems",
                type: "decimal(18,4)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,3)");

            // Old UnitOfMeasure: Kg=0,Gr=1,Liter=2,Ml=3,Count=4
            // New BaseUnit: Gram=0,Milliliter=1,Piece=2,Portion=3,Can=4,Kilogram=5,Liter=6
            migrationBuilder.Sql("""
                UPDATE InventoryItems SET BaseUnit = CASE BaseUnit
                    WHEN 0 THEN 5 -- Kg -> Kilogram
                    WHEN 1 THEN 0 -- Gr -> Gram
                    WHEN 2 THEN 6 -- Liter -> Liter
                    WHEN 3 THEN 1 -- Ml -> Milliliter
                    WHEN 4 THEN 2 -- Count -> Piece
                    ELSE 0 END;
                """);

            migrationBuilder.Sql("""
                UPDATE RecipeLines SET Unit = CASE Unit
                    WHEN 0 THEN 5
                    WHEN 1 THEN 0
                    WHEN 2 THEN 6
                    WHEN 3 THEN 1
                    WHEN 4 THEN 2
                    ELSE 0 END;
                """);

            migrationBuilder.AddColumn<int>(
                name: "StorageLocation",
                table: "InventoryItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Barcode",
                table: "InventoryItems",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "InventoryItems",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "InventoryItems",
                type: "rowversion",
                rowVersion: true,
                nullable: false);

            // --- InventoryTransactions: rename + map types ---
            migrationBuilder.RenameColumn(
                name: "Type",
                table: "InventoryTransactions",
                newName: "TransactionType");

            migrationBuilder.RenameColumn(
                name: "StaffId",
                table: "InventoryTransactions",
                newName: "UserId");

            migrationBuilder.RenameColumn(
                name: "OccurredAt",
                table: "InventoryTransactions",
                newName: "CreatedAtUtc");

            migrationBuilder.RenameColumn(
                name: "Quantity",
                table: "InventoryTransactions",
                newName: "QuantityDelta");

            migrationBuilder.RenameColumn(
                name: "UnitCost",
                table: "InventoryTransactions",
                newName: "UnitCostRials");

            migrationBuilder.RenameIndex(
                name: "IX_InventoryTransactions_InventoryItemId_OccurredAt",
                table: "InventoryTransactions",
                newName: "IX_InventoryTransactions_InventoryItemId_CreatedAtUtc");

            migrationBuilder.AlterColumn<decimal>(
                name: "QuantityDelta",
                table: "InventoryTransactions",
                type: "decimal(18,4)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,3)");

            migrationBuilder.AlterColumn<decimal>(
                name: "UnitCostRials",
                table: "InventoryTransactions",
                type: "decimal(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,0)");

            // Old: InboundPurchase=0,Waste=1,RecipeDeduction=2,ReverseDeduction=3,Adjustment=4
            // New: Purchase=0,RecipeDeduction=1,OrderCancelReturn=2,Waste=3,StockCountAdjustment=4,...
            migrationBuilder.Sql("""
                UPDATE InventoryTransactions SET TransactionType = CASE TransactionType
                    WHEN 0 THEN 0 -- Purchase
                    WHEN 1 THEN 3 -- Waste
                    WHEN 2 THEN 1 -- RecipeDeduction
                    WHEN 3 THEN 2 -- OrderCancelReturn
                    WHEN 4 THEN 4 -- StockCountAdjustment
                    ELSE 0 END;
                """);

            migrationBuilder.AddColumn<Guid>(
                name: "ReferenceId",
                table: "InventoryTransactions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE InventoryTransactions
                SET ReferenceId = TRY_CONVERT(uniqueidentifier, Reference)
                WHERE Reference IS NOT NULL AND TRY_CONVERT(uniqueidentifier, Reference) IS NOT NULL;
                """);

            migrationBuilder.DropColumn(
                name: "Reference",
                table: "InventoryTransactions");

            migrationBuilder.AddColumn<int>(
                name: "Location",
                table: "InventoryTransactions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "StockAfter",
                table: "InventoryTransactions",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "StockBefore",
                table: "InventoryTransactions",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AlterColumn<decimal>(
                name: "Quantity",
                table: "RecipeLines",
                type: "decimal(18,4)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,3)");

            migrationBuilder.CreateTable(
                name: "InventoryUnitConversions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InventoryItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UnitName = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    TargetBaseUnit = table.Column<int>(type: "int", nullable: false),
                    FactorToBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InventoryUnitConversions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InventoryUnitConversions_InventoryItems_InventoryItemId",
                        column: x => x.InventoryItemId,
                        principalTable: "InventoryItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InventoryWastes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OccurredAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RecordedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    TotalLossRials = table.Column<decimal>(type: "decimal(18,0)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InventoryWastes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StockCounts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    LocationFilter = table.Column<int>(type: "int", nullable: true),
                    StartedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ApprovedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    StartedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ApprovedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockCounts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StockTransfers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InventoryItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FromLocation = table.Column<int>(type: "int", nullable: false),
                    ToLocation = table.Column<int>(type: "int", nullable: false),
                    QuantityInBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    RequestedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    TransferredByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    RequestedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TransferredAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockTransfers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StockTransfers_InventoryItems_InventoryItemId",
                        column: x => x.InventoryItemId,
                        principalTable: "InventoryItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Suppliers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    ContactPerson = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    CurrentBalanceRials = table.Column<decimal>(type: "decimal(18,0)", nullable: false),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
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
                    table.PrimaryKey("PK_Suppliers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "InventoryWasteItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InventoryWasteId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InventoryItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QuantityInBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Reason = table.Column<int>(type: "int", nullable: false),
                    UnitCostRials = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    LossRials = table.Column<decimal>(type: "decimal(18,0)", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InventoryWasteItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InventoryWasteItems_InventoryItems_InventoryItemId",
                        column: x => x.InventoryItemId,
                        principalTable: "InventoryItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InventoryWasteItems_InventoryWastes_InventoryWasteId",
                        column: x => x.InventoryWasteId,
                        principalTable: "InventoryWastes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StockCountItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StockCountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InventoryItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SystemSnapshotQty = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    PhysicalCountQty = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    CostVarianceRials = table.Column<decimal>(type: "decimal(18,0)", nullable: false),
                    SnapshotUnitCostRials = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockCountItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StockCountItems_InventoryItems_InventoryItemId",
                        column: x => x.InventoryItemId,
                        principalTable: "InventoryItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StockCountItems_StockCounts_StockCountId",
                        column: x => x.StockCountId,
                        principalTable: "StockCounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PurchaseInvoices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InvoiceNumber = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SupplierId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InvoiceDateUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SubtotalRials = table.Column<decimal>(type: "decimal(18,0)", nullable: false),
                    TaxRials = table.Column<decimal>(type: "decimal(18,0)", nullable: false),
                    DiscountRials = table.Column<decimal>(type: "decimal(18,0)", nullable: false),
                    GrandTotalRials = table.Column<decimal>(type: "decimal(18,0)", nullable: false),
                    PaymentStatus = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    ApprovedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ApprovedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PurchaseInvoices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PurchaseInvoices_Suppliers_SupplierId",
                        column: x => x.SupplierId,
                        principalTable: "Suppliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PurchaseInvoiceItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PurchaseInvoiceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InventoryItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Quantity = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    QuantityInBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    PurchaseUnit = table.Column<int>(type: "int", nullable: false),
                    NamedPurchaseUnit = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    UnitPriceRials = table.Column<decimal>(type: "decimal(18,0)", nullable: false),
                    UnitPriceInBaseRials = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    LineDiscountRials = table.Column<decimal>(type: "decimal(18,0)", nullable: false),
                    LineTotalRials = table.Column<decimal>(type: "decimal(18,0)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PurchaseInvoiceItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PurchaseInvoiceItems_InventoryItems_InventoryItemId",
                        column: x => x.InventoryItemId,
                        principalTable: "InventoryItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PurchaseInvoiceItems_PurchaseInvoices_PurchaseInvoiceId",
                        column: x => x.PurchaseInvoiceId,
                        principalTable: "PurchaseInvoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_InventoryTransactions_CreatedAtUtc",
                table: "InventoryTransactions",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryTransactions_ReferenceId",
                table: "InventoryTransactions",
                column: "ReferenceId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryTransactions_TransactionType",
                table: "InventoryTransactions",
                column: "TransactionType");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryItems_Barcode",
                table: "InventoryItems",
                column: "Barcode");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryItems_Category",
                table: "InventoryItems",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryItems_StorageLocation",
                table: "InventoryItems",
                column: "StorageLocation");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryUnitConversions_InventoryItemId_UnitName",
                table: "InventoryUnitConversions",
                columns: new[] { "InventoryItemId", "UnitName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InventoryWasteItems_InventoryItemId",
                table: "InventoryWasteItems",
                column: "InventoryItemId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryWasteItems_InventoryWasteId",
                table: "InventoryWasteItems",
                column: "InventoryWasteId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryWasteItems_Reason",
                table: "InventoryWasteItems",
                column: "Reason");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryWastes_OccurredAtUtc",
                table: "InventoryWastes",
                column: "OccurredAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseInvoiceItems_InventoryItemId",
                table: "PurchaseInvoiceItems",
                column: "InventoryItemId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseInvoiceItems_PurchaseInvoiceId",
                table: "PurchaseInvoiceItems",
                column: "PurchaseInvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseInvoices_CreatedAt",
                table: "PurchaseInvoices",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseInvoices_InvoiceNumber",
                table: "PurchaseInvoices",
                column: "InvoiceNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseInvoices_SupplierId",
                table: "PurchaseInvoices",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_StockCountItems_InventoryItemId",
                table: "StockCountItems",
                column: "InventoryItemId");

            migrationBuilder.CreateIndex(
                name: "IX_StockCountItems_StockCountId_InventoryItemId",
                table: "StockCountItems",
                columns: new[] { "StockCountId", "InventoryItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StockCounts_StartedAtUtc",
                table: "StockCounts",
                column: "StartedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_StockCounts_Status",
                table: "StockCounts",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_StockTransfers_InventoryItemId",
                table: "StockTransfers",
                column: "InventoryItemId");

            migrationBuilder.CreateIndex(
                name: "IX_StockTransfers_RequestedAtUtc",
                table: "StockTransfers",
                column: "RequestedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_StockTransfers_Status",
                table: "StockTransfers",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Suppliers_IsDeleted",
                table: "Suppliers",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_Suppliers_Name",
                table: "Suppliers",
                column: "Name");

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryTransactions_InventoryItems_InventoryItemId",
                table: "InventoryTransactions",
                column: "InventoryItemId",
                principalTable: "InventoryItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InventoryTransactions_InventoryItems_InventoryItemId",
                table: "InventoryTransactions");

            migrationBuilder.DropTable(
                name: "InventoryUnitConversions");

            migrationBuilder.DropTable(
                name: "InventoryWasteItems");

            migrationBuilder.DropTable(
                name: "PurchaseInvoiceItems");

            migrationBuilder.DropTable(
                name: "StockCountItems");

            migrationBuilder.DropTable(
                name: "StockTransfers");

            migrationBuilder.DropTable(
                name: "InventoryWastes");

            migrationBuilder.DropTable(
                name: "PurchaseInvoices");

            migrationBuilder.DropTable(
                name: "StockCounts");

            migrationBuilder.DropTable(
                name: "Suppliers");

            migrationBuilder.DropIndex(
                name: "IX_InventoryTransactions_CreatedAtUtc",
                table: "InventoryTransactions");

            migrationBuilder.DropIndex(
                name: "IX_InventoryTransactions_ReferenceId",
                table: "InventoryTransactions");

            migrationBuilder.DropIndex(
                name: "IX_InventoryTransactions_TransactionType",
                table: "InventoryTransactions");

            migrationBuilder.DropIndex(
                name: "IX_InventoryItems_Barcode",
                table: "InventoryItems");

            migrationBuilder.DropIndex(
                name: "IX_InventoryItems_Category",
                table: "InventoryItems");

            migrationBuilder.DropIndex(
                name: "IX_InventoryItems_StorageLocation",
                table: "InventoryItems");

            migrationBuilder.DropColumn(
                name: "Location",
                table: "InventoryTransactions");

            migrationBuilder.DropColumn(
                name: "QuantityDelta",
                table: "InventoryTransactions");

            migrationBuilder.DropColumn(
                name: "ReferenceId",
                table: "InventoryTransactions");

            migrationBuilder.DropColumn(
                name: "StockAfter",
                table: "InventoryTransactions");

            migrationBuilder.DropColumn(
                name: "StockBefore",
                table: "InventoryTransactions");

            migrationBuilder.DropColumn(
                name: "UnitCostRials",
                table: "InventoryTransactions");

            migrationBuilder.DropColumn(
                name: "Barcode",
                table: "InventoryItems");

            migrationBuilder.DropColumn(
                name: "BaseUnit",
                table: "InventoryItems");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "InventoryItems");

            migrationBuilder.DropColumn(
                name: "LastPurchasePrice",
                table: "InventoryItems");

            migrationBuilder.DropColumn(
                name: "MinimumAlertStock",
                table: "InventoryItems");

            migrationBuilder.DropColumn(
                name: "OptimalStock",
                table: "InventoryItems");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "InventoryItems");

            migrationBuilder.DropColumn(
                name: "WeightedAverageCost",
                table: "InventoryItems");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "InventoryTransactions",
                newName: "StaffId");

            migrationBuilder.RenameColumn(
                name: "TransactionType",
                table: "InventoryTransactions",
                newName: "Type");

            migrationBuilder.RenameColumn(
                name: "CreatedAtUtc",
                table: "InventoryTransactions",
                newName: "OccurredAt");

            migrationBuilder.RenameIndex(
                name: "IX_InventoryTransactions_InventoryItemId_CreatedAtUtc",
                table: "InventoryTransactions",
                newName: "IX_InventoryTransactions_InventoryItemId_OccurredAt");

            migrationBuilder.RenameColumn(
                name: "StorageLocation",
                table: "InventoryItems",
                newName: "UnitOfMeasure");

            migrationBuilder.AlterColumn<decimal>(
                name: "Quantity",
                table: "RecipeLines",
                type: "decimal(18,3)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,4)");

            migrationBuilder.AddColumn<decimal>(
                name: "Quantity",
                table: "InventoryTransactions",
                type: "decimal(18,3)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "Reference",
                table: "InventoryTransactions",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "UnitCost",
                table: "InventoryTransactions",
                type: "decimal(18,0)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AlterColumn<decimal>(
                name: "CurrentStock",
                table: "InventoryItems",
                type: "decimal(18,3)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,4)");

            migrationBuilder.AddColumn<decimal>(
                name: "AverageCost",
                table: "InventoryItems",
                type: "decimal(18,0)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CostPrice",
                table: "InventoryItems",
                type: "decimal(18,0)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ReorderPoint",
                table: "InventoryItems",
                type: "decimal(18,3)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SafetyStock",
                table: "InventoryItems",
                type: "decimal(18,3)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryTransactions_InventoryItems_InventoryItemId",
                table: "InventoryTransactions",
                column: "InventoryItemId",
                principalTable: "InventoryItems",
                principalColumn: "Id");
        }
    }
}
