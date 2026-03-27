'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';

const ALLOWED_ROLES = ['ADMIN'];

type Coupon = {
  id: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  minPurchase: number | null;
  maxDiscount: number | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
};

type CouponForm = {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: string;
  minPurchase: string;
  maxDiscount: string;
  maxUses: string;
  expiresAt: string;
  isActive: boolean;
};

const initialForm: CouponForm = {
  code: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  minPurchase: '',
  maxDiscount: '',
  maxUses: '',
  expiresAt: '',
  isActive: true,
};

export default function CouponsPage() {
  const router = useRouter();
  const { isSidebarCollapsed } = useLayout();
  const [userRole, setUserRole] = useState<string>('');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [form, setForm] = useState<CouponForm>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Check authentication and set user role
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      if (!ALLOWED_ROLES.includes(userData.role)) {
        router.push('/dashboard');
        return;
      }
      setUserRole(userData.role);
    }
  }, [router]);

  // Fetch coupons
  const fetchCoupons = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/coupons?includeInactive=${showInactive}`);
      if (response.data.success) {
        setCoupons(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching coupons:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load data when userRole is set or filter changes
  useEffect(() => {
    if (userRole) {
      fetchCoupons();
    }
  }, [userRole, showInactive]);

  // Open modal for creating
  const handleCreate = () => {
    setForm(initialForm);
    setEditingCoupon(null);
    setError('');
    setShowModal(true);
  };

  // Open modal for editing
  const handleEdit = (coupon: Coupon) => {
    setForm({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue.toString(),
      minPurchase: coupon.minPurchase?.toString() || '',
      maxDiscount: coupon.maxDiscount?.toString() || '',
      maxUses: coupon.maxUses?.toString() || '',
      expiresAt: coupon.expiresAt ? coupon.expiresAt.split('T')[0] : '',
      isActive: coupon.isActive,
    });
    setEditingCoupon(coupon);
    setError('');
    setShowModal(true);
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const payload = {
        code: form.code.toUpperCase(),
        discountType: form.discountType,
        discountValue: parseFloat(form.discountValue),
        minPurchase: form.minPurchase ? parseFloat(form.minPurchase) : null,
        maxDiscount: form.maxDiscount ? parseFloat(form.maxDiscount) : null,
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        isActive: form.isActive,
      };

      if (editingCoupon) {
        await api.put(`/coupons/${editingCoupon.id}`, payload);
      } else {
        await api.post('/coupons', payload);
      }

      setShowModal(false);
      fetchCoupons();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete coupon
  const handleDelete = async (coupon: Coupon) => {
    if (!confirm(`Supprimer le coupon "${coupon.code}" ?`)) return;

    try {
      await api.delete(`/coupons/${coupon.id}`);
      fetchCoupons();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  // Toggle active status
  const handleToggleActive = async (coupon: Coupon) => {
    try {
      await api.put(`/coupons/${coupon.id}`, { isActive: !coupon.isActive });
      fetchCoupons();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur');
    }
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  // Don't render until role is verified
  if (!userRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-orange-400 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar />
      <main
        className={`flex-1 min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8 transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'
        }`}
      >
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">Codes Promo</h1>
              <p className="text-gray-600">Gerez vos coupons de reduction</p>
            </div>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nouveau Coupon
            </button>
          </div>

      {/* Filter */}
      <div className="mb-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-gray-300"
          />
          Afficher les coupons inactifs
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-orange-400 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : coupons.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-4xl mb-2">🎟️</p>
            <p>Aucun coupon</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reduction</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min. Achat</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisation</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expire</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {coupons.map((coupon) => (
                  <tr key={coupon.id} className={!coupon.isActive ? 'bg-gray-50 opacity-60' : ''}>
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-orange-600">{coupon.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      {coupon.discountType === 'PERCENTAGE' ? (
                        <span>{coupon.discountValue}%</span>
                      ) : (
                        <span>{coupon.discountValue.toFixed(2)} DH</span>
                      )}
                      {coupon.maxDiscount && coupon.discountType === 'PERCENTAGE' && (
                        <span className="text-xs text-gray-500 block">
                          (max {coupon.maxDiscount} DH)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {coupon.minPurchase ? `${coupon.minPurchase} DH` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">
                        {coupon.usedCount}
                        {coupon.maxUses && <span className="text-gray-500"> / {coupon.maxUses}</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {formatDate(coupon.expiresAt)}
                      {coupon.expiresAt && new Date(coupon.expiresAt) < new Date() && (
                        <span className="text-red-500 text-xs block">Expire</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(coupon)}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          coupon.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {coupon.isActive ? 'Actif' : 'Inactif'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(coupon)}
                          className="p-1 text-gray-500 hover:text-orange-600"
                          title="Modifier"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(coupon)}
                          className="p-1 text-gray-500 hover:text-red-600"
                          title="Supprimer"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">
                {editingCoupon ? 'Modifier le coupon' : 'Nouveau coupon'}
              </h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {/* Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code promo *
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg uppercase font-mono"
                    placeholder="EX: PROMO20"
                    required
                  />
                </div>

                {/* Discount Type & Value */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type *
                    </label>
                    <select
                      value={form.discountType}
                      onChange={(e) => setForm({ ...form, discountType: e.target.value as 'PERCENTAGE' | 'FIXED' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="PERCENTAGE">Pourcentage (%)</option>
                      <option value="FIXED">Montant fixe (DH)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Valeur *
                    </label>
                    <input
                      type="number"
                      value={form.discountValue}
                      onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder={form.discountType === 'PERCENTAGE' ? '10' : '50'}
                      min="0"
                      step={form.discountType === 'PERCENTAGE' ? '1' : '0.01'}
                      required
                    />
                  </div>
                </div>

                {/* Min Purchase & Max Discount */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Achat minimum (DH)
                    </label>
                    <input
                      type="number"
                      value={form.minPurchase}
                      onChange={(e) => setForm({ ...form, minPurchase: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="0"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reduction max (DH)
                    </label>
                    <input
                      type="number"
                      value={form.maxDiscount}
                      onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Illimite"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                {/* Max Uses & Expires */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Utilisations max
                    </label>
                    <input
                      type="number"
                      value={form.maxUses}
                      onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Illimite"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date d'expiration
                    </label>
                    <input
                      type="date"
                      value={form.expiresAt}
                      onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                {/* Active */}
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Actif</span>
                  </label>
                </div>
              </div>

              <div className="p-6 border-t flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:bg-gray-300"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </div>
      </main>
    </div>
  );
}
