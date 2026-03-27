// ============================================================
// ATLAS DENIM — Demo Data
// All data is fake. Used for sales demo purposes only.
// ============================================================

// ── Helpers ─────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date('2026-03-27T12:00:00Z')
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function jeansVariations(startId: number) {
  const sizes = ['28', '30', '32', '34', '36', '38', '40']
  const lengths = ['30', '32', '34']
  const result: { id: number; size: string; length: string }[] = []
  let id = startId
  for (const size of sizes) {
    for (const length of lengths) {
      result.push({ id: id++, size, length })
    }
  }
  return result // 21 variations
}

function vestesVariations(startId: number) {
  const sizes = ['S', 'M', 'L', 'XL', '2XL']
  return sizes.map((size, i) => ({ id: startId + i, size, length: '' }))
}

// ── Stores ──────────────────────────────────────────────────

export const STORES = [
  {
    id: 'store-1',
    name: 'Casablanca Centre',
    slug: 'casablanca-centre',
    city: 'Casablanca',
    isActive: true,
    phone: '0522123456',
    createdAt: daysAgo(365),
  },
  {
    id: 'store-2',
    name: 'Rabat Agdal',
    slug: 'rabat-agdal',
    city: 'Rabat',
    isActive: true,
    phone: '0537654321',
    createdAt: daysAgo(300),
  },
]

// ── Products ─────────────────────────────────────────────────

const JEANS_VARS_1 = jeansVariations(1)    // ids 1-21
const JEANS_VARS_2 = jeansVariations(22)   // ids 22-42
const JEANS_VARS_3 = jeansVariations(43)   // ids 43-63
const JEANS_VARS_4 = jeansVariations(64)   // ids 64-84
const VESTE_VARS_1 = vestesVariations(85)  // ids 85-89
const VESTE_VARS_2 = vestesVariations(90)  // ids 90-94
const ENSEMBLE_VARS = vestesVariations(95) // ids 95-99

export const PRODUCTS = [
  { id: 1,  name: 'SLIM NOIR',           shortCode: 'SL-NOI', category: 'Jeans',       isManual: false, variations: JEANS_VARS_1, createdAt: daysAgo(200) },
  { id: 2,  name: 'BAGGY BLEACH',        shortCode: 'BG-BLE', category: 'Jeans',       isManual: false, variations: JEANS_VARS_2, createdAt: daysAgo(200) },
  { id: 3,  name: 'REGULAR INDIGO',      shortCode: 'RG-IND', category: 'Jeans',       isManual: false, variations: JEANS_VARS_3, createdAt: daysAgo(180) },
  { id: 4,  name: 'SKINNY DESTROY',      shortCode: 'SK-DES', category: 'Jeans',       isManual: false, variations: JEANS_VARS_4, createdAt: daysAgo(150) },
  { id: 5,  name: 'VESTE CARGO KAKI',    shortCode: 'VT-KAK', category: 'Vestes',      isManual: false, variations: VESTE_VARS_1, createdAt: daysAgo(180) },
  { id: 6,  name: 'VESTE DENIM BLEUE',   shortCode: 'VT-BLE', category: 'Vestes',      isManual: false, variations: VESTE_VARS_2, createdAt: daysAgo(160) },
  { id: 7,  name: 'ENSEMBLE SPORT NOIR', shortCode: 'EN-NOI', category: 'Ensembles',   isManual: false, variations: ENSEMBLE_VARS, createdAt: daysAgo(120) },
  { id: 8,  name: 'CEINTURE CUIR NOIR',  shortCode: 'CC-NOI', category: 'Accessoires', isManual: false, variations: [], createdAt: daysAgo(200) },
  { id: 9,  name: 'BONNET LOGO ATLAS',   shortCode: 'BN-ATL', category: 'Accessoires', isManual: false, variations: [], createdAt: daysAgo(180) },
  { id: 10, name: 'CASQUETTE ATLAS',     shortCode: 'CQ-ATL', category: 'Accessoires', isManual: false, variations: [], createdAt: daysAgo(160) },
]

// ── Stock ────────────────────────────────────────────────────

function makeStockEntry(
  id: string,
  productId: number,
  variationId: number | null,
  storeId: string,
  qty: number
) {
  const product = PRODUCTS.find(p => p.id === productId)!
  const allVars = [
    ...JEANS_VARS_1, ...JEANS_VARS_2, ...JEANS_VARS_3, ...JEANS_VARS_4,
    ...VESTE_VARS_1, ...VESTE_VARS_2, ...ENSEMBLE_VARS,
  ]
  const variation = variationId ? (allVars.find(v => v.id === variationId) || null) : null
  const store = STORES.find(s => s.id === storeId)!
  return {
    id,
    productId,
    productVariationId: variationId,
    storeId,
    quantity: qty,
    product: { id: product.id, name: product.name, shortCode: product.shortCode, category: product.category },
    productVariation: variation,
    store: { id: store.id, name: store.name },
  }
}

