export type OrderType = "DineIn" | "Takeaway" | "Bar";
export type OrderStatus = "Draft" | "Submitted" | "InPreparation" | "Ready" | "Paid" | "Cancelled";
export type TicketStation = "CustomerReceipt" | "Kitchen" | "Bar" | "KitchenAndBar";
export type PaymentChannel = "Cash" | "LocalPC_POS" | "CardToCard" | "OnlineGateway";
export type PaymentStatus = "Pending" | "Authorized" | "Settled" | "Failed" | "Cancelled";
export type BaseUnit = "Gram" | "Milliliter" | "Piece" | "Portion" | "Can" | "Kilogram" | "Liter";
/** @deprecated prefer BaseUnit */
export type UnitOfMeasure = BaseUnit | "Kg" | "Gr" | "Liter" | "Ml" | "Count";
export type StorageLocation = "CentralStorage" | "KitchenLine" | "Bar" | "ColdRoom" | "DryStorage";
export type InventoryTransactionType =
  | "Purchase"
  | "RecipeDeduction"
  | "OrderCancelReturn"
  | "Waste"
  | "StockCountAdjustment"
  | "InternalTransfer"
  | "OpeningBalance"
  | "ManualAdjustment"
  | "InboundPurchase"
  | "ReverseDeduction"
  | "Adjustment";
export type PosProtocol = "Lan" | "Com" | "Serial";
export type IranianPsp = "Unknown" | "AsanPardakht" | "SamanKish" | "BehpardakhtMellat";
export type TimePeriodPreset = "Today" | "Yesterday" | "ThisMonth" | "LastMonth" | "CustomRange";
export type TimelineInterval = "Hourly" | "Daily" | "Weekly";
export type WasteReason = "Expired" | "PreparationDefect" | "Spoilage" | "StaffMeal" | "SpillBreakage";
export type StockCountStatus = "Draft" | "InProgress" | "Completed" | "Approved";
export type StockTransferStatus = "Requested" | "Transferred" | "Cancelled";
export type PurchaseInvoiceStatus = "Draft" | "Approved" | "Cancelled";
export type PurchasePaymentStatus = "Unpaid" | "Partial" | "Paid";
export type TableStatus = "Available" | "Occupied" | "Reserved" | "Cleaning";
export type ShiftStatus = "Open" | "Closed";
export type ReportPaymentMethod = "Cash" | "PosTerminal" | "CardToCard" | "WalletCredit" | "Online";

export type ApiResult<T = unknown> = {
  succeeded: boolean;
  value?: T | null;
  errors?: string[];
};

export type PaginatedList<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type MoneyAmountDto = { rials: number; tomans: number };

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  userId: string;
  userName: string;
  fullName: string;
  roles: string[];
  permissions: string[];
};

export type StaffDto = {
  id: string;
  userName: string;
  fullName: string;
  email?: string | null;
  phoneNumber?: string | null;
  personnelCode?: string | null;
  isActive: boolean;
  roles: string[];
};

export type RoleDto = { id: string; name: string; description?: string | null; permissions: string[] };
export type PermissionCatalogItem = { code: string; displayNameFa: string; module: string };

export type CategoryDto = {
  id: string;
  name: string;
  nameEn?: string | null;
  displayPriority: number;
  isVisible: boolean;
  iconUrl?: string | null;
  imageUrl?: string | null;
  parentId?: string | null;
};

export type RecipeLineDto = {
  inventoryItemId: string;
  quantity: number;
  unit: BaseUnit | UnitOfMeasure;
};

export type RecipeDto = {
  id: string;
  menuItemId?: string | null;
  menuItemModifierId?: string | null;
  name: string;
  lines: RecipeLineDto[];
};

export type ModifierDto = {
  id: string;
  menuItemId: string;
  modifierGroupId?: string | null;
  name: string;
  extraPrice: number;
  isActive: boolean;
  ticketStation: TicketStation;
  displayPriority: number;
};

export type ModifierGroupDto = {
  id: string;
  menuItemId: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  displayPriority: number;
  isActive: boolean;
  options: ModifierDto[];
};

