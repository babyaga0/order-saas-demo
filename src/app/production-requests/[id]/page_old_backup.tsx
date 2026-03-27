'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import toast, { Toaster } from 'react-hot-toast';
import api from '@/lib/api';

interface ProductionRequest {
  id: string;
  requestNumber: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  notes: string;
  dueDate: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  estimatedQuantity: number | null;
  actualQuantity: number | null;
  qualityScore: number | null;
  qualityCheckNotes: string | null;
  batchNumber: string | null;
  destinationStore: {
    id: string;
    name: string;
    address: string;
  };
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
  productionStartDate: string | null;
  productionEndDate: string | null;
  completedAt: string | null;
  rejectionReason: string | null;
  shipment: any | null;
}

export default function ProductionRequestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { isSidebarCollapsed } = useLayout();
  const [request, setRequest] = useState<ProductionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);

  // Accept form
  const [acceptData, setAcceptData] = useState({
    estimatedCost: '',
    estimatedQuantity: '',
    batchNumber: '',
    notes: '',
  });

  // Reject form
  const [rejectionReason, setRejectionReason] = useState('');

  // Quality check form
  const [qualityData, setQualityData] = useState({
    qualityScore: '5',
    qualityCheckNotes: '',
    itemResults: [] as any[],
  });

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

    if (params.id) {
      fetchRequest();
    }
  }, [params.id, router]);

  const fetchRequest = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/production-requests/${params.id}`);
      if (response.data.success) {
        setRequest(response.data.data);

        // Initialize quality data items
        const itemResults = response.data.data.items.map((item: any) => ({
          itemId: item.id,
          quantityProduced: item.quantityRequested,
          quantityPassed: item.quantityRequested,
          quantityFailed: 0,
          defectNotes: '',
        }));
        setQualityData({ ...qualityData, itemResults });
      }
    } catch (error) {
      console.error('Error fetching request:', error);
      toast.error('Erreur lors du chargement');
      router.push('/production-requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    try {
      const response = await api.post(`/production-requests/${params.id}/accept`, acceptData);
      if (response.data.success) {
        toast.success('Demande acceptée avec succès');
        setShowAcceptModal(false);
        fetchRequest();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'acceptation');
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Veuillez fournir une raison de refus');
      return;
    }

    try {
      const response = await api.post(`/production-requests/${params.id}/reject`, {
        rejectionReason,
      });
      if (response.data.success) {
        toast.success('Demande refusée');
        setShowRejectModal(false);
        fetchRequest();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors du refus');
    }
  };

  const handleStartProduction = async () => {
    try {
      const response = await api.post(`/production-requests/${params.id}/start-production`);
      if (response.data.success) {
        toast.success('Production démarrée');
        fetchRequest();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  const handleQualityCheck = async () => {
    try {
      const response = await api.post(`/production-requests/${params.id}/quality-check`, qualityData);
      if (response.data.success) {
        toast.success('Contrôle qualité soumis');
        setShowQualityModal(false);
        fetchRequest();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  const handleComplete = async () => {
    const actualCost = prompt('Entrez le coût réel de production (optionnel):');
    try {
      const response = await api.post(`/production-requests/${params.id}/complete`, {
        actualCost: actualCost || null,
      });
      if (response.data.success) {
        toast.success('Demande marquée comme terminée');
        fetchRequest();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  const handleCreateShipment = async () => {
    if (confirm('Créer un envoi pour cette demande de production ?')) {
      try {
        const response = await api.post(`/production-requests/${params.id}/create-shipment`);
        if (response.data.success) {
          toast.success('Envoi créé avec succès');
          fetchRequest();
        }
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Erreur');
      }
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      EN_ATTENTE: 'bg-yellow-100 text-yellow-800',
      ACCEPTE: 'bg-green-100 text-green-800',
      REFUSE: 'bg-red-100 text-red-800',
      EN_PRODUCTION: 'bg-blue-100 text-blue-800',
      CONTROLE_QUALITE: 'bg-purple-100 text-purple-800',
      QUALITE_VALIDEE: 'bg-green-100 text-green-800',
      QUALITE_REFUSEE: 'bg-red-100 text-red-800',
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
      CONTROLE_QUALITE: 'Contrôle Qualité',
      QUALITE_VALIDEE: 'Qualité Validée',
      QUALITE_REFUSEE: 'Qualité Refusée',
      TERMINE: 'Terminé',
      EXPEDIE: 'Expédié',
      ANNULE: 'Annulé',
    };
    return labels[status] || status;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const canAcceptReject = userRole === 'FACTORY_MANAGER' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className={`flex-1 flex items-center justify-center transition-all duration-300 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-2">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!request) return null;

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
              {request.status === 'EN_ATTENTE' && canAcceptReject && (
                <>
                  <button
                    onClick={() => setShowAcceptModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Accepter
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Refuser
                  </button>
                </>
              )}

              {request.status === 'ACCEPTE' && canAcceptReject && (
                <button
                  onClick={handleStartProduction}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Démarrer Production
                </button>
              )}

              {(request.status === 'EN_PRODUCTION' || request.status === 'QUALITE_REFUSEE') && canAcceptReject && (
                <button
                  onClick={() => setShowQualityModal(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Contrôle Qualité
                </button>
              )}

              {request.status === 'QUALITE_VALIDEE' && canAcceptReject && (
                <button
                  onClick={handleComplete}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Marquer Terminé
                </button>
              )}

              {request.status === 'TERMINE' && !request.shipment && canAcceptReject && (
                <button
                  onClick={handleCreateShipment}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  Créer Envoi
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Info Cards */}
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Magasin de Destination</h3>
              {request.destinationStore ? (
                <>
                  <p className="text-xl font-bold text-gray-900">{request.destinationStore.name}</p>
                  <p className="text-sm text-gray-600 mt-1">{request.destinationStore.address}</p>
                </>
              ) : (
                <p className="text-sm text-gray-500 italic">Non défini</p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Quantité Estimée</h3>
              <p className="text-xl font-bold text-gray-900">{request.estimatedQuantity || 'N/A'} unités</p>
              {request.actualQuantity && (
                <p className="text-sm text-gray-600 mt-1">Produit: {request.actualQuantity}</p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Coût</h3>
              <p className="text-xl font-bold text-gray-900">
                {request.estimatedCost ? `${request.estimatedCost} DH` : 'N/A'}
              </p>
              {request.actualCost && (
                <p className="text-sm text-gray-600 mt-1">Réel: {request.actualCost} DH</p>
              )}
            </div>
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
              {request.reviewedBy && (
                <>
                  <div>
                    <span className="text-gray-500">Revu par:</span>
                    <p className="font-medium">{request.reviewedBy.fullName}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Date de révision:</span>
                    <p className="font-medium">{formatDate(request.reviewedAt)}</p>
                  </div>
                </>
              )}
              {request.dueDate && (
                <div>
                  <span className="text-gray-500">Échéance:</span>
                  <p className="font-medium">{formatDate(request.dueDate)}</p>
                </div>
              )}
              {request.batchNumber && (
                <div>
                  <span className="text-gray-500">Numéro de Lot:</span>
                  <p className="font-medium">{request.batchNumber}</p>
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

          {/* Items */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Articles ({request.items.length})</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Variation</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qté Demandée</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qté Produite</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validée</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Refusée</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {request.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{item.product.name}</div>
                        <div className="text-sm text-gray-500">{item.product.shortCode}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.productVariation ? `${item.productVariation.size}/${item.productVariation.length}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantityRequested}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantityProduced || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{item.quantityPassed || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{item.quantityFailed || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Accept Modal */}
        {showAcceptModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold mb-4">Accepter la Demande</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Coût Estimé (DH)</label>
                  <input
                    type="number"
                    value={acceptData.estimatedCost}
                    onChange={(e) => setAcceptData({ ...acceptData, estimatedCost: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Quantité Estimée</label>
                  <input
                    type="number"
                    value={acceptData.estimatedQuantity}
                    onChange={(e) => setAcceptData({ ...acceptData, estimatedQuantity: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Numéro de Lot (optionnel)</label>
                  <input
                    type="text"
                    value={acceptData.batchNumber}
                    onChange={(e) => setAcceptData({ ...acceptData, batchNumber: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Auto-généré si vide"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    value={acceptData.notes}
                    onChange={(e) => setAcceptData({ ...acceptData, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAcceptModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAccept}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Accepter
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold mb-4">Refuser la Demande</h2>
              <div>
                <label className="block text-sm font-medium mb-1">Raison du Refus <span className="text-red-500">*</span></label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={4}
                  required
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleReject}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Refuser
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quality Check Modal */}
        {showQualityModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
              <h2 className="text-xl font-bold mb-4">Contrôle Qualité</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Note de Qualité (1-5)</label>
                  <select
                    value={qualityData.qualityScore}
                    onChange={(e) => setQualityData({ ...qualityData, qualityScore: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="5">5 - Excellent</option>
                    <option value="4">4 - Très Bon</option>
                    <option value="3">3 - Bon</option>
                    <option value="2">2 - Acceptable</option>
                    <option value="1">1 - Médiocre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Notes de Contrôle</label>
                  <textarea
                    value={qualityData.qualityCheckNotes}
                    onChange={(e) => setQualityData({ ...qualityData, qualityCheckNotes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={3}
                  />
                </div>

                <div>
                  <h3 className="font-medium mb-2">Résultats par Article</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {qualityData.itemResults.map((itemResult, index) => {
                      const item = request.items.find((i) => i.id === itemResult.itemId);
                      return (
                        <div key={itemResult.itemId} className="border rounded p-3">
                          <p className="font-medium text-sm mb-2">{item?.product.name}</p>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-xs text-gray-500">Produit</label>
                              <input
                                type="number"
                                value={itemResult.quantityProduced}
                                onChange={(e) => {
                                  const newResults = [...qualityData.itemResults];
                                  newResults[index].quantityProduced = parseInt(e.target.value) || 0;
                                  setQualityData({ ...qualityData, itemResults: newResults });
                                }}
                                className="w-full px-2 py-1 border rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500">Validé</label>
                              <input
                                type="number"
                                value={itemResult.quantityPassed}
                                onChange={(e) => {
                                  const newResults = [...qualityData.itemResults];
                                  newResults[index].quantityPassed = parseInt(e.target.value) || 0;
                                  setQualityData({ ...qualityData, itemResults: newResults });
                                }}
                                className="w-full px-2 py-1 border rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500">Refusé</label>
                              <input
                                type="number"
                                value={itemResult.quantityFailed}
                                onChange={(e) => {
                                  const newResults = [...qualityData.itemResults];
                                  newResults[index].quantityFailed = parseInt(e.target.value) || 0;
                                  setQualityData({ ...qualityData, itemResults: newResults });
                                }}
                                className="w-full px-2 py-1 border rounded text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowQualityModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleQualityCheck}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Soumettre
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
