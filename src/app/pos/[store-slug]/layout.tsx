'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useThermalPrinter } from '@/hooks/useThermalPrinter';
import { POSProvider } from '@/contexts/POSContext';
import api from '@/lib/api';

type User = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  storeId?: string;
  store?: {
    id: string;
    name: string;
  };
};

export default function POSLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const storeSlug = params['store-slug'] as string;
  const [user, setUser] = useState<User | null>(null);
  const [storeName, setStoreName] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<{ pendingSalesCount: number; isSyncing: boolean } | null>(null);
  const [showPrinterMenu, setShowPrinterMenu] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const printer = useThermalPrinter();

  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.isElectron;

  useEffect(() => {
    // Check user authentication
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    // Only STORE_CASHIER and ADMIN can access POS
    if (!['STORE_CASHIER', 'ADMIN', 'SUPER_ADMIN'].includes(parsedUser.role)) {
      router.push('/dashboard');
      return;
    }

    // Set store name from user data or derive from slug
    const name = parsedUser.store?.name ||
      storeSlug
        .split('-')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    setStoreName(name);

    // Check online status
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [router, storeSlug]);

  // Check sync status in Electron (every 10 seconds)
  useEffect(() => {
    if (!isElectron) return;

    let isMounted = true; // Track if component is still mounted

    const checkSync = async () => {
      if (!isMounted) return; // Skip if component unmounted

      try {
        const status = await (window as any).electronAPI?.getSyncStatus();
        if (status && isMounted) {
          setSyncStatus({
            pendingSalesCount: status.pendingSalesCount || 0,
            isSyncing: status.isSyncing || false,
          });
        }
      } catch (error) {
        if (isMounted) {
          console.error('[SYNC] Failed to get sync status:', error);
        }
      }
    };

    // Check immediately
    checkSync();

    // Check every 10 seconds
    const interval = setInterval(checkSync, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isElectron]);

  // Warm the server on auth so the first scan/stock load is fast (Hobby Plan cold start)
  useEffect(() => {
    if (!user) return;
    api.get('/stock/all-stores').catch(() => {});
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const navItems = [
    { href: `/pos/${storeSlug}`, label: 'Vente', icon: '🛒' },
    { href: `/pos/${storeSlug}/stock`, label: 'Stock', icon: '📦' },
    { href: `/pos/${storeSlug}/shipments`, label: 'Expeditions', icon: '🚚' },
    { href: `/pos/${storeSlug}/returns`, label: 'Retours', icon: '↩️' },
    { href: `/pos/${storeSlug}/summary`, label: 'Resume', icon: '📊' },
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400"></div>
      </div>
    );
  }

  return (
    <POSProvider>
      <div className="min-h-screen bg-gray-100">
        {/* Top Header - Fixed */}
        <header className="fixed top-0 left-0 right-0 z-40 bg-white shadow-sm border-b border-gray-200 px-4 py-2 flex items-center justify-between">
          {/* Left: Logo and store name */}
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <Image
                src="/logo-2.webp"
                alt="Logo"
                fill
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">{storeName}</h1>
              <p className="text-xs text-gray-500">ATLAS DENIM</p>
            </div>
          </div>

          {/* Center: Online/Offline indicator */}
          {!isOnline && (
            <div className="flex items-center gap-2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
              HORS LIGNE
            </div>
          )}

          {/* Right: Printer, User and logout */}
          <div className="flex items-center gap-2">
            {/* Printer Status with Selection */}
            <div className="relative">
              <button
                onClick={async () => {
                  if (isElectron) {
                    try {
                      console.log('[PRINTER] Fetching printer list...');
                      const printers = await (window as any).electronAPI?.listPrinters();
                      console.log('[PRINTER] Available printers:', printers);

                      if (printers && printers.length > 0) {
                        setAvailablePrinters(printers);
                        setShowPrinterMenu(!showPrinterMenu);
                      } else {
                        alert('Aucune imprimante trouvée. Vérifiez que vos imprimantes sont installées.');
                      }
                    } catch (error) {
                      console.error('[PRINTER] Error listing printers:', error);
                      alert(`Erreur: ${error}`);
                    }
                  } else {
                    // Browser mode - test print
                    if (confirm('Imprimer un ticket de test? (Assurez-vous que l\'imprimante est par defaut dans Windows)')) {
                      printer.printTest();
                    }
                  }
                }}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  printer.state.isConnected
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                }`}
                title={
                  printer.state.isConnected
                    ? `Imprimante: ${printer.state.printerName || 'Connectée'} - Cliquer pour changer`
                    : 'Cliquer pour sélectionner une imprimante'
                }
              >
                <span>🖨️</span>
                <span className={`w-2 h-2 rounded-full ${printer.state.isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></span>
                <span className="hidden sm:inline">
                  {printer.state.isConnected ? printer.state.printerName || 'OK' : 'Sélectionner'}
                </span>
              </button>

              {/* Printer selection dropdown */}
              {showPrinterMenu && availablePrinters.length > 0 && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]">
                  <div className="p-2">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Sélectionner imprimante:</p>
                    {availablePrinters.map((printerName) => (
                      <button
                        key={printerName}
                        onClick={async () => {
                          const result = await (window as any).electronAPI?.selectPrinter(printerName);
                          if (result?.success) {
                            alert(`Imprimante sélectionnée: ${printerName}`);
                            setShowPrinterMenu(false);
                            // Refresh printer status
                            printer.connectPrinter();
                          } else {
                            alert(`Erreur: ${result?.error || 'Échec de sélection'}`);
                          }
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 rounded transition-colors"
                      >
                        {printerName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user.fullName}</p>
              <p className="text-xs text-gray-500">Caissier</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
              title="Deconnexion"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* Main Content - with padding for fixed header and nav */}
        <main className="pt-14 pb-16 min-h-screen overflow-auto">
          {children}
        </main>

        {/* Bottom Navigation Bar - Fixed */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-orange-400 shadow-lg">
          <div className="flex justify-around py-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center px-4 py-2 rounded-xl transition-all ${
                    isActive
                      ? 'bg-orange-400 text-white shadow-md scale-105'
                      : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className={`text-xs mt-0.5 font-medium ${isActive ? 'text-white' : ''}`}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </POSProvider>
  );
}
