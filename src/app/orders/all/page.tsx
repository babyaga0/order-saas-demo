'use client';

import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import OrdersList from '@/components/OrdersList';

export default function AllOrdersPage() {
  const { isSidebarCollapsed } = useLayout();

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
            showCreator={true}
            title="Toutes les Commandes"
            description="Voir toutes les commandes de toutes les sources"
            filterOptions={['PENDING', 'CANCELLED']}
          />
        </div>
      </main>
    </div>
  );
}
