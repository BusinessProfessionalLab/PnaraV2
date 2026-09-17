/**
 * Backend contract types.
 *
 * This file mirrors the ToastIran POS OpenAPI document (v1) one-to-one:
 * enums keep the exact wire values, response DTOs keep the exact nullability
 * the backend serializes, and request payloads are declared next to the
 * service that sends them.
 */

/* ------------------------------- enums --------------------------------- */

export type OrderType = "DineIn" | "Takeaway" | "Bar";
export type OrderStatus = "Draft" | "Submitted" | "InPreparation" | "Ready" | "Paid" | "Cancelled";
export type TicketStation = "CustomerReceipt" | "Kitchen" | "Bar" | "KitchenAndBar";
export type PaymentChannel = "Cash" | "LocalPC_POS" | "CardToCard" | "OnlineGateway";
export type PaymentStatus = "Pending" | "Authorized" | "Settled" | "Failed" | "Cancelled";
export type ReportPaymentMethod = "Cash" | "PosTerminal" | "CardToCard" | "WalletCredit" | "Online";

export type BaseUnit =
  | "Gram"
  | "Milliliter"
  | "Piece"
  | "Portion"
  | "Can"
  | "Kilogram"
  | "Liter";

export type StorageLocation =
  | "CentralStorage"
  | "KitchenLine"
  | "Bar"
  | "ColdRoom"
  | "DryStorage";

export type InventoryTransactionType =
  | "Purchase"
  | "RecipeDeduction"
  | "OrderCancelReturn"
  | "Waste"
  | "StockCountAdjustment"
  | "InternalTransfer"
  | "OpeningBalance"
  | "ManualAdjustment";

export type PurchaseInvoiceStatus = "Draft" | "Approved" | "Cancelled";
export type PurchasePaymentStatus = "Unpaid" | "Partial" | "Paid";
export type WasteReason = "Expired" | "PreparationDefect" | "Spoilage" | "StaffMeal" | "SpillBreakage";
export type StockCountStatus = "Draft" | "InProgress" | "Completed" | "Approved";
export type StockTransferStatus = "Requested" | "Transferred" | "Cancelled";
export type CashDrawerMovementType = "CashDrop" | "PaidOut";

export type TableStatus = "Available" | "Occupied" | "Reserved" | "Cleaning";
export type ShiftStatus = "Open" | "Closed";
export type PosProtocol = "Lan" | "Com" | "Serial";
export type IranianPsp = "Unknown" | "AsanPardakht" | "SamanKish" | "BehpardakhtMellat";

export type TimePeriodPreset = "Today" | "Yesterday" | "ThisMonth" | "LastMonth" | "CustomRange";
export type TimelineInterval = "Hourly" | "Daily" | "Weekly";

/* --------------------------- envelopes --------------------------------- */

/**
 * Backend `Result`/`Result<T>` envelope used by the inventory + menu APIs.
 * `value` is absent on plain `Result` responses.
 */
export type Result<T = void> = {
  succeeded: boolean;
  value?: T | null;
  errors?: string[] | null;
};

/** Shared pagination envelope of every `*PaginatedList` response. */
export type PaginatedList<T> = {
  items?: T[] | null;
  page: number;
  pageSize: number;
  totalCount: number;
  readonly totalPages: number;
};

/* ------------------------------- auth ---------------------------------- */

export type AuthResponse = {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string;
  userId: string;
  userName: string | null;
  fullName: string | null;
  roles: string[] | null;
  permissions: string[] | null;
};

export type RoleDto = {
  id: string;
  name: string | null;
  description: string | null;
  permissions: string[] | null;
};

export type PermissionCatalogDto = {
  code: string | null;
  displayNameFa: string | null;
  module: string | null;
};

export type StaffDto = {
  id: string;
  userName: string | null;
  fullName: string | null;
  email: string | null;
  phoneNumber: string | null;
  personnelCode: string | null;
  isActive: boolean;
  roles: string[] | null;
};

/* ----------------------------- customers -------------------------------- */