// Generate stock for all jeans variations across both stores
const stockEntries: ReturnType<typeof makeStockEntry>[] = []
let stockId = 1

// Jeans - store 1
for (const v of [...JEANS_VARS_1, ...JEANS_VARS_2, ...JEANS_VARS_3, ...JEANS_VARS_4]) {
  const qty = [0, 2, 3, 5, 8, 10, 12, 15][stockId % 8]
  stockEntries.push(makeStockEntry(`stk-${stockId++}`, Math.ceil(v.id / 21) <= 4 ? (v.id <= 21 ? 1 : v.id <= 42 ? 2 : v.id <= 63 ? 3 : 4) : 1, v.id, 'store-1', qty))
}
// Jeans - store 2
for (const v of [...JEANS_VARS_1, ...JEANS_VARS_2, ...JEANS_VARS_3, ...JEANS_VARS_4]) {
  const qty = [1, 3, 4, 6, 9, 11, 0, 7][stockId % 8]
  stockEntries.push(makeStockEntry(`stk-${stockId++}`, v.id <= 21 ? 1 : v.id <= 42 ? 2 : v.id <= 63 ? 3 : 4, v.id, 'store-2', qty))
}
// Vestes - both stores
for (const v of [...VESTE_VARS_1, ...VESTE_VARS_2]) {
  const pId = v.id <= 89 ? 5 : 6
  stockEntries.push(makeStockEntry(`stk-${stockId++}`, pId, v.id, 'store-1', [4, 6, 8, 5, 3][stockId % 5]))
  stockEntries.push(makeStockEntry(`stk-${stockId++}`, pId, v.id, 'store-2', [2, 5, 7, 4, 6][stockId % 5]))
}
// Ensembles - both stores
for (const v of ENSEMBLE_VARS) {
  stockEntries.push(makeStockEntry(`stk-${stockId++}`, 7, v.id, 'store-1', [3, 5, 7, 4, 2][stockId % 5]))
  stockEntries.push(makeStockEntry(`stk-${stockId++}`, 7, v.id, 'store-2', [1, 4, 6, 3, 5][stockId % 5]))
}
// Accessoires - both stores (no variation)
for (const accId of [8, 9, 10]) {
  stockEntries.push(makeStockEntry(`stk-${stockId++}`, accId, null, 'store-1', [12, 18, 9][accId - 8]))
  stockEntries.push(makeStockEntry(`stk-${stockId++}`, accId, null, 'store-2', [8, 14, 6][accId - 8]))
}

export const STOCK = stockEntries

// ── Users ─────────────────────────────────────────────────────

export const USERS = [
  {
    id: 'user-1',
    email: 'admin@atlasdenim.ma',
    fullName: 'Youssef El Idrissi',
    role: 'ADMIN',
    isActive: true,
    status: 'ACTIVE',
    canSendToDelivery: true,
    canSeeAllOrders: true,
    store: null,
    createdAt: daysAgo(300),
  },
  {
    id: 'user-super',
    email: 'superadmin@atlasdenim.ma',
    fullName: 'Atlas Denim Admin',
    role: 'SUPER_ADMIN',
    isActive: true,
    status: 'ACTIVE',
    canSendToDelivery: true,
    canSeeAllOrders: true,
    store: null,
    createdAt: daysAgo(300),
  },
  {
    id: 'user-2',
    email: 'staff1@atlasdenim.ma',
    fullName: 'Fatima Benali',
    role: 'STAFF',
    isActive: true,
    status: 'ACTIVE',
    canSendToDelivery: true,
    canSeeAllOrders: false,
    store: null,
    createdAt: daysAgo(200),
  },
  {
    id: 'user-3',
    email: 'staff2@atlasdenim.ma',
    fullName: 'Omar Chakir',
    role: 'STAFF',
    isActive: true,
    status: 'ACTIVE',
    canSendToDelivery: false,
    canSeeAllOrders: false,
    store: null,
    createdAt: daysAgo(150),
  },
  {
    id: 'user-4',
    email: 'caisse@atlasdenim.ma',
    fullName: 'Samira Ouazzani',
    role: 'STORE_CASHIER',
    isActive: true,
    status: 'ACTIVE',
    canSendToDelivery: false,
    canSeeAllOrders: false,
    storeId: 'store-1',
    store: { id: 'store-1', name: 'Casablanca Centre' },
    createdAt: daysAgo(180),
  },
  {
    id: 'user-5',
    email: 'factory@atlasdenim.ma',
    fullName: 'Hassan Amrani',
    role: 'FACTORY_MANAGER',
    isActive: true,
    status: 'ACTIVE',
    canSendToDelivery: false,
    canSeeAllOrders: false,
    store: null,
    createdAt: daysAgo(250),
  },
]

