'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
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
    role: string;
  };
  store: {
    id: string;
    name: string;
  };
  items: {
    id: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
};

const STORE_NAME = 'Rabat Agdal';
const STORE_ID = '257e355c-ae4d-4606-8e81-2f907ef15b6f';

export default function SidiMaaroufPage() {
  const router = useRouter();
  const { isSidebarCollapsed } = useLayout();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
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
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Tab state
  const [activeTab, setActiveTab] = useState<'new-sale' | 'history'>('new-sale');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);

      // Check permissions - only ADMIN and STORE_CASHIER for this store can access
      if (parsedUser.role === 'STORE_CASHIER' && parsedUser.storeId !== STORE_ID) {
        router.push('/dashboard');
      }
    }
  }, [router]);

  useEffect(() => {
    if (user) {
      loadSales();
    }
  }, [user, page, filterStartDate, filterEndDate, filterPaymentMethod]);

  const loadSales = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '10');
      params.append('storeId', STORE_ID);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return amount.toFixed(2) + ' MAD';
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div
        className="flex-1 flex flex-col overflow-hidden transition-all duration-300"
        style={{ marginLeft: isSidebarCollapsed ? '80px' : '256px' }}
      >
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">
                Ventes Magasin - {STORE_NAME}
              </h1>
              <p className="text-gray-600 mt-1">
                Gérer les ventes en magasin pour {STORE_NAME}
              </p>
            </div>

            {/* Success Message */}
            {showSuccess && lastSale && (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <svg
                    className="w-6 h-6 text-green-600 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <div>
                    <h3 className="text-green-800 font-medium">
                      Vente enregistrée avec succès!
                    </h3>
                    <p className="text-green-700 text-sm">
                      N° {lastSale.saleNumber} - {formatCurrency(lastSale.totalAmount)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="mb-6">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('new-sale')}
                    className={`${
                      activeTab === 'new-sale'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                  >
                    Nouvelle Vente
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`${
                      activeTab === 'history'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                  >
                    Historique des Ventes
                  </button>
                </nav>
              </div>
            </div>

            {/* New Sale Tab */}
            {activeTab === 'new-sale' && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  Créer une Nouvelle Vente
                </h2>

                {/* Manual Product Entry */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ajouter un Produit
                  </label>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          placeholder="Nom du produit"
                          value={currentProduct}
                          onChange={(e) => setCurrentProduct(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          placeholder="Quantité"
                          min="1"
                          value={currentQuantity}
                          onChange={(e) => setCurrentQuantity(parseInt(e.target.value) || 1)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Prix (MAD)"
                          value={currentPrice}
                          onChange={(e) => setCurrentPrice(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <button
                      onClick={addToCart}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      Ajouter au Panier
                    </button>
                  </div>
                </div>

                {/* Cart */}
                {cart.length > 0 && (
                  <div className="mb-6 border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Panier ({cart.length} article{cart.length > 1 ? 's' : ''})
                    </h3>
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{item.productName}</p>
                            <p className="text-sm text-gray-500">
                              {formatCurrency(item.unitPrice)} × {item.quantity}
                            </p>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                              >
                                -
                              </button>
                              <span className="w-12 text-center font-medium">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                              >
                                +
                              </button>
                            </div>
                            <span className="font-semibold text-gray-900 w-24 text-right">
                              {formatCurrency(item.unitPrice * item.quantity)}
                            </span>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between text-lg font-bold text-gray-900">
                        <span>Total</span>
                        <span>{formatCurrency(cartTotal)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sale Details */}
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Téléphone Client (Optionnel)
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="06XXXXXXXX"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Méthode de Paiement
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="CASH">Espèces</option>
                      <option value="CARD">Carte Bancaire</option>
                      <option value="MIXED">Mixte</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes (Optionnel)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Notes supplémentaires..."
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleSubmitSale}
                  disabled={submitting || cart.length === 0}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  {submitting ? 'Enregistrement...' : 'Enregistrer la Vente'}
                </button>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="bg-white rounded-lg shadow-sm">
                {/* Filters */}
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtres</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date Début
                      </label>
                      <input
                        type="date"
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date Fin
                      </label>
                      <input
                        type="date"
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Méthode de Paiement
                      </label>
                      <select
                        value={filterPaymentMethod}
                        onChange={(e) => setFilterPaymentMethod(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="">Toutes</option>
                        <option value="CASH">Espèces</option>
                        <option value="CARD">Carte Bancaire</option>
                        <option value="MIXED">Mixte</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Sales List */}
                <div className="p-6">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                    </div>
                  ) : sales.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">Aucune vente trouvée</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sales.map((sale) => (
                        <div
                          key={sale.id}
                          className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">
                                {sale.saleNumber}
                              </h3>
                              <p className="text-sm text-gray-500">{formatDate(sale.createdAt)}</p>
                              <p className="text-sm text-gray-600">
                                Par: {sale.createdBy.fullName}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-gray-900">
                                {formatCurrency(sale.totalAmount)}
                              </p>
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                  sale.paymentMethod === 'CASH'
                                    ? 'bg-green-100 text-green-800'
                                    : sale.paymentMethod === 'CARD'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-purple-100 text-purple-800'
                                }`}
                              >
                                {sale.paymentMethod === 'CASH'
                                  ? 'Espèces'
                                  : sale.paymentMethod === 'CARD'
                                  ? 'Carte'
                                  : 'Mixte'}
                              </span>
                            </div>
                          </div>

                          {/* Items */}
                          <div className="space-y-2 mb-3">
                            {sale.items?.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="text-gray-700">
                                  {item.productName} × {item.quantity}
                                </span>
                                <span className="text-gray-900 font-medium">
                                  {formatCurrency(item.totalPrice)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Notes */}
                          {sale.notes && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Notes:</span> {sale.notes}
                              </p>
                            </div>
                          )}

                          {/* Customer Phone */}
                          {sale.customerPhone && (
                            <div className="mt-2">
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Client:</span> {sale.customerPhone}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center space-x-2 mt-6">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      >
                        Précédent
                      </button>
                      <span className="text-sm text-gray-600">
                        Page {page} sur {totalPages}
                      </span>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      >
                        Suivant
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
