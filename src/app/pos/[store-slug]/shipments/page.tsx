'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';

type Shipment = {
  id: string;
  shipmentNumber: string;
  fromLocation: string;
  status: 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  createdAt: string;
  confirmedAt?: string;
  itemCount: number;
  totalQuantity: number;
};

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  IN_TRANSIT: 'bg-orange-100 text-orange-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
};

const STATUS_LABELS = {
  PENDING: 'En attente',
  IN_TRANSIT: 'En transit',
  DELIVERED: 'Livre',
  CANCELLED: 'Annule',
};

export default function POSShipmentsPage() {
  const params = useParams();
  const router = useRouter();
  const storeSlug = params['store-slug'] as string;

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    loadShipments();
  }, []);

  const loadShipments = async () => {
    setLoading(true);
    try {
      const response = await api.get('/shipments');
      if (response.data.success) {
        setShipments(response.data.data || []);
      }
    } catch (error) {
      console.error('Error loading shipments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredShipments = shipments.filter(s =>
    statusFilter === 'ALL' || s.status === statusFilter
  );

  const pendingCount = shipments.filter(s => s.status === 'PENDING' || s.status === 'IN_TRANSIT').length;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4">
        <h1 className="text-xl font-bold mb-2">Expeditions</h1>
        {pendingCount > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-yellow-800">
            <span className="font-medium">{pendingCount}</span> expedition(s) en attente de reception
          </div>
        )}
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['ALL', 'PENDING', 'IN_TRANSIT', 'DELIVERED'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              statusFilter === status
                ? 'bg-orange-400 text-white'
                : 'bg-white text-gray-700 border'
            }`}
          >
            {status === 'ALL' ? 'Tous' : STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
          </button>
        ))}
      </div>

      {/* Shipments List */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-orange-400 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2 text-gray-500">Chargement...</p>
        </div>
      ) : filteredShipments.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Aucune expedition trouvee
        </div>
      ) : (
        <div className="space-y-3">
          {filteredShipments.map(shipment => (
              <div key={shipment.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold">{shipment.shipmentNumber}</p>
                    <p className="text-sm text-gray-500">De: {shipment.fromLocation}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[shipment.status]}`}>
                    {STATUS_LABELS[shipment.status]}
                  </span>
                </div>

                <div className="flex justify-between text-sm text-gray-600 mb-3">
                  <span>{shipment.itemCount} produit(s) - {shipment.totalQuantity} articles</span>
                  <span>{new Date(shipment.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>

                <div className="flex gap-2">
                  {(shipment.status === 'PENDING' || shipment.status === 'IN_TRANSIT') && (
                    <button
                      onClick={() => router.push(`/pos/${storeSlug}/shipments/${shipment.id}`)}
                      className="py-2 px-6 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                    >
                      Verifier
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/pos/${storeSlug}/shipments/${shipment.id}`)}
                    className="py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Voir details
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
