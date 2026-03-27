'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import OrdersList from '@/components/OrdersList';
import LoadingSpinner from '@/components/LoadingSpinner';
import api from '@/lib/api';

type User = {
  id: string;
  fullName: string;
  email: string;
};

export default function UserOrdersPage() {
  const { isSidebarCollapsed } = useLayout();
  const params = useParams();
  const userId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userId) {
      loadUser();
    }
  }, [userId]);

  const loadUser = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/users/${userId}`);
      if (response.data.success) {
        setUser(response.data.data);
      } else {
        setError('Utilisateur non trouvé');
      }
    } catch (err: any) {
      console.error('Failed to load user:', err);
      setError(err.response?.data?.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex">
        <Sidebar />
        <main
          className={`flex-1 min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8 transition-all duration-300 ${
            isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'
          }`}
        >
          <div className="max-w-7xl mx-auto flex justify-center items-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex">
        <Sidebar />
        <main
          className={`flex-1 min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8 transition-all duration-300 ${
            isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'
          }`}
        >
          <div className="max-w-7xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <p className="text-red-600 font-medium">{error || 'Utilisateur non trouvé'}</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  console.log('Rendering OrdersList with createdBy:', user.id);

  return (
    <div className="flex">
      <Sidebar />
      <main
        className={`flex-1 min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8 transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'
        }`}
      >
        <div className="max-w-7xl mx-auto">
          <OrdersList
            createdBy={user.id}
            title={`Commandes de ${user.fullName}`}
            description={`Commandes créées par ${user.fullName} (${user.email})`}
            showCreator={false}
            filterOptions={['PENDING', 'CANCELLED']}
          />
        </div>
      </main>
    </div>
  );
}
