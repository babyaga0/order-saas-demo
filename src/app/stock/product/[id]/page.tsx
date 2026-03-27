'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLayout } from '@/contexts/LayoutContext';
import Sidebar from '@/components/Sidebar';
import toast from 'react-hot-toast';
import { generateSingleProductBarcodePDF } from '@/utils/barcodeGenerator';

interface Variation {
  id: number;
  name: string;
  shortCode: string;
  barcode: string;
  size: string;
  length: string;
  price: string;
  stock: { quantity: number; storeId: string; store: { id: string; name: string } }[];
}

interface StockByStore {
  storeId: string;
  storeName: string;
  quantity: number;
}

interface Product {
  id: number;
  name: string;
  shortCode: string;
  price: string;
  imageUrl: string | null;
  categories: string | null;
  productionStatus: string | null;
  variations: Variation[];
  stock?: StockByStore[]; // accessories only (no variations)
}

// Status groups for dropdown
const STATUS_GROUPS = [
  {
    label: 'Création & Validation',
    options: [
      { value: 'BROUILLON', label: 'Brouillon' },
      { value: 'EN_ATTENTE_VALIDATION', label: 'En attente de validation' },
      { value: 'VALIDE_PRODUCTION', label: 'Validé pour production' },
      { value: 'REFUSE', label: 'Refusé' },
    ]
  },
  {
    label: 'Pré-Production',
    options: [
      { value: 'ANALYSE_TECHNIQUE', label: 'Analyse technique' },
      { value: 'ECHANTILLONNAGE', label: 'Échantillonnage' },
      { value: 'PRET_LANCEMENT', label: 'Prêt pour lancement' },
    ]
  },
  {
    label: 'Production',
    options: [
      { value: 'EN_PRODUCTION', label: 'En production' },
      { value: 'PRODUCTION_SUSPENDUE', label: 'Production suspendue' },
      { value: 'PRODUCTION_TERMINEE', label: 'Production terminée' },
    ]
  },
  {
    label: 'Contrôle Qualité',
    options: [
      { value: 'CONTROLE_QUALITE', label: 'Contrôle qualité' },
      { value: 'CONFORME', label: 'Conforme' },
      { value: 'NON_CONFORME', label: 'Non conforme' },
      { value: 'EN_PREPARATION_EXPEDITION', label: 'En préparation d\'expédition' },
    ]
  },
  {
    label: 'Livraison & Stock',
    options: [
      { value: 'EXPEDIE', label: 'Expédié' },
      { value: 'LIVRE_MAGASIN', label: 'Livré au magasin' },
      { value: 'EN_STOCK_MAGASIN', label: 'En stock magasin' },
      { value: 'RUPTURE_STOCK', label: 'Rupture de stock' },
    ]
  },
  {
    label: 'Options',
    options: [
      { value: 'ANNULE', label: 'Annulé' },
      { value: 'RETOUR_USINE', label: 'Retour à l\'usine' },
      { value: 'REPRODUCTION_DEMANDEE', label: 'Reproduction demandée' },
      { value: 'ARCHIVE', label: 'Archivé' },
    ]
  },
];

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { isSidebarCollapsed } = useLayout();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');

  // Edit product info state
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');

  // Add variation state
  const [isAddingVariation, setIsAddingVariation] = useState(false);
  const [newVariationSize, setNewVariationSize] = useState('');
  const [newVariationLength, setNewVariationLength] = useState('');
  const [isAddingVariationLoading, setIsAddingVariationLoading] = useState(false);

  // Only ADMIN can edit product info and images (business operations)
  const canEditProduct = userRole === 'ADMIN';
  // Only FACTORY_MANAGER can update production status
  const canUpdateStatus = userRole === 'FACTORY_MANAGER';
  const canDownloadBarcodes = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'PRODUCTION' || userRole === 'FACTORY_MANAGER';

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

  // Fetch product details
  useEffect(() => {
    if (userRole && params.id) {
      fetchProduct();
    }
  }, [userRole, params.id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setProduct(data.data);
      } else {
        toast.error(data.message || 'Erreur lors du chargement du produit');
        router.push('/stock/jeans');
      }
    } catch (err: any) {
      toast.error('Erreur de connexion au serveur');
      console.error('Error fetching product:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File selected:', file.name, file.type, file.size);

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('La taille de l\'image ne doit pas dépasser 5MB');
      return;
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format non supporté. Utilisez JPG, PNG ou WebP');
      return;
    }

    setSelectedImage(file);
    toast.loading('Chargement de l\'aperçu...');

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      console.log('Preview generated, length:', (reader.result as string).length);
      setImagePreview(reader.result as string);
      toast.dismiss();
      toast.success('Image sélectionnée! Cliquez sur "Enregistrer" pour sauvegarder.');
    };
    reader.onerror = () => {
      console.error('FileReader error:', reader.error);
      toast.dismiss();
      toast.error('Erreur lors du chargement de l\'image');
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateImage = async () => {
    if (!imagePreview || !product) return;

    const loadingToast = toast.loading('Mise à jour de l\'image...');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ imageUrl: imagePreview }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Image mise à jour avec succès!', { id: loadingToast });

        // Update local state immediately with new image
        setProduct({ ...product, imageUrl: imagePreview });

        // Close edit mode but keep preview until we refetch
        setIsEditingImage(false);
        setSelectedImage(null);

        // Refetch product to ensure backend saved it
        await fetchProduct();

        // Clear preview after refetch
        setImagePreview('');
      } else {
        toast.error(data.message || 'Erreur lors de la mise à jour', { id: loadingToast });
      }
    } catch (err) {
      toast.error('Erreur de connexion au serveur', { id: loadingToast });
      console.error('Error updating image:', err);
    }
  };

  const handleStartEditInfo = () => {
    if (!product) return;
    setEditName(product.name);
    setEditPrice(product.price);
    setIsEditingInfo(true);
  };

  const handleCancelEditInfo = () => {
    setIsEditingInfo(false);
    setEditName('');
    setEditPrice('');
  };

  const handleUpdateInfo = async () => {
    if (!product) return;

    // Validation
    if (!editName.trim()) {
      toast.error('Le nom du produit est requis');
      return;
    }

    if (!editPrice || parseFloat(editPrice) <= 0) {
      toast.error('Le prix doit être supérieur à 0');
      return;
    }

    const loadingToast = toast.loading('Mise à jour du produit...');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName,
          price: editPrice,
          regularPrice: editPrice,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Produit mis à jour avec succès!', { id: loadingToast });

        // Update local state
        setProduct({ ...product, name: editName, price: editPrice });

        // Close edit mode
        setIsEditingInfo(false);
        setEditName('');
        setEditPrice('');

        // Refetch to ensure consistency
        await fetchProduct();
      } else {
        toast.error(data.message || 'Erreur lors de la mise à jour', { id: loadingToast });
      }
    } catch (err) {
      toast.error('Erreur de connexion au serveur', { id: loadingToast });
      console.error('Error updating product info:', err);
    }
  };

  const handleUpdateStock = async (variationId: number, stockQuantity: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products/variations/${variationId}/stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ stockQuantity }),
      });

      const data = await response.json();

      if (data.success) {
        setProduct(prev => prev ? {
          ...prev,
          variations: prev.variations.map(v =>
            v.id === variationId ? { ...v, stockQuantity } : v
          ),
        } : null);
        toast.success('Stock mis à jour');
      } else {
        toast.error(data.message || 'Erreur lors de la mise à jour');
      }
    } catch (err) {
      toast.error('Erreur de connexion au serveur');
      console.error('Error updating stock:', err);
    }
  };

  const handleUpdateProductionStatus = async (newStatus: string) => {
    if (!product) return;

    const loadingToast = toast.loading('Mise à jour du statut...');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products/${product.id}/production-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ productionStatus: newStatus }),
      });

      const data = await response.json();

      if (data.success) {
        setProduct(prev => prev ? { ...prev, productionStatus: newStatus } : null);
        toast.success('Statut mis à jour avec succès!', { id: loadingToast });
      } else {
        toast.error(data.message || 'Erreur lors de la mise à jour', { id: loadingToast });
      }
    } catch (err) {
      toast.error('Erreur de connexion au serveur', { id: loadingToast });
      console.error('Error updating status:', err);
    }
  };

  const handleAddVariation = async () => {
    if (!product || !newVariationSize) {
      toast.error('La taille est requise');
      return;
    }

    const isJeans = product.categories?.toLowerCase() === 'jeans';
    if (isJeans && !newVariationLength) {
      toast.error('La longueur est requise pour les jeans');
      return;
    }

    setIsAddingVariationLoading(true);
    const loadingToast = toast.loading('Ajout de la variation...');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products/${product.id}/variations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          size: newVariationSize,
          length: isJeans ? newVariationLength : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message || 'Variation ajoutée!', { id: loadingToast });
        setNewVariationSize('');
        setNewVariationLength('');
        setIsAddingVariation(false);
        await fetchProduct();
      } else {
        toast.error(data.message || 'Erreur', { id: loadingToast });
      }
    } catch (err) {
      toast.error('Erreur de connexion au serveur', { id: loadingToast });
      console.error('Error adding variation:', err);
    } finally {
      setIsAddingVariationLoading(false);
    }
  };

  const calculateTotalStock = () => {
    if (!product) return 0;
    if (product.variations.length === 0 && product.stock) {
      return product.stock.reduce((total, s) => total + s.quantity, 0);
    }
    return product.variations.reduce((total, v) => total + (v.stock?.reduce((sum, s) => sum + s.quantity, 0) || 0), 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <>
      <Sidebar />
      <div className={`transition-all duration-300 ${isSidebarCollapsed ? 'md:pl-20' : 'md:pl-64'}`}>
        <main className="p-6 bg-gray-50 min-h-screen">
          {/* Back Button */}
          <button
            onClick={() => router.push(product?.categories ? `/stock/${product.categories.toLowerCase()}` : '/stock')}
            className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Retour au Stock
          </button>

          {/* Product Header */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Image Section */}
              <div>
                <div className="relative">
                  {product.imageUrl || imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview || product.imageUrl || ''}
                        alt={product.name}
                        className="w-full h-64 object-cover rounded-lg"
                      />
                      {imagePreview && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                          Nouveau
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">
                      <svg className="w-24 h-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Edit Image */}
                {canEditProduct && (
                  <div className="mt-4">
                    {!isEditingImage ? (
                      <button
                        onClick={() => setIsEditingImage(true)}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        Modifier l'image
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          onChange={handleImageChange}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleUpdateImage}
                            disabled={!imagePreview}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-gray-300"
                          >
                            Enregistrer
                          </button>
                          <button
                            onClick={() => {
                              setIsEditingImage(false);
                              setSelectedImage(null);
                              setImagePreview('');
                            }}
                            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="md:col-span-2">
                {!isEditingInfo ? (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
                      {canEditProduct && (
                        <button
                          onClick={handleStartEditInfo}
                          className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                          title="Éditer le produit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Éditer
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-4">
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nom du Produit <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Nom du produit"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Prix (DH) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Prix"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateInfo}
                        className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Sauvegarder
                      </button>
                      <button
                        onClick={handleCancelEditInfo}
                        className="px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 font-medium">Code:</span>
                    <span className="text-gray-900 font-mono">{product.shortCode}</span>
                  </div>
                  {!isEditingInfo && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 font-medium">Prix:</span>
                      <span className="text-2xl font-bold text-green-600">{product.price} DH</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 font-medium">Stock Total:</span>
                    <span className="text-xl font-semibold text-blue-600">{calculateTotalStock()} unités</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 font-medium">Variations:</span>
                    <span className="text-gray-900">{product.variations.length}</span>
                  </div>
                  {product.categories && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 font-medium">Catégorie:</span>
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                        {product.categories}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Variations Matrix */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Variations ({product.variations.length})</h2>
              {canDownloadBarcodes && (
                <button
                  onClick={async () => {
                    if (!product) return;
                    try {
                      toast.loading('Génération du PDF...', { id: 'product-pdf' });
                      await generateSingleProductBarcodePDF(product);
                      toast.success(`PDF généré: ${product.variations.length} codes-barres`, { id: 'product-pdf' });
                    } catch (error) {
                      console.error('PDF generation error:', error);
                      toast.error('Erreur lors de la génération du PDF', { id: 'product-pdf' });
                    }
                  }}
                  className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Télécharger Codes-barres PDF
                </button>
              )}
            </div>

            {/* Professional Inventory Table */}
            {(() => {
              const totalStock = calculateTotalStock();
              const isAccessory = product.variations.length === 0;

              const getStatusBadge = (qty: number) => {
                if (qty === 0) return <span className="inline-flex items-center gap-1 text-red-600"><span className="w-2 h-2 rounded-full bg-red-500"></span> Out of Stock</span>;
                if (qty <= 10) return <span className="inline-flex items-center gap-1 text-yellow-600"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Low Stock</span>;
                return <span className="inline-flex items-center gap-1 text-green-600"><span className="w-2 h-2 rounded-full bg-green-500"></span> In Stock</span>;
              };

              if (isAccessory) {
                // Accessory: show per-store stock table
                const storeRows = product.stock || [];
                return (
                  <>
                    <div className="bg-gradient-to-r from-amber-50 to-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-gray-600 font-medium">Total Stock:</span>
                          <span className="ml-2 text-lg font-bold text-gray-900">{totalStock} pcs</span>
                        </div>
                        <div className="h-6 w-px bg-gray-300"></div>
                        <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">Accessoire</span>
                      </div>
                    </div>
                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">Magasin</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">Stock Qty</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {storeRows.length === 0 ? (
                            <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">Aucun stock enregistré</td></tr>
                          ) : (
                            storeRows.map((s, index) => (
                              <tr key={s.storeId} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-amber-50 transition-colors`}>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-200">{s.storeName}</td>
                                <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900 border-r border-gray-200">{s.quantity}</td>
                                <td className="px-4 py-3 text-sm">{getStatusBadge(s.quantity)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              }

              // Regular product with variations
              const getVarStock = (v: Variation) => v.stock?.reduce((sum, s) => sum + s.quantity, 0) || 0;
              const inStockCount = product.variations.filter(v => getVarStock(v) > 10).length;
              const lowStockCount = product.variations.filter(v => { const qty = getVarStock(v); return qty > 0 && qty <= 10; }).length;
              const outOfStockCount = product.variations.filter(v => getVarStock(v) === 0).length;
              const sortedVariations = [...product.variations].sort((a, b) => {
                const sizeCompare = parseInt(a.size) - parseInt(b.size);
                if (sizeCompare !== 0) return sizeCompare;
                return parseInt(a.length) - parseInt(b.length);
              });

              return (
                <>
                  {/* Quick Stats Bar */}
                  <div className="bg-gradient-to-r from-blue-50 to-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-gray-600 font-medium">Total Stock:</span>
                          <span className="ml-2 text-lg font-bold text-gray-900">{totalStock} pcs</span>
                        </div>
                        <div className="h-6 w-px bg-gray-300"></div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          <span className="text-gray-700">{inStockCount}/{product.variations.length} variations</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                          <span className="text-gray-700">{lowStockCount} low</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          <span className="text-gray-700">{outOfStockCount} out</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Professional Table */}
                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">Size</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">Length</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">SKU Code</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">Stock Qty</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {sortedVariations.map((variation, index) => {
                            const stock = variation.stock?.reduce((sum, s) => sum + s.quantity, 0) || 0;
                            const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                            return (
                              <tr key={variation.id} className={`${rowBg} hover:bg-blue-50 transition-colors`}>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">{variation.size}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 border-r border-gray-200">{variation.length}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-600 border-r border-gray-200">{variation.shortCode}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-center border-r border-gray-200">
                                  <span className="text-sm font-semibold text-gray-900">{stock}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm">{getStatusBadge(stock)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>


                  {/* Add Variation */}
                  {canEditProduct && product.categories?.toLowerCase() !== 'accessoires' && (
                    <div className="mt-4">
                      {!isAddingVariation ? (
                        <button
                          onClick={() => setIsAddingVariation(true)}
                          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Ajouter Variation
                        </button>
                      ) : (
                        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                          <h3 className="font-medium text-gray-900 mb-3">Nouvelle Variation</h3>
                          <div className="flex items-end gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Taille</label>
                              {product.categories?.toLowerCase() === 'jeans' ? (
                                <select
                                  value={newVariationSize}
                                  onChange={(e) => setNewVariationSize(e.target.value)}
                                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Choisir...</option>
                                  {['28', '29', '30', '31', '32', '33', '34', '36', '38', '40', '42', '44', '46'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                              ) : (
                                <select
                                  value={newVariationSize}
                                  onChange={(e) => setNewVariationSize(e.target.value)}
                                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Choisir...</option>
                                  {['S', 'M', 'L', 'XL', '2XL', '3XL'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                            {product.categories?.toLowerCase() === 'jeans' && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Longueur</label>
                                <select
                                  value={newVariationLength}
                                  onChange={(e) => setNewVariationLength(e.target.value)}
                                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Choisir...</option>
                                  {['30', '32', '34', '36'].map(l => (
                                    <option key={l} value={l}>{l}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <button
                              onClick={handleAddVariation}
                              disabled={isAddingVariationLoading}
                              className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition disabled:bg-gray-400"
                            >
                              {isAddingVariationLoading ? 'Ajout...' : 'Ajouter'}
                            </button>
                            <button
                              onClick={() => {
                                setIsAddingVariation(false);
                                setNewVariationSize('');
                                setNewVariationLength('');
                              }}
                              className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}

            {/* Summary */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="text-sm text-blue-700 font-medium mb-1">Stock Total</div>
                  <div className="text-3xl font-bold text-blue-900">{calculateTotalStock()}</div>
                  <div className="text-xs text-blue-600">unités</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="text-sm text-green-700 font-medium mb-1">Prix Unitaire</div>
                  <div className="text-3xl font-bold text-green-900">{product.price}</div>
                  <div className="text-xs text-green-600">DH</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <div className="text-sm text-purple-700 font-medium mb-1">Valeur Totale</div>
                  <div className="text-3xl font-bold text-purple-900">
                    {(calculateTotalStock() * parseFloat(product.price)).toFixed(0)}
                  </div>
                  <div className="text-xs text-purple-600">DH</div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