export type CustomerDto = {
  id: string;
  phoneNumber: string | null;
  fullName: string | null;
  visitCount: number;
  totalSpent: number;
  loyaltyPoints: number;
  firstVisitAt: string;
  firstVisitShamsi: string | null;
  lastVisitAt: string;
  lastVisitShamsi: string | null;
};

/* -------------------------------- menu ---------------------------------- */

export type CategoryDto = {
  id: string;
  name: string | null;
  nameEn: string | null;
  displayPriority: number;
  isVisible: boolean;
  iconUrl: string | null;
  imageUrl: string | null;
  parentId: string | null;
};

export type RecipeLineDto = {
  inventoryItemId: string;
  quantity: number;
  unit: BaseUnit;
};

export type RecipeDto = {
  id: string;
  menuItemId: string | null;
  menuItemModifierId: string | null;
  name: string | null;
  lines: RecipeLineDto[] | null;
};

export type ModifierDto = {
  id: string;
  menuItemId: string;
  modifierGroupId: string | null;
  name: string | null;
  extraPrice: number;
  isActive: boolean;
  ticketStation: TicketStation;
  displayPriority: number;
};

export type ModifierGroupDto = {
  id: string;
  menuItemId: string;
  name: string | null;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  displayPriority: number;
  isActive: boolean;
  options: ModifierDto[] | null;
};

export type MenuItemDto = {
  id: string;
  title: string | null;
  description: string | null;
  basePrice: number;
  taxInclusive: boolean;
  imageUrl: string | null;
  displayPriority: number;
  categoryId: string;
  categoryName: string | null;
  isActive: boolean;
  isSoldOut: boolean;
  ticketStation: TicketStation;
  prepTimeMinutes: number;
  modifiers: ModifierDto[] | null;
  modifierGroups: ModifierGroupDto[] | null;
  recipe: RecipeDto | null;
};

/* ------------------------------- orders --------------------------------- */

export type PaymentDto = {
  id: string;
  channel: PaymentChannel;
  status: PaymentStatus;
  amount: number;
  traceNumber: string | null;
  rrn: string | null;
  paidAt: string | null;
};

export type OrderItemModifierDto = {
  id: string;
  menuItemModifierId: string | null;
  addonId: string | null;
  name: string | null;
  extraPrice: number;
  quantity: number;
  ticketStation: TicketStation;
};

export type OrderItemDto = {
  id: string;
  menuItemId: string;
  title: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  discountPercent: number;
  ticketStation: TicketStation;
  notes: string | null;
  modifiers: OrderItemModifierDto[] | null;
};

export type OrderDto = {
  id: string;
  orderNumber: string | null;
  status: OrderStatus;
  orderType: OrderType;
  tableNumber: string | null;
  diningTableId: string | null;
  customerPhone: string | null;
  cashierId: string;
  shiftId: string | null;
  subtotal: number;
  modifiersTotal: number;
  discountAmount: number;
  discountPercent: number;
  serviceChargeAmount: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  notes: string | null;
  createdAt: string;
  createdAtShamsi: string | null;
  submittedAt: string | null;
  items: OrderItemDto[] | null;
  payments: PaymentDto[] | null;
  kitchenItems: OrderItemDto[] | null;
  barItems: OrderItemDto[] | null;
};

/* ------------------------------ inventory ------------------------------- */

export type UnitConversionDto = {
  id: string;
  unitName: string | null;
  targetBaseUnit: BaseUnit;
  factorToBase: number;
};

export type InventoryItemListDto = {
  id: string;
  name: string | null;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  baseUnit: BaseUnit;
  currentStock: number;
  minimumAlertStock: number;
  optimalStock: number;
  weightedAverageCostRials: number;
  weightedAverageCostToman: number;
  lastPurchasePriceRials: number;
  lastPurchasePriceToman: number;
  storageLocation: StorageLocation;
  isActive: boolean;
  isLowStock: boolean;
  valuationRials: number;
  valuationToman: number;
};

export type InventoryItemDetailDto = InventoryItemListDto & {
  conversions: UnitConversionDto[] | null;
};

