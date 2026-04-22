// ERP domain types – system-agnostic, used by all connectors

export interface Customer {
  id: string;
  externalId: string;
  tenantId: string;
  customerNumber: string;
  name: string;
  name2?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  taxNumber?: string;
  vatId?: string;
  currency: string;
  paymentTerms?: string;
  creditLimit?: number;
  salesRepId?: string;
  priceGroup?: string;
  addresses: Address[];
  isActive: boolean;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  id: string;
  type: "billing" | "shipping" | "both";
  street: string;
  streetNumber?: string;
  zip: string;
  city: string;
  countryCode: string;
  state?: string;
  additionalLine?: string;
  isDefault: boolean;
  contactName?: string;
  contactPhone?: string;
}

export interface Product {
  id: string;
  externalId: string;
  tenantId: string;
  articleNumber: string;
  ean?: string;
  designation: string;
  description?: string;
  manufacturer?: string;
  manufacturerArticleNumber?: string;
  category?: string;
  unit: string;
  basePrice: number;
  currency: string;
  taxClass: string;
  weight?: number;
  stockInfo?: StockInfo;
  isActive: boolean;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockInfo {
  productId: string;
  warehouseId: string;
  warehouseName: string;
  available: number;
  reserved: number;
  onOrder: number;
  total: number;
  unit: string;
  updatedAt: string;
}

export interface PriceInfo {
  productId: string;
  customerId?: string;
  priceGroup?: string;
  quantity: number;
  netPrice: number;
  grossPrice: number;
  discount?: number;
  currency: string;
  validFrom?: string;
  validTo?: string;
}

export interface QuoteLineItem {
  position: number;
  productId: string;
  articleNumber: string;
  designation: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  discount?: number;
  netTotal: number;
  grossTotal: number;
  currency: string;
  deliveryDate?: string;
  notes?: string;
}

export interface QuoteDraft {
  id: string;
  tenantId: string;
  userId: string;
  customerId: string;
  customerNumber: string;
  customerName: string;
  deliveryAddressId?: string;
  deliveryAddress?: Address;
  currency: string;
  validUntil?: string;
  lineItems: QuoteLineItem[];
  notes?: string;
  totalNet: number;
  totalGross: number;
  status: "draft" | "submitted" | "confirmed" | "rejected" | "expired";
  erpQuoteNumber?: string;
  erpQuoteId?: string;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUpTask {
  id: string;
  tenantId: string;
  userId: string;
  assignedToId?: string;
  relatedQuoteId?: string;
  relatedCustomerId?: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "done" | "cancelled";
  erpTaskId?: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  tenantId: string;
  userId: string;
  customerId?: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  location?: string;
  attendees?: string[];
  erpAppointmentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  tenantId: string;
  userId: string;
  customerId?: string;
  productId?: string;
  quoteId?: string;
  content: string;
  tags?: string[];
  erpNoteId?: string;
  createdAt: string;
  updatedAt: string;
}