export type MenuItemDto = {
  id: string;
  title: string;
  description?: string | null;
  basePrice: number;
  taxInclusive: boolean;
  imageUrl?: string | null;
  displayPriority: number;
  categoryId: string;
  categoryName: string;
  isActive: boolean;
  isSoldOut?: boolean;
  ticketStation: TicketStation;
  prepTimeMinutes: number;
  modifiers: ModifierDto[];
  modifierGroups?: ModifierGroupDto[];
  recipe?: RecipeDto | null;
};

export type OrderItemModifierDto = {
  id: string;
  menuItemModifierId: string;
  name: string;
  extraPrice: number;
  quantity: number;
  ticketStation: TicketStation;
};

export type OrderItemDto = {
  id: string;
  menuItemId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  ticketStation: TicketStation;
  notes?: string | null;
  modifiers: OrderItemModifierDto[];
};

export type PaymentDto = {
  id: string;
  channel: PaymentChannel;
  status: PaymentStatus;
  amount: number;
  traceNumber?: string | null;
  rrn?: string | null;
  paidAt?: string | null;
};

export type OrderDto = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  orderType: OrderType;
  tableNumber?: string | null;
  customerPhone?: string | null;
  cashierId: string;
  shiftId?: string | null;
  subtotal: number;
  modifiersTotal: number;
  discountAmount: number;
  discountPercent: number;
  serviceChargeAmount?: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  notes?: string | null;
  diningTableId?: string | null;
  createdAt: string;
  createdAtShamsi: string;
  submittedAt?: string | null;
  items: OrderItemDto[];
  payments: PaymentDto[];
  kitchenItems: OrderItemDto[];
  barItems: OrderItemDto[];
};

export type StoreSettingsDto = {
  id: string;
  storeName: string;
  logoUrl?: string | null;
  taxIdentificationNumber?: string | null;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  primaryColor: string;
  secondaryColor: string;
  vatRate: number;
  currencyCode: string;
  loyaltyPointsPerMillionRial: number;
  thermalPrinterHost?: string | null;
  thermalPrinterPort: number;
};

export type CustomerDto = {
  id: string;
  phoneNumber: string;
  fullName?: string | null;
  visitCount: number;
  totalSpent: number;
  loyaltyPoints: number;
  firstVisitAt: string;
  firstVisitShamsi: string;
  lastVisitAt: string;
  lastVisitShamsi: string;
};

export type UnitConversionDto = {
  id: string;
  unitName: string;
  targetBaseUnit: BaseUnit;
  factorToBase: number;
};

export type InventoryItemListDto = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  category?: string | null;
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

/** Back-compat alias used by older UI fields */
export type InventoryItemDto = InventoryItemListDto & {
  unitOfMeasure?: BaseUnit | UnitOfMeasure;
  reorderPoint?: number;
  safetyStock?: number;
  costPrice?: number;
  averageCost?: number;
};

export type InventoryItemDetailDto = InventoryItemListDto & {
  conversions: UnitConversionDto[];
};

export type InventoryTransactionListDto = {
  id: string;
  inventoryItemId: string;
  itemName: string;
  sku: string;
  transactionType: InventoryTransactionType;
  referenceId?: string | null;
  quantityDelta: number;
  stockBefore: number;
  stockAfter: number;
  unitCostRials: number;
  unitCostToman: number;
  userId?: string | null;
  createdAtUtc: string;
  notes?: string | null;
};

export type InventoryTransactionDto = InventoryTransactionListDto & {
  type?: InventoryTransactionType;
  quantity?: number;
  unitCost?: number;
  occurredAt?: string;
};

export type SupplierDto = {
  id: string;
  name: string;
  phone?: string | null;
  contactPerson?: string | null;
  currentBalanceRials: number;
  address?: string | null;
  isActive: boolean;
};

export type PurchaseInvoiceListDto = {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  invoiceDateUtc: string;
  grandTotalRials: number;
  grandTotalToman: number;
  paymentStatus: PurchasePaymentStatus;
  status: PurchaseInvoiceStatus;
};

export type PurchaseInvoiceDetailDto = PurchaseInvoiceListDto & {
  subtotalRials: number;
  taxRials: number;
  discountRials: number;
  notes?: string | null;
  approvedAtUtc?: string | null;
  items: {
    id: string;
    inventoryItemId: string;
    itemName: string;
    sku: string;
    quantity: number;
    quantityInBase: number;
    purchaseUnit: BaseUnit;
    namedPurchaseUnit?: string | null;
    unitPriceRials: number;
    unitPriceInBaseRials: number;
    lineDiscountRials: number;
    lineTotalRials: number;
    lineTotalToman: number;
  }[];
};

