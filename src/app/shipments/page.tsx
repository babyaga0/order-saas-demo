'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import toast, { Toaster } from 'react-hot-toast';
import api from '@/lib/api';

interface Shipment {
  id: string;
  shipmentNumber: string;
  status: 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  fromLocation: string;
  toStore: {
    id: string;
    name: string;
  };
  itemCount: number;
  totalQuantity: number;
  createdAt: string;
  confirmedAt: string | null;
  confirmedBy: {
    id: string;
    fullName: string;
  } | null;
  createdBy: {
    id: string;
    fullName: string;
  } | null;
}

export default function ShipmentsPage() {
  const router = useRouter();
  const { isSidebarCollapsed } = useLayout();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [userRole] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const userData = localStorage.getItem('user');
    if (!userData) return '';
    try { return JSON.parse(userData).role || ''; } catch { return ''; }
  });

  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    const allowedRoles = ['ADMIN', 'PRODUCTION', 'FACTORY_MANAGER', 'STORE_CASHIER'];
    if (!userRole || !allowedRoles.includes(userRole)) { router.push('/dashboard'); }
  }, []);

  // Fetch shipments on mount and when filter changes
  useEffect(() => {
    if (userRole) {
      fetchShipments();
    }
  }, [userRole, selectedStatus]);

  const fetchShipments = async () => {
    try {
      console.log('Fetching shipments...');
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedStatus !== 'ALL') {
        params.append('status', selectedStatus);
      }

      console.log('API call starting...');
      const response = await api.get(`/shipments?${params.toString()}`);
      console.log('API response:', response.data);

      if (response.data.success) {
        setShipments(response.data.data);
        console.log('Shipments loaded:', response.data.data.length);
      } else {
        console.error('API returned success:false');
        toast.error('Erreur lors du chargement des expéditions');
      }
    } catch (error: any) {
      console.error('Error fetching shipments:', error);
      toast.error(error.response?.data?.message || 'Erreur lors du chargement');
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  const handleConfirm = async (shipmentId: string) => {
    try {
      setConfirmingId(shipmentId);
      const response = await api.post(`/shipments/${shipmentId}/confirm`);

      if (response.data.success) {
        toast.success('Expédition confirmée et stock mis à jour');
        fetchShipments(); // Refresh list
      }
    } catch (error: any) {
      console.error('Error confirming shipment:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la confirmation');
    } finally {
      setConfirmingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'IN_TRANSIT':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'DELIVERED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'En Attente';
      case 'IN_TRANSIT':
        return 'En Transit';
      case 'DELIVERED':
        return 'Livrée';
      case 'CANCELLED':
        return 'Annulée';
      default:
        return status;
    }
  };

  const canConfirm = (shipment: Shipment) => {
    // Only STORE_CASHIER can confirm shipment reception at their store
    return ['PENDING', 'IN_TRANSIT'].includes(shipment.status) && userRole === 'STORE_CASHIER';
  };

  // Don't render until role is verified
  const allowedRoles = ['ADMIN', 'PRODUCTION', 'FACTORY_MANAGER', 'STORE_CASHIER'];
  if (!userRole || !allowedRoles.includes(userRole)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div
          className={`flex-1 flex items-center justify-center transition-all duration-300 ${
            isSidebarCollapsed ? 'ml-20' : 'ml-64'
          }`}
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Chargement des expéditions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Toaster position="top-right" />
      <Sidebar />
      <div
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Expéditions</h1>
              <p className="text-sm text-gray-600 mt-1">
                Gérez et confirmez la réception des expéditions
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Filter Tabs */}
          <div className="mb-6 flex gap-2 border-b border-gray-200">
            {[
              { value: 'ALL', label: 'Toutes' },
              { value: 'PENDING', label: 'En Attente' },
              { value: 'IN_TRANSIT', label: 'En Transit' },
              { value: 'DELIVERED', label: 'Livrées' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setSelectedStatus(tab.value)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  selectedStatus === tab.value
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Shipments List */}
          {shipments.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune expédition</h3>
              <p className="mt-1 text-sm text-gray-500">
                {selectedStatus !== 'ALL'
                  ? `Aucune expédition avec le statut "${getStatusLabel(selectedStatus)}"`
                  : 'Aucune expédition disponible pour le moment'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {shipments.map((shipment) => (
                <div
                  key={shipment.id}
                  className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <h3
                          className="text-lg font-semibold text-gray-900 hover:text-purple-600 cursor-pointer"
                          onClick={() => router.push(`/shipments/${shipment.id}`)}
                        >
                          {shipment.shipmentNumber}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                            shipment.status
                          )}`}
                        >
                          {getStatusLabel(shipment.status)}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Destination:</span>
                          <p className="font-medium text-gray-900">{shipment.toStore.name}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Articles:</span>
                          <p className="font-medium text-gray-900">{shipment.itemCount} produits</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Quantité totale:</span>
                          <p className="font-medium text-gray-900">{shipment.totalQuantity} unités</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Date de création:</span>
                          <p className="font-medium text-gray-900">
                            {new Date(shipment.createdAt).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>

                      {/* Confirmation Info */}
                      {shipment.status === 'DELIVERED' && shipment.confirmedBy && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-500">
                            Confirmée le{' '}
                            {shipment.confirmedAt
                              ? new Date(shipment.confirmedAt).toLocaleString('fr-FR')
                              : '-'}{' '}
                            par {shipment.confirmedBy.fullName}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="ml-4 flex flex-col gap-2">
                      <button
                        onClick={() => router.push(`/shipments/${shipment.id}`)}
                        className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Voir détails
                      </button>
                      {canConfirm(shipment) && (
                        <button
                          onClick={() => handleConfirm(shipment.id)}
                          disabled={confirmingId === shipment.id}
                          className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                        >
                          {confirmingId === shipment.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Confirmation...</span>
                            </>
                          ) : (
                            'Confirmer Réception'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
