export type PaymentMethod = "cash" | "pix" | "card" | "fiado";

export type Product = {
  id?: string;
  internalCode: string;
  eanCode?: string;
  name: string;
  category: string;
  unitType: string;
  costPrice: number;
  marginCash: number;
  priceCash: number;
  marginCard: number;
  priceCard: number;
  active: boolean;
  createdAt?: string;
};

export type Customer = {
  id?: string;
  code?: string;
  name: string;
  cpf?: string;
  phone?: string;
  whatsapp?: string;
  cep?: string;
  address?: string;
  district?: string;
  city?: string;
  creditLimit?: number;
  availableCredit?: number;
  blocked?: boolean;
  active: boolean;
  createdAt?: string;
};

export type Operator = {
  id?: string;
  name: string;
  username: string;
  password: string;
  active: boolean;
  createdAt?: string;
};

export type CompanySettings = {
  id?: string;
  companyName: string;
  companyAddress: string;
  companyCnpj: string;
  companyPhone: string;
  logoUrl?: string;
  reportsPassword?: string;
  adminPassword?: string;
  updatedAt?: string;
};

export type Sale = {
  id?: string;
  saleNumber: number;
  customerId: string;
  customerName: string;
  operatorId: string;
  operatorName: string;
  paymentMethod: PaymentMethod;
  priceMode: "cash" | "card";
  subtotal: number;
  total: number;
  createdAt: string;
  remainingCustomerCredit?: number | null;
  cardType?: "debit" | "credit" | "";
  amountReceived?: number | null;
  changeAmount?: number | null;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    internalCode: string;
    eanCode?: string;
    unitType: string;
  }>;
};

export type CashSession = {
  id?: string;
  operatorId: string;
  operatorName: string;
  openedAt: string;
  openingAmount: number;
  status: "open" | "closed";
  closedAt?: string | null;
  closingNotes?: string;
  expectedCashAmount?: number | null;
  totalSalesCash?: number;
  totalSalesPix?: number;
  totalSalesCard?: number;
  totalSalesFiado?: number;
  totalWithdrawals?: number;
  trayAmount?: number | null;
  differenceAmount?: number | null;
  differenceType?: "matched" | "short" | "over" | null;
};

export type CashMovement = {
  id?: string;
  sessionId: string;
  operatorId: string;
  operatorName: string;
  type: "opening" | "withdrawal" | "adjustment";
  amount: number;
  reason: string;
  createdAt: string;
};

export type CashClosureReport = {
  openingAmount: number;
  totalSalesCash: number;
  totalSalesPix: number;
  totalSalesCard: number;
  totalSalesFiado: number;
  totalWithdrawals: number;
  expectedCashAmount: number;
  trayAmount?: number | null;
  differenceAmount?: number | null;
  differenceType?: "matched" | "short" | "over" | null;
};

export type CanceledCoupon = {
  id?: string;
  operationId: string;
  operatorId: string;
  operatorName: string;
  customerId?: string;
  customerName?: string;
  reason: string;
  total: number;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    internalCode: string;
    eanCode?: string;
    unitType: string;
  }>;
  createdAt: string;
};

export type CanceledItem = {
  id?: string;
  operationId: string;
  operatorId: string;
  operatorName: string;
  customerId?: string;
  customerName?: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  internalCode: string;
  eanCode?: string;
  unitType: string;
  reason: string;
  createdAt: string;
};