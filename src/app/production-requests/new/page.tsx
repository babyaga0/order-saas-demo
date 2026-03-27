'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import toast, { Toaster } from 'react-hot-toast';
import api from '@/lib/api';

interface Product {
  id: number;
  name: string;
  shortCode: string;
  imageUrl: string;
  variations: ProductVariation[];
}

interface ProductVariation {
  id: number;
  name: string;
  size: string;
  length: string;
  shortCode: string;
}

interface RequestItem {
  productId: number;
  productVariationId: number | null;
  productName: string;
  variationName: string | null;
  quantityRequested: number;
}

export default function NewProductionRequestPage() {
  const router = useRouter();
  const { isSidebarCollapsed } = useLayout();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [productQuantities, setProductQuantities] = useState<Record<number, Record<number, number>>>({});
  const [bulkQuantity, setBulkQuantity] = useState<Record<number, string>>({});
  const [expandedAddedProducts, setExpandedAddedProducts] = useState<Set<number>>(new Set());

  const [formData, setFormData] = useState({
    title: '',
    dueDate: '',
    notes: '',
  });

  const [items, setItems] = useState<RequestItem[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'PRODUCTION', 'FACTORY_MANAGER'];

      if (!allowedRoles.includes(user.role)) {
        router.push('/production-requests');
        return;
      }
    }

    fetchProducts();
  }, [router]);

  const PRODUCTS_CACHE_KEY = 'prod_form_products_cache';
  const PRODUCTS_CACHE_TTL = 5 * 60 * 1000;

  const fetchProducts = async () => {
    try {
      // Show cached data instantly
      const cached = localStorage.getItem(PRODUCTS_CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < PRODUCTS_CACHE_TTL) {
          setProducts(data);
        }
      }
      // Always refresh in background
      const response = await api.get('/products/manual');
      if (response.data.success) {
        setProducts(response.data.data);
        localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({ data: response.data.data, ts: Date.now() }));
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.shortCode && p.shortCode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const toggleExpand = (productId: number) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  const handleQuantityChange = (productId: number, variationId: number, quantity: number) => {
    setProductQuantities(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        [variationId]: quantity,
      },
    }));
  };

  const handleBulkQuantity = (productId: number, product: Product) => {
    const qty = parseInt(bulkQuantity[productId] || '0');
    if (!qty || qty <= 0) {
      toast.error('Veuillez entrer une quantité valide');
      return;
    }

    const newQuantities = { ...productQuantities };
    if (!newQuantities[productId]) {
      newQuantities[productId] = {};
    }

    if (product.variations.length > 0) {
      product.variations.forEach(variation => {
        newQuantities[productId][variation.id] = qty;
      });
      toast.success(`Quantité ${qty} appliquée à toutes les variations`);
    } else {
      // Products without variations (accessoires)
      newQuantities[productId][-1] = qty;
      toast.success(`Quantité ${qty} appliquée`);
    }

    setProductQuantities(newQuantities);
  };

  const clearProductQuantities = (productId: number) => {
    const newQuantities = { ...productQuantities };
    delete newQuantities[productId];
    setProductQuantities(newQuantities);
    toast.success('Quantités effacées');
  };

  const getProductTotal = (productId: number) => {
    const quantities = productQuantities[productId] || {};
    return Object.values(quantities).reduce((sum, qty) => sum + (qty || 0), 0);
  };

  const handleAddProduct = (product: Product) => {
    const quantities = productQuantities[product.id] || {};
    const newItems: RequestItem[] = [];

    if (product.variations.length > 0) {
      // Products with variations (jeans, vestes, ensembles)
      product.variations.forEach(variation => {
        const qty = quantities[variation.id] || 0;
        if (qty > 0) {
          const existingIndex = items.findIndex(
            item => item.productId === product.id && item.productVariationId === variation.id
          );
          if (existingIndex === -1) {
            newItems.push({
              productId: product.id,
              productVariationId: variation.id,
              productName: product.name,
              variationName: variation.length ? `T${variation.size}/L${variation.length}` : variation.size,
              quantityRequested: qty,
            });
          } else {
            const updatedItems = [...items];
            updatedItems[existingIndex].quantityRequested = qty;
            setItems(updatedItems);
          }
        }
      });
    } else {
      // Products without variations (accessoires)
      const qty = quantities[-1] || 0;
      if (qty > 0) {
        const existingIndex = items.findIndex(
          item => item.productId === product.id && item.productVariationId === null
        );
        if (existingIndex === -1) {
          newItems.push({
            productId: product.id,
            productVariationId: null,
            productName: product.name,
            variationName: null,
            quantityRequested: qty,
          });
        } else {
          const updatedItems = [...items];
          updatedItems[existingIndex].quantityRequested = qty;
          setItems(updatedItems);
        }
      }
    }

    if (newItems.length > 0) {
      setItems([...items, ...newItems]);
      toast.success(product.variations.length > 0 ? `${newItems.length} variation(s) ajoutée(s)` : 'Produit ajouté');

      // Clear quantities for this product
      const newQuantities = { ...productQuantities };
      delete newQuantities[product.id];
      setProductQuantities(newQuantities);

      // Collapse the product
      const newExpanded = new Set(expandedProducts);
      newExpanded.delete(product.id);
      setExpandedProducts(newExpanded);
    } else {
      toast.error('Aucune quantité saisie');
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleRemoveProduct = (productId: number) => {
    setItems(items.filter(item => item.productId !== productId));
    toast.success('Produit supprimé');
  };

  const handleUpdateQuantity = (index: number, quantity: number) => {
    const updatedItems = [...items];
    updatedItems[index].quantityRequested = quantity;
    setItems(updatedItems);
  };

  const toggleExpandAddedProduct = (productId: number) => {
    const newExpanded = new Set(expandedAddedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedAddedProducts(newExpanded);
  };

  const getAddedProductItems = (productId: number) => {
    return items.filter(item => item.productId === productId);
  };

  const getAddedProductTotal = (productId: number) => {
    return getAddedProductItems(productId).reduce((sum, item) => sum + item.quantityRequested, 0);
  };

  const getUniqueAddedProducts = () => {
    const uniqueProducts = new Map<number, { name: string; shortCode: string; imageUrl: string }>();
    items.forEach(item => {
      if (!uniqueProducts.has(item.productId)) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          uniqueProducts.set(item.productId, {
            name: item.productName,
            shortCode: product.shortCode,
            imageUrl: product.imageUrl,
          });
        }
      }
    });
    return Array.from(uniqueProducts.entries()).map(([id, data]) => ({ id, ...data }));
  };

  const getTotalUnits = () => {
    return items.reduce((sum, item) => sum + item.quantityRequested, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || items.length === 0) {
      toast.error('Veuillez remplir le titre et ajouter au moins un article');
      return;
    }

    try {
      setLoading(true);

      // Prepare data for backend
      const payload = {
        title: formData.title,
        dueDate: formData.dueDate || null,
        notes: formData.notes || null,
        items: items.map(item => ({
          productId: item.productId,
          productVariationId: item.productVariationId,
          quantityRequested: item.quantityRequested,
        })),
      };

      console.log('Submitting production request:', payload);

      const response = await api.post('/production-requests', payload);

      if (response.data.success) {
        toast.success('Demande de production créée avec succès');
        router.push('/production-requests');
      } else {
        toast.error(response.data.message || 'Erreur lors de la création');
      }
    } catch (error: any) {
      console.error('Error creating request:', error);
      console.error('Error details:', error.response?.data);

      const errorMessage = error.response?.data?.message || error.message || 'Erreur lors de la création';
      toast.error(errorMessage, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <Toaster position="top-right" />

      <div
        className={`flex-1 transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <div className="p-6">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Nouvelle Demande de Production</h1>
              <p className="text-gray-600 mt-1">Créer une nouvelle demande pour l'usine</p>
            </div>

            <form id="production-request-form" onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info Card */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Détails de la Demande</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Titre <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="ex: Réapprovisionnement Collection Été"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date d'Échéance
                    </label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      placeholder="Instructions spéciales ou notes..."
                    />
                  </div>
                </div>
              </div>

              {/* Product Selection */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">
                  Produits <span className="text-red-500">*</span>
                </h2>

                {/* Search */}
                <div className="mb-6">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher un produit..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Product Cards */}
                <div className="space-y-4">
                  {filteredProducts.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">Aucun produit trouvé</p>
                  ) : (
                    filteredProducts.map((product) => {
                      const isExpanded = expandedProducts.has(product.id);
                      const total = getProductTotal(product.id);

                      return (
                        <div
                          key={product.id}
                          className="border-2 border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition"
                        >
                          {/* Product Header */}
                          <div className="p-4 bg-white">
                            <div className="flex items-center gap-4">
                              {/* Image */}
                              <div className="flex-shrink-0">
                                {product.imageUrl ? (
                                  <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                                  />
                                ) : (
                                  <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                )}
                              </div>

                              {/* Product Info */}
                              <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                                <p className="text-sm text-gray-500 font-mono">{product.shortCode}</p>
                                <p className="text-sm text-gray-600 mt-1">
                                  {product.variations.length > 0
                                    ? `${product.variations.length} variation(s) disponible(s)`
                                    : 'Produit simple (sans variations)'}
                                </p>
                                {total > 0 && (
                                  <p className="text-sm font-medium text-blue-600 mt-1">
                                    Total saisi: {total} unités
                                  </p>
                                )}
                              </div>

                              {/* Expand Button */}
                              <button
                                type="button"
                                onClick={() => toggleExpand(product.id)}
                                className="flex-shrink-0 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition flex items-center gap-2"
                              >
                                {isExpanded ? (
                                  <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                    </svg>
                                    Réduire
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                    Développer
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Expanded Content */}
                          {isExpanded && (
                            <div className="p-4 bg-gray-50 border-t-2 border-gray-200">
                              {product.variations.length > 0 ? (
                                <>
                                  {/* Bulk Actions */}
                                  <div className="flex gap-3 mb-4 pb-4 border-b border-gray-300">
                                    <input
                                      type="number"
                                      min="1"
                                      value={bulkQuantity[product.id] || ''}
                                      onChange={(e) => setBulkQuantity({ ...bulkQuantity, [product.id]: e.target.value })}
                                      placeholder="100"
                                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleBulkQuantity(product.id, product)}
                                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                                    >
                                      Même qté partout
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => clearProductQuantities(product.id)}
                                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm"
                                    >
                                      Effacer
                                    </button>
                                  </div>

                                  {/* Variations Grid */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {product.variations.map((variation) => (
                                      <div key={variation.id} className="bg-white rounded-lg p-3 border border-gray-200">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                          {variation.length ? `T${variation.size} / L${variation.length}` : variation.size}
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          value={productQuantities[product.id]?.[variation.id] || ''}
                                          onChange={(e) => handleQuantityChange(product.id, variation.id, parseInt(e.target.value) || 0)}
                                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center"
                                          placeholder="0"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                /* Simple quantity input for products without variations (accessoires) */
                                <div className="bg-white rounded-lg p-4 border border-gray-200">
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Quantité à produire
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={productQuantities[product.id]?.[-1] || ''}
                                    onChange={(e) => handleQuantityChange(product.id, -1, parseInt(e.target.value) || 0)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-lg"
                                    placeholder="0"
                                  />
                                </div>
                              )}

                              {/* Add Button */}
                              <div className="mt-4 pt-4 border-t border-gray-300">
                                <button
                                  type="button"
                                  onClick={() => handleAddProduct(product)}
                                  className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition"
                                >
                                  Ajouter ce produit ({total} unités)
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Selected Items - Grouped by Product */}
                {items.length > 0 && (
                  <div className="mt-6 pt-6 border-t-2 border-gray-300">
                    <div className="mb-4">
                      <h3 className="font-semibold text-lg">Articles ajoutés</h3>
                      <p className="text-sm text-gray-600">
                        {getUniqueAddedProducts().length} produit(s) • {items.length} variation(s) • {getTotalUnits()} unités au total
                      </p>
                    </div>

                    <div className="space-y-3">
                      {getUniqueAddedProducts().map((product) => {
                        const isExpanded = expandedAddedProducts.has(product.id);
                        const productItems = getAddedProductItems(product.id);
                        const total = getAddedProductTotal(product.id);

                        return (
                          <div
                            key={product.id}
                            className="border-2 border-blue-200 bg-blue-50 rounded-lg overflow-hidden"
                          >
                            {/* Product Header */}
                            <div className="p-4 bg-white border-b-2 border-blue-200">
                              <div className="flex items-center gap-4">
                                {/* Image */}
                                <div className="flex-shrink-0">
                                  {product.imageUrl ? (
                                    <img
                                      src={product.imageUrl}
                                      alt={product.name}
                                      className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                                    />
                                  ) : (
                                    <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                                      <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                  )}
                                </div>

                                {/* Product Info */}
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-gray-900">{product.name}</h4>
                                  <p className="text-sm text-gray-500 font-mono">{product.shortCode}</p>
                                  <p className="text-sm text-blue-600 font-medium mt-1">
                                    {productItems.length} variation(s) • {total} unités
                                  </p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandAddedProduct(product.id)}
                                    className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition text-sm flex items-center gap-1"
                                  >
                                    {isExpanded ? (
                                      <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                        </svg>
                                        Masquer
                                      </>
                                    ) : (
                                      <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                        Modifier
                                      </>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveProduct(product.id)}
                                    className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition text-sm"
                                    title="Supprimer ce produit"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            </div>

                            {/* Expanded Variations */}
                            {isExpanded && (
                              <div className="p-4 bg-blue-50">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  {productItems.map((item, index) => {
                                    const globalIndex = items.indexOf(item);
                                    return (
                                      <div key={index} className="bg-white rounded-lg p-3 border border-blue-200">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                          {item.variationName}
                                        </label>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="number"
                                            min="1"
                                            value={item.quantityRequested}
                                            onChange={(e) => handleUpdateQuantity(globalIndex, parseInt(e.target.value) || 0)}
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-center"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveItem(globalIndex)}
                                            className="text-red-600 hover:text-red-700"
                                            title="Supprimer cette variation"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

            </form>

            {/* Spacer so content isn't hidden behind sticky bar */}
            <div className="h-20" />
          </div>
        </div>
      </div>

      {/* Sticky bottom action bar */}
      <div className={`fixed bottom-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg transition-all duration-300 ${isSidebarCollapsed ? 'left-20' : 'left-64'}`}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex gap-4">
          <button
            type="button"
            onClick={() => router.push('/production-requests')}
            className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={loading}
          >
            Annuler
          </button>
          <button
            type="submit"
            form="production-request-form"
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            disabled={loading || items.length === 0}
          >
            {loading ? 'Création...' : `Créer la Demande${items.length > 0 ? ` (${getTotalUnits()} unités)` : ''}`}
          </button>
        </div>
      </div>

    </div>
  );
}