export type WasteReportRowDto = {
  wasteId: string;
  wasteItemId: string;
  inventoryItemId: string;
  itemName: string;
  sku: string;
  reason: WasteReason;
  quantityInBase: number;
  unitCostRials: number;
  lossRials: number;
  lossToman: number;
  occurredAtUtc: string;
  notes?: string | null;
};

export type WasteDetailDto = {
  id: string;
  occurredAtUtc: string;
  totalLossRials: number;
  notes?: string | null;
  items: WasteReportRowDto[];
};

export type StockCountListDto = {
  id: string;
  title: string;
  status: StockCountStatus;
  startedAtUtc: string;
  completedAtUtc?: string | null;
  approvedAtUtc?: string | null;
};

export type StockCountDetailDto = {
  id: string;
  title: string;
  status: StockCountStatus;
  locationFilter?: StorageLocation | null;
  startedAtUtc: string;
  completedAtUtc?: string | null;
  approvedAtUtc?: string | null;
  notes?: string | null;
  totalCostVarianceRials: number;
  totalCostVarianceToman: number;
  items: {
    id: string;
    inventoryItemId: string;
    itemName: string;
    sku: string;
    systemSnapshotQty: number;
    physicalCountQty?: number | null;
    discrepancyQty: number;
    costVarianceRials: number;
    costVarianceToman: number;
    snapshotUnitCostRials: number;
  }[];
};

export type StockTransferDto = {
  id: string;
  inventoryItemId: string;
  itemName?: string;
  fromLocation: StorageLocation;
  toLocation: StorageLocation;
  quantityInBase: number;
  status: StockTransferStatus;
  requestedAtUtc: string;
  transferredAtUtc?: string | null;
  notes?: string | null;
};

export type CardexRowDto = {
  id: string;
  transactionType: InventoryTransactionType;
  referenceId?: string | null;
  quantityDelta: number;
  stockBefore: number;
  stockAfter: number;
  unitCostRials: number;
  unitCostToman: number;
  userId?: string | null;
  createdAtUtc: string;
  notes?: string | null;
  location?: StorageLocation | null;
};

export type InventoryValuationDto = {
  grandTotalRials: number;
  grandTotalToman: number;
  byLocation: { groupKey: string; groupLabel: string; totalStock: number; totalValueRials: number; totalValueToman: number; itemCount: number }[];
  byCategory: { groupKey: string; groupLabel: string; totalStock: number; totalValueRials: number; totalValueToman: number; itemCount: number }[];
};

export type PosDeviceDto = {
  id: string;
  name: string;
  protocol: PosProtocol;
  psp: IranianPsp;
  ipAddress?: string | null;
  port?: number | null;
  comPort?: string | null;
  baudRate?: number | null;
  terminalId: string;
  merchantId?: string;
  isActive: boolean;
};

export type ShiftDto = {
  id: string;
  staffId: string;
  openedAt: string;
  closedAt?: string | null;
  openingCash: number;
  closingCash?: number | null;
  status: ShiftStatus;
  notes?: string | null;
};

export type CashDrawerMovementDto = {
  id: string;
  shiftId: string;
  type: "CashDrop" | "PaidOut";
  amountRials: number;
  reason: string;
  occurredAtUtc: string;
};

export type DiningAreaDto = {
  id: string;
  name: string;
  description?: string | null;
  displayPriority: number;
  isActive: boolean;
};

export type DiningTableDto = {
  id: string;
  diningAreaId: string;
  diningAreaName?: string;
  code: string;
  name?: string | null;
  capacity: number;
  status: TableStatus;
  currentOrderId?: string | null;
  displayPriority: number;
  isActive: boolean;
};

