'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import api from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';

type SystemHealth = {
  status: string;
  timestamp: string;
  uptime: string;
  uptimeSeconds: number;
  database: {
    status: string;
    latency: string;
  };
  memory: {
    heapUsed: string;
    heapTotal: string;
    rss: string;
    external: string;
  };
  node: {
    version: string;
    platform: string;
    arch: string;
  };
};

type SystemSettings = {
  environment: string;
  port: number;
  database: {
    connected: boolean;
    url: string;
  };
  woocommerce: {
    url: string;
    consumerKey: string;
    consumerSecret: string;
  };
  cathedis: {
    apiUrl: string;
    username: string;
    password: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  app: {
    name: string;
    version: string;
  };
};

type SystemStats = {
  users: {
    total: number;
    active: number;
    inactive: number;
  };
  orders: {
    total: number;
    today: number;
  };
  products: {
    total: number;
  };
  inStoreSales: {
    total: number;
    today: number;
  };
};

type LogEntry = {
  timestamp: string;
  level: string;
  type: string;
  message: string;
  details: any;
};

type DatabaseStats = {
  tables: { name: string; count: number }[];
  total: number;
};

type ActiveUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  updatedAt: string;
  createdAt: string;
};

export default function SystemPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [databaseStats, setDatabaseStats] = useState<DatabaseStats | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { isSidebarCollapsed } = useLayout();
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token) {
      router.push('/login');
      return;
    }

    if (userData) {
      const user = JSON.parse(userData);
      if (user.role !== 'SUPER_ADMIN') {
        router.push('/dashboard');
        return;
      }
    }

    loadSystemData();
  }, [router]);

  const loadSystemData = async () => {
    setLoading(true);
    try {
      const [healthRes, settingsRes, statsRes, logsRes, dbStatsRes, activeUsersRes] = await Promise.all([
        api.get('/system/health'),
        api.get('/system/settings'),
        api.get('/system/stats'),
        api.get('/system/logs?limit=50'),
        api.get('/system/database-stats'),
        api.get('/system/active-users'),
      ]);

      if (healthRes.data.success) setHealth(healthRes.data.data);
      if (settingsRes.data.success) setSettings(settingsRes.data.data);
      if (statsRes.data.success) setStats(statsRes.data.data);
      if (logsRes.data.success) setLogs(logsRes.data.data.logs);
      if (dbStatsRes.data.success) setDatabaseStats(dbStatsRes.data.data);
      if (activeUsersRes.data.success) setActiveUsers(activeUsersRes.data.data);
    } catch (error) {
      console.error('Failed to load system data:', error);
      toast.error('Erreur lors du chargement des données système');
    } finally {
      setLoading(false);
    }
  };

  const handleForceLogout = async (userId: string, userName: string) => {
    try {
      const response = await api.post(`/system/force-logout/${userId}`);
      if (response.data.success) {
        toast.success(`${userName} a été déconnecté`);
        loadSystemData();
      }
    } catch (error: any) {
      console.error('Force logout failed:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la déconnexion');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <main className={`transition-all duration-300 ${isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'} min-h-screen p-6`}>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      <main className={`transition-all duration-300 ${isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'} min-h-screen p-6`}>
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Panneau Système</h1>
            <p className="text-gray-600 mt-2">Monitoring du système - SUPER_ADMIN uniquement</p>
          </div>
          <button
            onClick={loadSystemData}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Rafraîchir</span>
          </button>
        </div>

        {/* Health & Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* System Health */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">État du Système</h2>
            {health && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    health.status === 'healthy' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {health.status === 'healthy' ? 'Sain' : 'Dégradé'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Uptime</span>
                  <span className="font-semibold">{health.uptime}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Base de données</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    health.database.status === 'healthy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {health.database.latency}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Mémoire (Heap)</span>
                  <span className="font-semibold">{health.memory.heapUsed} / {health.memory.heapTotal}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Node.js</span>
                  <span className="font-semibold">{health.node.version}</span>
                </div>
              </div>
            )}
          </div>

          {/* System Stats */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Statistiques</h2>
            {stats && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600">{stats.users.total}</div>
                  <div className="text-sm text-gray-600">Utilisateurs ({stats.users.active} actifs)</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">{stats.orders.total}</div>
                  <div className="text-sm text-gray-600">Commandes ({stats.orders.today} aujourd'hui)</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600">{stats.products.total}</div>
                  <div className="text-sm text-gray-600">Produits</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-orange-600">{stats.inStoreSales.total}</div>
                  <div className="text-sm text-gray-600">Ventes Magasin ({stats.inStoreSales.today} aujourd'hui)</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Settings */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Configuration Système</h2>
          {settings && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Application</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Nom</span>
                    <span>{settings.app.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Version</span>
                    <span>{settings.app.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Environnement</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      settings.environment === 'production' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {settings.environment}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Port</span>
                    <span>{settings.port}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-700 mb-2">WooCommerce</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">URL</span>
                    <span className="truncate max-w-[150px]">{settings.woocommerce.url}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Consumer Key</span>
                    <span className={settings.woocommerce.consumerKey.includes('configured') ? 'text-green-600' : 'text-red-600'}>
                      {settings.woocommerce.consumerKey}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Consumer Secret</span>
                    <span className={settings.woocommerce.consumerSecret.includes('configured') ? 'text-green-600' : 'text-red-600'}>
                      {settings.woocommerce.consumerSecret}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Cathedis</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">API URL</span>
                    <span className="truncate max-w-[150px]">{settings.cathedis.apiUrl}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Username</span>
                    <span className={settings.cathedis.username.includes('configured') ? 'text-green-600' : 'text-red-600'}>
                      {settings.cathedis.username}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Password</span>
                    <span className={settings.cathedis.password.includes('configured') ? 'text-green-600' : 'text-red-600'}>
                      {settings.cathedis.password}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Database Stats & Active Users Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Database Stats */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Base de Données</h2>
            {databaseStats && (
              <div className="space-y-3">
                {databaseStats.tables.map((table) => (
                  <div key={table.name} className="flex items-center justify-between">
                    <span className="text-gray-600">{table.name}</span>
                    <span className="font-semibold text-gray-900">{table.count.toLocaleString()}</span>
                  </div>
                ))}
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 font-semibold">Total</span>
                    <span className="font-bold text-lg text-orange-600">{databaseStats.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active Users */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Utilisateurs Actifs</h2>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {activeUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-orange-400 flex items-center justify-center text-white text-sm font-bold">
                      {user.fullName?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{user.fullName}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      user.role === 'SUPER_ADMIN' ? 'bg-red-100 text-red-800' :
                      user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {user.role}
                    </span>
                    {user.role !== 'SUPER_ADMIN' && (
                      <button
                        onClick={() => handleForceLogout(user.id, user.fullName)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Déconnecter"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity Logs */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Activité Récente</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        log.type === 'order' ? 'bg-blue-100 text-blue-800' :
                        log.type === 'user' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {log.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Toaster position="top-right" />
    </div>
  );
}
