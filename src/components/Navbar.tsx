'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useState, useEffect } from 'react';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo and Navigation */}
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-sm">AD</span>
              </div>
              <span className="text-xl font-bold text-gray-800">Atlas Denim</span>
            </div>

            {/* Navigation Links */}
            <nav className="hidden md:flex space-x-6">
              <a
                href="/dashboard"
                className="text-gray-700 hover:text-primary-500 font-medium transition-colors"
              >
                Tableau de Bord
              </a>
              <a
                href="/orders"
                className="text-gray-700 hover:text-primary-500 font-medium transition-colors"
              >
                Commandes
              </a>
              {user?.role === 'ADMIN' && (
                <>
                  <a
                    href="/users"
                    className="text-gray-700 hover:text-primary-500 font-medium transition-colors"
                  >
                    Utilisateurs
                  </a>
                  <a
                    href="/settings"
                    className="text-gray-700 hover:text-primary-500 font-medium transition-colors"
                  >
                    Paramètres
                  </a>
                </>
              )}
            </nav>
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {user && (
              <>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-gray-800">
                    {user.fullName}
                  </p>
                  <p className="text-xs text-gray-500">{user.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
                >
                  Déconnexion
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