// ── Orders ────────────────────────────────────────────────────

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'SENT_TO_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'RETURNED'

interface OrderItem {
  id: string
  productName: string
  size?: string
  length?: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface Order {
  id: string
  orderNumber: string
  customerName: string
  customerPhone: string
  customerAddress: string
  totalAmount: number
  status: OrderStatus
  source: 'WOOCOMMERCE' | 'MANUAL'
  createdAt: string
  updatedAt: string
  deliveryTrackingNumber?: string
  notes?: string
  items: OrderItem[]
  assignedTo: { id: string; fullName: string } | null
}

const ORDER_DATA: Array<{
  name: string; phone: string; city: string; address: string;
  items: Array<{ product: string; size?: string; length?: string; qty: number; price: number }>
  status: OrderStatus; daysBack: number; source: 'WOOCOMMERCE' | 'MANUAL'; tracking?: string
}> = [
  { name: 'Mohamed Alami',      phone: '0612345678', city: 'Casablanca', address: 'Rue Al Maarif, Maarif',       items: [{ product: 'SLIM NOIR',      size: '32', length: '32', qty: 2, price: 250 }, { product: 'CEINTURE CUIR NOIR', qty: 1, price: 80 }],  status: 'DELIVERED',         daysBack: 45, source: 'WOOCOMMERCE', tracking: 'ATL-1001' },
  { name: 'Fatima Benhadi',     phone: '0623456789', city: 'Rabat',       address: 'Avenue Agdal, Agdal',        items: [{ product: 'BAGGY BLEACH',   size: '34', length: '30', qty: 1, price: 270 }],                                                     status: 'DELIVERED',         daysBack: 40, source: 'WOOCOMMERCE', tracking: 'ATL-1002' },
  { name: 'Youssef Chakir',     phone: '0634567890', city: 'Marrakech',   address: 'Rue Bab Doukkala',           items: [{ product: 'VESTE CARGO KAKI', size: 'L', qty: 1, price: 350 }, { product: 'SLIM NOIR', size: '34', length: '32', qty: 1, price: 250 }], status: 'DELIVERED',    daysBack: 38, source: 'MANUAL',    tracking: 'ATL-1003' },
  { name: 'Khadija Mansouri',   phone: '0645678901', city: 'Casablanca', address: 'Bd Moulay Youssef, CIL',      items: [{ product: 'REGULAR INDIGO', size: '30', length: '30', qty: 2, price: 260 }],                                                     status: 'DELIVERED',         daysBack: 35, source: 'WOOCOMMERCE', tracking: 'ATL-1004' },
  { name: 'Omar Bennani',       phone: '0656789012', city: 'Fès',         address: 'Quartier Narjiss, Fès',      items: [{ product: 'BAGGY BLEACH',   size: '36', length: '32', qty: 1, price: 270 }, { product: 'BONNET LOGO ATLAS', qty: 2, price: 60 }],  status: 'DELIVERED',         daysBack: 32, source: 'WOOCOMMERCE', tracking: 'ATL-1005' },
  { name: 'Zineb Tahiri',       phone: '0667890123', city: 'Tanger',      address: 'Rue Ibn Batouta, Tanger',    items: [{ product: 'ENSEMBLE SPORT NOIR', size: 'M', qty: 1, price: 480 }],                                                               status: 'RETURNED',          daysBack: 30, source: 'MANUAL',    tracking: 'ATL-1006' },
  { name: 'Rachid Belhaj',      phone: '0678901234', city: 'Agadir',      address: 'Avenue Hassan II, Agadir',   items: [{ product: 'SLIM NOIR',      size: '38', length: '34', qty: 1, price: 250 }],                                                     status: 'DELIVERED',         daysBack: 28, source: 'WOOCOMMERCE', tracking: 'ATL-1007' },
  { name: 'Samira Ouazzani',    phone: '0689012345', city: 'Casablanca', address: 'Rue Brahim Roudani, Gauthier', items: [{ product: 'VESTE DENIM BLEUE', size: 'S', qty: 1, price: 320 }, { product: 'CASQUETTE ATLAS', qty: 1, price: 70 }],              status: 'DELIVERED',         daysBack: 25, source: 'WOOCOMMERCE', tracking: 'ATL-1008' },
  { name: 'Hassan Idrissi',     phone: '0690123456', city: 'Rabat',       address: 'Avenue Fal Ould Oumeir',     items: [{ product: 'SKINNY DESTROY', size: '32', length: '30', qty: 2, price: 240 }],                                                     status: 'DELIVERED',         daysBack: 22, source: 'MANUAL',    tracking: 'ATL-1009' },
  { name: 'Nadia Berrada',      phone: '0601234567', city: 'Salé',        address: 'Quartier Tabriquet, Salé',   items: [{ product: 'REGULAR INDIGO', size: '34', length: '32', qty: 1, price: 260 }, { product: 'CEINTURE CUIR NOIR', qty: 1, price: 80 }], status: 'DELIVERED',         daysBack: 20, source: 'WOOCOMMERCE', tracking: 'ATL-1010' },
  { name: 'Amine El Fassi',     phone: '0612111222', city: 'Casablanca', address: 'Rue Abderrahmane Sahraoui',   items: [{ product: 'BAGGY BLEACH',   size: '30', length: '30', qty: 1, price: 270 }],                                                     status: 'SENT_TO_DELIVERY',  daysBack: 18, source: 'WOOCOMMERCE', tracking: 'ATL-1011' },
  { name: 'Leila Tazi',         phone: '0623222333', city: 'Fès',         address: 'Hay Ryad, Fès',              items: [{ product: 'ENSEMBLE SPORT NOIR', size: 'L', qty: 1, price: 480 }, { product: 'BONNET LOGO ATLAS', qty: 1, price: 60 }],           status: 'SENT_TO_DELIVERY',  daysBack: 16, source: 'MANUAL',    tracking: 'ATL-1012' },
  { name: 'Karim Cherkaoui',    phone: '0634333444', city: 'Marrakech',   address: 'Rue Mouassine, Gueliz',      items: [{ product: 'VESTE CARGO KAKI', size: 'XL', qty: 1, price: 350 }],                                                                 status: 'SENT_TO_DELIVERY',  daysBack: 14, source: 'WOOCOMMERCE', tracking: 'ATL-1013' },
  { name: 'Meriem Slaoui',      phone: '0645444555', city: 'Rabat',       address: 'Rue Patrice Lumumba',        items: [{ product: 'SLIM NOIR',      size: '28', length: '30', qty: 2, price: 250 }],                                                     status: 'SHIPPED',           daysBack: 12, source: 'WOOCOMMERCE', tracking: 'ATL-1014' },
  { name: 'Tariq Lahlou',       phone: '0656555666', city: 'Casablanca', address: 'Bd Anfa, Ain Diab',           items: [{ product: 'REGULAR INDIGO', size: '36', length: '34', qty: 1, price: 260 }, { product: 'CASQUETTE ATLAS', qty: 2, price: 70 }],   status: 'SHIPPED',           daysBack: 10, source: 'MANUAL',    tracking: 'ATL-1015' },
  { name: 'Houda Benchekroun',  phone: '0667666777', city: 'Tanger',      address: 'Avenue Mohamed V, Tanger',   items: [{ product: 'SKINNY DESTROY', size: '34', length: '32', qty: 1, price: 240 }],                                                     status: 'CONFIRMED',         daysBack: 8,  source: 'WOOCOMMERCE' },
  { name: 'Khalid Rhazali',     phone: '0678777888', city: 'Agadir',      address: 'Rue du 18 Novembre, Agadir', items: [{ product: 'VESTE DENIM BLEUE', size: 'M', qty: 1, price: 320 }, { product: 'SLIM NOIR', size: '32', length: '32', qty: 1, price: 250 }], status: 'CONFIRMED', daysBack: 7, source: 'WOOCOMMERCE' },
  { name: 'Soukaina Filali',    phone: '0689888999', city: 'Casablanca', address: 'Quartier Hay Hassani',        items: [{ product: 'ENSEMBLE SPORT NOIR', size: 'S', qty: 1, price: 480 }],                                                               status: 'CONFIRMED',         daysBack: 6,  source: 'MANUAL'    },
  { name: 'Hamza Kabbaj',       phone: '0690999000', city: 'Rabat',       address: 'Avenue Allal Ben Abdallah',  items: [{ product: 'BAGGY BLEACH',   size: '40', length: '34', qty: 1, price: 270 }, { product: 'CEINTURE CUIR NOIR', qty: 1, price: 80 }], status: 'CONFIRMED',         daysBack: 5,  source: 'WOOCOMMERCE' },
  { name: 'Asmaa Raissouni',    phone: '0601000111', city: 'Salé',        address: 'Hay Al Inbiat, Salé',        items: [{ product: 'REGULAR INDIGO', size: '32', length: '30', qty: 2, price: 260 }],                                                     status: 'PENDING',           daysBack: 4,  source: 'WOOCOMMERCE' },
  { name: 'Driss El Alami',     phone: '0612111333', city: 'Casablanca', address: 'Rue Abou Inane, Anfa',        items: [{ product: 'VESTE CARGO KAKI', size: 'M', qty: 2, price: 350 }],                                                                  status: 'PENDING',           daysBack: 3,  source: 'MANUAL'    },
  { name: 'Naima Kettani',      phone: '0623222444', city: 'Fès',         address: 'Quartier Narjiss, Fès',      items: [{ product: 'SLIM NOIR',      size: '34', length: '32', qty: 1, price: 250 }, { product: 'BONNET LOGO ATLAS', qty: 3, price: 60 }], status: 'PENDING',           daysBack: 3,  source: 'WOOCOMMERCE' },
  { name: 'Bilal Amrani',       phone: '0634333555', city: 'Marrakech',   address: 'Hay Mohammadi, Marrakech',   items: [{ product: 'SKINNY DESTROY', size: '30', length: '30', qty: 1, price: 240 }],                                                     status: 'PENDING',           daysBack: 2,  source: 'WOOCOMMERCE' },
  { name: 'Ghita Lazrak',       phone: '0645444666', city: 'Casablanca', address: 'Bd Zerktouni, Maarif',        items: [{ product: 'VESTE DENIM BLEUE', size: 'L', qty: 1, price: 320 }, { product: 'CASQUETTE ATLAS', qty: 1, price: 70 }],              status: 'PENDING',           daysBack: 1,  source: 'MANUAL'    },
  { name: 'Said Lahrichi',      phone: '0656555777', city: 'Rabat',       address: 'Hay Riad, Rabat',             items: [{ product: 'ENSEMBLE SPORT NOIR', size: 'XL', qty: 1, price: 480 }],                                                             status: 'PENDING',           daysBack: 1,  source: 'WOOCOMMERCE' },
  { name: 'Widad Benjelloun',   phone: '0667666888', city: 'Casablanca', address: 'Rue de Normandie, Maarif',    items: [{ product: 'BAGGY BLEACH',   size: '32', length: '32', qty: 2, price: 270 }],                                                     status: 'CANCELLED',         daysBack: 15, source: 'WOOCOMMERCE' },
  { name: 'Mourad Skali',       phone: '0678777999', city: 'Tanger',      address: 'Cité Malabata, Tanger',      items: [{ product: 'REGULAR INDIGO', size: '38', length: '30', qty: 1, price: 260 }],                                                     status: 'CANCELLED',         daysBack: 22, source: 'MANUAL'    },
  { name: 'Hajar Guerraoui',    phone: '0689888000', city: 'Agadir',      address: 'Hay Dakhla, Agadir',         items: [{ product: 'SLIM NOIR',      size: '36', length: '34', qty: 1, price: 250 }, { product: 'CEINTURE CUIR NOIR', qty: 2, price: 80 }], status: 'CANCELLED',        daysBack: 18, source: 'WOOCOMMERCE' },
  { name: 'Mohamed Tahir',      phone: '0690000111', city: 'Casablanca', address: 'Hay Moulay Rachid',            items: [{ product: 'SKINNY DESTROY', size: '36', length: '32', qty: 2, price: 240 }],                                                    status: 'RETURNED',          daysBack: 25, source: 'WOOCOMMERCE', tracking: 'ATL-1020' },
  { name: 'Imane Bouzidi',      phone: '0601111222', city: 'Rabat',       address: 'Avenue Tariq Ibn Ziad',      items: [{ product: 'VESTE CARGO KAKI', size: '2XL', qty: 1, price: 350 }],                                                                status: 'RETURNED',          daysBack: 20, source: 'MANUAL',    tracking: 'ATL-1021' },
]

export const ORDERS: Order[] = ORDER_DATA.map((o, i) => {
  const num = String(i + 1).padStart(3, '0')
  const items: OrderItem[] = o.items.map((it, j) => ({
    id: `item-${i}-${j}`,
    productName: it.product,
    size: it.size,
    length: it.length,
    quantity: it.qty,
    unitPrice: it.price,
    totalPrice: it.qty * it.price,
  }))
  const totalAmount = items.reduce((s, it) => s + it.totalPrice, 0)
  const created = daysAgo(o.daysBack)
  const updated = daysAgo(Math.max(0, o.daysBack - 2))
  const staffPick = [USERS[2], USERS[3]][i % 2]
  return {
    id: `order-${i + 1}`,
    orderNumber: `AD-2026-${num}`,
    customerName: o.name,
    customerPhone: o.phone,
    customerAddress: `${o.address}, ${o.city}`,
    totalAmount,
    status: o.status,
    source: o.source,
    createdAt: created,
    updatedAt: updated,
    deliveryTrackingNumber: o.tracking,
    notes: '',
    items,
    assignedTo: staffPick,
  }
})

// ── Order Stats ───────────────────────────────────────────────

export const ORDER_STATS = {
  total: ORDERS.length,
  byStatus: {
    pending:          ORDERS.filter(o => o.status === 'PENDING').length,
    confirmed:        ORDERS.filter(o => o.status === 'CONFIRMED').length,
    shipped:          ORDERS.filter(o => o.status === 'SHIPPED').length,
    sent_to_delivery: ORDERS.filter(o => o.status === 'SENT_TO_DELIVERY').length,
    delivered:        ORDERS.filter(o => o.status === 'DELIVERED').length,
    cancelled:        ORDERS.filter(o => o.status === 'CANCELLED').length,
    returned:         ORDERS.filter(o => o.status === 'RETURNED').length,
  },
  revenue: ORDERS.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.totalAmount, 0),
}

