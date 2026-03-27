// Electron API types for when the frontend runs inside Electron
interface ElectronAPI {
  // App
  getAppInfo: () => Promise<{
    version: string;
    isPackaged: boolean;
    platform: string;
  }>;
  checkOnline: () => Promise<boolean>;
  reload: () => Promise<void>;
  installUpdate: () => void;

  // Config
  getConfig: (key: string) => Promise<any>;
  setConfig: (key: string, value: any) => Promise<boolean>;

  // Printer
  printReceipt: (receiptData: any) => Promise<{ success: boolean; error?: string }>;
  openCashDrawer: () => Promise<{ success: boolean; error?: string }>;
  testPrinter: () => Promise<{ success: boolean; error?: string }>;
  getPrinterStatus: () => Promise<{ connected: boolean; type: string }>;

  // Sync
  getSyncStatus: () => Promise<{
    isOnline: boolean;
    isSyncing: boolean;
    pendingSalesCount: number;
    lastProductSync: string | null;
    lastSalesSync: string | null;
  }>;
  forceSync: () => Promise<{ success: boolean; error?: string }>;
  getPendingSalesCount: () => Promise<number>;

  // Offline
  createOfflineSale: (saleData: any) => Promise<{
    success: boolean;
    localId: string;
    error?: string;
  }>;
  getProductByCode: (shortCode: string) => Promise<any>;
  getAllProducts: () => Promise<any[]>;

  // Events
  onConnectivityChange: (callback: (data: { isOnline: boolean }) => void) => () => void;
  onUpdateAvailable: (callback: (info: any) => void) => () => void;
  onUpdateDownloaded: (callback: (info: any) => void) => () => void;
  onPendingSaleAdded: (callback: (data: { count: number }) => void) => () => void;
  onSyncComplete: (callback: (data: { pendingSalesCount: number }) => void) => () => void;

  // Platform info
  platform: string;
  isElectron: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
