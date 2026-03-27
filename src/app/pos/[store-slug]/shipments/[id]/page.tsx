'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';

type ShipmentItem = {
  id: string;
  productId: number;
  productVariationId?: number;
  quantityRequested: number | null;
  quantityExpected: number;
  quantityReceived: number;
  product: {
    name: string;
    shortCode: string;
  };
  productVariation?: {
    shortCode: string;
    size: string;
    length: string;
  };
};

type Shipment = {
  id: string;
  shipmentNumber: string;
  fromLocation: string;
  status: string;
  createdAt: string;
  items: ShipmentItem[];
};

export default function ShipmentVerificationPage() {
  const params = useParams();
  const router = useRouter();
  const storeSlug = params['store-slug'] as string;
  const shipmentId = params.id as string;
  const scanInputRef = useRef<HTMLInputElement>(null);

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  const [discrepancyNote, setDiscrepancyNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanCode, setScanCode] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    loadShipment();
  }, [shipmentId]);

  const loadShipment = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/shipments/${shipmentId}`);
      if (response.data.success) {
        const data = response.data.data;
        setShipment(data);
        const initial: Record<string, number> = {};
        data.items.forEach((item: ShipmentItem) => {
          initial[item.id] = item.quantityReceived > 0 ? item.quantityReceived : item.quantityExpected;
        });
        setReceivedQuantities(initial);
      }
    } catch (error) {
      console.error('Error loading shipment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = () => {
    if (!scanCode || !shipment) return;

    // Find matching item
    const item = shipment.items.find(i =>
      i.productVariation?.shortCode === scanCode ||
      i.product.shortCode === scanCode
    );

    if (item) {
      // Increment received quantity
      setReceivedQuantities(prev => ({
        ...prev,
        [item.id]: Math.min((prev[item.id] || 0) + 1, item.quantityExpected)
      }));
      setScanCode('');
    } else {
      alert(`Article non trouve dans cette expedition: ${scanCode}`);
    }

    scanInputRef.current?.focus();
  };

  const handleConfirm = async () => {
    if (!shipment || isSubmitting || confirmed) return;

    setIsSubmitting(true);
    try {
      const response = await api.put(`/shipments/${shipmentId}/verify`, {
        items: Object.entries(receivedQuantities).map(([itemId, qty]) => ({
          itemId,
          quantityReceived: qty
        })),
        discrepancyNote: discrepancyNote || null
      });

      if (response.data.success) {
        // Mark as confirmed to prevent double-click
        setConfirmed(true);
        setShowSuccess(true);

        // Clear product cache so POS sales tab shows updated stock immediately
        const cacheKeys = Object.keys(localStorage).filter(k => k.startsWith('products_cache_'));
        cacheKeys.forEach(k => localStorage.removeItem(k));
        console.log('[SHIPMENT] Cleared product cache after receiving shipment');

        // Wait a moment for user to see success message, then redirect
        setTimeout(() => {
          router.push(`/pos/${storeSlug}/shipments`);
        }, 1500);
      }
    } catch (error: any) {
      console.error('Error confirming shipment:', error);
      const errorMsg = error.response?.data?.message || 'Erreur lors de la confirmation';

      // If already delivered, show success instead of error
      if (errorMsg.includes('already delivered') || errorMsg.includes('deja livre')) {
        setConfirmed(true);
        setShowSuccess(true);
        setTimeout(() => {
          router.push(`/pos/${storeSlug}/shipments`);
        }, 1500);
      } else {
        alert(errorMsg);
        setIsSubmitting(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-orange-400 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">Expedition non trouvee</p>
      </div>
    );
  }

  const totalExpected = shipment.items.reduce((sum, item) => sum + item.quantityExpected, 0);
  const totalReceived = Object.values(receivedQuantities).reduce((sum, qty) => sum + qty, 0);
  const hasDiscrepancy = shipment.items.some(item => receivedQuantities[item.id] !== item.quantityExpected);
  const canConfirm = shipment.status !== 'DELIVERED' && shipment.status !== 'CANCELLED' && !confirmed;

  return (
    <>
    {/* Success Toast */}
    {showSuccess && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Reception Confirmee!</h2>
          <p className="text-gray-600">{totalReceived}/{totalExpected} articles recus</p>
          <p className="text-sm text-gray-500 mt-2">Redirection...</p>
        </div>
      </div>
    )}
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold">{shipment.shipmentNumber}</h1>
            <p className="text-sm text-gray-500">De: {shipment.fromLocation}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            shipment.status === 'DELIVERED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {shipment.status === 'DELIVERED' ? 'Livre' : 'En attente'}
          </span>
        </div>
      </div>

      {/* Scan Input */}
      {canConfirm && (
        <div className="bg-white rounded-lg shadow p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Scanner chaque article:
          </label>
          <div className="flex gap-2">
            <input
              ref={scanInputRef}
              type="text"
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              placeholder="Scanner code-barre..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg"
              autoFocus
            />
            <button
              onClick={handleScan}
              className="px-6 py-3 bg-orange-400 text-white rounded-lg hover:bg-orange-500"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between text-sm mb-2">
          <span>Progression</span>
          <span className="font-medium">{totalReceived}/{totalExpected} articles</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full ${totalReceived === totalExpected ? 'bg-green-500' : 'bg-orange-400'}`}
            style={{ width: `${(totalReceived / totalExpected) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Article</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Demandé</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Expédié</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Recu</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {shipment.items.map((item) => {
              const received = receivedQuantities[item.id] || 0;
              const isComplete = received === item.quantityExpected;
              const isPartial = received > 0 && received < item.quantityExpected;
              const isMissing = received === 0;

              return (
                <tr key={item.id} className={isComplete ? 'bg-green-50' : ''}>
                  <td className="px-4 py-3">
                    <p className="font-mono text-sm">{item.productVariation?.shortCode || item.product.shortCode}</p>
                    <p className="text-xs text-gray-500">{item.product.name}</p>
                    {item.productVariation && (
                      <p className="text-xs text-gray-400">T{item.productVariation.size}/L{item.productVariation.length}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">
                    {item.quantityRequested ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-medium">{item.quantityExpected}</span>
                      {item.quantityRequested != null && item.quantityExpected !== item.quantityRequested && (
                        <span className={`text-xs font-medium ${item.quantityExpected > item.quantityRequested ? 'text-orange-500' : 'text-red-500'}`}>
                          {item.quantityExpected > item.quantityRequested ? `+${item.quantityExpected - item.quantityRequested}` : `${item.quantityExpected - item.quantityRequested}`}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {canConfirm ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setReceivedQuantities(prev => ({
                            ...prev,
                            [item.id]: Math.max(0, (prev[item.id] || 0) - 1)
                          }))}
                          className="w-8 h-8 bg-gray-200 rounded hover:bg-gray-300"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-medium">{received}</span>
                        <button
                          onClick={() => setReceivedQuantities(prev => ({
                            ...prev,
                            [item.id]: Math.min(item.quantityExpected, (prev[item.id] || 0) + 1)
                          }))}
                          className="w-8 h-8 bg-gray-200 rounded hover:bg-gray-300"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <span className="font-medium">{received}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isComplete && (
                      <span className="inline-flex items-center text-green-600">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                        OK
                      </span>
                    )}
                    {isPartial && (
                      <span className="inline-flex items-center text-yellow-600">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></span>
                        Manque {item.quantityExpected - received}
                      </span>
                    )}
                    {isMissing && (
                      <span className="inline-flex items-center text-gray-400">
                        <span className="w-2 h-2 bg-gray-400 rounded-full mr-1"></span>
                        En attente
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Discrepancy Note */}
      {canConfirm && hasDiscrepancy && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <label className="block text-sm font-medium text-yellow-800 mb-2">
            Note sur les ecarts (obligatoire si quantites differentes):
          </label>
          <textarea
            value={discrepancyNote}
            onChange={(e) => setDiscrepancyNote(e.target.value)}
            placeholder="Ex: 2x articles endommages, 1x article manquant..."
            className="w-full px-4 py-2 border border-yellow-300 rounded-lg"
            rows={3}
          />
        </div>
      )}

      {/* Actions */}
      {canConfirm && (
        <div className="flex gap-3">
          <button
            onClick={() => router.back()}
            disabled={isSubmitting}
            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || confirmed}
            className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Confirmation...
              </span>
            ) : `Confirmer Reception ${totalReceived}/${totalExpected}`}
          </button>
        </div>
      )}

      {/* Show if already delivered */}
      {shipment.status === 'DELIVERED' && !showSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-green-800 font-medium">Cette expedition a deja ete confirmee</p>
          <button
            onClick={() => router.push(`/pos/${storeSlug}/shipments`)}
            className="mt-3 px-6 py-2 bg-green-600 text-white rounded-lg"
          >
            Retour aux expeditions
          </button>
        </div>
      )}
    </div>
    </>
  );
}