// ── Low Stock Alerts ──────────────────────────────────────────

export const STOCK_ALERTS = STOCK.filter(s => s.quantity <= 3 && s.quantity > 0).slice(0, 8)

// ── Production Requests ───────────────────────────────────────

export const PRODUCTION_REQUESTS = [
  {
    id: 'pr-1',
    requestNumber: 'PR-2026-001',
    status: 'COMPLETED',
    priority: 'HIGH',
    requestedBy: USERS[0],
    assignedTo: USERS[4],
    targetStore: STORES[0],
    notes: 'Réassort urgent pour la saison printemps',
    createdAt: daysAgo(30),
    updatedAt: daysAgo(10),
    items: [
      { id: 'pri-1', product: { id: 1, name: 'SLIM NOIR', shortCode: 'SL-NOI' }, variation: { size: '32', length: '32' }, requestedQty: 20, producedQty: 20 },
      { id: 'pri-2', product: { id: 2, name: 'BAGGY BLEACH', shortCode: 'BG-BLE' }, variation: { size: '34', length: '30' }, requestedQty: 15, producedQty: 15 },
    ],
  },
  {
    id: 'pr-2',
    requestNumber: 'PR-2026-002',
    status: 'IN_PRODUCTION',
    priority: 'MEDIUM',
    requestedBy: USERS[0],
    assignedTo: USERS[4],
    targetStore: STORES[1],
    notes: 'Commande pour Rabat Agdal',
    createdAt: daysAgo(15),
    updatedAt: daysAgo(5),
    items: [
      { id: 'pri-3', product: { id: 3, name: 'REGULAR INDIGO', shortCode: 'RG-IND' }, variation: { size: '30', length: '30' }, requestedQty: 10, producedQty: 6 },
      { id: 'pri-4', product: { id: 5, name: 'VESTE CARGO KAKI', shortCode: 'VT-KAK' }, variation: { size: 'L', length: '' }, requestedQty: 12, producedQty: 0 },
    ],
  },
  {
    id: 'pr-3',
    requestNumber: 'PR-2026-003',
    status: 'PENDING',
    priority: 'LOW',
    requestedBy: USERS[0],
    assignedTo: null,
    targetStore: STORES[0],
    notes: 'Accessoires été 2026',
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
    items: [
      { id: 'pri-5', product: { id: 8, name: 'CEINTURE CUIR NOIR', shortCode: 'CC-NOI' }, variation: null, requestedQty: 30, producedQty: 0 },
      { id: 'pri-6', product: { id: 9, name: 'BONNET LOGO ATLAS', shortCode: 'BN-ATL' }, variation: null, requestedQty: 25, producedQty: 0 },
    ],
  },
  {
    id: 'pr-4',
    requestNumber: 'PR-2026-004',
    status: 'QUALITY_CHECK',
    priority: 'HIGH',
    requestedBy: USERS[0],
    assignedTo: USERS[4],
    targetStore: STORES[0],
    notes: 'Nouvelle collection SKINNY DESTROY',
    createdAt: daysAgo(8),
    updatedAt: daysAgo(1),
    items: [
      { id: 'pri-7', product: { id: 4, name: 'SKINNY DESTROY', shortCode: 'SK-DES' }, variation: { size: '32', length: '30' }, requestedQty: 25, producedQty: 25 },
    ],
  },
]

