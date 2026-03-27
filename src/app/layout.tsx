import '../styles/globals.css'
import type { Metadata } from 'next'
import { AuthProvider } from '@/contexts/AuthContext'
import { LayoutProvider } from '@/contexts/LayoutContext'
import ClientLayout from '@/components/ClientLayout'
import DemoFetchInterceptor from '@/components/DemoFetchInterceptor'

export const metadata: Metadata = {
  title: 'Atlas Denim - Order Management',
  description: 'Gestion des commandes Atlas Denim',
  themeColor: '#f97316',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <DemoFetchInterceptor />
        <AuthProvider>
          <LayoutProvider>
            <ClientLayout>
              {children}
            </ClientLayout>
          </LayoutProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
