// ===================================
// USER TYPES
// ===================================
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'STAFF' | 'STORE_CASHIER' | 'PRODUCTION' | 'FACTORY_MANAGER'

export interface User {
  id: string
  email: string
  fullName: string
  role: UserRole
  isActive: boolean
  storeId?: string
  canSendToDelivery?: boolean
  createdAt: string
  updatedAt: string
}

// ===================================
// PRODUCT STATUS TYPES
// ===================================
export type ProductStatus =
  // Creation & Validation
  | 'BROUILLON'
  | 'EN_ATTENTE_VALIDATION'
  | 'VALIDE_PRODUCTION'
  | 'REFUSE'
  // Pre-Production
  | 'ANALYSE_TECHNIQUE'
  | 'ECHANTILLONNAGE'
  | 'PRET_LANCEMENT'
  // Production
  | 'EN_PRODUCTION'
  | 'PRODUCTION_SUSPENDUE'
  | 'PRODUCTION_TERMINEE'
  // Quality Control & Logistics
  | 'CONTROLE_QUALITE'
  | 'CONFORME'
  | 'NON_CONFORME'
  | 'EN_PREPARATION_EXPEDITION'
  // Delivery & Stock
  | 'EXPEDIE'
  | 'LIVRE_MAGASIN'
  | 'EN_STOCK_MAGASIN'
  | 'RUPTURE_STOCK'
  // Optional
  | 'ANNULE'
  | 'RETOUR_USINE'
  | 'REPRODUCTION_DEMANDEE'
  | 'ARCHIVE'

export interface ProductStatusInfo {
  code: ProductStatus
  label: string
  color: string
  category: string
}

// ===================================
// ORDER TYPES
// ===================================
export type OrderSource = 'WOOCOMMERCE' | 'WHATSAPP' | 'MANUAL'

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SENT_TO_DELIVERY'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'RETURNED'
  | 'CANCELLED'

export interface Order {
  id: string
  orderNumber: string
  source: OrderSource
  status: OrderStatus

  // Customer info
  customerName: string
  customerPhone: string
  customerCity: string
  customerAddress: string

  // Order details
  products: string
  totalAmount: number
  notes?: string

  // Delivery info
  deliveryCity?: string
  deliverySector?: string
  deliveryTrackingId?: string
  deliveryStatus?: string
  sentToDeliveryAt?: string

  // Exchange info
  isExchange?: boolean
  exchangeForOrderId?: string
  exchangeForOrder?: Order
  exchangeOrders?: Order[]

  // User info
  createdById?: string
  createdBy?: User

  // Timestamps
  createdAt: string
  updatedAt: string
}

// ===================================
// DELIVERY TYPES
// ===================================
export interface DeliveryCity {
  id: number
  cityName: string
  deliveryCompanyId?: number
  active: boolean
  sectors: DeliverySector[]
}

export interface DeliverySector {
  id: number
  sectorName: string
  cityId: number
  deliveryCompanySectorId?: number
}

// ===================================
// API RESPONSE TYPES
// ===================================
export interface ApiResponse<T> {
  data?: T
  error?: {
    message: string
    status: number
  }
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

// ===================================
// FORM TYPES
// ===================================
export interface LoginFormData {
  email: string
  password: string
}

export interface CreateOrderFormData {
  customerName: string
  customerPhone: string
  customerCity: string
  customerAddress: string
  products: string
  totalAmount: number
  notes?: string
  source: OrderSource
}