// ── Shipments ─────────────────────────────────────────────────

export const SHIPMENTS = [
  {
    id: 'sh-1',
    shipmentNumber: 'SH-2026-001',
    status: 'DELIVERED',
    fromFactory: 'Usine Principale Casablanca',
    toStore: STORES[0],
    createdAt: daysAgo(25),
    deliveredAt: daysAgo(20),
    notes: 'Livraison réassort hiver',
    items: [
      { id: 'shi-1', product: { id: 1, name: 'SLIM NOIR', shortCode: 'SL-NOI' }, variation: { size: '32', length: '32' }, quantity: 20 },
      { id: 'shi-2', product: { id: 2, name: 'BAGGY BLEACH', shortCode: 'BG-BLE' }, variation: { size: '34', length: '30' }, quantity: 15 },
      { id: 'shi-3', product: { id: 8, name: 'CEINTURE CUIR NOIR', shortCode: 'CC-NOI' }, variation: null, quantity: 30 },
    ],
  },
  {
    id: 'sh-2',
    shipmentNumber: 'SH-2026-002',
    status: 'IN_TRANSIT',
    fromFactory: 'Usine Principale Casablanca',
    toStore: STORES[1],
    createdAt: daysAgo(5),
    deliveredAt: null,
    notes: 'Expédition Rabat Agdal',
    items: [
      { id: 'shi-4', product: { id: 3, name: 'REGULAR INDIGO', shortCode: 'RG-IND' }, variation: { size: '30', length: '30' }, quantity: 10 },
      { id: 'shi-5', product: { id: 6, name: 'VESTE DENIM BLEUE', shortCode: 'VT-BLE' }, variation: { size: 'M', length: '' }, quantity: 8 },
    ],
  },
  {
    id: 'sh-3',
    shipmentNumber: 'SH-2026-003',
    status: 'PENDING',
    fromFactory: 'Usine Principale Casablanca',
    toStore: STORES[0],
    createdAt: daysAgo(1),
    deliveredAt: null,
    notes: 'Collection printemps 2026',
    items: [
      { id: 'shi-6', product: { id: 7, name: 'ENSEMBLE SPORT NOIR', shortCode: 'EN-NOI' }, variation: { size: 'L', length: '' }, quantity: 15 },
      { id: 'shi-7', product: { id: 5, name: 'VESTE CARGO KAKI', shortCode: 'VT-KAK' }, variation: { size: 'XL', length: '' }, quantity: 12 },
    ],
  },
]

