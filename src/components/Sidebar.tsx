'use client';

  import { useRouter, usePathname } from 'next/navigation';
  import Image from 'next/image';
  import { useState, useEffect } from 'react';
  import { useLayout } from '@/contexts/LayoutContext';
  import api from '@/lib/api';
  import NotificationBell from '@/components/NotificationBell';

  // Icon component for order sources
  const OrderIcon = ({ src, alt, className = "" }: { src: string; alt: string; className?: string }) => (
    <div className={`relative w-5 h-5 ${className}`}>
      <Image src={src} alt={alt} fill className="object-contain" />
    </div>
  );

  type StaffUser = {
    id: string;
    fullName: string;
  };

  type Store = {
    id: string;
    name: string;
    slug?: string;
  };

  // Cache configuration
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  const CACHE_KEYS = {
    STAFF_USERS: 'sidebar_staff_users',
    STORES: 'sidebar_stores',
  };

  // Cache helper functions
  const getCachedData = <T,>(key: string): T | null => {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const isExpired = Date.now() - timestamp > CACHE_TTL;

      if (isExpired) {
        localStorage.removeItem(key);
        return null;
      }

      return data as T;
    } catch {
      return null;
    }
  };

  const setCachedData = <T,>(key: string, data: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch {
      // localStorage might be full or unavailable
    }
  };

  const clearSidebarCache = (): void => {
    try {
      localStorage.removeItem(CACHE_KEYS.STAFF_USERS);
      localStorage.removeItem(CACHE_KEYS.STORES);
    } catch {
      // Ignore errors
    }
  };

  // Read user from localStorage synchronously to prevent sidebar flash
  const getInitialUser = () => {
    if (typeof window === 'undefined') return null;
    try {
      const userData = localStorage.getItem('user');
      return userData ? JSON.parse(userData) : null;
    } catch {
      return null;
    }
  };

  export default function Sidebar() {
    const [user, setUser] = useState<any>(getInitialUser);
    const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const { isSidebarCollapsed, toggleSidebar } = useLayout();
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [ordersExpanded, setOrdersExpanded] = useState(true);
    const [deliveryExpanded, setDeliveryExpanded] = useState(true);
    const [retourExpanded, setRetourExpanded] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const loadStaffUsers = async () => {
      try {
        // Check cache first
        const cachedStaff = getCachedData<StaffUser[]>(CACHE_KEYS.STAFF_USERS);
        if (cachedStaff) {
          setStaffUsers(cachedStaff);
          return;
        }

        // Fetch with server-side filter (only STAFF + isActive)
        const response = await api.get('/users?role=STAFF&isActive=true');
        if (response.data.success) {
          const usersData = response.data.data;
          // Handle paginated response - extract users array
          const users = usersData.users || usersData;
          if (Array.isArray(users)) {
            const staff = users.map((u: any) => ({ id: u.id, fullName: u.fullName }));
            setStaffUsers(staff);
            // Cache the result
            setCachedData(CACHE_KEYS.STAFF_USERS, staff);
          }
        }
      } catch (error) {
        console.error('Failed to load staff users:', error);
      }
    };

    const loadStores = async () => {
      try {
        // Check cache first
        const cachedStores = getCachedData<Store[]>(CACHE_KEYS.STORES);
        if (cachedStores) {
          setStores(cachedStores);
          return;
        }

        const response = await api.get('/stores');
        if (response.data.success) {
          const storesData = response.data.data;
          // Ensure we have an array
          const storesList = Array.isArray(storesData) ? storesData : [];
          setStores(storesList);
          // Cache the result
          setCachedData(CACHE_KEYS.STORES, storesList);
        }
      } catch (error) {
        console.error('Failed to load stores:', error);
      }
    };

    useEffect(() => {
      // STORE_CASHIER should use POS interface - redirect them
      if (user?.role === 'STORE_CASHIER') {
        const storeName = user.store?.name;
        if (storeName) {
          const storeSlug = storeName.toLowerCase().replace(/\s+/g, '-');
          router.push(`/pos/${storeSlug}`);
        } else {
          router.push('/pos/ain-sebaa');
        }
        return;
      }

      // Load stores for admins
      if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
        loadStores();
      }

      // Load staff users for roles that need them (for orders submenu)
      if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || (user?.role === 'STAFF' && user?.canSeeAllOrders)) {
        loadStaffUsers();
      }
    }, [user, router]);

    const handleLogout = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Clear sidebar cache on logout
      clearSidebarCache();
      router.push('/login');
    };

    const handleNavigate = (path: string) => {
      setIsMobileOpen(false);
      router.push(path);
    };

    const isActive = (path: string) => {
      return pathname === path || pathname?.startsWith(path + '/');
    };

    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    const isStaff = user?.role === 'STAFF';
    const isStoreCashier = user?.role === 'STORE_CASHIER';
    const isFactoryManager = user?.role === 'FACTORY_MANAGER';
    const isProduction = user?.role === 'PRODUCTION';
    const canSeeAllOrders = user?.canSeeAllOrders || false;

    const orderSubmenuItems = [
      // ADMIN or STAFF with canSeeAllOrders see "Toutes" and all staff members
      ...((isAdmin || canSeeAllOrders) ? [{ name: 'Toutes', path: '/orders', icon: '📋' }] : []),
      // Dynamically load staff users for ADMIN or STAFF with canSeeAllOrders
      ...((isAdmin || canSeeAllOrders) ? staffUsers.map(staffUser => ({
        name: staffUser.fullName,
        path: `/orders/user/${staffUser.id}`,
        icon: '👤'
      })) : []),
      // Regular STAFF see only "Mes Commandes"
      ...(isStaff && !canSeeAllOrders ? [
        { name: 'Mes Commandes', path: '/orders', icon: '👤' }
      ] : []),
    ];


    return (
      <>
        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="md:hidden fixed top-4 left-4 z-50 p-2 bg-orange-400 text-white rounded-lg shadow-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Overlay for mobile */}
        {isMobileOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          style={{ width: isSidebarCollapsed ? '80px' : '256px' }}
          className={`fixed left-0 top-0 h-full bg-white border-r border-gray-200 shadow-lg transition-all duration-300 z-50 ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0`}
        >
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            {!isSidebarCollapsed && (
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-black text-sm">AD</span>
                </div>
                <span className="text-lg font-bold text-gray-800">Atlas Denim</span>
              </div>
            )}
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors hidden md:block"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isSidebarCollapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                )}
              </svg>
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-3">
              {/* SUPER_ADMIN - Dev Only (System & Users) */}
              {isSuperAdmin && (
                <>
                  {/* System Panel */}
                  <li>
                    <button
                      onClick={() => handleNavigate('/system')}
                      className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-all ${
                        isActive('/system')
                          ? 'bg-orange-400 text-white shadow-md'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      title={isSidebarCollapsed ? 'Panneau Système' : ''}
                    >
                      <span className={isActive('/system') ? 'text-white' : 'text-gray-600'}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                      </span>
                      {!isSidebarCollapsed && (
                        <span className="font-medium">Panneau Système</span>
                      )}
                    </button>
                  </li>

                  {/* Users */}
                  <li>
                    <button
                      onClick={() => handleNavigate('/users')}
                      className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-all ${
                        isActive('/users')
                          ? 'bg-orange-400 text-white shadow-md'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      title={isSidebarCollapsed ? 'Utilisateurs' : ''}
                    >
                      <span className={isActive('/users') ? 'text-white' : 'text-gray-600'}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </span>
                      {!isSidebarCollapsed && (
                        <span className="font-medium">Utilisateurs</span>
                      )}
                    </button>
                  </li>

                </>
              )}

              {/* ADMIN Menu Items (not SUPER_ADMIN) */}
              {isAdmin && !isSuperAdmin && (
                <>
                  {/* Dashboard */}
                  <li>
                    <button
                      onClick={() => handleNavigate('/dashboard')}
                      className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-all ${
                        isActive('/dashboard')
                          ? 'bg-orange-400 text-white shadow-md'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      title={isSidebarCollapsed ? 'Tableau de Bord' : ''}
                    >
                      <span className={isActive('/dashboard') ? 'text-white' : 'text-gray-600'}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      </span>
                      {!isSidebarCollapsed && (
                        <span className="font-medium">Tableau de Bord</span>
                      )}
                    </button>
                  </li>

                </>
              )}

              {/* Orders with Submenu - Not for SUPER_ADMIN, FACTORY_MANAGER, or STORE_CASHIER */}
              {!isSuperAdmin && !isFactoryManager && !isStoreCashier && (
              <li>
                <button
                  onClick={() => {
                    if (isSidebarCollapsed) {
                      // When collapsed, navigate to orders page
                      // ADMIN or STAFF with canSeeAllOrders go to /orders (all orders)
                      // Regular STAFF go to /orders/all (their own orders)
                      handleNavigate((isAdmin || canSeeAllOrders) ? '/orders' : '/orders/all');
                    } else {
                      setOrdersExpanded(!ordersExpanded);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-all ${
                    pathname?.startsWith('/orders') && !pathname?.startsWith('/orders/validated') && !pathname?.startsWith('/orders/sent')
                      ? 'bg-orange-400 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  title={isSidebarCollapsed ? 'Commandes' : ''}
                >
                  <div className="flex items-center space-x-3">
                    <span className={pathname?.startsWith('/orders') && !pathname?.startsWith('/orders/validated') && !pathname?.startsWith('/orders/sent') ? 'text-white' : 'text-gray-600'}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </span>
                    {!isSidebarCollapsed && (
                      <span className="font-medium">Commandes</span>
                    )}
                  </div>
                  {!isSidebarCollapsed && (
                    <svg className={`w-4 h-4 transition-transform ${ordersExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>

                {/* Submenu Items */}
                {ordersExpanded && !isSidebarCollapsed && (
                  <ul className="mt-1 ml-6 space-y-1">
                    {orderSubmenuItems.map((item, index) => (
                      <li key={`${item.path}-${index}`}>
                        <button
                          onClick={() => handleNavigate(item.path)}
                          className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-all ${
                            isActive(item.path)
                              ? 'bg-orange-100 text-orange-600 font-medium'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <span className="text-base">{item.icon}</span>
                          <span>{item.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
              )}

              {/* Livraison (Delivery) Section - Admin and Staff (not SUPER_ADMIN) */}
              {(isAdmin || isStaff) && !isSuperAdmin && (
                <li>
                  <button
                    onClick={() => {
                      if (isSidebarCollapsed) {
                        // When collapsed, navigate to validated orders
                        handleNavigate('/orders/validated');
                      } else {
                        setDeliveryExpanded(!deliveryExpanded);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-all ${
                      pathname?.startsWith('/orders/validated') || pathname?.startsWith('/orders/sent') || pathname?.startsWith('/orders/delivered')
                        ? 'bg-orange-400 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    title={isSidebarCollapsed ? 'Livraison' : ''}
                  >
                    <div className="flex items-center space-x-3">
                      <span className={pathname?.startsWith('/orders/validated') || pathname?.startsWith('/orders/sent') || pathname?.startsWith('/orders/delivered') ? 'text-white' : 'text-gray-600'}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      </span>
                      {!isSidebarCollapsed && (
                        <span className="font-medium">Livraison</span>
                      )}
                    </div>
                    {!isSidebarCollapsed && (
                      <svg className={`w-4 h-4 transition-transform ${deliveryExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>

                  {/* Delivery Submenu Items */}
                  {deliveryExpanded && !isSidebarCollapsed && (
                    <ul className="mt-1 ml-6 space-y-1">
                      {/* For STAFF - only their validated orders */}
                      {isStaff && (
                        <li>
                          <button
                            onClick={() => handleNavigate('/orders/validated')}
                            className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-all ${
                              isActive('/orders/validated')
                                ? 'bg-orange-100 text-orange-600 font-medium'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            <OrderIcon src="/Icons/logo-Delivery.png" alt="Envoyer Cathedis" />
                            <span>Envoyer Cathedis</span>
                          </button>
                        </li>
                      )}

                      {/* For Admin - show all validated */}
                      {isAdmin && (
                        <li>
                          <button
                            onClick={() => handleNavigate('/orders/validated')}
                            className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-all ${
                              isActive('/orders/validated')
                                ? 'bg-orange-100 text-orange-600 font-medium'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            <OrderIcon src="/Icons/logo-Delivery.png" alt="Envoyer Cathedis" />
                            <span>Envoyer Cathedis</span>
                          </button>
                        </li>
                      )}


                      {/* Cathedis - Orders sent to delivery company */}
                      <li>
                        <button
                          onClick={() => handleNavigate('/orders/delivered')}
                          className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-all ${
                            isActive('/orders/delivered')
                              ? 'bg-orange-100 text-orange-600 font-medium'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <span className="text-base">📦</span>
                          <span>Suivre Cathedis</span>
                        </button>
                      </li>
                    </ul>
                  )}
                </li>
              )}

              {/* Retour - Admin and Staff only (not SUPER_ADMIN) */}
              {(isAdmin || isStaff) && !isSuperAdmin && (
                <li>
                  <button
                    onClick={() => {
                      if (isSidebarCollapsed) {
                        handleNavigate('/orders/retour/suivi');
                      } else {
                        setRetourExpanded(!retourExpanded);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-all ${
                      pathname?.startsWith('/orders/retour')
                        ? 'bg-orange-400 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    title={isSidebarCollapsed ? 'Retour' : ''}
                  >
                    <div className="flex items-center space-x-3">
                      <span className={pathname?.startsWith('/orders/retour') ? 'text-white' : 'text-gray-600'}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      </span>
                      {!isSidebarCollapsed && (
                        <span className="font-medium">Retour</span>
                      )}
                    </div>
                    {!isSidebarCollapsed && (
                      <svg className={`w-4 h-4 transition-transform ${retourExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>

                  {/* Retour Submenu Items */}
                  {retourExpanded && !isSidebarCollapsed && (
                    <ul className="mt-1 ml-6 space-y-1">
                      {/* Suivi Retours */}
                      <li>
                        <button
                          onClick={() => handleNavigate('/orders/retour/suivi')}
                          className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-all ${
                            isActive('/orders/retour/suivi')
                              ? 'bg-orange-100 text-orange-600 font-medium'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <span className="text-base">📦</span>
                          <span>Suivi Retours</span>
                        </button>
                      </li>

                      {/* Analytics Retours */}
                      <li>
                        <button
                          onClick={() => handleNavigate('/orders/retour/analytics')}
                          className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-all ${
                            isActive('/orders/retour/analytics')
                              ? 'bg-orange-100 text-orange-600 font-medium'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <span className="text-base">📊</span>
                          <span>Analytics Retours</span>
                        </button>
                      </li>
                    </ul>
                  )}
                </li>
              )}

              {/* Magasins - Admin only (store analytics) */}
              {isAdmin && !isSuperAdmin && (
                <li>
                  <button
                    onClick={() => handleNavigate('/magasins')}
                    className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-all ${
                      isActive('/magasins')
                        ? 'bg-orange-400 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    title={isSidebarCollapsed ? 'Magasins' : ''}
                  >
                    <span className={isActive('/magasins') ? 'text-white' : 'text-gray-600'}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </span>
                    {!isSidebarCollapsed && (
                      <span className="font-medium">Magasins</span>
                    )}
                  </button>
                </li>
              )}

              {/* Stock - Admin, Production, Factory Manager - not SUPER_ADMIN */}
              {((isAdmin && !isSuperAdmin) || isProduction || isFactoryManager) && (
                <li>
                  <button
                    onClick={() => handleNavigate('/stock')}
                    className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-all ${
                      isActive('/stock')
                        ? 'bg-orange-400 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    title={isSidebarCollapsed ? 'Stock' : ''}
                  >
                    <span className={isActive('/stock') ? 'text-white' : 'text-gray-600'}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </span>
                    {!isSidebarCollapsed && (
                      <span className="font-medium">Stock</span>
                    )}
                  </button>
                </li>
              )}

              {/* Production Requests - Admin, Production, Factory Manager */}
              {((isAdmin && !isSuperAdmin) || isProduction || isFactoryManager) && (
                <li>
                  <button
                    onClick={() => handleNavigate('/production-requests')}
                    className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-all ${
                      isActive('/production-requests')
                        ? 'bg-orange-400 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    title={isSidebarCollapsed ? 'Production' : ''}
                  >
                    <span className={isActive('/production-requests') ? 'text-white' : 'text-gray-600'}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </span>
                    {!isSidebarCollapsed && (
                      <span className="font-medium">Production</span>
                    )}
                  </button>
                </li>
              )}

              {/* Shipments - Admin, Production, Factory Manager (STORE_CASHIER uses POS interface) */}
              {((isAdmin && !isSuperAdmin) || isProduction || isFactoryManager) && (
                <li>
                  <button
                    onClick={() => handleNavigate('/shipments')}
                    className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-all ${
                      isActive('/shipments')
                        ? 'bg-orange-400 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    title={isSidebarCollapsed ? 'Expéditions' : ''}
                  >
                    <span className={isActive('/shipments') ? 'text-white' : 'text-gray-600'}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    </span>
                    {!isSidebarCollapsed && (
                      <span className="font-medium">Expéditions</span>
                    )}
                  </button>
                </li>
              )}

              {/* Analytics - Staff (personal) */}
              {isStaff && (
                <li>
                  <button
                    onClick={() => handleNavigate('/analytics')}
                    className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-all ${
                      isActive('/analytics')
                        ? 'bg-orange-400 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    title={isSidebarCollapsed ? 'Mes Performances' : ''}
                  >
                    <span className={isActive('/analytics') ? 'text-white' : 'text-gray-600'}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </span>
                    {!isSidebarCollapsed && (
                      <span className="font-medium">Mes Performances</span>
                    )}
                  </button>
                </li>
              )}

              {/* Analytics - Admin (not SUPER_ADMIN) */}
              {isAdmin && !isSuperAdmin && (
                <li>
                  <button
                    onClick={() => handleNavigate('/analytics')}
                    className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-all ${
                      isActive('/analytics')
                        ? 'bg-orange-400 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    title={isSidebarCollapsed ? 'Analytics' : ''}
                  >
                    <span className={isActive('/analytics') ? 'text-white' : 'text-gray-600'}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </span>
                    {!isSidebarCollapsed && (
                      <span className="font-medium">Analytics</span>
                    )}
                  </button>
                </li>
              )}

              {/* Admin Analytics - ONLY for STAFF with canSeeAllOrders (e.g., Fouad) */}
              {isStaff && canSeeAllOrders && (
                <li>
                  <button
                    onClick={() => handleNavigate('/admin-analytics')}
                    className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-all ${
                      isActive('/admin-analytics')
                        ? 'bg-orange-400 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    title={isSidebarCollapsed ? 'Admin Analytics' : ''}
                  >
                    <span className={isActive('/admin-analytics') ? 'text-white' : 'text-gray-600'}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </span>
                    {!isSidebarCollapsed && (
                      <span className="font-medium">Admin Analytics</span>
                    )}
                  </button>
                </li>
              )}

              {/* Users - Admin only (not SUPER_ADMIN - they have it in their special menu) */}
              {isAdmin && !isSuperAdmin && (
                <li>
                  <button
                    onClick={() => handleNavigate('/users')}
                    className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-all ${
                      isActive('/users')
                        ? 'bg-orange-400 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    title={isSidebarCollapsed ? 'Utilisateurs' : ''}
                  >
                    <span className={isActive('/users') ? 'text-white' : 'text-gray-600'}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </span>
                    {!isSidebarCollapsed && (
                      <span className="font-medium">Utilisateurs</span>
                    )}
                  </button>
                </li>
              )}


              {/* Clients - Admin and Super Admin only */}
              {(isAdmin || isSuperAdmin) && (
                <li>
                  <button
                    onClick={() => handleNavigate('/clients')}
                    className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-all ${
                      isActive('/clients')
                        ? 'bg-orange-400 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    title={isSidebarCollapsed ? 'Clients' : ''}
                  >
                    <span className={isActive('/clients') ? 'text-white' : 'text-gray-600'}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </span>
                    {!isSidebarCollapsed && (
                      <span className="font-medium">Clients</span>
                    )}
                  </button>
                </li>
              )}

              {/* Coupons - Admin only (not SUPER_ADMIN) */}
              {isAdmin && !isSuperAdmin && (
                <li>
                  <button
                    onClick={() => handleNavigate('/coupons')}
                    className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-all ${
                      isActive('/coupons')
                        ? 'bg-orange-400 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    title={isSidebarCollapsed ? 'Codes Promo' : ''}
                  >
                    <span className={isActive('/coupons') ? 'text-white' : 'text-gray-600'}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </span>
                    {!isSidebarCollapsed && (
                      <span className="font-medium">Codes Promo</span>
                    )}
                  </button>
                </li>
              )}
            </ul>
          </nav>

          {/* Settings Section - Only SUPER_ADMIN */}
          {isSuperAdmin && (
            <div className="px-3 pb-2">
              <button
                onClick={() => handleNavigate('/settings')}
                className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-all ${
                  isActive('/settings')
                    ? 'bg-orange-400 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title={isSidebarCollapsed ? 'Paramètres' : ''}
              >
                <span className={isActive('/settings') ? 'text-white' : 'text-gray-600'}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                {!isSidebarCollapsed && (
                  <span className="font-medium">Paramètres</span>
                )}
              </button>
            </div>
          )}

          {/* User Section */}
          {user && (
            <div className="border-t border-gray-200 p-4">
              {!isSidebarCollapsed ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-orange-400 flex items-center justify-center text-white font-bold">
                      {user.fullName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {user.fullName}
                      </p>
                      <p className="text-xs text-gray-500">{user.role}</p>
                    </div>
                    {/* Notification Bell - Not for STORE_CASHIER */}
                    {!isStoreCashier && (
                      <NotificationBell collapsed={false} />
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white
  bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3
   0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Déconnexion</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Notification Bell when collapsed - Not for STORE_CASHIER */}
                  {!isStoreCashier && (
                    <NotificationBell collapsed={true} />
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Déconnexion"
                  >
                    <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0
   01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
      </>
    );
  }
