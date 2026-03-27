type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SENT_TO_DELIVERY' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  PENDING: { label: 'En Attente', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  CONFIRMED: { label: 'Confirmée', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  SENT_TO_DELIVERY: { label: 'Envoyée', className: 'bg-purple-100 text-purple-800 border-purple-200' },
  SHIPPED: { label: 'Expédiée', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  DELIVERED: { label: 'Livrée', className: 'bg-green-100 text-green-800 border-green-200' },
  CANCELLED: { label: 'Annulée', className: 'bg-red-100 text-red-800 border-red-200' },
  RETURNED: { label: 'Retournée', className: 'bg-gray-100 text-gray-800 border-gray-200' },
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  const config = statusConfig[status] || statusConfig.PENDING;

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${config.className}`}>
      {config.label}
    </span>
  );
}
