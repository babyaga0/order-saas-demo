'use client';

import { useEffect, useState } from 'react';
import ChatBot from './ChatBot';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    // Get user role from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setUserRole(user.role);
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, []);

  // Only show chatbot for ADMIN and SUPER_ADMIN
  const showChatBot = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

  return (
    <>
      {children}
      {showChatBot && <ChatBot />}
    </>
  );
}
