'use client';

import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import OrdersList from '@/components/OrdersList';
import { Toaster } from 'react-hot-toast';

export default function SentOrdersPage() {
  const { isSidebarCollapsed } = useLayout();

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
              title="Commandes Envoyées"
              description="Commandes envoyées à Cathedis Delivery"
              hideStatusDropdown={true}
              sentToDelivery={true}
              filterOptions={['SENT_TO_DELIVERY', 'SHIPPED', 'DELIVERED', 'CANCELLED']}
              showStaffFilter={true}
            />
          </div>
        </main>
      </div>
    </>
  );
}
