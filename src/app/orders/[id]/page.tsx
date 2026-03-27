 'use client';

  import { useEffect, useState } from 'react';
  import { useRouter, useParams } from 'next/navigation';
  import Sidebar from '@/components/Sidebar';
  import { useLayout } from '@/contexts/LayoutContext';
  import LoadingSpinner from '@/components/LoadingSpinner';
  import { ConfirmModal } from '@/components/Modal';
  import Modal from '@/components/Modal';
  import ProductSelector from '@/components/ProductSelector';
  import StockProductSelector, { OrderItem } from '@/components/StockProductSelector';
  import api from '@/lib/api';
  import toast, { Toaster } from 'react-hot-toast';

  type Order = {
    id: string;
    orderNumber: string;
    source: string;
    status: string;
    customerName: string;
    customerPhone: string;
    customerCity: string;
    customerAddress: string;
    products: string;
    totalAmount: string;
    notes?: string;
    deliveryCity?: string;
    deliverySector?: string;
    deliveryTrackingId?: string;
    deliveryStatus?: string;
    sentToDeliveryAt?: string;
    isExchange?: boolean;
    exchangeForOrderId?: string;
    exchangeForOrder?: {
      id: string;
      orderNumber: string;
      status: string;
      customerName: string;
      customerPhone: string;
      customerCity: string;
      customerAddress: string;
      products: string;
      totalAmount: string;
      deliveryTrackingId?: string;
      createdBy?: {
        id: string;
        fullName: string;
        email: string;
      };
      createdAt: string;
      updatedAt: string;
    };
    exchangeOrders?: Array<{
      id: string;
      orderNumber: string;
    }>;
    createdBy?: {
      id: string;
      fullName: string;
      email: string;
    };
    createdAt: string;
    updatedAt: string;
    sourceStoreId?: string;
    sourceStore?: { id: string; name: string };
    orderItems?: OrderItem[];
  };

  export default function OrderDetailPage() {
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editedOrder, setEditedOrder] = useState<Partial<Order>>({});
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showExchangeModal, setShowExchangeModal] = useState(false);
    const [pendingStatus, setPendingStatus] = useState('');
    const [exchangeProducts, setExchangeProducts] = useState<any[]>([]);
    const [exchangeNotes, setExchangeNotes] = useState('');
    const [exchangeSourceStoreId, setExchangeSourceStoreId] = useState('');
    const [exchangeOrderItems, setExchangeOrderItems] = useState<OrderItem[]>([]);
    const [exchangeTotalAmount, setExchangeTotalAmount] = useState('');
    const [cathedisAmount, setCathedisAmount] = useState('');

    // Auto-populate exchange total when items change (for canSendToDelivery users)
    useEffect(() => {
      if (exchangeOrderItems.length > 0) {
        const total = exchangeOrderItems.reduce((t, i) => t + i.price * i.quantity, 0);
        setExchangeTotalAmount(total.toFixed(2));
      }
    }, [exchangeOrderItems]);
    const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
    const [selectedSourceStoreId, setSelectedSourceStoreId] = useState('');
    const [sourceStoreItems, setSourceStoreItems] = useState<OrderItem[]>([]);
    const [savingSourceStore, setSavingSourceStore] = useState(false);
    const { isSidebarCollapsed } = useLayout();
    const router = useRouter();
    const params = useParams();
    const orderId = params?.id as string;

    useEffect(() => {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');
      if (!token) {
        router.push('/login');
        return;
      }
      if (userData) {
        setUser(JSON.parse(userData));
      }
      if (orderId) {
        loadOrder();
      }
      api.get('/stores').then(r => { if (r.data.success) setStores(r.data.data); }).catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId]);

    const loadOrder = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/orders/${orderId}`);
        if (response.data.success) {
          console.log('📦 Order loaded from API:', response.data.data);
          console.log('📦 deliveryStatus:', response.data.data.deliveryStatus);
          console.log('📦 status:', response.data.data.status);
          setOrder(response.data.data);
          setEditedOrder(response.data.data);
          setSelectedSourceStoreId(response.data.data.sourceStoreId || '');
          setCathedisAmount(response.data.data.totalAmount || '');
        }
      } catch (error) {
        console.error('Failed to load order:', error);
        alert('Erreur lors du chargement de la commande');
        router.push('/orders');
      } finally {
        setLoading(false);
      }
    };

    const handleEditClick = () => {
      setIsEditing(true);
      setEditedOrder(order || {});
    };

    const handleCancelEdit = () => {
      setIsEditing(false);
      setEditedOrder(order || {});
    };

    const handleSaveEdit = async () => {
      if (!editedOrder) return;

      setActionLoading(true);
      try {
        const response = await api.put(`/orders/${orderId}`, {
          customerName: editedOrder.customerName,
          customerPhone: editedOrder.customerPhone,
          customerCity: editedOrder.customerCity,
          customerAddress: editedOrder.customerAddress,
          products: editedOrder.products,
          totalAmount: editedOrder.totalAmount,
          notes: editedOrder.notes,
        });

        if (response.data.success) {
          toast.success('Commande mise à jour avec succès!');
          setIsEditing(false);
          loadOrder();
        }
      } catch (error: any) {
        console.error('Update order error:', error);
        toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour');
      } finally {
        setActionLoading(false);
      }
    };

    const handleEditChange = (field: keyof Order, value: string) => {
      setEditedOrder({
        ...editedOrder,
        [field]: value,
      });
    };

    const handleSaveSourceStore = async () => {
      setSavingSourceStore(true);
      try {
        const payload: any = { sourceStoreId: selectedSourceStoreId || null };
        if (sourceStoreItems.length > 0) payload.orderItems = sourceStoreItems;
        await api.patch(`/orders/${orderId}/source-store`, payload);
        toast.success('Magasin source enregistré');
        loadOrder();
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Erreur lors de la sauvegarde');
      } finally {
        setSavingSourceStore(false);
      }
    };

    const handleStatusUpdate = async (newStatus: string) => {
      setPendingStatus(newStatus);
      setShowStatusModal(true);
    };

    const confirmStatusUpdate = async () => {
      setActionLoading(true);
      try {
        const response = await api.patch(`/orders/${orderId}/status`, {
          status: pendingStatus,
        });

        if (response.data.success) {
          toast.success('Statut mis à jour avec succès');
          setShowStatusModal(false);
          loadOrder();
        }
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour du statut');
      } finally {
        setActionLoading(false);
      }
    };

    const handleDelete = async () => {
      setActionLoading(true);
      try {
        const response = await api.delete(`/orders/${orderId}`);
        if (response.data.success) {
          toast.success('Commande supprimée avec succès');
          setShowDeleteModal(false);
          router.push('/orders');
        }
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
      } finally {
        setActionLoading(false);
      }
    };

    // Send to delivery - automatic with customerCity + "Autre" sector
    const handleSendToDelivery = async () => {
      setActionLoading(true);
      const loadingToast = toast.loading('Envoi à Cathedis en cours...');

      try {
        // Patch totalAmount first if Fouad changed it
        if (cathedisAmount && parseFloat(cathedisAmount) !== parseFloat(order?.totalAmount || '0')) {
          await api.put(`/orders/${orderId}`, { totalAmount: parseFloat(cathedisAmount) });
        }

        // Use customer city in UPPERCASE (Cathedis requirement), default to CASABLANCA if not set
        const deliveryCity = order?.customerCity?.trim().toUpperCase() || 'CASABLANCA';
        const deliverySector = 'Autre'; // Always use "Autre" sector

        const response = await api.post(`/delivery/send/${orderId}`, {
          deliveryCity: deliveryCity,
          deliverySector: deliverySector,
        });

        if (response.data.success) {
          const trackingId = response.data.data.trackingId;
          toast.success(`Commande envoyée avec succès!\nTracking ID: ${trackingId}`, {
            duration: 5000,
            id: loadingToast,
          });
          loadOrder(); // Reload to show tracking ID
        }
      } catch (error: any) {
        console.error('Send to delivery error:', error);
        const errorMessage = error.response?.data?.message || 'Erreur lors de l\'envoi à la livraison';
        toast.error(errorMessage, {
          id: loadingToast,
          duration: 6000,
        });
      } finally {
        setActionLoading(false);
      }
    };

    const handleExchangeOrder = async () => {
      if (!exchangeSourceStoreId) {
        toast.error('Veuillez choisir le magasin source');
        return;
      }

      if (!exchangeOrderItems || exchangeOrderItems.length === 0) {
        toast.error('Veuillez sélectionner au moins un produit');
        return;
      }

      setActionLoading(true);
      const loadingToast = toast.loading('Création de la commande d\'échange...');

      try {
        // Build products text from stock items
        const productsText = exchangeOrderItems
          .map((item) => {
            let sizeLabel = '';
            if (item.size) sizeLabel += ` (Taille: ${item.size}`;
            if (item.length) sizeLabel += `, Longueur: ${item.length}`;
            if (item.size) sizeLabel += ')';
            return `${item.quantity}x ${item.productName}${sizeLabel}`;
          })
          .join(', ');

        const totalAmount = parseFloat(exchangeTotalAmount) || exchangeOrderItems.reduce((total, item) => total + (item.price * item.quantity), 0);

        const response = await api.post(`/orders/${orderId}/exchange`, {
          products: productsText,
          totalAmount: totalAmount,
          notes: exchangeNotes || `Échange de la commande ${order?.orderNumber}`,
          sourceStoreId: exchangeSourceStoreId,
          orderItems: exchangeOrderItems,
        });

        if (response.data.success) {
          toast.success('Commande d\'échange créée et envoyée à Cathedis!', {
            id: loadingToast,
          });
          setShowExchangeModal(false);
          setExchangeProducts([]);
          setExchangeNotes('');
          setExchangeSourceStoreId('');
          setExchangeOrderItems([]);
          setExchangeTotalAmount('');
          loadOrder(); // Reload to show exchange link
        }
      } catch (error: any) {
        console.error('Exchange order error:', error);
        toast.error(error.response?.data?.message || 'Erreur lors de la création de l\'échange', {
          id: loadingToast,
        });
      } finally {
        setActionLoading(false);
      }
    };

    const getStatusBadge = (status: string, deliveryStatus?: string) => {
      // If there's a Cathedis deliveryStatus, show that instead
      console.log('🔍 getStatusBadge called:', { status, deliveryStatus, displayStatus: deliveryStatus || status });
      const displayStatus = deliveryStatus || status;

      const statusConfig: any = {
        PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'En Attente' },
        CONFIRMED: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Confirmée' },
        SENT_TO_DELIVERY: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Envoyée' },
        SHIPPED: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Expédiée' },
        DELIVERED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Livrée' },
        CANCELLED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Annulée' },
        RETURNED: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Retournée' },
        // Common Cathedis French statuses
        'En Attente Ramassage': { bg: 'bg-purple-100', text: 'text-purple-800', label: 'En Attente Ramassage' },
        'Collecté': { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Collecté' },
        'Livré': { bg: 'bg-green-100', text: 'text-green-800', label: 'Livré' },
        'Annulé': { bg: 'bg-red-100', text: 'text-red-800', label: 'Annulé' },
        'Hub CATHEDIS': { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Hub CATHEDIS' },
        'Client Injoignable': { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Client Injoignable' },
        'CRC': { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'CRC' },
        'Au Téléphone': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Au Téléphone' },
      };

      // If status exists in config, use it; otherwise display as-is with default styling
      const config = statusConfig[displayStatus] || {
        bg: 'bg-indigo-100',
        text: 'text-indigo-800',
        label: displayStatus // Display whatever Cathedis returns
      };

      return (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
          {config.label}
        </span>
      );
    };

    const getSourceDisplay = () => {
      if (!order) return null;

      if (order.source === 'WOOCOMMERCE') {
        return (
          <span className="inline-flex items-center px-3 py-1 rounded text-sm font-medium bg-purple-100 text-purple-800">
            WooCommerce
          </span>
        );
      } else if (order.source === 'WHATSAPP') {
        return (
          <span className="inline-flex items-center px-3 py-1 rounded text-sm font-medium bg-green-100 text-green-800">
            WhatsApp
          </span>
        );
      } else {
        return (
          <div className="flex flex-col">
            <span className="inline-flex items-center px-3 py-1 rounded text-sm font-medium bg-gray-100 text-gray-800">
              Manuelle
            </span>
            {order.createdBy && (
              <span className="text-sm text-gray-500 mt-1">
                Créée par: {order.createdBy.fullName}
              </span>
            )}
          </div>
        );
      }
    };

    if (loading) {
      return (
        <>
          <Toaster position="top-right" />
          <div className="flex">
            <Sidebar />
            <main
              className={`flex-1 min-h-screen bg-gray-50 transition-all duration-300 ${
                isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'
              }`}
            >
              <div className="flex justify-center items-center h-screen">
                <LoadingSpinner size="lg" />
              </div>
            </main>
          </div>
        </>
      );
    }

    if (!order) {
      return (
        <>
          <Toaster position="top-right" />
          <div className="flex">
            <Sidebar />
          <main
            className={`flex-1 min-h-screen bg-gray-50 transition-all duration-300 ${
              isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'
            }`}
          >
            <div className="flex justify-center items-center h-screen">
              <p className="text-gray-500">Commande non trouvée</p>
            </div>
          </main>
        </div>
        </>
      );
    }

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
              <button
                onClick={() => router.back()}
                className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Retour aux commandes
              </button>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{order.orderNumber}</h1>
                  <p className="text-gray-600 mt-1">
                    Créée le {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  {getStatusBadge(order.status, order.deliveryStatus)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Order Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Customer Information */}
                <div className="bg-white rounded-xl shadow-md p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Informations Client</h2>
                    {!isEditing && (user?.role === 'ADMIN' || user?.role === 'STAFF' || user?.canSendToDelivery) && !order.deliveryTrackingId && (
                      <button
                        onClick={handleEditClick}
                        className="px-4 py-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg font-semibold transition-colors flex items-center space-x-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Modifier</span>
                      </button>
                    )}
                  </div>
                  {order.deliveryTrackingId && (user?.role === 'ADMIN' || user?.canSendToDelivery) && (
                    <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800 flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Modification désactivée : La commande a été envoyée à Cathedis
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Nom</p>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedOrder.customerName || ''}
                          onChange={(e) => handleEditChange('customerName', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      ) : (
                        <p className="text-lg text-gray-900">{order.customerName}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Téléphone</p>
                      {isEditing ? (
                        <input
                          type="tel"
                          value={editedOrder.customerPhone || ''}
                          onChange={(e) => handleEditChange('customerPhone', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      ) : (
                        <a href={`tel:${order.customerPhone}`} className="text-lg text-blue-600 hover:text-blue-800">
                          {order.customerPhone}
                        </a>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Ville</p>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedOrder.customerCity || ''}
                          onChange={(e) => handleEditChange('customerCity', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      ) : (
                        <p className="text-lg text-gray-900">{order.customerCity}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Source</p>
                      <div className="mt-1">{getSourceDisplay()}</div>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-gray-600 mb-1">Adresse</p>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedOrder.customerAddress || ''}
                          onChange={(e) => handleEditChange('customerAddress', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      ) : (
                        <p className="text-lg text-gray-900">{order.customerAddress}</p>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                      <button
                        onClick={handleCancelEdit}
                        disabled={actionLoading}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
                      >
                        {actionLoading ? 'Enregistrement...' : 'Enregistrer'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Source Magasin */}
                {(user?.role === 'ADMIN' || user?.role === 'STAFF') && (
                  <div className="bg-white rounded-xl shadow-md p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Source Magasin</h2>
                    {['PENDING', 'CONFIRMED'].includes(order.status) ? (
                      <div className="space-y-4">
                        <div className="flex gap-3">
                          <select
                            value={selectedSourceStoreId}
                            onChange={e => setSelectedSourceStoreId(e.target.value)}
                            className="input-field flex-1"
                          >
                            <option value="">Choisir le magasin source...</option>
                            {stores.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={handleSaveSourceStore}
                            disabled={savingSourceStore}
                            className="px-4 py-2 bg-orange-400 text-white rounded-lg font-medium hover:bg-orange-500 disabled:opacity-50 whitespace-nowrap"
                          >
                            {savingSourceStore ? '...' : 'Enregistrer'}
                          </button>
                        </div>
                        {/* For WooCommerce orders without orderItems, show product picker */}
                        {order.source === 'WOOCOMMERCE' && selectedSourceStoreId && !order.orderItems && (
                          <div>
                            <p className="text-sm text-gray-500 mb-2">Sélectionnez les produits depuis le stock du magasin:</p>
                            <StockProductSelector
                              storeId={selectedSourceStoreId}
                              onItemsChange={setSourceStoreItems}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-900 font-medium">
                        {order.sourceStore?.name || <span className="text-gray-400 italic">Non défini</span>}
                      </p>
                    )}
                  </div>
                )}

                {/* Order Details */}
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Détails de la Commande</h2>
                  <div className="space-y-4">
                    {/* Exchange Information */}
                    {order.isExchange && order.exchangeForOrder && (
                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-300 rounded-xl p-5 shadow-sm">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            <span className="font-bold text-blue-900">Commande d'Échange</span>
                          </div>
                          <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full font-semibold">
                            EXCHANGE
                          </span>
                        </div>

                        {/* Quick Summary */}
                        <div className="bg-white rounded-lg p-4 mb-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Commande Originale</p>
                              <button
                                onClick={() => router.push(`/orders/${order.exchangeForOrderId}`)}
                                className="text-sm font-bold text-blue-600 hover:text-blue-700 underline"
                              >
                                {order.exchangeForOrder.orderNumber}
                              </button>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Date Originale</p>
                              <p className="text-sm font-semibold text-gray-900">
                                {new Date(order.exchangeForOrder.createdAt).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Montant Original</p>
                              <p className="text-sm font-semibold text-gray-900">
                                {parseFloat(order.exchangeForOrder.totalAmount).toFixed(2)} DH
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Statut Original</p>
                              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                                order.exchangeForOrder.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                                order.exchangeForOrder.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {order.exchangeForOrder.status}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Collapsible Timeline */}
                        <details className="group">
                          <summary className="cursor-pointer list-none flex items-center justify-between bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-2 transition-colors">
                            <span className="text-sm font-semibold text-blue-900">Voir l'historique complet de l'échange</span>
                            <svg className="w-5 h-5 text-blue-600 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </summary>
                          <div className="mt-3 bg-white rounded-lg p-4 space-y-4">
                            {/* Original Order Timeline */}
                            <div className="relative pl-8 pb-4 border-l-2 border-blue-200">
                              <div className="absolute -left-2 top-0 w-4 h-4 bg-blue-500 rounded-full"></div>
                              <div className="mb-1">
                                <p className="text-sm font-bold text-gray-900">Commande Originale Créée</p>
                                <p className="text-xs text-gray-500">
                                  {new Date(order.exchangeForOrder.createdAt).toLocaleString('fr-FR')}
                                </p>
                              </div>
                              <div className="mt-2 text-xs space-y-1">
                                <p className="text-gray-700"><span className="font-semibold">Client:</span> {order.exchangeForOrder.customerName}</p>
                                <p className="text-gray-700"><span className="font-semibold">Téléphone:</span> {order.exchangeForOrder.customerPhone}</p>
                                <p className="text-gray-700"><span className="font-semibold">Ville:</span> {order.exchangeForOrder.customerCity}</p>
                                <div className="mt-2">
                                  <p className="font-semibold text-gray-700 mb-1">Produits Originaux:</p>
                                  <p className="text-gray-600 whitespace-pre-wrap bg-gray-50 p-2 rounded">
                                    {order.exchangeForOrder.products}
                                  </p>
                                </div>
                                <p className="text-gray-700"><span className="font-semibold">Montant:</span> {parseFloat(order.exchangeForOrder.totalAmount).toFixed(2)} DH</p>
                                {order.exchangeForOrder.deliveryTrackingId && (
                                  <p className="text-gray-700">
                                    <span className="font-semibold">Cathedis ID:</span>
                                    <span className="font-mono ml-1">{order.exchangeForOrder.deliveryTrackingId}</span>
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Exchange Created Timeline */}
                            <div className="relative pl-8 pb-4 border-l-2 border-orange-200">
                              <div className="absolute -left-2 top-0 w-4 h-4 bg-orange-500 rounded-full"></div>
                              <div className="mb-1">
                                <p className="text-sm font-bold text-gray-900">Échange Créé</p>
                                <p className="text-xs text-gray-500">
                                  {new Date(order.createdAt).toLocaleString('fr-FR')}
                                </p>
                              </div>
                              <div className="mt-2 text-xs space-y-1">
                                <p className="text-gray-700"><span className="font-semibold">Nouvelle Commande:</span> {order.orderNumber}</p>
                                <div className="mt-2">
                                  <p className="font-semibold text-gray-700 mb-1">Nouveaux Produits:</p>
                                  <p className="text-gray-600 whitespace-pre-wrap bg-gray-50 p-2 rounded">
                                    {order.products}
                                  </p>
                                </div>
                                <p className="text-gray-700"><span className="font-semibold">Nouveau Montant:</span> {parseFloat(order.totalAmount).toFixed(2)} DH</p>
                                {order.createdBy && (
                                  <p className="text-gray-700"><span className="font-semibold">Créé par:</span> {order.createdBy.fullName}</p>
                                )}
                              </div>
                            </div>

                            {/* Current Status Timeline */}
                            <div className="relative pl-8">
                              <div className="absolute -left-2 top-0 w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                              <div className="mb-1">
                                <p className="text-sm font-bold text-gray-900">Statut Actuel</p>
                                <p className="text-xs text-gray-500">
                                  {new Date(order.updatedAt).toLocaleString('fr-FR')}
                                </p>
                              </div>
                              <div className="mt-2 text-xs">
                                <span className={`px-3 py-1 rounded-full font-semibold ${
                                  order.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                                  order.status === 'SENT_TO_DELIVERY' ? 'bg-purple-100 text-purple-800' :
                                  order.status === 'CONFIRMED' ? 'bg-orange-100 text-orange-800' :
                                  order.status === 'SHIPPED' ? 'bg-indigo-100 text-indigo-800' :
                                  order.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {order.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        </details>
                      </div>
                    )}

                    {/* Has Exchange Orders */}
                    {order.exchangeOrders && order.exchangeOrders.length > 0 && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2">
                          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          <span className="text-sm font-semibold text-purple-900">Commandes d'Échange Créées</span>
                        </div>
                        <ul className="mt-2 space-y-1">
                          {order.exchangeOrders.map((exchangeOrder) => (
                            <li key={exchangeOrder.id}>
                              <button
                                onClick={() => router.push(`/orders/${exchangeOrder.id}`)}
                                className="text-sm text-purple-800 font-semibold underline hover:text-purple-600"
                              >
                                {exchangeOrder.orderNumber}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Produits</p>
                      {isEditing ? (
                        <textarea
                          value={editedOrder.products || ''}
                          onChange={(e) => handleEditChange('products', e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="Description des produits..."
                        />
                      ) : (
                        <p className="text-gray-900 whitespace-pre-wrap">{order.products}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Montant Total</p>
                      {isEditing ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            step="0.01"
                            value={editedOrder.totalAmount || ''}
                            onChange={(e) => handleEditChange('totalAmount', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder="0.00"
                          />
                          <span className="text-gray-600 font-semibold">DH</span>
                        </div>
                      ) : (
                        <p className="text-2xl font-bold text-gray-900">
                          {parseFloat(order.totalAmount).toFixed(2)} DH
                        </p>
                      )}
                    </div>
                    {(order.notes || isEditing) && (
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Notes</p>
                        {isEditing ? (
                          <textarea
                            value={editedOrder.notes || ''}
                            onChange={(e) => handleEditChange('notes', e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder="Ajouter des notes..."
                          />
                        ) : (
                          <p className="text-gray-900">{order.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Delivery Information */}
                {(order.deliveryCity || order.deliverySector || order.deliveryTrackingId) && (
                  <div className="bg-white rounded-xl shadow-md p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Informations de Livraison</h2>
                    <div className="grid grid-cols-2 gap-4">
                      {order.deliveryCity && (
                        <div>
                          <p className="text-sm font-medium text-gray-600">Ville de Livraison</p>
                          <p className="text-lg text-gray-900">{order.deliveryCity}</p>
                        </div>
                      )}
                      {order.deliverySector && (
                        <div>
                          <p className="text-sm font-medium text-gray-600">Secteur</p>
                          <p className="text-lg text-gray-900">{order.deliverySector}</p>
                        </div>
                      )}
                      {order.deliveryTrackingId && (
                        <div className="col-span-2">
                          <p className="text-sm font-medium text-gray-600">ID de Suivi</p>
                          <p className="text-lg text-gray-900 font-mono">{order.deliveryTrackingId}</p>
                        </div>
                      )}
                      {order.sentToDeliveryAt && (
                        <div className="col-span-2">
                          <p className="text-sm font-medium text-gray-600">Date d'Envoi</p>
                          <p className="text-lg text-gray-900">
                            {new Date(order.sentToDeliveryAt).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Actions */}
              <div className="space-y-6">
                {/* Status Actions */}
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Actions</h2>
                  <div className="space-y-3">
                    {order.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleStatusUpdate('CONFIRMED')}
                          disabled={actionLoading}
                          className="w-full px-4 py-3 bg-orange-400 text-white rounded-lg font-semibold hover:bg-orange-500
  transition-colors disabled:opacity-50"
                        >
                          Confirmer la Commande
                        </button>
                        <button
                          onClick={() => handleStatusUpdate('CANCELLED')}
                          disabled={actionLoading}
                          className="w-full px-4 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600
  transition-colors disabled:opacity-50"
                        >
                          Annuler la Commande
                        </button>
                      </>
                    )}

                    {order.status === 'CONFIRMED' && (user?.role === 'ADMIN' || user?.canSendToDelivery) && (
                      <>
                        {order.source === 'WOOCOMMERCE' && (!order.sourceStoreId || !order.orderItems || (order.orderItems as any) === 'null') && (
                          <p className="text-sm text-red-500 text-center">
                            Sélectionnez les produits dans "Source Magasin" avant d'envoyer.
                          </p>
                        )}
                        {(user?.role === 'ADMIN' || user?.role === 'STAFF' || user?.canSendToDelivery) && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Montant à envoyer (DH)</label>
                            <input
                              type="number"
                              value={cathedisAmount}
                              onChange={e => setCathedisAmount(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                              min="0"
                              step="1"
                            />
                          </div>
                        )}
                        <button
                          onClick={handleSendToDelivery}
                          disabled={actionLoading || (order.source === 'WOOCOMMERCE' && (!order.sourceStoreId || !order.orderItems || (order.orderItems as any) === 'null'))}
                          className="w-full px-4 py-3 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 transition-colors disabled:opacity-50"
                        >
                          Envoyer à Cathedis Delivery
                        </button>
                      </>
                    )}

                    {order.status === 'SENT_TO_DELIVERY' && !order.deliveryTrackingId && (
                      <button
                        onClick={() => handleStatusUpdate('SHIPPED')}
                        disabled={actionLoading}
                        className="w-full px-4 py-3 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600
  transition-colors disabled:opacity-50"
                      >
                        Marquer comme Expédiée
                      </button>
                    )}

                    {order.status === 'SHIPPED' && !order.deliveryTrackingId && (
                      <button
                        onClick={() => handleStatusUpdate('DELIVERED')}
                        disabled={actionLoading}
                        className="w-full px-4 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600
  transition-colors disabled:opacity-50"
                      >
                        Marquer comme Livrée
                      </button>
                    )}

                    {/* Exchange Button for DELIVERED orders */}
                    {order.status === 'DELIVERED' && (
                      user?.role === 'ADMIN' ||
                      user?.role === 'SUPER_ADMIN' ||
                      user?.canSeeAllOrders ||
                      order.createdBy?.id === user?.id
                    ) && (
                      <button
                        onClick={() => setShowExchangeModal(true)}
                        disabled={actionLoading}
                        className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600
  transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        <span>Échanger</span>
                      </button>
                    )}

                    {/* Info message for Cathedis-managed orders */}
                    {order.deliveryTrackingId && (order.status === 'SENT_TO_DELIVERY' || order.status === 'SHIPPED') && (
                      <div className="w-full px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800 text-center">
                          <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Le statut est synchronisé automatiquement depuis Cathedis
                        </p>
                      </div>
                    )}

                    {(user?.role === 'ADMIN' || (user?.canSendToDelivery && order.status !== 'SENT_TO_DELIVERY')) && (
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        disabled={actionLoading}
                        className="w-full px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700
  transition-colors disabled:opacity-50"
                      >
                        Supprimer la Commande
                      </button>
                    )}
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Historique</h2>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-gray-400 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Créée</p>
                        <p className="text-xs text-gray-500">
                          {new Date(order.createdAt).toLocaleString('fr-FR')}
                        </p>
                      </div>
                    </div>
                    {order.sentToDeliveryAt && (
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Envoyée à la Livraison</p>
                          <p className="text-xs text-gray-500">
                            {new Date(order.sentToDeliveryAt).toLocaleString('fr-FR')}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-orange-400 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Dernière Mise à Jour</p>
                        <p className="text-xs text-gray-500">
                          {new Date(order.updatedAt).toLocaleString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Supprimer la commande"
        message={`Voulez-vous vraiment supprimer la commande ${order?.orderNumber} ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        type="danger"
        loading={actionLoading}
      />

      {/* Exchange Modal */}
      <Modal
        isOpen={showExchangeModal}
        onClose={() => {
          setShowExchangeModal(false);
          setExchangeSourceStoreId('');
          setExchangeOrderItems([]);
          setExchangeTotalAmount('');
        }}
        title="Créer une Commande d'Échange"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">Échange de commande</h4>
                <p className="text-sm text-blue-800">
                  Commande originale: <span className="font-semibold">{order?.orderNumber}</span>
                  <br />
                  Les informations client seront automatiquement copiées et la nouvelle commande sera envoyée à Cathedis.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Magasin source <span className="text-red-500">*</span></label>
            <select
              value={exchangeSourceStoreId}
              onChange={e => { setExchangeSourceStoreId(e.target.value); setExchangeOrderItems([]); }}
              className="input-field w-full"
            >
              <option value="">Choisir le magasin source...</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {exchangeSourceStoreId ? (
            <StockProductSelector storeId={exchangeSourceStoreId} onItemsChange={setExchangeOrderItems} />
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-400 text-sm">
              Choisissez un magasin source pour voir les produits disponibles
            </div>
          )}

          {(user?.role === 'ADMIN' || user?.role === 'STAFF' || user?.canSendToDelivery) && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Montant Total (DH)
              </label>
              <input
                type="number"
                value={exchangeTotalAmount}
                onChange={e => setExchangeTotalAmount(e.target.value)}
                className="input-field w-full"
                min="0"
                step="1"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Notes (optionnel)
            </label>
            <textarea
              value={exchangeNotes}
              onChange={(e) => setExchangeNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Raison de l'échange, instructions spéciales, etc."
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                setShowExchangeModal(false);
                setExchangeProducts([]);
                setExchangeNotes('');
              }}
              disabled={actionLoading}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleExchangeOrder}
              disabled={actionLoading || !exchangeSourceStoreId || exchangeOrderItems.length === 0}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {actionLoading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Création...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>Créer l'Échange</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Status Change Confirmation Modal */}
      <ConfirmModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        onConfirm={confirmStatusUpdate}
        title="Changer le statut"
        message={`Voulez-vous changer le statut de cette commande en "${pendingStatus}" ?`}
        confirmText="Confirmer"
        cancelText="Annuler"
        type="warning"
        loading={actionLoading}
      />
      </>
    );
  }