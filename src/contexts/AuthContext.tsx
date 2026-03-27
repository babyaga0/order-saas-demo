'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { USERS } from '@/lib/demoData';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'STAFF' | 'STORE_CASHIER' | 'PRODUCTION' | 'FACTORY_MANAGER';
  status: 'ACTIVE' | 'INACTIVE';
  storeId?: string;
  canSendToDelivery?: boolean;
  store?: { id: string; name: string };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getStoreSlug(storeName: string): string {
  return storeName.toLowerCase().replace(/\s+/g, '-');
}

// Pick the right demo user based on email (falls back to ADMIN)
function resolveUser(email: string): User {
  const match = USERS.find(u => u.email === email);
  return (match || USERS[0]) as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, _password: string) => {
    // Accept any credentials — pick the matching demo user or default to admin
    const userData = resolveUser(email);
    localStorage.setItem('token', 'demo-token-atlas');
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);

    if (userData.role === 'STAFF') {
      router.push('/orders');
    } else if (userData.role === 'STORE_CASHIER') {
      const slug = userData.store?.name ? getStoreSlug(userData.store.name) : 'casablanca-centre';
      router.push(`/pos/${slug}`);
    } else if (userData.role === 'FACTORY_MANAGER') {
      router.push('/stock');
    } else {
      router.push('/dashboard');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
