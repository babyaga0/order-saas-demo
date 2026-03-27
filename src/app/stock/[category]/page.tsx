'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import toast, { Toaster } from 'react-hot-toast';
import { generateSingleProductBarcodePDF } from '@/utils/barcodeGenerator';

// Category configurations
const CATEGORY_CONFIG: Record<string, { label: string; accentColor: string; textColor: string }> = {
  jeans: { label: 'Jeans', accentColor: 'bg-blue-500', textColor: 'text-blue-600' },
  vestes: { label: 'Vestes', accentColor: 'bg-purple-500', textColor: 'text-purple-600' },
  ensembles: { label: 'Ensembles', accentColor: 'bg-teal-500', textColor: 'text-teal-600' },
  accessoires: { label: 'Accessoires', accentColor: 'bg-amber-500', textColor: 'text-amber-600' },
};

interface Variation {
  id: number;
  name: string;
  shortCode: string;
  barcode: string;
  size: string;
  length: string;
  price: string;
  stockQuantity: number | null;
}

interface Product {
  id: number;
  name: string;
  shortCode: string;
  price: string;
  imageUrl: string | null;
  categories: string | null;
  productionStatus: string | null;
  stockQuantity?: number; // accessories only (no variations)
  variations: Variation[];
}

export default function CategoryStockPage() {
  const router = useRouter();
  const params = useParams();
  const category = params.category as string;
  const { isSidebarCollapsed } = useLayout();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState<string>('');

  // Products cache (5-min TTL) — show instantly, refresh in background
  const PRODUCTS_CACHE_KEY = `admin_products_${category}`;
  const PRODUCTS_CACHE_TS_KEY = `admin_products_ts_${category}`;
  const PRODUCTS_CACHE_TTL = 5 * 60 * 1000;

  // Image cache helpers (24h TTL, same pattern as POS)
  const IMAGE_CACHE_KEY = `admin_product_images_${category}`;
  const IMAGE_CACHE_TS_KEY = `admin_product_images_ts_${category}`;
  const IMAGE_CACHE_TTL = 24 * 60 * 60 * 1000;

  const categoryConfig = CATEGORY_CONFIG[category];

  // Check authentication and permissions
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
        router.push('/dashboard');
        return;
      }

      setUserRole(user.role);
    }
  }, [router]);

  // Fetch products
  useEffect(() => {
    if (userRole && category) {
      fetchProducts();
    }
  }, [userRole, category]);

  const applyImages = (items: Product[]): Product[] => {
    try {
      const cached = localStorage.getItem(IMAGE_CACHE_KEY);
      if (!cached) return items;
      const imageMap: Record<number, string> = JSON.parse(cached);
      return items.map(p => ({ ...p, imageUrl: imageMap[p.id] || null }));
    } catch { return items; }
  };

  const fetchProducts = async (force = false) => {
    // Show from localStorage cache instantly
    try {
      const cachedRaw = localStorage.getItem(PRODUCTS_CACHE_KEY);
      const cachedTs = parseInt(localStorage.getItem(PRODUCTS_CACHE_TS_KEY) || '0');
      const isFresh = Date.now() - cachedTs < PRODUCTS_CACHE_TTL;

      if (cachedRaw) {
        setProducts(applyImages(JSON.parse(cachedRaw)));
        setLoading(false);
        fetchImages();
        if (isFresh && !force) return; // cache still valid — skip API
      }
    } catch { /* ignore cache errors */ }

    // Fetch from API (first load or stale cache)
    try {
      setLoading(prev => products.length === 0 ? true : prev); // only show spinner if empty
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products/manual?category=${category}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();

      if (data.success) {
        const items: Product[] = data.data;
        try {
          localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(items));
          localStorage.setItem(PRODUCTS_CACHE_TS_KEY, Date.now().toString());
        } catch { /* storage full */ }
        setProducts(applyImages(items));
        fetchImages();
      } else {
        toast.error(data.message || 'Erreur lors du chargement des produits');
      }
    } catch (err: any) {
      toast.error('Erreur de connexion au serveur');
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchImages = async () => {
    try {
      const ts = parseInt(localStorage.getItem(IMAGE_CACHE_TS_KEY) || '0');
      if (Date.now() - ts < IMAGE_CACHE_TTL) return; // cache still fresh

      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/products/manual/images?category=${category}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        const imageMap: Record<number, string> = data.data;
        try {
          localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(imageMap));
          localStorage.setItem(IMAGE_CACHE_TS_KEY, Date.now().toString());
        } catch { /* storage full */ }
        setProducts(prev => prev.map(p => ({ ...p, imageUrl: imageMap[p.id] || p.imageUrl || null })));
      }
    } catch { /* images are optional */ }
  };

  const calculateTotalStock = (product: Product) => {
    if (product.variations.length === 0) return product.stockQuantity || 0;
    return product.variations.reduce((total, v) => total + (v.stockQuantity || 0), 0);
  };

  const handleDeleteProduct = async (productId: number, productName: string) => {
    if (!confirm(`Supprimer "${productName}" ?`)) return;

    const loadingToast = toast.loading('Suppression...');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Produit supprimé!', { id: loadingToast });
        // Bust cache so the deleted product doesn't show on next visit
        localStorage.removeItem(PRODUCTS_CACHE_KEY);
        localStorage.removeItem(PRODUCTS_CACHE_TS_KEY);
        fetchProducts(true);
      } else {
        toast.error(data.message || 'Erreur', { id: loadingToast });
      }
    } catch (err) {
      toast.error('Erreur de connexion', { id: loadingToast });
    }
  };

  // Filter by search
  const filteredProducts = products.filter(product => {
    return searchTerm === '' ||
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.shortCode && product.shortCode.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  // Group jeans by fit type and accessories by product type (first word(s) of name)
  const getFitType = (name: string): string => {
    const words = name.trim().toUpperCase().split(/\s+/);
    if (words.length >= 2 && words[1] === 'FIT') return `${words[0]} FIT`;
    return words[0];
  };

  const groupedJeans = (category === 'jeans' || category === 'accessoires' || category === 'vestes')
    ? Object.entries(
        filteredProducts.reduce((groups, product) => {
          const fit = getFitType(product.name);
          if (!groups[fit]) groups[fit] = [];
          groups[fit].push(product);
          return groups;
        }, {} as Record<string, Product[]>)
      ).sort(([a], [b]) => a.localeCompare(b))
    : null;

  // Invalid category
  if (!categoryConfig) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-xl text-gray-600">Catégorie non trouvée</p>
          <button
            onClick={() => router.push('/stock')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Retour au catalogue
          </button>
        </div>
      </div>
    );
  }

  if (!userRole || !['ADMIN', 'SUPER_ADMIN', 'PRODUCTION', 'FACTORY_MANAGER'].includes(userRole)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-400 border-t-transparent"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex">
        <Sidebar />
        <main className={`flex-1 min-h-screen bg-gray-50 transition-all duration-300 ${isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'}`}>
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-400 border-t-transparent mx-auto"></div>
              <p className="mt-4 text-gray-600">Chargement...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
  const totalStock = products.reduce((acc, p) => acc + calculateTotalStock(p), 0);

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
            {/* Sticky Header + Search */}
            <div className="sticky top-0 z-10 bg-gray-50 pb-4">
              {/* Header */}
              <div className="mb-4 pt-2">
                <button
                  onClick={() => router.push('/stock')}
                  className="text-gray-600 hover:text-gray-900 mb-3 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Retour au catalogue
                </button>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-12 rounded-full ${categoryConfig.accentColor}`}></div>
                    <div>
                      <h1 className={`text-3xl font-bold ${categoryConfig.textColor}`}>{categoryConfig.label}</h1>
                      <p className="text-gray-600">
                        {products.length} produit{products.length > 1 ? 's' : ''} • Stock total: {totalStock}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Search */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Rechercher par nom ou code..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Products List */}
            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-500 text-lg">
                  {searchTerm ? 'Aucun produit trouvé' : `Aucun ${categoryConfig.label.toLowerCase()} dans le catalogue`}
                </p>
              </div>
            ) : groupedJeans ? (
              // Jeans: grouped by fit type
              <div className="space-y-6">
                {groupedJeans.map(([fitType, groupProducts]) => (
                  <div key={fitType}>
                    {/* Group header */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`text-sm font-bold uppercase tracking-widest ${categoryConfig.textColor}`}>{fitType}</span>
                      <div className="flex-1 h-px bg-gray-200"></div>
                      <span className="text-xs text-gray-400">{groupProducts.length} produit{groupProducts.length > 1 ? 's' : ''}</span>
                    </div>
                    {/* Products in group */}
                    <div className="space-y-3">
                      {groupProducts.map((product) => {
                        const productStock = calculateTotalStock(product);
                        const getStockStyle = (stock: number) => {
                          if (stock === 0) return { color: 'text-red-600', bg: 'bg-red-100' };
                          if (stock <= 10) return { color: 'text-amber-600', bg: 'bg-amber-100' };
                          return { color: 'text-green-600', bg: 'bg-green-100' };
                        };
                        const stockStyle = getStockStyle(productStock);
                        return (
                          <div
                            key={product.id}
                            className="bg-white rounded-lg shadow hover:shadow-md transition border border-gray-200 p-4 cursor-pointer"
                            onClick={() => router.push(`/stock/product/${product.id}`)}
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex-shrink-0">
                                <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                                  {product.imageUrl ? (
                                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className={`w-full h-full flex items-center justify-center ${categoryConfig.accentColor}`}>
                                      <span className="text-white font-bold text-lg">{product.name.charAt(0)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-gray-900 truncate">{product.name}</h3>
                                <p className="text-xs text-gray-500 font-mono">Code: {product.shortCode}</p>
                                <div className="flex items-center gap-3 text-sm mt-1">
                                  <span className="font-semibold text-gray-700">{product.price} DH</span>
                                  <span className="text-gray-300">|</span>
                                  <span className={`px-2 py-0.5 rounded text-sm font-medium ${stockStyle.bg} ${stockStyle.color}`}>
                                    Stock: {productStock}
                                  </span>
                                  {product.variations.length > 0 && (
                                    <>
                                      <span className="text-gray-300">|</span>
                                      <span className="text-gray-500">{product.variations.length} var.</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex-shrink-0 flex items-center gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); router.push(`/stock/product/${product.id}`); }}
                                  className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                                >
                                  Voir
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id, product.name); }}
                                    className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                    title="Supprimer"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Other categories: flat list
              <div className="space-y-3">
                {filteredProducts.map((product) => {
                  const productStock = calculateTotalStock(product);

                  const getStockStyle = (stock: number) => {
                    if (stock === 0) return { color: 'text-red-600', bg: 'bg-red-100' };
                    if (stock <= 10) return { color: 'text-amber-600', bg: 'bg-amber-100' };
                    return { color: 'text-green-600', bg: 'bg-green-100' };
                  };
                  const stockStyle = getStockStyle(productStock);

                  return (
                    <div
                      key={product.id}
                      className="bg-white rounded-lg shadow hover:shadow-md transition border border-gray-200 p-4 cursor-pointer"
                      onClick={() => router.push(`/stock/product/${product.id}`)}
                    >
                      <div className="flex items-center gap-4">
                        {/* Image */}
                        <div className="flex-shrink-0">
                          <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className={`w-full h-full flex items-center justify-center ${categoryConfig.accentColor}`}>
                                <span className="text-white font-bold text-lg">{product.name.charAt(0)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 truncate">{product.name}</h3>
                          <p className="text-xs text-gray-500 font-mono">Code: {product.shortCode}</p>
                          <div className="flex items-center gap-3 text-sm mt-1">
                            <span className="font-semibold text-gray-700">{product.price} DH</span>
                            <span className="text-gray-300">|</span>
                            <span className={`px-2 py-0.5 rounded text-sm font-medium ${stockStyle.bg} ${stockStyle.color}`}>
                              Stock: {productStock}
                            </span>
                            {product.variations.length > 0 && (
                              <>
                                <span className="text-gray-300">|</span>
                                <span className="text-gray-500">{product.variations.length} var.</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex-shrink-0 flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/stock/product/${product.id}`);
                            }}
                            className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                          >
                            Voir
                          </button>
                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProduct(product.id, product.name);
                              }}
                              className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                              title="Supprimer"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
