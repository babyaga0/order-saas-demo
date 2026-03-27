'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import toast, { Toaster } from 'react-hot-toast';
import api from '@/lib/api';
import { generateShipmentReceipt } from '@/utils/shipmentReceiptGenerator';
import { generateProductionRequestPDF } from '@/utils/productionRequestPDF';

interface ProductionRequest {
  id: string;
  requestNumber: string;
  title: string;
  status: string;
  notes: string;
  dueDate: string | null;
  estimatedQuantity: number | null;
  destinationStore: {
    id: string;
    name: string;
    address: string;
  } | null;
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  };
  reviewedBy?: {
    id: string;
    fullName: string;
    email: string;
  };
  items: any[];
  createdAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  shipment: any | null;
}

export default function ProductionRequestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { isSidebarCollapsed } = useLayout();
  const [request, setRequest] = useState<ProductionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStores, setSelectedStores] = useState<Set<string>>(new Set());
  const [storeQuantities, setStoreQuantities] = useState<Record<string, Record<string, number>>>({});
  const [storeStock, setStoreStock] = useState<Record<string, Record<string, number>>>({});
  const [loadingStock, setLoadingStock] = useState(false);
  const [distributionMode, setDistributionMode] = useState<'smart' | 'equal'>('smart');

  // Only FACTORY_MANAGER can accept/reject production requests (not ADMIN)
  const canAcceptReject = userRole === 'FACTORY_MANAGER' || userRole === 'SUPER_ADMIN';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUserRole(user.role);
    }

    fetchRequest();
  }, [params.id]);

  // Lazy-load stores only when the shipment modal is opened
  useEffect(() => {
    if (showShipmentModal && stores.length === 0) {
      fetchStores();
    }
  }, [showShipmentModal]);

  const fetchRequest = async () => {
    try {
      setLoading(true);
      console.log('Fetching production request:', params.id);
      const response = await api.get(`/production-requests/${params.id}`);
      console.log('Response:', response.data);
      if (response.data.success) {
        setRequest(response.data.data);
      } else {
        toast.error(response.data.message || 'Erreur lors du chargement');
      }
    } catch (error: any) {
      console.error('Error fetching request:', error);
      console.error('Error details:', error.response?.data);
      const errorMsg = error.response?.data?.message || error.message || 'Erreur lors du chargement de la demande';
      toast.error(errorMsg, { duration: 5000 });

      // If 404, redirect back to list
      if (error.response?.status === 404) {
        setTimeout(() => router.push('/production-requests'), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      console.log('Fetching stores...');
      const response = await api.get('/stores');
      console.log('Stores response:', response.data);

      if (response.data.success) {
        console.log('Stores loaded:', response.data.data.length);
        setStores(response.data.data);
      } else {
        console.error('Failed to fetch stores:', response.data.message);
        toast.error('Impossible de charger les magasins');
      }
    } catch (error: any) {
      console.error('Error fetching stores:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Erreur lors du chargement des magasins');
    }
  };

  const handleAccept = async () => {
    if (actionLoading) return;
    try {
      setActionLoading(true);
      const response = await api.post(`/production-requests/${params.id}/accept`, {});
      if (response.data.success) {
        toast.success('Demande acceptée');
        fetchRequest();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Veuillez entrer une raison');
      return;
    }

    if (actionLoading) return;
    try {
      setActionLoading(true);
      const response = await api.post(`/production-requests/${params.id}/reject`, {
        rejectionReason,
      });
      if (response.data.success) {
        toast.success('Demande refusée');
        setShowRejectModal(false);
        setRejectionReason('');
        fetchRequest();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartProduction = async () => {
    if (actionLoading) return;
    try {
      setActionLoading(true);
      const response = await api.post(`/production-requests/${params.id}/start-production`, {});
      if (response.data.success) {
        toast.success('Production démarrée');
        fetchRequest();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (actionLoading) return;
    try {
      setActionLoading(true);
      const response = await api.post(`/production-requests/${params.id}/complete`, {});
      if (response.data.success) {
        toast.success('Production terminée');
        fetchRequest();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const fetchStockData = async () => {
    if (!request || !request.items || request.items.length === 0) {
      return;
    }

    try {
      setLoadingStock(true);

      // Single batch request instead of N parallel requests
      const response = await api.post('/stock/product/batch', {
        items: request.items.map((item: any) => ({
          productId: item.productId,
          variationId: item.productVariationId || null,
        })),
      });

      const stockMap: Record<string, Record<string, number>> = {};

      if (response.data.success && response.data.data) {
        const batchData = response.data.data;
        request.items.forEach((item: any) => {
          const itemKey = `${item.productId}-${item.productVariationId || 'null'}`;
          stockMap[itemKey] = {};
          const stocks = batchData[itemKey] || [];
          stocks.forEach((stock: any) => {
            stockMap[itemKey][stock.storeId] = stock.quantity || 0;
          });
        });
      }

      setStoreStock(stockMap);
    } catch (error) {
      console.error('Error fetching stock data:', error);
      toast.error('Impossible de charger les niveaux de stock');
    } finally {
      setLoadingStock(false);
    }
  };

  const handleCreateShipment = async () => {
    // Initialize storeQuantities with zeros for each item
    const initialQuantities: Record<string, Record<string, number>> = {};
    request?.items.forEach((item) => {
      const itemKey = `${item.productId}-${item.productVariationId || 'null'}`;
      initialQuantities[itemKey] = {};
    });
    setStoreQuantities(initialQuantities);
    setSelectedStores(new Set());

    setShowShipmentModal(true);

    // Fetch stock data in background while modal is already open
    fetchStockData();
  };

  const toggleStore = (storeId: string) => {
    const newSelected = new Set(selectedStores);
    if (newSelected.has(storeId)) {
      newSelected.delete(storeId);
      // Clear quantities for this store
      const newQuantities = { ...storeQuantities };
      Object.keys(newQuantities).forEach(itemKey => {
        delete newQuantities[itemKey][storeId];
      });
      setStoreQuantities(newQuantities);
    } else {
      newSelected.add(storeId);
    }
    setSelectedStores(newSelected);

    // Auto-fill quantities for all selected stores
    if (newSelected.size > 0) {
      recalculateQuantities(newSelected);
    }
  };

  const updateQuantity = (storeId: string, itemKey: string, quantity: number) => {
    setStoreQuantities(prev => ({
      ...prev,
      [itemKey]: {
        ...prev[itemKey],
        [storeId]: quantity,
      },
    }));
  };

  // Get stock color based on quantity
  const getStockColor = (stock: number) => {
    if (stock <= 10) return 'text-red-600';
    if (stock <= 15) return 'text-yellow-600';
    return 'text-green-600';
  };

  // Get stock icon based on quantity
  const getStockIcon = (stock: number) => {
    if (stock <= 10) return '🔴';
    if (stock <= 15) return '🟡';
    return '🟢';
  };

  // Get store priority label
  const getStoreStockLabel = (storeId: string) => {
    const items = request?.items || [];
    let lowCount = 0;
    let mediumCount = 0;

    items.forEach(item => {
      const itemKey = `${item.productId}-${item.productVariationId || 'null'}`;
      const stock = storeStock[itemKey]?.[storeId] || 0;
      if (stock <= 10) lowCount++;
      else if (stock <= 15) mediumCount++;
    });

    if (lowCount > items.length / 2) return { label: 'STOCK FAIBLE - URGENT', color: 'text-red-600', bg: 'bg-red-50', icon: '🔴' };
    if (mediumCount > items.length / 2) return { label: 'STOCK MOYEN', color: 'text-yellow-600', bg: 'bg-yellow-50', icon: '🟡' };
    return { label: 'Stock Normal', color: 'text-green-600', bg: 'bg-green-50', icon: '🟢' };
  };

  // Calculate smart suggestion for a store
  const calculateSuggestion = (storeId: string, itemKey: string, totalAvailable: number) => {
    const currentStock = storeStock[itemKey]?.[storeId] || 0;

    // Calculate all stores' stock levels for this item
    const allStoresStock = stores.map(store => ({
      storeId: store.id,
      stock: storeStock[itemKey]?.[store.id] || 0
    }));

    // Priority allocation: stores with lower stock get more
    if (currentStock <= 10) {
      // RED zone: needs a lot
      return Math.floor(totalAvailable * 0.6);
    } else if (currentStock <= 15) {
      // YELLOW zone: needs some
      return Math.floor(totalAvailable * 0.3);
    } else {
      // GREEN zone: needs less
      return Math.floor(totalAvailable * 0.1);
    }
  };

  // Apply smart suggestions to all items for selected stores
  const applySuggestions = (storesToUse?: Set<string>) => {
    const activeStores = storesToUse || selectedStores;
    const newQuantities: Record<string, Record<string, number>> = {};

    request?.items.forEach(item => {
      const itemKey = `${item.productId}-${item.productVariationId || 'null'}`;
      newQuantities[itemKey] = {};

      const selectedStoresArray = Array.from(activeStores);

      // Calculate suggestions for each store
      const suggestions = selectedStoresArray.map(storeId => ({
        storeId,
        suggested: calculateSuggestion(storeId, itemKey, item.quantityRequested)
      }));

      // Normalize suggestions to not exceed total
      const totalSuggested = suggestions.reduce((sum, s) => sum + s.suggested, 0);

      if (totalSuggested === 0) {
        // Fallback: Smart produced all zeros (happens with qty=1 and green-zone stores)
        // Use equal split so small quantities are never silently dropped
        const storeCount = selectedStoresArray.length;
        const perStore = Math.floor(item.quantityRequested / storeCount);
        const remainder = item.quantityRequested % storeCount;
        suggestions.forEach(({ storeId }, index) => {
          newQuantities[itemKey][storeId] = perStore + (index < remainder ? 1 : 0);
        });
      } else {
        suggestions.forEach(({ storeId, suggested }) => {
          const normalized = Math.floor((suggested / totalSuggested) * item.quantityRequested);
          newQuantities[itemKey][storeId] = normalized;
        });
      }
    });

    setStoreQuantities(newQuantities);
  };

  // Apply equal split to all items for selected stores
  const applyEqualSplit = (storesToUse?: Set<string>) => {
    const activeStores = storesToUse || selectedStores;
    const newQuantities: Record<string, Record<string, number>> = {};
    const storeCount = activeStores.size;

    if (storeCount === 0) return;

    request?.items.forEach(item => {
      const itemKey = `${item.productId}-${item.productVariationId || 'null'}`;
      newQuantities[itemKey] = {};

      const perStore = Math.floor(item.quantityRequested / storeCount);
      const remainder = item.quantityRequested % storeCount;

      let index = 0;
      activeStores.forEach(storeId => {
        // Give the remainder to the first store(s)
        newQuantities[itemKey][storeId] = perStore + (index < remainder ? 1 : 0);
        index++;
      });
    });

    setStoreQuantities(newQuantities);
  };

  // Recalculate based on current mode
  const recalculateQuantities = (storesToUse?: Set<string>, mode?: 'smart' | 'equal') => {
    const activeMode = mode || distributionMode;
    if (activeMode === 'smart') {
      applySuggestions(storesToUse);
    } else {
      applyEqualSplit(storesToUse);
    }
  };

  // Reset all quantities to zero
  const resetQuantities = () => {
    const newQuantities: Record<string, Record<string, number>> = {};
    request?.items.forEach((item) => {
      const itemKey = `${item.productId}-${item.productVariationId || 'null'}`;
      newQuantities[itemKey] = {};
      selectedStores.forEach(storeId => {
        newQuantities[itemKey][storeId] = 0;
      });
    });
    setStoreQuantities(newQuantities);
    toast.success('Quantités réinitialisées');
  };

  const getRemainingQuantity = (itemKey: string, requestedQty: number) => {
    const allocated = Object.values(storeQuantities[itemKey] || {}).reduce((sum, qty) => sum + qty, 0);
    return requestedQty - allocated;
  };

  // Calculate total for a store
  const getStoreTotal = (storeId: string) => {
    let total = 0;
    request?.items.forEach(item => {
      const itemKey = `${item.productId}-${item.productVariationId || 'null'}`;
      total += storeQuantities[itemKey]?.[storeId] || 0;
    });
    return total;
  };

  const confirmCreateShipment = async () => {
    if (selectedStores.size === 0) {
      toast.error('Veuillez sélectionner au moins un magasin');
      return;
    }


    // Build shipments data
    const shipments = Array.from(selectedStores).map(storeId => {
      const items = request?.items.map(item => {
        const itemKey = `${item.productId}-${item.productVariationId || 'null'}`;
        const quantity = storeQuantities[itemKey]?.[storeId] || 0;
        return {
          productId: item.productId,
          productVariationId: item.productVariationId,
          quantity,
          quantityRequested: item.quantityRequested,
        };
      }).filter(item => item.quantity > 0) || [];

      return {
        destinationStoreId: storeId,
        items,
      };
    }).filter(shipment => shipment.items.length > 0);

    if (shipments.length === 0) {
      toast.error('Veuillez entrer des quantités pour au moins un magasin');
      return;
    }

    try {
      setActionLoading(true);
      const response = await api.post(`/production-requests/${params.id}/create-shipments`, {
        shipments,
      });
      if (response.data.success) {
        toast.success(`${shipments.length} expédition(s) créée(s) avec succès`);
        setShowShipmentModal(false);
        setSelectedStores(new Set());
        setStoreQuantities({});
        fetchRequest();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      EN_ATTENTE: 'bg-yellow-100 text-yellow-800',
      ACCEPTE: 'bg-green-100 text-green-800',
      REFUSE: 'bg-red-100 text-red-800',
      EN_PRODUCTION: 'bg-blue-100 text-blue-800',
      TERMINE: 'bg-green-100 text-green-800',
      EXPEDIE: 'bg-teal-100 text-teal-800',
      ANNULE: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      EN_ATTENTE: 'En Attente',
      ACCEPTE: 'Accepté',
      REFUSE: 'Refusé',
      EN_PRODUCTION: 'En Production',
      TERMINE: 'Terminé',
      EXPEDIE: 'Expédié',
      ANNULE: 'Annulé',
    };
    return labels[status] || status;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
          <div className="flex items-center justify-center h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
          <div className="p-6">
            <p className="text-red-600">Demande introuvable</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <Toaster position="top-right" />

      <div className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => router.push('/production-requests')}
                className="text-blue-600 hover:text-blue-700 mb-2"
              >
                ← Retour aux demandes
              </button>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{request.requestNumber}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(request.status)}`}>
                  {getStatusLabel(request.status)}
                </span>
              </div>
              <p className="text-gray-600 mt-1">{request.title}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => generateProductionRequestPDF(request)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-white border border-gray-200 text-gray-500 rounded-lg hover:bg-green-50 hover:text-green-600 hover:border-green-300 shadow-sm transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3" />
                </svg>
                PDF
              </button>
              {request.status === 'EN_ATTENTE' && canAcceptReject && (
                <>
                  <button
                    onClick={handleAccept}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {actionLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                    Accepter
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Refuser
                  </button>
                </>
              )}

              {request.status === 'ACCEPTE' && canAcceptReject && (
                <button
                  onClick={handleStartProduction}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {actionLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                  Démarrer Production
                </button>
              )}

              {request.status === 'EN_PRODUCTION' && canAcceptReject && (
                <button
                  onClick={handleComplete}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {actionLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                  Terminer
                </button>
              )}

              {request.status === 'TERMINE' && canAcceptReject && !request.shipment && (
                <button
                  onClick={handleCreateShipment}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Créer Expédition
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Info Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Quantité Totale</h3>
            <p className="text-xl font-bold text-gray-900">{request.estimatedQuantity || 0} unités</p>
          </div>

          {/* Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Détails</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Créé par:</span>
                <p className="font-medium">{request.createdBy.fullName}</p>
              </div>
              <div>
                <span className="text-gray-500">Date de création:</span>
                <p className="font-medium">{formatDate(request.createdAt)}</p>
              </div>
              {request.dueDate && (
                <div>
                  <span className="text-gray-500">Date d'échéance:</span>
                  <p className="font-medium">{formatDate(request.dueDate)}</p>
                </div>
              )}
              {request.reviewedBy && (
                <div>
                  <span className="text-gray-500">Révisé par:</span>
                  <p className="font-medium">{request.reviewedBy.fullName}</p>
                </div>
              )}
              {request.notes && (
                <div className="col-span-2">
                  <span className="text-gray-500">Notes:</span>
                  <p className="font-medium mt-1">{request.notes}</p>
                </div>
              )}
              {request.rejectionReason && (
                <div className="col-span-2">
                  <span className="text-gray-500">Raison du refus:</span>
                  <p className="font-medium mt-1 text-red-600">{request.rejectionReason}</p>
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Articles ({request.items.length})</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Variation</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {request.items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.product.name}</div>
                        <div className="text-sm text-gray-500">{item.product.shortCode}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.productVariation
                          ? (item.productVariation.length ? `T${item.productVariation.size}/L${item.productVariation.length}` : item.productVariation.size)
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.quantityRequested}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Refuser la demande</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Raison du refus <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                placeholder="Expliquez pourquoi cette demande est refusée..."
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {actionLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                Refuser
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Shipment Distribution Modal - Card Layout */}
      {showShipmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-lg p-6 max-w-6xl w-full my-8 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Répartir la Production Terminée</h3>
              <p className="text-sm text-gray-600">
                Demande: {request?.requestNumber} • Total: {request?.items.reduce((sum, i) => sum + i.quantityRequested, 0)} pièces
              </p>
            </div>

            {/* Products Overview */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">📦 Produits à Distribuer</h4>
              <div className="space-y-1">
                {request?.items.map((item) => (
                  <div key={`${item.productId}-${item.productVariationId}`} className="text-sm text-gray-700">
                    • {item.product.name} {item.productVariation && `(${item.productVariation.length ? `T${item.productVariation.size}/L${item.productVariation.length}` : item.productVariation.size})`}: <span className="font-semibold">{item.quantityRequested} pièces</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Store Selection */}
            <div className="mb-6">
              <h4 className="text-base font-semibold text-gray-900 mb-3">🏪 Sélectionner les Magasins</h4>
              {stores.length === 0 ? (
                <div className="p-6 bg-yellow-50 border-2 border-yellow-200 rounded-lg text-center">
                  <p className="text-yellow-800 font-medium">⚠️ Aucun magasin actif disponible</p>
                  <p className="text-sm text-yellow-600 mt-2">Vérifiez que des magasins sont activés dans le système</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {stores.map((store) => {
                    const stockLabel = getStoreStockLabel(store.id);
                    return (
                      <label
                        key={store.id}
                        className={`flex items-center gap-3 px-4 py-3 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedStores.has(store.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedStores.has(store.id)}
                          onChange={() => toggleStore(store.id)}
                          className="w-5 h-5 text-blue-600"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{stockLabel.icon}</span>
                            <span className="font-semibold text-gray-900">{store.name}</span>
                          </div>
                          <span className={`text-xs font-medium ${stockLabel.color}`}>{stockLabel.label}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Store Distribution Cards */}
            {selectedStores.size > 0 && (
              <div className="space-y-6 mb-6">
                {Array.from(selectedStores).map((storeId) => {
                  const store = stores.find(s => s.id === storeId);
                  if (!store) return null;
                  const stockLabel = getStoreStockLabel(storeId);
                  const storeTotal = getStoreTotal(storeId);

                  return (
                    <div key={storeId} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                      {/* Store Header */}
                      <div className={`px-4 py-3 ${stockLabel.bg} border-b border-gray-200`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{stockLabel.icon}</span>
                            <div>
                              <h5 className="font-bold text-gray-900">{store.name}</h5>
                              <p className={`text-xs font-medium ${stockLabel.color}`}>{stockLabel.label}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Total pour ce magasin</p>
                            <p className="text-xl font-bold text-gray-900">{storeTotal} pièces</p>
                          </div>
                        </div>
                      </div>

                      {/* Product Table */}
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit & Variation</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Stock Actuel</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">💡 Suggéré</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Envoyer</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {request?.items.map((item) => {
                              const itemKey = `${item.productId}-${item.productVariationId || 'null'}`;
                              const currentStock = storeStock[itemKey]?.[storeId] || 0;
                              const suggested = calculateSuggestion(storeId, itemKey, item.quantityRequested);
                              const qty = storeQuantities[itemKey]?.[storeId] || 0;
                              const diff = qty - item.quantityRequested;

                              return (
                                <tr key={itemKey} className="hover:bg-gray-50">
                                  <td className="px-4 py-3">
                                    <div className="text-sm font-medium text-gray-900">{item.product.name}</div>
                                    {item.productVariation && (
                                      <div className="text-xs text-gray-500">
                                        {item.productVariation.length
                                          ? `Taille ${item.productVariation.size} / Longueur ${item.productVariation.length}`
                                          : `Taille ${item.productVariation.size}`}
                                      </div>
                                    )}
                                    <div className="text-xs text-gray-400 mt-0.5">Demandé: {item.quantityRequested}</div>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {loadingStock ? (
                                      <span className="text-xs text-gray-400">...</span>
                                    ) : (
                                      <span className={`text-sm font-bold ${getStockColor(currentStock)}`}>
                                        {getStockIcon(currentStock)} {currentStock}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="text-sm font-medium text-blue-600">{suggested}</span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => updateQuantity(storeId, itemKey, Math.max(0, qty - 1))}
                                        className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-sm"
                                      >−</button>
                                      <input
                                        type="number"
                                        min="0"
                                        value={qty || ''}
                                        onChange={(e) => updateQuantity(storeId, itemKey, parseInt(e.target.value) || 0)}
                                        className="w-16 px-2 py-1 text-sm text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="0"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => updateQuantity(storeId, itemKey, qty + 1)}
                                        className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-sm"
                                      >+</button>
                                    </div>
                                    {qty > 0 && diff !== 0 && (
                                      <div className={`text-xs mt-1 font-medium ${diff > 0 ? 'text-orange-500' : 'text-red-500'}`}>
                                        {diff > 0 ? `+${diff}` : diff} vs demandé
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Store Actions */}
                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDistributionMode('smart');
                            recalculateQuantities(undefined, 'smart');
                          }}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                            distributionMode === 'smart'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          💡 Smart
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDistributionMode('equal');
                            recalculateQuantities(undefined, 'equal');
                          }}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                            distributionMode === 'equal'
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          ⚖️ Split Égal
                        </button>
                        <button
                          type="button"
                          onClick={resetQuantities}
                          className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition"
                        >
                          ↺ Réinitialiser
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Final Summary */}
            {selectedStores.size > 0 && (
              <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <h4 className="text-base font-bold text-blue-900 mb-3">📊 RÉSUMÉ FINAL</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Production totale:</span>
                    <span className="font-bold text-gray-900">
                      {request?.items.reduce((sum, i) => sum + i.quantityRequested, 0)} pièces
                    </span>
                  </div>
                  {Array.from(selectedStores).map(storeId => {
                    const store = stores.find(s => s.id === storeId);
                    const total = getStoreTotal(storeId);
                    const stockLabel = getStoreStockLabel(storeId);
                    const percentage = request?.items.reduce((sum, i) => sum + i.quantityRequested, 0) || 0;

                    return (
                      <div key={storeId} className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          {stockLabel.icon} {store?.name}:
                        </span>
                        <span className="font-bold text-gray-900">
                          {total} pièces ({percentage > 0 ? Math.round((total / percentage) * 100) : 0}%)
                        </span>
                      </div>
                    );
                  })}
                  <div className="pt-2 border-t border-blue-300 flex justify-between text-sm">
                    <span className="text-gray-700">Non distribué:</span>
                    <span className="font-bold text-gray-900">
                      {(request?.items.reduce((sum, i) => sum + i.quantityRequested, 0) || 0) -
                       Array.from(selectedStores).reduce((sum, storeId) => sum + getStoreTotal(storeId), 0)} pièces
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowShipmentModal(false);
                  setSelectedStores(new Set());
                  setStoreQuantities({});
                }}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmCreateShipment}
                disabled={selectedStores.size === 0 || actionLoading}
                className="flex-1 px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition text-lg flex items-center justify-center gap-2"
              >
                {actionLoading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Création...
                  </>
                ) : (
                  <>✓ Créer {selectedStores.size} Expédition{selectedStores.size > 1 ? 's' : ''}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
