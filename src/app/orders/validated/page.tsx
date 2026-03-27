'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import OrdersList from '@/components/OrdersList';
import { Toaster } from 'react-hot-toast';

const ALLOWED_ROLES = ['ADMIN', 'STAFF'];

export default function ValidatedOrdersPage() {
  const router = useRouter();
  const { isSidebarCollapsed } = useLayout();
  const [userRole, setUserRole] = useState<string>('');
  const [canSeeAllOrders, setCanSeeAllOrders] = useState(false);

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
      const hasPermission = userData.canSeeAllOrders || userData.role === 'ADMIN' || userData.role === 'SUPER_ADMIN';
      setCanSeeAllOrders(hasPermission);
    }
  }, [router]);

  // Don't render until role is verified
  if (!userRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-orange-400 border-t-transparent rounded-full"></div>
      </div>
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
            <OrdersList
              status="CONFIRMED"
              title="Commandes Validées"
              description="Commandes confirmées prêtes pour la livraison"
              hideStatusDropdown={true}
              showStaffFilter={canSeeAllOrders}
            />
          </div>
        </main>
      </div>
    </>
  );
}