// ── Clients ───────────────────────────────────────────────────

export const CLIENTS = [
  { id: 'c-1', name: 'Mohamed Alami',     phone: '0612345678', totalOrders: 3, totalSpent: 1580, city: 'Casablanca', createdAt: daysAgo(120) },
  { id: 'c-2', name: 'Fatima Benhadi',    phone: '0623456789', totalOrders: 2, totalSpent: 810,  city: 'Rabat',       createdAt: daysAgo(100) },
  { id: 'c-3', name: 'Youssef Chakir',    phone: '0634567890', totalOrders: 5, totalSpent: 2450, city: 'Marrakech',   createdAt: daysAgo(200) },
  { id: 'c-4', name: 'Khadija Mansouri',  phone: '0645678901', totalOrders: 1, totalSpent: 520,  city: 'Casablanca',  createdAt: daysAgo(85)  },
  { id: 'c-5', name: 'Omar Bennani',      phone: '0656789012', totalOrders: 4, totalSpent: 1960, city: 'Fès',         createdAt: daysAgo(160) },
  { id: 'c-6', name: 'Zineb Tahiri',      phone: '0667890123', totalOrders: 2, totalSpent: 960,  city: 'Tanger',      createdAt: daysAgo(90)  },
  { id: 'c-7', name: 'Rachid Belhaj',     phone: '0678901234', totalOrders: 6, totalSpent: 3200, city: 'Agadir',      createdAt: daysAgo(250) },
  { id: 'c-8', name: 'Samira Ouazzani',   phone: '0689012345', totalOrders: 3, totalSpent: 1100, city: 'Casablanca',  createdAt: daysAgo(70)  },
  { id: 'c-9', name: 'Hassan Idrissi',    phone: '0690123456', totalOrders: 2, totalSpent: 680,  city: 'Rabat',       createdAt: daysAgo(55)  },
  { id: 'c-10', name: 'Nadia Berrada',    phone: '0601234567', totalOrders: 1, totalSpent: 340,  city: 'Salé',        createdAt: daysAgo(30)  },
]