export type InventoryTransactionListDto = {
  id: string;
  inventoryItemId: string;
  itemName: string | null;
  sku: string | null;
  transactionType: InventoryTransactionType;
  referenceId: string | null;
  quantityDelta: number;
  stockBefore: number;
  stockAfter: number;
  unitCostRials: number;
  unitCostToman: number;
  userId: string | null;
  createdAtUtc: string;
  notes: string | null;
};

export type CardexRowDto = {
  id: string;
  transactionType: InventoryTransactionType;
  referenceId: string | null;
  quantityDelta: number;
  stockBefore: number;
  stockAfter: number;
  unitCostRials: number;
  unitCostToman: number;
  userId: string | null;
  createdAtUtc: string;
  notes: string | null;
  location: StorageLocation;
};

export type InventoryValuationGroupDto = {
  groupKey: string | null;
  groupLabel: string | null;
  totalStock: number;
  totalValueRials: number;
  totalValueToman: number;
  itemCount: number;
};

export type InventoryValuationDto = {
  grandTotalRials: number;
  grandTotalToman: number;
  byLocation: InventoryValuationGroupDto[] | null;
  byCategory: InventoryValuationGroupDto[] | null;
};

export type SupplierDto = {
  id: string;
  name: string | null;
  phone: string | null;
  contactPerson: string | null;
  address: string | null;
  currentBalanceRials: number;
  currentBalanceToman: number;
  isActive: boolean;
};

export type PurchaseInvoiceItemDto = {
  id: string;
  inventoryItemId: string;
  itemName: string | null;
  sku: string | null;
  quantity: number;
  quantityInBase: number;
  purchaseUnit: BaseUnit;
  namedPurchaseUnit: string | null;
  unitPriceRials: number;
  unitPriceInBaseRials: number;
  lineDiscountRials: number;
  lineTotalRials: number;
  lineTotalToman: number;
};

export type PurchaseInvoiceListDto = {
  id: string;
  invoiceNumber: string | null;
  supplierId: string;
  supplierName: string | null;
  invoiceDateUtc: string;
  grandTotalRials: number;
  grandTotalToman: number;
  paymentStatus: PurchasePaymentStatus;
  status: PurchaseInvoiceStatus;
};

export type PurchaseInvoiceDetailDto = {
  id: string;
  invoiceNumber: string | null;
  supplierId: string;
  supplierName: string | null;
  invoiceDateUtc: string;
  subtotalRials: number;
  taxRials: number;
  discountRials: number;
  grandTotalRials: number;
  grandTotalToman: number;
  paymentStatus: PurchasePaymentStatus;
  status: PurchaseInvoiceStatus;
  notes: string | null;
  approvedAtUtc: string | null;
  items: PurchaseInvoiceItemDto[] | null;
};

export type WasteReportRowDto = {
  wasteId: string;
  wasteItemId: string;
  inventoryItemId: string;
  itemName: string | null;
  sku: string | null;
  reason: WasteReason;
  quantityInBase: number;
  unitCostRials: number;
  lossRials: number;
  lossToman: number;
  occurredAtUtc: string;
  notes: string | null;
};

export type WasteDetailDto = {
  id: string;
  occurredAtUtc: string;
  recordedByUserId: string | null;
  notes: string | null;
  totalLossRials: number;
  totalLossToman: number;
  items: WasteReportRowDto[] | null;
};

export type StockCountItemDto = {
  id: string;
  inventoryItemId: string;
  itemName: string | null;
  sku: string | null;
  systemSnapshotQty: number;
  physicalCountQty: number | null;
  discrepancyQty: number;
  costVarianceRials: number;
  costVarianceToman: number;
  snapshotUnitCostRials: number;
};

export type StockCountListDto = {
  id: string;
  title: string | null;
  status: StockCountStatus;
  locationFilter: StorageLocation;
  startedAtUtc: string;
  completedAtUtc: string | null;
  approvedAtUtc: string | null;
};

export type StockCountDetailDto = {
  id: string;
  title: string | null;
  status: StockCountStatus;
  locationFilter: StorageLocation;
  startedAtUtc: string;
  completedAtUtc: string | null;
  approvedAtUtc: string | null;
  notes: string | null;
  totalCostVarianceRials: number;
  totalCostVarianceToman: number;
  items: StockCountItemDto[] | null;
};

