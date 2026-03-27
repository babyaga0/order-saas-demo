'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RetourOrdersPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to suivi page by default
    router.push('/orders/retour/suivi');
  }, [router]);

  return null;
}