// ── Coupons ───────────────────────────────────────────────────

export const COUPONS = [
  { id: 'cp-1', code: 'ATLAS10',    discountType: 'PERCENTAGE', discountValue: 10, minOrderAmount: 200, maxUses: 100, usedCount: 34, isActive: true, expiresAt: '2026-06-30T00:00:00Z', createdAt: daysAgo(60) },
  { id: 'cp-2', code: 'PRINTEMPS',  discountType: 'PERCENTAGE', discountValue: 15, minOrderAmount: 300, maxUses: 50,  usedCount: 12, isActive: true, expiresAt: '2026-04-30T00:00:00Z', createdAt: daysAgo(14) },
  { id: 'cp-3', code: 'FIDELE50',   discountType: 'FIXED',      discountValue: 50, minOrderAmount: 400, maxUses: 20,  usedCount: 8,  isActive: true, expiresAt: '2026-12-31T00:00:00Z', createdAt: daysAgo(90) },
  { id: 'cp-4', code: 'HIVER2025',  discountType: 'PERCENTAGE', discountValue: 20, minOrderAmount: 250, maxUses: 80,  usedCount: 80, isActive: false, expiresAt: '2026-01-31T00:00:00Z', createdAt: daysAgo(120) },
]

// ── In-Store Sales (POS) ─────────────────────────────────────

function posDay(daysBack: number, storeId: string) {
  const revenues = [1240, 980, 1580, 2100, 1750, 890, 1320, 1640, 2200, 1480, 960, 1780, 2050, 1390, 1120, 1860, 2300, 1560, 990, 1430, 1670, 2180, 1250, 1040, 1820, 2080, 1370, 950, 1600, 2250]
  const idx = daysBack % revenues.length
  return {
    date: daysAgo(daysBack).split('T')[0],
    storeId,
    storeName: STORES.find(s => s.id === storeId)!.name,
    totalRevenue: revenues[idx] + (storeId === 'store-2' ? -200 : 0),
    totalSales: Math.floor(revenues[idx] / 280),
    cashAmount: Math.floor(revenues[idx] * 0.65),
    cardAmount: Math.floor(revenues[idx] * 0.35),
  }
}

