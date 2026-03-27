// ============================================================
// ATLAS DENIM — Mock API Handler
// Intercepts all API calls and returns fake demo data.
// ============================================================

import {
  STORES, PRODUCTS, STOCK, USERS, ORDERS, ORDER_STATS,
  STOCK_ALERTS, PRODUCTION_REQUESTS, SHIPMENTS, CLIENTS,
  COUPONS, NOTIFICATIONS, ANALYTICS_DATA, POS_DAILY_SUMMARY,
  getPOSProducts,
} from './demoData'

function ok(data: unknown, extra?: object) {
  return { success: true, data, ...extra }
}

function paginate<T>(items: T[], page = 1, limit = 20) {
  const total = items.length
  const totalPages = Math.ceil(total / limit)
  const start = (page - 1) * limit
  return {
    items: items.slice(start, start + limit),
    pagination: { total, page, limit, totalPages },
  }
}

/** Strip base URL and query string to get plain path like /orders */
function parsePath(url: string): { path: string; params: URLSearchParams } {
  try {
    // Handle both absolute URLs and relative paths
    const raw = url.includes('?') ? url : url
    const [pathPart, queryPart = ''] = raw.split('?')
    // Remove the fake base URL if present
    const path = pathPart
      .replace(/^https?:\/\/[^/]+/, '') // strip protocol+host
      .replace(/\/api$/, '')             // strip trailing /api
      .replace(/\/api\//, '/')           // strip /api/ prefix
    return { path: path || '/', params: new URLSearchParams(queryPart) }
  } catch {
    return { path: '/', params: new URLSearchParams() }
  }
}

// Normalize production request fields to match what the page expects
function normalizePR(pr: any) {
  return {
    ...pr,
    title: pr.notes || pr.requestNumber,
    createdBy: pr.requestedBy,
    destinationStore: pr.targetStore,
    estimatedQuantity: pr.items.reduce((s: number, i: any) => s + i.requestedQty, 0),
    dueDate: null,
  }
}

export function handleMockRequest(
  method: string,
  url: string,
  body?: unknown
): unknown {
  const { path, params } = parsePath(url)
  const segments = path.split('/').filter(Boolean)
  const [seg0, seg1, seg2, seg3] = segments

  // ── Auth ──────────────────────────────────────────────────
  if (seg0 === 'auth' && seg1 === 'login') {
    // Accept any credentials — log in as admin
    const user = USERS[0]
    return ok({ token: 'demo-token-atlas', user })
  }
  if (seg0 === 'auth' && seg1 === 'me') {
    return ok(USERS[0])
  }

  // ── Orders ────────────────────────────────────────────────
  if (seg0 === 'orders' && seg1 === 'stats') {
    return ok(ORDER_STATS)
  }
  if (seg0 === 'orders' && (seg1 === 'analytics' || seg1 === 'admin-analytics')) {
    return ok({
      ...ANALYTICS_DATA,
      monthlyData: [
        { month: 'Oct', orders: 18, revenue: 7200 },
        { month: 'Nov', orders: 24, revenue: 9600 },
        { month: 'Déc', orders: 31, revenue: 12400 },
        { month: 'Jan', orders: 22, revenue: 8800 },
        { month: 'Fév', orders: 28, revenue: 11200 },
        { month: 'Mar', orders: 30, revenue: 12100 },
      ],
      sourceBreakdown: [
        { source: 'WOOCOMMERCE', count: 18, revenue: 7560 },
        { source: 'MANUAL',      count: 12, revenue: 4540 },
      ],
      staffPerformance: [
        { staffName: 'Fatima Benali', orders: 14, revenue: 5600 },
        { staffName: 'Omar Chakir',   orders: 16, revenue: 6500 },
      ],
      storePerformance: [
        { storeName: 'Casablanca Centre', sales: 380, revenue: 48200 },
        { storeName: 'Rabat Agdal',       sales: 260, revenue: 31400 },
      ],
      deliveryStats: [
        { status: 'DELIVERED', count: 10, percentage: 72 },
        { status: 'RETURNED',  count: 2,  percentage: 8  },
        { status: 'CANCELLED', count: 3,  percentage: 10 },
        { status: 'PENDING',   count: 5,  percentage: 10 },
      ],
    })
  }
  if (seg0 === 'orders' && seg1 === 'returns' && seg2 === 'analytics') {
    const returned = ORDERS.filter(o => o.status === 'RETURNED')
    return ok({
      summary: {
        totalReturns: returned.length,
        totalReturnAmount: returned.reduce((s, o) => s + o.totalAmount, 0),
        averageReturnValue: returned.length ? Math.round(returned.reduce((s, o) => s + o.totalAmount, 0) / returned.length) : 0,
        returnRate: 8,
        pendingRegistration: 1,
      },
      returnsByDeliveryStatus: [
        { status: 'Retourné', count: 2 },
        { status: 'Livré', count: 1 },
      ],
      returnsByReturnStatus: [
        { status: 'RETURNED_TO_STORE', count: 2 },
        { status: 'PROCESSED', count: 1 },
      ],
      returnsByCity: [
        { city: 'Casablanca', count: 2 },
        { city: 'Tanger', count: 1 },
      ],
      returnsByMonth: [
        { month: 'Oct 2025', count: 1 },
        { month: 'Nov 2025', count: 0 },
        { month: 'Déc 2025', count: 2 },
        { month: 'Jan 2026', count: 1 },
        { month: 'Fév 2026', count: 0 },
        { month: 'Mar 2026', count: 2 },
      ],
      recentReturns: returned.map(o => ({
        ...o,
        returnStatus: 'RETURNED_TO_STORE',
        deliveryStatus: 'RETURNED',
        createdBy: 'Fatima Benali',
      })),
    })
  }
  if (seg0 === 'orders' && seg1 && !['stats', 'analytics', 'admin-analytics', 'all', 'returns'].includes(seg1)) {
    // Single order by ID
    const order = ORDERS.find(o => o.id === seg1) || ORDERS[0]
    return ok(order)
  }
  if (seg0 === 'orders') {
    // List with optional filters
    let filtered = [...ORDERS]
    const status = params.get('status')
    if (status) filtered = filtered.filter(o => o.status === status)
    const source = params.get('source')
    if (source) filtered = filtered.filter(o => o.source === source)
    const search = params.get('search')
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(o =>
        o.customerName.toLowerCase().includes(q) ||
        o.orderNumber.toLowerCase().includes(q)
      )
    }
    const limit = parseInt(params.get('limit') || '20')
    const page = parseInt(params.get('page') || '1')
    const { items, pagination } = paginate(filtered, page, limit)
    return { success: true, data: items, pagination }
  }

  // ── Delivery ──────────────────────────────────────────────
  if (seg0 === 'delivery' && seg1 === 'cities') {
    return ok(['Casablanca', 'Rabat', 'Marrakech', 'Fès', 'Tanger', 'Agadir', 'Salé', 'Témara', 'Meknès', 'Oujda'])
  }
  if (seg0 === 'delivery') {
    return ok({ message: 'Commande envoyée en livraison', trackingNumber: 'ATL-DEMO' })
  }

  // ── Stock ─────────────────────────────────────────────────
  if (seg0 === 'stock' && seg1 === 'alerts') {
    return ok(STOCK_ALERTS)
  }
  if (seg0 === 'stock' && seg1 === 'all-stores') {
    // Build AllStoresData structure expected by stock/stores page
    const stockByProduct = new Map<number, any>()
    for (const s of STOCK) {
      if (!stockByProduct.has(s.productId)) {
        stockByProduct.set(s.productId, {
          productId: s.productId,
          productName: s.product.name,
          shortCode: s.product.shortCode,
          categories: s.product.category,
          variations: [],
          storeStock: {},
        })
      }
      const p = stockByProduct.get(s.productId)
      if (s.productVariationId) {
        const existing = p.variations.find((v: any) => v.id === s.productVariationId)
        if (existing) {
          existing.stores[s.store.name] = s.quantity
        } else {
          p.variations.push({
            id: s.productVariationId,
            shortCode: `${s.product.shortCode}-${s.productVariation?.size}${s.productVariation?.length ? '/' + s.productVariation.length : ''}`,
            size: s.productVariation?.size || '',
            length: s.productVariation?.length || null,
            stores: { [s.store.name]: s.quantity },
          })
        }
      } else {
        p.storeStock[s.store.name] = (p.storeStock[s.store.name] || 0) + s.quantity
      }
    }
    return ok({
      stores: STORES.map(s => ({ id: s.id, name: s.name, slug: s.slug })),
      stock: Array.from(stockByProduct.values()),
    })
  }
  if (seg0 === 'stock' && seg1 === 'store' && seg2 && seg3 === 'products') {
    return ok(getPOSProducts(seg2))
  }
  if (seg0 === 'stock' && seg1 === 'store' && seg2 && seg3 === 'images') {
    return ok({})
  }
  if (seg0 === 'stock' && seg1 === 'product' && seg2 === 'batch') {
    return ok(STOCK)
  }
  if (seg0 === 'stock') {
    return ok(STOCK)
  }

  // ── Products ──────────────────────────────────────────────
  if (seg0 === 'products' && seg1 === 'with-variations') {
    return ok(PRODUCTS)
  }
  if (seg0 === 'products' && seg1 === 'manual' && seg2 === 'counts') {
    const counts: Record<string, number> = {}
    for (const p of PRODUCTS) {
      counts[p.category] = (counts[p.category] || 0) + 1
    }
    return ok(counts)
  }
  if (seg0 === 'products' && seg1 === 'manual') {
    const category = params.get('category')
    const filtered = category
      ? PRODUCTS.filter(p => p.category.toLowerCase() === category.toLowerCase())
      : PRODUCTS
    return ok(filtered)
  }
  if (seg0 === 'products' && seg1) {
    const product = PRODUCTS.find(p => String(p.id) === seg1) || PRODUCTS[0]
    // Also return stock for this product
    const productStock = STOCK.filter(s => String(s.productId) === seg1)
    return ok({ ...product, stockEntries: productStock })
  }
  if (seg0 === 'products') {
    return ok(PRODUCTS)
  }

  // ── Stores ────────────────────────────────────────────────
  if (seg0 === 'stores' && seg1) {
    const store = STORES.find(s => s.id === seg1 || s.slug === seg1) || STORES[0]
    return ok(store)
  }
  if (seg0 === 'stores') {
    return ok(STORES)
  }

  // ── Magasins (store analytics) ────────────────────────────
  if (seg0 === 'magasins' && seg1) {
    const store = STORES.find(s => s.slug === seg1) || STORES[0]
    const storeSales = POS_DAILY_SUMMARY.filter(s => s.storeId === store.id)
    return ok({
      store,
      totalRevenue: storeSales.reduce((sum, s) => sum + s.totalRevenue, 0),
      totalSales: storeSales.reduce((sum, s) => sum + s.totalSales, 0),
      dailySales: storeSales,
    })
  }
  if (seg0 === 'magasins') {
    return ok(STORES.map(store => {
      const storeSales = POS_DAILY_SUMMARY.filter(s => s.storeId === store.id)
      return {
        ...store,
        totalRevenue: storeSales.reduce((sum, s) => sum + s.totalRevenue, 0),
        totalSales: storeSales.reduce((sum, s) => sum + s.totalSales, 0),
      }
    }))
  }

  // ── Users ─────────────────────────────────────────────────
  if (seg0 === 'users' && seg1) {
    const user = USERS.find(u => u.id === seg1) || USERS[0]
    return ok(user)
  }
  if (seg0 === 'users') {
    return ok(USERS)
  }

  // ── Shipments ─────────────────────────────────────────────
  if (seg0 === 'shipments' && seg1) {
    const shipment = SHIPMENTS.find(s => s.id === seg1) || SHIPMENTS[0]
    return ok(shipment)
  }
  if (seg0 === 'shipments') {
    return { success: true, data: SHIPMENTS, pagination: { total: SHIPMENTS.length, page: 1, limit: 20, totalPages: 1 } }
  }

  // ── Production Requests ───────────────────────────────────
  if (seg0 === 'production-requests' && seg1 === 'stats') {
    return ok({
      total: PRODUCTION_REQUESTS.length,
      byStatus: {
        PENDING: 1, IN_PRODUCTION: 1, QUALITY_CHECK: 1, COMPLETED: 1,
      },
    })
  }
  if (seg0 === 'production-requests' && seg1) {
    const pr = PRODUCTION_REQUESTS.find(p => p.id === seg1) || PRODUCTION_REQUESTS[0]
    return ok(normalizePR(pr))
  }
  if (seg0 === 'production-requests') {
    const normalized = PRODUCTION_REQUESTS.map(normalizePR)
    return { success: true, data: normalized, pagination: { total: normalized.length, page: 1, limit: 20, totalPages: 1 } }
  }

  // ── In-Store Sales (POS) ──────────────────────────────────
  if (seg0 === 'in-store-sales') {
    if (method === 'POST') {
      return ok({ id: 'sale-demo', message: 'Vente enregistrée' })
    }
    if (seg1 === 'stores-summary') {
      // Used by /magasins page
      const storesSummary = STORES.map(store => {
        const sales = POS_DAILY_SUMMARY.filter(s => s.storeId === store.id)
        const totalAmount = sales.reduce((sum, s) => sum + s.totalRevenue, 0)
        const totalCount = sales.reduce((sum, s) => sum + s.totalSales, 0)
        return {
          id: store.id, name: store.name, slug: store.slug,
          sales: { count: totalCount, totalAmount, avgBasket: totalCount ? Math.round(totalAmount / totalCount) : 0 },
          returns: { count: 2 },
        }
      })
      const totalAmount = storesSummary.reduce((s, st) => s + st.sales.totalAmount, 0)
      const totalCount = storesSummary.reduce((s, st) => s + st.sales.count, 0)
      return ok({
        period: { startDate: '2026-02-25', endDate: '2026-03-27' },
        stores: storesSummary,
        totals: { salesCount: totalCount, salesAmount: totalAmount, returnsCount: 4, avgBasket: totalCount ? Math.round(totalAmount / totalCount) : 0 },
      })
    }
    if (seg1 === 'summary') {
      const storeSlug = seg2 || 'casablanca-centre'
      const store = STORES.find(s => s.slug === storeSlug) || STORES[0]
      const sales = POS_DAILY_SUMMARY.filter(s => s.storeId === store.id)
      return ok({
        store,
        today: sales[0] || { totalRevenue: 0, totalSales: 0, cashAmount: 0, cardAmount: 0 },
        last7days: sales.slice(0, 7),
        last30days: sales,
        items: [],
      })
    }
    return ok([])
  }

  // ── Ventes Magasin ────────────────────────────────────────
  if (seg0 === 'ventes-magasin') {
    const storeId = seg1 === 'rabat-agdal' ? 'store-2' : 'store-1'
    const sales = POS_DAILY_SUMMARY.filter(s => s.storeId === storeId)
    return ok({
      daily: sales,
      total: sales.reduce((sum, s) => sum + s.totalRevenue, 0),
      byProduct: ANALYTICS_DATA.topProducts,
    })
  }

  // ── Analytics ─────────────────────────────────────────────
  if (seg0 === 'analytics') {
    return ok(ANALYTICS_DATA)
  }

  // ── Notifications ─────────────────────────────────────────
  if (seg0 === 'notifications') {
    return ok(NOTIFICATIONS)
  }

  // ── Clients ───────────────────────────────────────────────
  if (seg0 === 'clients' && seg1) {
    const client = CLIENTS.find(c => c.id === seg1) || CLIENTS[0]
    return ok(client)
  }
  if (seg0 === 'clients') {
    const { items, pagination } = paginate(CLIENTS)
    return { success: true, data: items, pagination }
  }

  // ── Coupons ───────────────────────────────────────────────
  if (seg0 === 'coupons' && seg1 === 'validate') {
    return ok({ valid: true, discount: 10, type: 'PERCENTAGE', message: 'Coupon valide' })
  }
  if (seg0 === 'coupons') {
    return ok(COUPONS)
  }

  // ── Retour (returns) ──────────────────────────────────────
  if (seg0 === 'retour' || seg0 === 'returns') {
    const returned = ORDERS.filter(o => o.status === 'RETURNED')
    return ok({ returns: returned, total: returned.length })
  }

  // ── Settings / System ─────────────────────────────────────
  if (seg0 === 'settings') {
    return ok({ storeName: 'ATLAS DENIM', currency: 'DH', timezone: 'Africa/Casablanca' })
  }

  // ── Default — return empty success ────────────────────────
  return ok(null)
}
