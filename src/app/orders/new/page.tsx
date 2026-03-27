'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast from '@/components/Toast';
import StockProductSelector, { OrderItem } from '@/components/StockProductSelector';
import api from '@/lib/api';

type City = {
  id: number;
  cityName: string;
  sectors?: Sector[];
};

type Sector = {
  id: number;
  sectorName: string;
};

export default function NewOrderPage() {
  const [loading, setLoading] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [citySearch, setCitySearch] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerCity: '',
    customerAddress: '',
    products: '',
    totalAmount: '',
    paymentMethod: 'CASH_ON_DELIVERY',
    paymentStatus: 'PENDING',
    deliveryCity: '',
    deliverySector: '',
    notes: '',
    sourceStoreId: '',
  });
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const { isSidebarCollapsed } = useLayout();
  const router = useRouter();

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    loadCities();
    loadStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStores = async () => {
    try {
      const response = await api.get('/stores');
      if (response.data.success) setStores(response.data.data);
    } catch (error) {
      console.error('Failed to load stores:', error);
    }
  };

  const loadCities = async () => {
    try {
      const response = await api.get('/delivery/cities');
      if (response.data.success) {
        setCities(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load cities:', error);
    }
  };

  const handleCitySelect = (cityName: string) => {
    setCitySearch(cityName);
    setFormData({
      ...formData,
      customerCity: cityName,
      deliveryCity: cityName,
      deliverySector: ''
    });
    setShowCityDropdown(false);

    // Find city and load its sectors
    const city = cities.find(c => c.cityName === cityName);
    if (city && city.sectors) {
      setSectors(city.sectors);
    } else {
      setSectors([]);
    }
  };

  const handleCitySearchChange = (value: string) => {
    setCitySearch(value);
    setShowCityDropdown(true);

    // If search is cleared, clear the selected city
    if (!value) {
      setFormData({
        ...formData,
        customerCity: '',
        deliveryCity: '',
        deliverySector: ''
      });
      setSectors([]);
    }
  };

  const filteredCities = cities.filter(city =>
    city.cityName.toLowerCase().includes(citySearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/orders', {
        ...formData,
        orderItems: orderItems.length > 0 ? orderItems : undefined,
      });

      if (response.data.success) {
        setToast({ message: 'Commande créée avec succès!', type: 'success' });
        setTimeout(() => {
          router.push(`/orders/${response.data.data.id}`);
        }, 1500);
      }
    } catch (error: any) {
      console.error('Failed to create order:', error);
      setToast({
        message: error.response?.data?.message || 'Erreur lors de la création de la commande',
        type: 'error'
      });
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleStockItemsChange = (items: OrderItem[]) => {
    setOrderItems(items);

    const productsText = items.map(item => {
      const sizeLabel = item.size
        ? (item.length ? ` T${item.size}/L${item.length}` : ` T${item.size}`)
        : '';
      return `${item.quantity}x ${item.productName}${sizeLabel}`;
    }).join(', ');

    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    setFormData(prev => ({
      ...prev,
      products: productsText,
      totalAmount: totalAmount.toFixed(2),
    }));
  };

  return (
    <div className="flex">
      <Sidebar />
      <main
        className={`flex-1 min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8 transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'
        }`}
      >
        <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/orders')}
            className="text-gray-600 hover:text-gray-900 flex items-center space-x-2 mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Retour aux commandes</span>
          </button>

          <h1 className="text-3xl font-bold text-gray-900">Nouvelle Commande</h1>
          <p className="text-gray-600 mt-2">
            Créez une nouvelle commande manuelle (WhatsApp, Téléphone, etc.)
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-8">
          {/* Customer Information */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Informations Client
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="customerName" className="block text-sm font-semibold text-gray-700 mb-2">
                  Nom Complet <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="customerName"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleChange}
                  required
                  className="input-field"
                  placeholder="Ex: Ahmed Alaoui"
                />
              </div>

              <div>
                <label htmlFor="customerPhone" className="block text-sm font-semibold text-gray-700 mb-2">
                  Téléphone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  id="customerPhone"
                  name="customerPhone"
                  value={formData.customerPhone}
                  onChange={handleChange}
                  required
                  className="input-field"
                  placeholder="Ex: 0612345678"
                />
              </div>

              <div className="relative">
                <label htmlFor="customerCity" className="block text-sm font-semibold text-gray-700 mb-2">
                  Ville <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="customerCity"
                    value={citySearch}
                    onChange={(e) => handleCitySearchChange(e.target.value)}
                    onFocus={() => setShowCityDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCityDropdown(false), 200)}
                    required
                    className="input-field pr-10"
                    placeholder="Rechercher une ville..."
                    autoComplete="off"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Dropdown */}
                {showCityDropdown && filteredCities.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredCities.map((city) => (
                      <button
                        key={city.id}
                        type="button"
                        onClick={() => handleCitySelect(city.cityName)}
                        className="w-full text-left px-4 py-2 hover:bg-orange-50 hover:text-orange-600 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        {city.cityName}
                      </button>
                    ))}
                  </div>
                )}

                {/* No results message */}
                {showCityDropdown && citySearch && filteredCities.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
                    Aucune ville trouvée
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="customerAddress" className="block text-sm font-semibold text-gray-700 mb-2">
                  Adresse <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="customerAddress"
                  name="customerAddress"
                  value={formData.customerAddress}
                  onChange={handleChange}
                  required
                  className="input-field"
                  placeholder="Ex: 123 Rue Mohamed V"
                />
              </div>
            </div>
          </div>

          {/* Source Magasin */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Source Magasin
            </h2>
            <select
              name="sourceStoreId"
              value={formData.sourceStoreId}
              onChange={handleChange}
              required
              className="input-field"
            >
              <option value="">Choisir le magasin source...</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Order Details */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Produits
            </h2>
            <div className="space-y-6">
              {formData.sourceStoreId ? (
                <StockProductSelector
                  storeId={formData.sourceStoreId}
                  onItemsChange={handleStockItemsChange}
                />
              ) : (
                <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-400">
                  Choisissez un magasin source pour voir les produits disponibles
                </div>
              )}

              {/* Hidden field for form validation */}
              <input type="hidden" name="products" value={formData.products} required />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="totalAmount" className="block text-sm font-semibold text-gray-700 mb-2">
                    Montant Total (DH) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="totalAmount"
                    name="totalAmount"
                    value={formData.totalAmount}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    className="input-field"
                    placeholder="Auto-calculé"
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-calculé depuis les produits. Modifiable pour offres spéciales.</p>
                </div>

                <div>
                  <label htmlFor="paymentMethod" className="block text-sm font-semibold text-gray-700 mb-2">
                    Méthode de Paiement <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="paymentMethod"
                    name="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={handleChange}
                    required
                    className="input-field"
                  >
                    <option value="CASH_ON_DELIVERY">Paiement à la Livraison</option>
                    <option value="BANK_TRANSFER">Virement Bancaire</option>
                    <option value="CREDIT_CARD">Carte de Crédit</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="mb-8">
            <label htmlFor="notes" className="block text-sm font-semibold text-gray-700 mb-2">
              Notes (Optionnel)
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="input-field"
              placeholder="Ajouter des notes ou instructions spéciales..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.push('/orders')}
              className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Création en cours...</span>
                </>
              ) : (
                <span>Créer la Commande</span>
              )}
            </button>
          </div>
        </form>
        </div>
      </main>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
