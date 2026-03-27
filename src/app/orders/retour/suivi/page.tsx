'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import { Toaster } from 'react-hot-toast';
import api from '@/lib/api';

interface OrderItem {
  productId: number;
  productName: string;
  shortCode: string;
  size?: string;
  length?: string;
  quantity: number;
  price: number;
  variationId?: number;
}

interface CathedisReturn {
  id: string;
  returnNumber: string;
  productId: number;
  productVariationId?: number;
  condition: string;
  notes?: string;
  createdAt: string;
  store: { id: string; name: string };
  product: { id: number; name: string; shortCode: string };
  productVariation?: { id: number; size: string; length?: string };
  createdBy: { id: string; fullName: string };
}

interface RetourOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  returnStatus: string;
  paymentStatus?: string;
  deliveryStatus?: string;
  orderItems: OrderItem[] | null;
  cathedisReturns: CathedisReturn[];
  sourceStore?: { id: string; name: string };
  etat: 'en_route' | 'a_enregistrer' | 'partiel' | 'recu';
  itemCount: number;
  returnRecordCount: number;
  updatedAt: string;
}

interface Counts {
  all: number;
  a_enregistrer: number;
  recu: number;
  en_route: number;
}

interface Store {
  id: string;
  name: string;
}

const TABS = [
  { key: 'all', label: 'Tous' },
  { key: 'a_enregistrer', label: '⚠️ À enregistrer' },
  { key: 'recu', label: '✅ Reçu' },
  { key: 'en_route', label: '⏳ En route' },
] as const;

type TabKey = typeof TABS[number]['key'];

const ETAT_ORDER = { a_enregistrer: 0, partiel: 1, recu: 2, en_route: 3 };

const ETAT_CONFIG = {
  en_route: { label: 'En route', className: 'bg-gray-100 text-gray-700' },
  a_enregistrer: { label: 'À enregistrer', className: 'bg-orange-100 text-orange-700' },
  partiel: { label: 'Partiel', className: 'bg-yellow-100 text-yellow-700' },
  recu: { label: 'Reçu', className: 'bg-green-100 text-green-700' },
};

const RETURN_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  NEW: { label: 'NEW', className: 'bg-gray-100 text-gray-600' },
  IN_RETURN: { label: 'IN_RETURN', className: 'bg-orange-100 text-orange-700' },
  SEND_TO_CENTRAL_HUB: { label: 'SEND_TO_CENTRAL_HUB', className: 'bg-orange-100 text-orange-700' },
  RETURNED_TO_STORE: { label: 'RETURNED_TO_STORE', className: 'bg-blue-100 text-blue-700' },
  RECUPERATED: { label: 'RECUPERATED', className: 'bg-blue-100 text-blue-700' },
  PROCESSED: { label: 'PROCESSED', className: 'bg-purple-100 text-purple-700' },
  RETURNED: { label: 'RETURNED', className: 'bg-green-100 text-green-700' },
};