export const POS_DAILY_SUMMARY: ReturnType<typeof posDay>[] = []
for (let d = 1; d <= 30; d++) {
  POS_DAILY_SUMMARY.push(posDay(d, 'store-1'))
  POS_DAILY_SUMMARY.push(posDay(d, 'store-2'))
}

// ── Analytics ─────────────────────────────────────────────────

export const ANALYTICS_DATA = {
  period: 'month',
  totalOrders: ORDERS.length,
  totalRevenue: ORDERS.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.totalAmount, 0),
  deliveryRate: 72,
  returnRate: 8,
  cancelRate: 10,
  topProducts: [
    { name: 'SLIM NOIR',        shortCode: 'SL-NOI', orders: 14, revenue: 3500  },
    { name: 'BAGGY BLEACH',     shortCode: 'BG-BLE', orders: 11, revenue: 2970  },
    { name: 'VESTE CARGO KAKI', shortCode: 'VT-KAK', orders: 9,  revenue: 3150  },
    { name: 'REGULAR INDIGO',   shortCode: 'RG-IND', orders: 8,  revenue: 2080  },
    { name: 'ENSEMBLE SPORT',   shortCode: 'EN-NOI', orders: 6,  revenue: 2880  },
  ],
  dailyRevenue: Array.from({ length: 27 }, (_, i) => ({
    date: daysAgo(27 - i).split('T')[0],
    revenue: [0, 580, 0, 820, 1250, 0, 0, 960, 1100, 0, 750, 1380, 0, 0, 1050, 870, 0, 1420, 1600, 0, 0, 930, 1280, 0, 760, 1180, 0][i] || 0,
    orders: [0, 2, 0, 3, 5, 0, 0, 4, 4, 0, 3, 5, 0, 0, 4, 3, 0, 5, 6, 0, 0, 3, 4, 0, 3, 4, 0][i] || 0,
  })),
}

// ── Notifications ─────────────────────────────────────────────

export const NOTIFICATIONS = [
  { id: 'n-1', type: 'LOW_STOCK',    message: 'Stock faible — SLIM NOIR 32/32 (Casablanca Centre : 2 unités)',   isRead: false, createdAt: daysAgo(1) },
  { id: 'n-2', type: 'NEW_ORDER',    message: 'Nouvelle commande AD-2026-025 — Said Lahrichi (480 DH)',           isRead: false, createdAt: daysAgo(1) },
  { id: 'n-3', type: 'DELIVERED',    message: 'Commande AD-2026-008 livrée avec succès — Samira Ouazzani',        isRead: true,  createdAt: daysAgo(2) },
  { id: 'n-4', type: 'RETURNED',     message: 'Retour reçu — Commande AD-2026-006 — Zineb Tahiri',                isRead: true,  createdAt: daysAgo(3) },
  { id: 'n-5', type: 'PRODUCTION',   message: 'Demande PR-2026-004 prête pour contrôle qualité',                  isRead: true,  createdAt: daysAgo(4) },
]

// ── POS Store Products (for useProductCache) ──────────────────

export function getPOSProducts(storeId: string) {
  const storeStock = STOCK.filter(s => s.storeId === storeId)
  const productMap = new Map<number, any>()

  for (const s of storeStock) {
    if (!productMap.has(s.productId)) {
      const p = PRODUCTS.find(pr => pr.id === s.productId)!
      const basePrice = p.category === 'Accessoires' ? 70 : p.category === 'Vestes' ? 330 : p.category === 'Ensembles' ? 480 : 250
      productMap.set(s.productId, {
        productId: p.id,
        productName: p.name,
        shortCode: p.shortCode,
        imageUrl: null,
        basePrice,
        totalStock: 0,
        variations: [],
      })
    }
    const entry = productMap.get(s.productId)!
    const p = PRODUCTS.find(pr => pr.id === s.productId)!
    if (s.productVariationId === null) {
      // Accessory — no variation
      entry.totalStock += s.quantity
    } else {
      const sizePart = s.productVariation?.size ? `-${s.productVariation.size}` : ''
      const lenPart = s.productVariation?.length ? `-${s.productVariation.length}` : ''
      entry.variations.push({
        variationId: s.productVariationId,
        shortCode: `${p.shortCode}${sizePart}${lenPart}`,
        size: s.productVariation?.size || '',
        length: s.productVariation?.length || '',
        price: entry.basePrice,
        stock: s.quantity,
      })
      entry.totalStock += s.quantity
    }
  }

  return Array.from(productMap.values())
}