export type StockTransferDto = {
  id: string;
  inventoryItemId: string;
  itemName: string | null;
  sku: string | null;
  fromLocation: StorageLocation;
  toLocation: StorageLocation;
  quantityInBase: number;
  status: StockTransferStatus;
  requestedAtUtc: string;
  transferredAtUtc: string | null;
  notes: string | null;
};

/* ------------------------------ POS devices ----------------------------- */

export type PosDeviceDto = {
  id: string;
  name: string | null;
  protocol: PosProtocol;
  psp: IranianPsp;
  ipAddress: string | null;
  port: number | null;
  comPort: string | null;
  baudRate: number | null;
  terminalId: string | null;
  merchantId: string | null;
  isActive: boolean;
};

export type PosDeviceTestResult = {
  success: boolean;
  message: string | null;
};

/* -------------------------------- shifts -------------------------------- */

export type CashDrawerMovementDto = {
  id: string;
  type: CashDrawerMovementType;
  amountRials: number;
  reason: string | null;
  occurredAtUtc: string;
  recordedByUserId: string | null;
};

export type ShiftDto = {
  id: string;
  staffId: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number | null;
  status: ShiftStatus;
};

export type ShiftHistoryDto = ShiftDto & {
  expectedCash: number | null;
  notes: string | null;
  movements: CashDrawerMovementDto[] | null;
};

/* -------------------------------- tables -------------------------------- */

export type DiningAreaDto = {
  id: string;
  name: string | null;
  description: string | null;
  displayPriority: number;
  isActive: boolean;
  tableCount: number;
};

export type DiningTableDto = {
  id: string;
  diningAreaId: string;
  areaName: string | null;
  code: string | null;
  name: string | null;
  capacity: number;
  status: TableStatus;
  currentOrderId: string | null;
  displayPriority: number;
  isActive: boolean;
};

/* -------------------------------- reports ------------------------------- */

export type MoneyAmountDto = {
  rials: number;
  tomans: number;
};

export type PeriodComparisonDto = {
  grossSalesChangePercent: number;
  netSalesChangePercent: number;
  ordersChangePercent: number;
  averageTicketChangePercent: number;
  totalVatChangePercent: number;
  totalDiscountsChangePercent: number;
};

export type DashboardSummaryDto = {
  periodLabelFa: string | null;
  fromUtc: string;
  toUtc: string;
  comparisonFromUtc: string;
  comparisonToUtc: string;
  grossSales: MoneyAmountDto;
  netSales: MoneyAmountDto;
  totalDiscounts: MoneyAmountDto;
  totalVat: MoneyAmountDto;
  averageTicketSize: MoneyAmountDto;
  totalOrders: number;
  paidOrdersCount: number;
  pendingOrdersCount: number;
  cancelledOrdersCount: number;
  comparisonWithPreviousPeriod: PeriodComparisonDto;
};

export type SalesTimelinePointDto = {
  bucketStartUtc: string;
  label: string | null;
  labelFa: string | null;
  netSales: MoneyAmountDto;
  grossSales: MoneyAmountDto;
  orderCount: number;
  previousNetSales: MoneyAmountDto;
};

export type SalesTimelineDto = {
  interval: TimelineInterval;
  periodLabelFa: string | null;
  fromUtc: string;
  toUtc: string;
  points: SalesTimelinePointDto[] | null;
};

export type PaymentMethodShareDto = {
  method: ReportPaymentMethod;
  methodLabelFa: string | null;
  paymentCount: number;
  amount: MoneyAmountDto;
  percentageShare: number;
};

export type PaymentBreakdownReportDto = {
  periodLabelFa: string | null;
  fromUtc: string;
  toUtc: string;
  totalSettled: MoneyAmountDto;
  totalPaymentCount: number;
  methods: PaymentMethodShareDto[] | null;
};

