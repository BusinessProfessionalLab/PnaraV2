export type OrderType = "DineIn" | "Takeaway" | "Bar";
export type OrderStatus = "Draft" | "Submitted" | "InPreparation" | "Ready" | "Paid" | "Cancelled";
export type TicketStation = "CustomerReceipt" | "Kitchen" | "Bar" | "KitchenAndBar";
export type PaymentChannel = "Cash" | "LocalPC_POS" | "CardToCard" | "OnlineGateway";
export type PaymentStatus = "Pending" | "Authorized" | "Settled" | "Failed" | "Cancelled";
export type UnitOfMeasure = "Kg" | "Gr" | "Liter" | "Ml" | "Count";
export type InventoryTransactionType =
  | "InboundPurchase"
  | "Waste"
  | "RecipeDeduction"
  | "ReverseDeduction"
  | "Adjustment";
export type PosProtocol = "Lan" | "Com" | "Serial";
export type IranianPsp = "Unknown" | "AsanPardakht" | "SamanKish" | "BehpardakhtMellat";

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

export type CategoryDto = {
  id: string;
  name: string;
  nameEn?: string | null;
  displayPriority: number;
  discountPercent: number;
  isVisible: boolean;
  iconUrl?: string | null;
  imageUrl?: string | null;
  parentId?: string | null;
};

export type RecipeLineDto = {
  inventoryItemId: string;
  quantity: number;
  unit: UnitOfMeasure;
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
  name: string;
  extraPrice: number;
  isActive: boolean;
  ticketStation: TicketStation;
  displayPriority: number;
  quantity?: number;
  addonId?: string;
};

export type AddonDto = {
  id: string;
  name: string;
  title?: string;
  extraPrice: number;
  basePrice?: number;
  isActive: boolean;
  ticketStation: TicketStation;
  displayPriority: number;
};

export type MenuItemDto = {
  id: string;
  title: string;
  nameEn?: string | null;
  description?: string | null;
  basePrice: number;
  taxInclusive: boolean;
  imageUrl?: string | null;
  displayPriority: number;
  discountPercent: number;
  categoryDiscountPercent?: number;
  categoryId: string;
  categoryName: string;
  isActive: boolean;
  ticketStation: TicketStation;
  prepTimeMinutes: number;
  modifiers: ModifierDto[];
  recipe?: RecipeDto | null;
  addons?: { id: string; title: string; basePrice: number; imageUrl?: string | null; isSharedAddon?: boolean }[];
};

export type OrderItemModifierDto = {
  id: string;
  menuItemModifierId?: string | null;
  addonId?: string | null;
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
  discountPercent: number;
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
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  notes?: string | null;
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

export type InventoryItemDto = {
  id: string;
  name: string;
  sku: string;
  unitOfMeasure: UnitOfMeasure;
  reorderPoint: number;
  safetyStock: number;
  currentStock: number;
  costPrice: number;
  averageCost: number;
  isActive: boolean;
  isLowStock: boolean;
};

export type InventoryTransactionDto = {
  id: string;
  inventoryItemId: string;
  itemName: string;
  type: InventoryTransactionType;
  quantity: number;
  unitCost: number;
  reference?: string | null;
  notes?: string | null;
  occurredAt: string;
};

export type PosDeviceDto = {
  id: string;
  name: string;
  protocol: PosProtocol;
  psp: IranianPsp;
  ipAddress?: string | null;
  port?: number | null;
  terminalId: string;
  isActive: boolean;
};

export type ShiftDto = {
  id: string;
  staffId: string;
  openedAt: string;
  closedAt?: string | null;
  openingCash: number;
  closingCash?: number | null;
  status: "Open" | "Closed";
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
  reorderPoint: number;
  safetyStock: number;
  deficit: number;
};
