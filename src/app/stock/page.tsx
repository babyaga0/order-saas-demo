'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import toast, { Toaster } from 'react-hot-toast';

// Category configurations
const CATEGORIES = [
  { value: 'jeans', label: 'Jeans', accentColor: 'bg-blue-500', textColor: 'text-blue-600' },
  { value: 'vestes', label: 'Vestes', accentColor: 'bg-purple-500', textColor: 'text-purple-600' },
  { value: 'ensembles', label: 'Ensembles', accentColor: 'bg-teal-500', textColor: 'text-teal-600' },
  { value: 'accessoires', label: 'Accessoires', accentColor: 'bg-amber-500', textColor: 'text-amber-600' },
];

// Size configurations for create form
const SIZE_CONFIG: Record<string, { sizes: string[]; lengths: string[]; hasLengths: boolean; hasSizes: boolean }> = {
  jeans: {
    sizes: ['28', '30', '31', '32', '33', '34', '36', '38', '40', '42', '44', '46'],
    lengths: ['30', '32', '34', '36'],
    hasLengths: true,
    hasSizes: true,
  },
  vestes: {
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    lengths: [],
    hasLengths: false,
    hasSizes: true,
  },
  ensembles: {
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    lengths: [],
    hasLengths: false,
    hasSizes: true,
  },
  accessoires: {
    sizes: [],
    lengths: [],
    hasLengths: false,
    hasSizes: false,
  },
};

interface CategoryCounts {
  [key: string]: {
    count: number;
    stock: number;
  };
}

