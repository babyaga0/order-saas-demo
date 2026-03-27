'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import ProductSelector from '@/components/ProductSelector';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';

type CartItem = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
};

type Sale = {
  id: string;
  saleNumber: string;
  customerPhone: string | null;
  paymentMethod: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  };
  items: {
    id: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
};

type Stats = {
  total: { count: number; amount: number };
  today: { count: number; amount: number };
  thisMonth: { count: number; amount: number };
  byPaymentMethod: { method: string; count: number; amount: number }[];
};

type StaffUser = {
  id: string;
  fullName: string;
  email: string;
};

export default function VentesMagasinPage() {
  const router = useRouter();
  const { isSidebarCollapsed } = useLayout();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentProduct, setCurrentProduct] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [currentPrice, setCurrentPrice] = useState('');

  // Sale form
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');

  // Filters
  const [filterStaffId, setFilterStaffId] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Tab state - default to History for all users
  const [activeTab, setActiveTab] = useState<'new-sale' | 'history'>('history');

  // Edit modal state
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editCart, setEditCart] = useState<CartItem[]>([]);
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('CASH');
  const [editNotes, setEditNotes] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete confirmation
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
        loadStaffList();
        loadStats();
      } else if (user.role === 'STAFF') {
        // For STAFF users, automatically filter to show only their own sales
        setFilterStaffId(user.id);
      }
      loadSales();
    }
  }, [user, page, filterStaffId, filterStartDate, filterEndDate, filterPaymentMethod]);

  const loadStaffList = async () => {
    try {
      const response = await api.get('/in-store-sales/staff');
      if (response.data.success) {
        setStaffList(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load staff list:', error);
    }
  };

  const loadStats = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStaffId) params.append('staffId', filterStaffId);
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);

      const response = await api.get(`/in-store-sales/stats?${params.toString()}`);
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadSales = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '10');
      if (filterStaffId) params.append('staffId', filterStaffId);
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);
      if (filterPaymentMethod) params.append('paymentMethod', filterPaymentMethod);

      const response = await api.get(`/in-store-sales?${params.toString()}`);
      if (response.data.success) {
        setSales(response.data.data);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to load sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = () => {
    if (!currentProduct.trim() || !currentPrice || parseFloat(currentPrice) <= 0) {
      alert('Veuillez remplir le nom du produit et le prix');
      return;
    }

    const newItem: CartItem = {
      id: Date.now().toString(),
      productName: currentProduct.trim(),
      quantity: currentQuantity,
      unitPrice: parseFloat(currentPrice),
    };

    setCart([...cart, newItem]);
    setCurrentProduct('');
    setCurrentQuantity(1);
    setCurrentPrice('');
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    setCart(
      cart.map((item) => (item.id === id ? { ...item, quantity: newQuantity } : item))
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const handleSubmitSale = async () => {
    if (cart.length === 0) {
      alert('Le panier est vide');
      return;
    }

    setSubmitting(true);
    try {
      const saleData = {
        customerPhone: customerPhone || null,
        paymentMethod,
        notes: notes || null,
        items: cart.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      };

      const response = await api.post('/in-store-sales', saleData);
      if (response.data.success) {
        setLastSale(response.data.data);
        setShowSuccess(true);

        // Reset form
        setCart([]);
        setCustomerPhone('');
        setPaymentMethod('CASH');
        setNotes('');

        // Reload data
        loadSales();
        if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
          loadStats();
        }

        // Switch to history tab to show the new sale
        setActiveTab('history');

        // Hide success after 5 seconds
        setTimeout(() => setShowSuccess(false), 5000);
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de la création de la vente');
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-MA', {
      style: 'currency',
      currency: 'MAD',
    }).format(price);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'CASH':
        return 'Espèces';
      case 'CARD':
        return 'Carte';
      case 'MIXED':
        return 'Mixte';
      default:
        return method;
    }
  };

  const handleProductSelectorChange = (products: any[]) => {
    // Convert ProductSelector format to cart format
    const newCartItems: CartItem[] = products.map((item, index) => {
      const productName = item.product.name;
      const variation = item.variation
        ? ` (${JSON.parse(item.variation.attributes || '[]')
            .map((attr: any) => attr.option)
            .join(', ')})`
        : '';
      const price = parseFloat(item.variation?.price || item.product.price || '0');

      return {
        id: `selector-${index}-${Date.now()}`,
        productName: `${productName}${variation}`,
        quantity: item.quantity,
        unitPrice: price,
      };
    });
    setCart(newCartItems);
  };

  const updatePrice = (id: string, newPrice: number) => {
    if (newPrice < 0) return;
    setCart(
      cart.map((item) => (item.id === id ? { ...item, unitPrice: newPrice } : item))
    );
  };

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  // Open edit modal
  const openEditModal = (sale: Sale) => {
    setEditingSale(sale);
    setEditCart(sale.items.map((item, index) => ({
      id: `edit-${index}`,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })));
    setEditCustomerPhone(sale.customerPhone || '');
    setEditPaymentMethod(sale.paymentMethod);
    setEditNotes(sale.notes || '');
  };

  // Close edit modal
  const closeEditModal = () => {
    setEditingSale(null);
    setEditCart([]);
    setEditCustomerPhone('');
    setEditPaymentMethod('CASH');
    setEditNotes('');
  };

  // Handle edit submit
  const handleEditSubmit = async () => {
    if (!editingSale || editCart.length === 0) return;

    setEditSubmitting(true);
    try {
      const updateData = {
        customerPhone: editCustomerPhone || null,
        paymentMethod: editPaymentMethod,
        notes: editNotes || null,
        items: editCart.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      };

      const response = await api.put(`/in-store-sales/${editingSale.id}`, updateData);
      if (response.data.success) {
        closeEditModal();
        loadSales();
        if (isAdmin) loadStats();
        alert('Vente modifiée avec succès');
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de la modification');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (saleId: string) => {
    try {
      const response = await api.delete(`/in-store-sales/${saleId}`);
      if (response.data.success) {
        setDeleteConfirm(false);
        setDeletingSaleId(null);
        loadSales();
        if (isAdmin) loadStats();
        alert('Vente supprimée avec succès');
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  // Edit cart functions
  const updateEditQuantity = (id: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    setEditCart(editCart.map((item) => (item.id === id ? { ...item, quantity: newQuantity } : item)));
  };

  const updateEditPrice = (id: string, newPrice: number) => {
    if (newPrice < 0) return;
    setEditCart(editCart.map((item) => (item.id === id ? { ...item, unitPrice: newPrice } : item)));
  };

  const removeEditItem = (id: string) => {
    setEditCart(editCart.filter((item) => item.id !== id));
  };

  const editCartTotal = editCart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className={`flex-1 p-6 space-y-6 transition-all duration-300 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Ventes Magasin</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('new-sale')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'new-sale'
                ? 'bg-orange-400 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Nouvelle Vente
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-orange-400 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isAdmin ? 'Historique' : 'Mes Ventes'}
          </button>
        </div>
      </div>

      {/* Success Message */}
      {showSuccess && lastSale && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-green-500 text-2xl">✓</span>
              <div>
                <p className="font-semibold text-green-800">Vente enregistrée avec succès!</p>
                <p className="text-sm text-green-700">
                  N° {lastSale.saleNumber} - {formatPrice(Number(lastSale.totalAmount))}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSuccess(false)}
              className="text-green-600 hover:text-green-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Admin Stats */}
      {isAdmin && stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="text-sm font-medium text-blue-800">Aujourd'hui</h3>
            <p className="text-2xl font-bold text-blue-900">
              {formatPrice(Number(stats.today.amount))}
            </p>
            <p className="text-sm text-blue-700">{stats.today.count} ventes</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h3 className="text-sm font-medium text-green-800">Ce Mois</h3>
            <p className="text-2xl font-bold text-green-900">
              {formatPrice(Number(stats.thisMonth.amount))}
            </p>
            <p className="text-sm text-green-700">{stats.thisMonth.count} ventes</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <h3 className="text-sm font-medium text-purple-800">Total</h3>
            <p className="text-2xl font-bold text-purple-900">
              {formatPrice(Number(stats.total.amount))}
            </p>
            <p className="text-sm text-purple-700">{stats.total.count} ventes</p>
          </div>
        </div>
      )}

      {activeTab === 'new-sale' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product Selector - Takes 2/3 of space */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <svg className="w-6 h-6 text-orange-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h2 className="text-xl font-bold text-gray-800">Sélectionner les Produits</h2>
            </div>
            <ProductSelector onProductsChange={handleProductSelectorChange} />
          </div>

          {/* Cart Summary - Sticky on the right, takes 1/3 of space */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg shadow-lg p-6 sticky top-6 border-2 border-orange-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">Panier</h2>
                <div className="bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                  {cart.length}
                </div>
              </div>

            {cart.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <p className="text-gray-400 font-medium">Panier vide</p>
                <p className="text-sm text-gray-400 mt-1">Ajoutez des produits</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Cart Items */}
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                  {cart.map((item, index) => (
                    <div key={item.id} className="bg-white rounded-lg p-3 border-2 border-orange-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-800 text-sm">{item.productName}</div>
                          <div className="text-xs text-gray-500 mt-1">Quantité: {item.quantity}</div>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-400 hover:text-red-600 ml-2"
                          title="Retirer du panier"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 text-sm border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          />
                          <span className="text-xs text-gray-500">MAD</span>
                        </div>
                        <div className="font-bold text-orange-600">
                          {formatPrice(item.unitPrice * item.quantity)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Section */}
                <div className="bg-white rounded-lg p-4 border-2 border-orange-300">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-700">Total à payer</span>
                    <span className="text-3xl font-bold text-orange-600">{formatPrice(cartTotal)}</span>
                  </div>
                </div>

                {/* Sale Details */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      💳 Méthode de Paiement *
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-medium bg-white"
                    >
                      <option value="CASH">💵 Espèces</option>
                      <option value="CARD">💳 Carte</option>
                      <option value="MIXED">💵💳 Mixte</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      📱 Téléphone Client (optionnel)
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      placeholder="06XXXXXXXX"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      📝 Notes (optionnel)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      placeholder="Notes supplémentaires..."
                    />
                  </div>
                </div>

                {/* Validation Button - Big and Prominent */}
                <button
                  onClick={handleSubmitSale}
                  disabled={submitting || cart.length === 0}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Valider la Vente</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filters - Available to all users */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className={`grid grid-cols-1 gap-4 ${isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
              {/* Vendeur filter - Admin Only */}
              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vendeur
                  </label>
                  <select
                    value={filterStaffId}
                    onChange={(e) => {
                      setFilterStaffId(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                  >
                    <option value="">Tous</option>
                    {staffList.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Début
                </label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => {
                    setFilterStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Fin
                </label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => {
                    setFilterEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Paiement
                </label>
                <select
                  value={filterPaymentMethod}
                  onChange={(e) => {
                    setFilterPaymentMethod(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                >
                  <option value="">Tous</option>
                    <option value="CASH">Espèces</option>
                    <option value="CARD">Carte</option>
                    <option value="MIXED">Mixte</option>
                  </select>
                </div>
              </div>
            </div>

          {/* Sales List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Chargement...</div>
            ) : sales.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Aucune vente trouvée</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        N° Vente
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      {isAdmin && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Vendeur
                        </th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Articles
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Paiement
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Total
                      </th>
                      {isAdmin && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {sale.saleNumber}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDate(sale.createdAt)}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {sale.createdBy.fullName}
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div className="max-w-xs">
                            {sale.items.map((item, idx) => (
                              <div key={idx} className="text-xs">
                                {item.quantity}x {item.productName}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              sale.paymentMethod === 'CASH'
                                ? 'bg-green-100 text-green-800'
                                : sale.paymentMethod === 'CARD'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {getPaymentMethodLabel(sale.paymentMethod)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                          {formatPrice(Number(sale.totalAmount))}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => openEditModal(sale)}
                                className="text-blue-600 hover:text-blue-800 p-1"
                                title="Modifier"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => {
                                  setDeletingSaleId(sale.id);
                                  setDeleteConfirm(true);
                                }}
                                className="text-red-600 hover:text-red-800 p-1"
                                title="Supprimer"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                >
                  Précédent
                </button>
                <span className="text-sm text-gray-700">
                  Page {page} sur {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  Modifier la Vente {editingSale.saleNumber}
                </h2>
                <button
                  onClick={closeEditModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Edit Items */}
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">Articles</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {editCart.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                      <span className="flex-1 text-sm">{item.productName}</span>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateEditQuantity(item.id, parseInt(e.target.value) || 1)}
                        className="w-16 px-2 py-1 text-sm border rounded"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => updateEditPrice(item.id, parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 text-sm border rounded"
                      />
                      <span className="text-sm font-medium w-24 text-right">
                        {formatPrice(item.unitPrice * item.quantity)}
                      </span>
                      <button
                        onClick={() => removeEditItem(item.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-right font-bold text-lg">
                  Total: {formatPrice(editCartTotal)}
                </div>
              </div>

              {/* Edit Form Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Méthode de Paiement
                  </label>
                  <select
                    value={editPaymentMethod}
                    onChange={(e) => setEditPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="CASH">Espèces</option>
                    <option value="CARD">Carte</option>
                    <option value="MIXED">Mixte</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone Client
                  </label>
                  <input
                    type="tel"
                    value={editCustomerPhone}
                    onChange={(e) => setEditCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="06XXXXXXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Edit Actions */}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={closeEditModal}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Annuler
                </button>
                <button
                  onClick={handleEditSubmit}
                  disabled={editSubmitting || editCart.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {editSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && deletingSaleId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Supprimer cette vente ?
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Cette action est irréversible. La vente sera définitivement supprimée.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => {
                    setDeleteConfirm(false);
                    setDeletingSaleId(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleDelete(deletingSaleId)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
