'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Vérifier si l'utilisateur est déjà connecté
    const token = localStorage.getItem('token');
    if (token) {
      // Rediriger vers le tableau de bord
      router.push('/dashboard');
    } else {
      // Rediriger vers la page de connexion
      router.push('/login');
    }
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-br from-primary-50 via-white to-primary-100">
      <div className="text-center">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="relative w-32 h-24">
            <Image
              src="/logo-2.webp"
              alt="Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Loading Animation */}
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-4"></div>
        <p className="text-gray-600 text-lg">Chargement...</p>
      </div>
    </main>
  );
}
