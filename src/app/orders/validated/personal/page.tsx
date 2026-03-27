'use client';

import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import OrdersList from '@/components/OrdersList';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState } from 'react';

export default function PersonalValidatedOrdersPage() {
  const { isSidebarCollapsed } = useLayout();
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      setUserId(userData.id);
    }
  }, []);

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
            {userId && (
              <OrdersList
                status="CONFIRMED"
                createdBy={userId}
                title="Mes Commandes Validées"
                description="Mes commandes confirmées prêtes pour la livraison"
                hideStatusDropdown={true}
              />
            )}
          </div>
        </main>
      </div>
    </>
  );
}