export type SalesByProductRow = {
  menuItemId: string;
  title: string;
  categoryId: string;
  categoryName: string;
  quantity: number;
  netSales: number;
};
export type SalesByCategoryRow = {
  categoryId: string;
  categoryName: string;
  quantity: number;
  netSales: number;
};
export type HourlySalesRow = { hour: number; orderCount: number; netSales: number };
export type ProductPerformanceRow = {
  menuItemId: string;
  title: string;
  quantity: number;
  netSales: number;
  band: string;
};
export type StaffPerformanceRow = {
  staffId: string;
  staffName: string;
  orderCount: number;
  netSales: number;
  averageTicket: number;
};
export type StockAlertRow = {
  inventoryItemId: string;
  name: string;
  sku: string;
  currentStock: number;
  reorderPoint?: number;
  safetyStock?: number;
  minimumAlertStock?: number;
  optimalStock?: number;
  deficit: number;
};

export type DashboardSummaryDto = {
  periodLabelFa: string;
  fromUtc: string;
  toUtc: string;
  grossSales: MoneyAmountDto;
  netSales: MoneyAmountDto;
  totalDiscounts: MoneyAmountDto;
  totalVat: MoneyAmountDto;
  averageTicketSize: MoneyAmountDto;
  totalOrders: number;
  paidOrdersCount: number;
  pendingOrdersCount: number;
  cancelledOrdersCount: number;
  comparisonWithPreviousPeriod: {
    grossSalesChangePercent: number;
    netSalesChangePercent: number;
    ordersChangePercent: number;
    averageTicketChangePercent: number;
  };
};

export type SalesTimelineDto = {
  interval: TimelineInterval;
  periodLabelFa: string;
  points: {
    bucketStartUtc: string;
    label: string;
    labelFa: string;
    netSales: MoneyAmountDto;
    grossSales: MoneyAmountDto;
    orderCount: number;
    previousNetSales?: MoneyAmountDto | null;
  }[];
};

export type HourlyHeatmapRowDto = {
  dayOfWeek: number;
  dayOfWeekFa: string;
  hour: number;
  orderCount: number;
  netSales: MoneyAmountDto;
  densityScore: number;
};

export type PaymentBreakdownReportDto = {
  periodLabelFa: string;
  totalSettled: MoneyAmountDto;
  totalPaymentCount: number;
  methods: {
    method: ReportPaymentMethod;
    methodLabelFa: string;
    paymentCount: number;
    amount: MoneyAmountDto;
    percentageShare: number;
  }[];
};

export type TerminalReconciliationDto = {
  terminalId?: string | null;
  psp: IranianPsp;
  pspLabel: string;
  transactionCount: number;
  amount: MoneyAmountDto;
  averageTicket: MoneyAmountDto;
};

export type MenuItemPerformanceReportDto = {
  periodLabelFa: string;
  topSellingItems: {
    rank: number;
    menuItemId: string;
    title: string;
    categoryName: string;
    quantity: number;
    revenue: MoneyAmountDto;
    estimatedCogs: MoneyAmountDto;
    grossProfit: MoneyAmountDto;
    grossMarginPercent: number;
    band: string;
  }[];
  lowestSellingItems: MenuItemPerformanceReportDto["topSellingItems"];
};

export type CategorySalesDetailDto = {
  categoryId: string;
  categoryName: string;
  quantity: number;
  revenue: MoneyAmountDto;
  sharePercent: number;
  items: { menuItemId: string; title: string; quantity: number; revenue: MoneyAmountDto; categorySharePercent: number }[];
};

export type ShiftSummaryReportDto = {
  shiftId: string;
  cashierId: string;
  cashierName: string;
  openedAtUtc: string;
  closedAtUtc?: string | null;
  status: ShiftStatus;
  openingCash: MoneyAmountDto;
  closingCash?: MoneyAmountDto | null;
  expectedCash?: MoneyAmountDto | null;
  cashVariance?: MoneyAmountDto | null;
  grossSales: MoneyAmountDto;
  netSales: MoneyAmountDto;
  paidOrderCount: number;
};

export type ProfitMarginReportDto = {
  periodLabelFa: string;
  totalRevenue: MoneyAmountDto;
  totalCogs: MoneyAmountDto;
  grossProfit: MoneyAmountDto;
  grossMarginPercent: number;
  lines: {
    menuItemId: string;
    title: string;
    categoryName: string;
    quantitySold: number;
    revenue: MoneyAmountDto;
    cogs: MoneyAmountDto;
    grossProfit: MoneyAmountDto;
    grossMarginPercent: number;
  }[];
};