export type TerminalReconciliationDto = {
  terminalId: string | null;
  psp: IranianPsp;
  pspLabel: string | null;
  transactionCount: number;
  amount: MoneyAmountDto;
  averageTicket: MoneyAmountDto;
};

export type CategorySalesItemDto = {
  menuItemId: string;
  title: string | null;
  quantity: number;
  revenue: MoneyAmountDto;
  categorySharePercent: number;
};

export type CategorySalesDetailDto = {
  categoryId: string;
  categoryName: string | null;
  quantity: number;
  revenue: MoneyAmountDto;
  sharePercent: number;
  items: CategorySalesItemDto[] | null;
};

export type MenuItemPerformanceRowDto = {
  rank: number;
  menuItemId: string;
  title: string | null;
  categoryId: string;
  categoryName: string | null;
  quantity: number;
  revenue: MoneyAmountDto;
  estimatedCogs: MoneyAmountDto;
  grossProfit: MoneyAmountDto;
  grossMarginPercent: number;
  band: string | null;
};

export type MenuItemPerformanceReportDto = {
  periodLabelFa: string | null;
  fromUtc: string;
  toUtc: string;
  topSellingItems: MenuItemPerformanceRowDto[] | null;
  lowestSellingItems: MenuItemPerformanceRowDto[] | null;
  allItems: MenuItemPerformanceRowDto[] | null;
};

export type ShiftPaymentBreakdownDto = {
  method: ReportPaymentMethod;
  methodLabelFa: string | null;
  amount: MoneyAmountDto;
  count: number;
};

export type ShiftSummaryReportDto = {
  shiftId: string;
  cashierId: string;
  cashierName: string | null;
  openedAtUtc: string;
  closedAtUtc: string | null;
  status: ShiftStatus;
  openingCash: MoneyAmountDto;
  closingCash: MoneyAmountDto;
  expectedCash: MoneyAmountDto;
  cashVariance: MoneyAmountDto;
  grossSales: MoneyAmountDto;
  netSales: MoneyAmountDto;
  paidOrderCount: number;
  paymentsByMethod: ShiftPaymentBreakdownDto[] | null;
  notes: string | null;
};

export type ProfitMarginLineDto = {
  menuItemId: string;
  title: string | null;
  categoryId: string;
  categoryName: string | null;
  quantitySold: number;
  revenue: MoneyAmountDto;
  cogs: MoneyAmountDto;
  grossProfit: MoneyAmountDto;
  grossMarginPercent: number;
};

export type ProfitMarginReportDto = {
  periodLabelFa: string | null;
  fromUtc: string;
  toUtc: string;
  totalRevenue: MoneyAmountDto;
  totalCogs: MoneyAmountDto;
  grossProfit: MoneyAmountDto;
  grossMarginPercent: number;
  lines: ProfitMarginLineDto[] | null;
};

export type SalesByProductRow = {
  menuItemId: string;
  title: string | null;
  categoryId: string;
  categoryName: string | null;
  quantity: number;
  netSales: number;
};

export type SalesByCategoryRow = {
  categoryId: string;
  categoryName: string | null;
  quantity: number;
  netSales: number;
};

export type HourlySalesRow = { hour: number; orderCount: number; netSales: number };

export type ProductPerformanceRow = {
  menuItemId: string;
  title: string | null;
  quantity: number;
  netSales: number;
  band: string | null;
};

export type StaffPerformanceRow = {
  staffId: string;
  staffName: string | null;
  orderCount: number;
  netSales: number;
  averageTicket: number;
};

export type StockAlertRow = {
  inventoryItemId: string;
  name: string | null;
  sku: string | null;
  currentStock: number;
  minimumAlertStock: number;
  optimalStock: number;
  deficit: number;
};

/* ------------------------------- settings ------------------------------- */

export type StoreSettingsDto = {
  id: string;
  storeName: string | null;
  logoUrl: string | null;
  taxIdentificationNumber: string | null;
  receiptHeader: string | null;
  receiptFooter: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  vatRate: number;
  currencyCode: string | null;
  loyaltyPointsPerMillionRial: number;
  thermalPrinterHost: string | null;
  thermalPrinterPort: number;
};