export default function RetourSuiviPage() {
  const { isSidebarCollapsed } = useLayout();
  const [tab, setTab] = useState<TabKey>('all');
  const [orders, setOrders] = useState<RetourOrder[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, a_enregistrer: 0, recu: 0, en_route: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [storeId, setStoreId] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load stores for dropdown
  useEffect(() => {
    api.get('/stores').then(r => {
      if (r.data.success) setStores(r.data.data);
    }).catch(() => {});
  }, []);

  const loadData = useCallback(async (currentTab: TabKey, currentPage: number, currentSearch: string, currentDate: string, currentStoreId: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        tab: currentTab,
        page: String(currentPage),
        limit: '50',
        ...(currentSearch && { search: currentSearch }),
        ...(currentDate && { date: currentDate }),
        ...(currentStoreId && { storeId: currentStoreId }),
      });
      const res = await api.get(`/orders/returns/suivi?${params.toString()}`);
      if (res.data.success) {
        const sorted = [...res.data.data].sort((a: RetourOrder, b: RetourOrder) =>
          (ETAT_ORDER[a.etat] ?? 99) - (ETAT_ORDER[b.etat] ?? 99)
        );
        setOrders(sorted);
        setCounts(res.data.counts);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch (err) {
      console.error('Failed to load returns suivi', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(tab, page, search, date, storeId);
  }, [tab, page, date, storeId, loadData]);

  // Debounce search
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      loadData(tab, 1, value, date, storeId);
    }, 300);
  };

  const handleTabChange = (newTab: TabKey) => {
    setTab(newTab);
    setPage(1);
    setExpandedRows(new Set());
  };

  const handleDateChange = (value: string) => {
    setDate(value);
    setPage(1);
  };

  const handleStoreChange = (value: string) => {
    setStoreId(value);
    setPage(1);
  };

  const toggleRow = (orderId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

  const getItemReception = (order: RetourOrder, item: OrderItem): CathedisReturn | undefined =>
    order.cathedisReturns.find(r =>
      r.productId === item.productId &&
      (!item.variationId || r.productVariationId === item.variationId)
    );

  const hasActiveFilters = search || date || storeId;

  return (
    <>
      <Toaster position="top-right" />
      <div className="flex">
        <Sidebar />
        <main
          className={`flex-1 min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8 transition-all duration-300 ${
            isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'
          }`}
        >
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Suivi des Retours</h1>
              <p className="text-gray-500 mt-1 text-sm">
                Comparaison entre les retours Cathedis et la réception magasin
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => handleTabChange(t.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === t.key
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                    tab === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {t.key === 'all' ? counts.all
                      : t.key === 'a_enregistrer' ? counts.a_enregistrer
                      : t.key === 'recu' ? counts.recu
                      : counts.en_route}
                  </span>
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-6 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="N° commande..."
                  value={search}
                  onChange={e => handleSearchChange(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* Date picker */}
              <input
                type="date"
                value={date}
                onChange={e => handleDateChange(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
              />

              {/* Store dropdown */}
              <select
                value={storeId}
                onChange={e => handleStoreChange(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">Tous les magasins</option>
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  onClick={() => { setSearch(''); setDate(''); setStoreId(''); setPage(1); }}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
                >
                  ✕ Effacer
                </button>
              )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-[40px_1fr_160px_180px_120px_130px] gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div />
                <div>Commande</div>
                <div>Cathedis</div>
                <div>Réception magasin</div>
                <div>Montant</div>
                <div>État</div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  Aucun retour trouvé
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {orders.map(order => {
                    const isExpanded = expandedRows.has(order.id);
                    const items = order.orderItems || [];
                    const statusCfg = RETURN_STATUS_CONFIG[order.returnStatus] ?? { label: order.returnStatus, className: 'bg-gray-100 text-gray-600' };
                    const etatCfg = ETAT_CONFIG[order.etat];

                    return (
                      <div key={order.id}>
                        <div
                          className="grid grid-cols-[40px_1fr_160px_180px_120px_130px] gap-4 px-4 py-4 hover:bg-gray-50 cursor-pointer items-center"
                          onClick={() => toggleRow(order.id)}
                        >
                          <div className="flex items-center justify-center text-gray-400">
                            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>

                          <div>
                            <div className="font-medium text-gray-900 text-sm">{order.orderNumber}</div>
                            <div className="text-gray-500 text-xs mt-0.5">{order.customerName}</div>
                            {order.deliveryStatus && (
                              <div className="text-gray-400 text-xs mt-0.5 truncate max-w-[200px]">{order.deliveryStatus}</div>
                            )}
                          </div>

                          <div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusCfg.className}`}>
                              {statusCfg.label}
                            </span>
                            {order.paymentStatus === 'RETURN_CUSTOMER' && (
                              <div className="mt-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                  RETURN_CUSTOMER
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="text-sm">
                            {order.etat === 'en_route' ? (
                              <span className="text-gray-400">—</span>
                            ) : order.returnRecordCount === 0 ? (
                              <span className="text-orange-600 font-medium">⚠️ 0/{order.itemCount || '?'} enregistré</span>
                            ) : (
                              <span className={order.etat === 'recu' ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>
                                {order.etat === 'recu' ? '✅' : '⚠️'} {order.returnRecordCount}/{order.itemCount || order.returnRecordCount} enregistré
                              </span>
                            )}
                          </div>

                          <div className="text-sm font-semibold text-gray-900">
                            {formatCurrency(Number(order.totalAmount))}
                          </div>

                          <div>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${etatCfg.className}`}>
                              {etatCfg.label}
                            </span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="bg-gray-50 border-t border-gray-100 px-4 pb-3">
                            <div className="ml-10 mt-3 space-y-2">
                              {items.length > 0 ? (
                                items.map((item, idx) => {
                                  const reception = getItemReception(order, item);
                                  return (
                                    <div key={idx} className="flex items-center gap-4 bg-white rounded-lg border border-gray-200 px-4 py-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-800 truncate">{item.productName}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                          {item.shortCode}
                                          {item.size && ` · T${item.size}`}
                                          {item.length && `/L${item.length}`}
                                          {` · x${item.quantity}`}
                                        </div>
                                      </div>
                                      <div className="shrink-0">
                                        {reception ? (
                                          <div className="text-right">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-medium">
                                              ✅ Reçu {formatDate(reception.createdAt)}
                                            </span>
                                            <div className="text-xs text-gray-400 mt-1">
                                              {reception.condition === 'RESTOCKABLE' ? 'Restockable' : 'Défectueux'}
                                              {reception.store && ` · ${reception.store.name}`}
                                            </div>
                                          </div>
                                        ) : order.etat !== 'en_route' ? (
                                          <span className="inline-flex items-center px-2 py-1 rounded bg-orange-100 text-orange-700 text-xs font-medium">
                                            ⚠️ Non enregistré
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 text-xs">En route</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              ) : order.cathedisReturns.length > 0 ? (
                                order.cathedisReturns.map(r => (
                                  <div key={r.id} className="flex items-center gap-4 bg-white rounded-lg border border-gray-200 px-4 py-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-gray-800">{r.product.name}</div>
                                      <div className="text-xs text-gray-500 mt-0.5">
                                        {r.product.shortCode}
                                        {r.productVariation && ` · T${r.productVariation.size}${r.productVariation.length ? `/L${r.productVariation.length}` : ''}`}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-medium">
                                        ✅ Reçu {formatDate(r.createdAt)}
                                      </span>
                                      {r.store && (
                                        <div className="text-xs text-gray-400 mt-1">
                                          {r.condition === 'RESTOCKABLE' ? 'Restockable' : 'Défectueux'} · {r.store.name}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-sm text-gray-400 py-2">
                                  Aucun article enregistré sur cette commande
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50"
                >
                  Précédent
                </button>
                <span className="text-sm text-gray-600">Page {page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50"
                >
                  Suivant
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