export default function StockPage() {
  const router = useRouter();
  const { isSidebarCollapsed } = useLayout();
  const [categoryCounts, setCategoryCounts] = useState<CategoryCounts>({});
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: 'jeans',
  });
  const [imagePreview, setImagePreview] = useState<string>('');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedLengths, setSelectedLengths] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check authentication
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

  // Fetch category counts (lightweight)
  useEffect(() => {
    if (userRole) {
      fetchCounts();
    }
  }, [userRole]);

  const fetchCounts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products/manual/counts`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setCategoryCounts(data.data);
      }
    } catch (err) {
      console.error('Error fetching counts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get stats for a category from counts
  const getCategoryStats = (categoryValue: string) => {
    return categoryCounts[categoryValue] || { count: 0, stock: 0 };
  };

  // Form handlers
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image trop grande (max 5MB)');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSizeToggle = (size: string) => {
    setSelectedSizes(prev =>
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  };

  const handleLengthToggle = (length: string) => {
    setSelectedLengths(prev =>
      prev.includes(length) ? prev.filter(l => l !== length) : [...prev, length]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const categoryConfig = SIZE_CONFIG[formData.category];

    if (!formData.name.trim()) {
      toast.error('Nom du produit requis');
      return;
    }
    if (categoryConfig.hasSizes && selectedSizes.length === 0) {
      toast.error('Sélectionnez au moins une taille');
      return;
    }
    if (categoryConfig.hasLengths && selectedLengths.length === 0) {
      toast.error('Sélectionnez au moins une longueur');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products/with-variations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          price: formData.price,
          regularPrice: formData.price,
          category: formData.category,
          imageUrl: imagePreview || null,
          sizes: categoryConfig.hasSizes ? selectedSizes : [],
          lengths: categoryConfig.hasLengths ? selectedLengths : [],
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Produit créé!');
        setFormData({ name: '', price: '', category: 'jeans' });
        setImagePreview('');
        setSelectedSizes([]);
        setSelectedLengths([]);
        setShowCreateForm(false);
        fetchCounts();
      } else {
        toast.error(data.message || 'Erreur');
      }
    } catch (err) {
      toast.error('Erreur de connexion');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!userRole || !['ADMIN', 'SUPER_ADMIN', 'PRODUCTION', 'FACTORY_MANAGER'].includes(userRole)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-400 border-t-transparent"></div>
      </div>
    );
  }

  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

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
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-8 flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Catalogue Stock</h1>
                <p className="text-gray-600 mt-2">Sélectionnez une catégorie</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
                >
                  {showCreateForm ? '✕ Fermer' : '+ Créer un Produit'}
                </button>
              )}
            </div>

            {/* Create Form */}
            {showCreateForm && isAdmin && (
              <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Nouveau Produit</h2>

                {/* Category Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Catégorie</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, category: cat.value });
                          setSelectedSizes([]);
                          setSelectedLengths([]);
                        }}
                        className={`p-4 rounded-lg border-2 font-medium transition ${
                          formData.category === cat.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${cat.accentColor} mx-auto mb-2`}></div>
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name & Price */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nom du Produit *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: BAGGY BLEACH"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Prix (DH) *</label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="450"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                {/* Image */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Image (optionnel)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700"
                  />
                  {imagePreview && (
                    <img src={imagePreview} alt="Preview" className="mt-3 w-24 h-24 object-cover rounded-lg" />
                  )}
                </div>

                {/* Sizes - only if category has sizes */}
                {SIZE_CONFIG[formData.category].hasSizes && (
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-medium text-gray-700">Tailles *</label>
                      <button
                        type="button"
                        onClick={() => setSelectedSizes(SIZE_CONFIG[formData.category].sizes)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Tout sélectionner
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SIZE_CONFIG[formData.category].sizes.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => handleSizeToggle(size)}
                          className={`px-4 py-2 rounded-lg border-2 font-medium transition ${
                            selectedSizes.includes(size)
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lengths - only for jeans */}
                {SIZE_CONFIG[formData.category].hasLengths && (
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-medium text-gray-700">Longueurs *</label>
                      <button
                        type="button"
                        onClick={() => setSelectedLengths(SIZE_CONFIG[formData.category].lengths)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Tout sélectionner
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SIZE_CONFIG[formData.category].lengths.map((length) => (
                        <button
                          key={length}
                          type="button"
                          onClick={() => handleLengthToggle(length)}
                          className={`px-4 py-2 rounded-lg border-2 font-medium transition ${
                            selectedLengths.includes(length)
                              ? 'border-green-500 bg-green-50 text-green-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {length}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Info for belts */}
                {!SIZE_CONFIG[formData.category].hasSizes && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-600">Les accessoires n'ont pas de variations - 1 produit = 1 code</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Création...' : 'Créer le Produit'}
                </button>
              </form>
            )}

            {/* Category Cards */}
            {loading ? (
              <div className="flex items-center justify-center min-h-[40vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-400 border-t-transparent"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {CATEGORIES.map((cat) => {
                  const stats = getCategoryStats(cat.value);
                  return (
                    <div
                      key={cat.value}
                      onClick={() => router.push(`/stock/${cat.value}`)}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-gray-300 group"
                    >
                      {/* Colored accent line */}
                      <div className={`h-1 ${cat.accentColor}`}></div>

                      <div className="p-5">
                        <h3 className={`text-lg font-semibold ${cat.textColor} mb-1`}>{cat.label}</h3>
                        <div className="flex items-baseline justify-between">
                          <div>
                            <span className="text-2xl font-bold text-gray-900">{stats.count}</span>
                            <span className="text-sm text-gray-500 ml-1">produit{stats.count > 1 ? 's' : ''}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm text-gray-500">Stock</span>
                            <span className="block text-lg font-semibold text-gray-700">{stats.stock}</span>
                          </div>
                        </div>

                        {/* Arrow indicator */}
                        <div className="mt-4 flex items-center text-sm text-gray-400 group-hover:text-gray-600 transition-colors">
                          <span>Voir les produits</span>
                          <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Multi-Store View Card */}
            {!loading && (
              <div
                onClick={() => router.push('/stock/stores')}
                className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-blue-300 group"
              >
                <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-teal-500"></div>
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-xl">🏪</div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Vue Multi-Magasins</h3>
                      <p className="text-sm text-gray-500">Voir le stock de chaque magasin en un seul endroit</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400 group-hover:text-blue-600 transition-colors">
                    <span>Ouvrir</span>
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
