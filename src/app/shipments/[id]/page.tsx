'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import toast, { Toaster } from 'react-hot-toast';
import api from '@/lib/api';
import { generateShipmentReceipt } from '@/utils/shipmentReceiptGenerator';

interface Shipment {
  id: string;
  shipmentNumber: string;
  status: 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  fromLocation: string;
  notes: string | null;
  discrepancyNote: string | null;
  toStore: {
    id: string;
    name: string;
    address: string | null;
  };
  productionRequest: {
    id: string;
    requestNumber: string;
    title: string;
  } | null;
  items: {
    id: string;
    productId: number;
    productVariationId: number | null;
    quantityRequested: number | null;
    quantityExpected: number;
    quantityReceived: number | null;
    notes: string | null;
    product: {
      id: number;
      name: string;
      shortCode: string;
      imageUrl: string | null;
      price: number;
    };
    productVariation: {
      id: number;
      size: string;
      length: string;
      shortCode: string;
    } | null;
  }[];
  createdAt: string;
  confirmedAt: string | null;
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  confirmedBy: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export default function ShipmentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { isSidebarCollapsed } = useLayout();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    fetchShipment();
  }, [params.id]);

  const fetchShipment = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/shipments/${params.id}`);
      if (response.data.success) {
        setShipment(response.data.data);
      } else {
        toast.error('Erreur lors du chargement de l\'expédition');
      }
    } catch (error: any) {
      console.error('Error fetching shipment:', error);
      toast.error(error.response?.data?.message || 'Erreur lors du chargement');
      if (error.response?.status === 404) {
        setTimeout(() => router.push('/shipments'), 2000);
      }
    } finally {
      setLoading(false);
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

  const handleDownloadPDF = async () => {
    if (!shipment) return;

    try {
      await generateShipmentReceipt(shipment);
      toast.success('BON DE LIVRAISON téléchargé');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erreur lors de la génération du PDF');
    }
  };

  const getTotalExpected = () => {
    return shipment?.items.reduce((sum, item) => sum + item.quantityExpected, 0) || 0;
  };

  const getTotalReceived = () => {
    return shipment?.items.reduce((sum, item) => sum + (item.quantityReceived || 0), 0) || 0;
  };

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
            <p className="mt-4 text-gray-600">Chargement de l'expédition...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div
          className={`flex-1 flex items-center justify-center transition-all duration-300 ${
            isSidebarCollapsed ? 'ml-20' : 'ml-64'
          }`}
        >
          <div className="text-center">
            <p className="text-gray-600">Expédition introuvable</p>
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
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/shipments')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">{shipment.shipmentNumber}</h1>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                      shipment.status
                    )}`}
                  >
                    {getStatusLabel(shipment.status)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">Détails de l'expédition</p>
              </div>
            </div>
            <button
              onClick={handleDownloadPDF}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span>BON DE LIVRAISON</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Destination */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Destination</h3>
                <p className="font-semibold text-gray-900">{shipment.toStore.name}</p>
                {shipment.toStore.address && (
                  <p className="text-sm text-gray-600 mt-1">{shipment.toStore.address}</p>
                )}
              </div>

              {/* Quantity */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Quantité</h3>
                <p className="text-2xl font-bold text-gray-900">{getTotalExpected()}</p>
                <p className="text-sm text-gray-600 mt-1">{shipment.items.length} articles différents</p>
              </div>

              {/* Date */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Créée le</h3>
                <p className="font-semibold text-gray-900">
                  {new Date(shipment.createdAt).toLocaleDateString('fr-FR')}
                </p>
                {shipment.createdBy && (
                  <p className="text-sm text-gray-600 mt-1">
                    Par {shipment?.createdBy?.fullName}
                  </p>
                )}
              </div>
            </div>

            {/* Confirmation Info */}
            {shipment.status === 'DELIVERED' && shipment.confirmedBy && shipment.confirmedAt && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-5">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <h3 className="font-medium text-green-900">Expédition confirmée</h3>
                    <p className="text-sm text-green-800 mt-1">
                      Confirmée le {new Date(shipment.confirmedAt).toLocaleString('fr-FR')} par{' '}
                      {shipment.confirmedBy.fullName}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Discrepancy Note */}
            {shipment.discrepancyNote && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div>
                    <h3 className="font-medium text-yellow-900">Note d'écart</h3>
                    <p className="text-sm text-yellow-800 mt-1">{shipment.discrepancyNote}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Production Request Link */}
            {shipment.productionRequest && (
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Demande de production liée</h3>
                <button
                  onClick={() =>
                    router.push(`/production-requests/${shipment.productionRequest?.id}`)
                  }
                  className="text-purple-600 hover:text-purple-700 font-medium flex items-center gap-2"
                >
                  {shipment.productionRequest.requestNumber} - {shipment.productionRequest.title}
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </button>
              </div>
            )}

            {/* Items Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Articles</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Produit
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Variation
                      </th>
                      {shipment.items.some(i => i.quantityRequested != null) && (
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Demandé
                        </th>
                      )}
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Expédié
                      </th>
                      {shipment.status === 'DELIVERED' && (
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Reçu
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {shipment.items.map((item) => {
                      const hasRequestedData = item.quantityRequested != null;
                      const shippedVsRequested = hasRequestedData ? item.quantityExpected - item.quantityRequested! : 0;
                      const receivedVsExpected = shipment.status === 'DELIVERED' && item.quantityReceived !== null
                        ? item.quantityReceived - item.quantityExpected : 0;

                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {item.product.imageUrl && (
                                <img
                                  src={item.product.imageUrl}
                                  alt={item.product.name}
                                  className="w-10 h-10 rounded object-cover"
                                />
                              )}
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {item.product.name}
                                </div>
                                <div className="text-xs text-gray-500">{item.product.shortCode}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.productVariation
                              ? `T${item.productVariation.size}/L${item.productVariation.length}`
                              : '-'}
                            {item.productVariation?.shortCode && (
                              <div className="text-xs text-gray-500">{item.productVariation.shortCode}</div>
                            )}
                          </td>
                          {shipment.items.some(i => i.quantityRequested != null) && (
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {hasRequestedData ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                                  {item.quantityRequested}
                                </span>
                              ) : <span className="text-gray-400">-</span>}
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                {item.quantityExpected}
                              </span>
                              {hasRequestedData && shippedVsRequested !== 0 && (
                                <span className={`text-xs font-medium ${shippedVsRequested > 0 ? 'text-orange-500' : 'text-red-500'}`}>
                                  {shippedVsRequested > 0 ? `+${shippedVsRequested}` : shippedVsRequested}
                                </span>
                              )}
                            </div>
                          </td>
                          {shipment.status === 'DELIVERED' && (
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                  receivedVsExpected !== 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                                }`}>
                                  {item.quantityReceived ?? '-'}
                                </span>
                                {receivedVsExpected !== 0 && (
                                  <span className={`text-xs font-medium ${receivedVsExpected > 0 ? 'text-orange-500' : 'text-red-500'}`}>
                                    {receivedVsExpected > 0 ? `+${receivedVsExpected}` : receivedVsExpected}
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={shipment.items.some(i => i.quantityRequested != null) ? 3 : 2} className="px-6 py-4 text-sm font-medium text-gray-900">
                        Total
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          {getTotalExpected()}
                        </span>
                      </td>
                      {shipment.status === 'DELIVERED' && (
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            getTotalReceived() !== getTotalExpected()
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {getTotalReceived()}
                          </span>
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Notes */}
            {shipment.notes && (
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
                <p className="text-sm text-gray-900">{shipment.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
