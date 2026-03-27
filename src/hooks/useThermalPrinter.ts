'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  generateEscPosReceipt,
  generateOpenDrawerCommand,
  printReceiptBrowser,
  ReceiptData,
} from '@/utils/receiptGenerator';

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron === true;

interface PrinterState {
  isConnected: boolean;
  isPrinting: boolean;
  lastError: string | null;
  printerName: string | null;
}

interface UseThermalPrinterReturn {
  state: PrinterState;
  connectPrinter: () => Promise<boolean>;
  disconnectPrinter: () => Promise<void>;
  printReceipt: (data: ReceiptData) => Promise<boolean>;
  printTest: () => Promise<boolean>;
  openDrawer: () => Promise<boolean>;
}

/**
 * Hook for managing thermal printer connection and printing
 * Supports:
 * - Electron: Silent printing via USB (no dialogs)
 * - Browser: Web Serial API or browser print fallback
 */
export function useThermalPrinter(): UseThermalPrinterReturn {
  const [state, setState] = useState<PrinterState>({
    isConnected: false,
    isPrinting: false,
    lastError: null,
    printerName: null,
  });

  const [port, setPort] = useState<any>(null);

  // Check printer status on mount and periodically
  useEffect(() => {
    // Browser mode: always ready (uses window.print with default printer)
    if (!isElectron) {
      setState({
        isConnected: true,
        isPrinting: false,
        lastError: null,
        printerName: 'Impression navigateur',
      });
      return;
    }

    if (isElectron && window.electronAPI) {
      let isCheckingStatus = false; // Prevent concurrent checks
      let isMounted = true; // Track if component is still mounted

      const checkStatus = async () => {
        // Skip if already checking or component unmounted
        if (isCheckingStatus || !isMounted) return;

        isCheckingStatus = true;
        try {
          const status = await window.electronAPI?.getPrinterStatus();
          if (!status || !isMounted) {
            isCheckingStatus = false;
            return;
          }

          // Only update state if status actually changed (prevent unnecessary re-renders)
          setState((prev) => {
            const statusChanged =
              prev.isConnected !== status.connected ||
              prev.printerName !== (status.connected ? status.type : 'Non connectée');

            if (statusChanged) {
              console.log('[PRINTER] Status changed:', status.connected ? 'Connected' : 'Disconnected');
              return {
                ...prev,
                isConnected: status.connected,
                printerName: status.connected ? status.type : 'Non connectée',
                lastError: status.connected ? null : 'Imprimante USB non détectée',
              };
            }
            return prev; // No change, return same state
          });
        } catch (error) {
          if (isMounted) {
            console.error('[PRINTER] Failed to get status:', error);
          }
        } finally {
          isCheckingStatus = false;
        }
      };

      // Check immediately on mount
      checkStatus();

      // Check every 30 seconds (reduced from 5s to prevent performance issues)
      // Only checks when needed - Electron auto-reconnects in background
      const interval = setInterval(checkStatus, 30000);

      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }
  }, []);

  /**
   * Connect to USB thermal printer
   * Note: In Electron, this just checks status (auto-connect on startup)
   * In browser, this uses Web Serial API
   */
  const connectPrinter = useCallback(async (): Promise<boolean> => {
    console.log('[PRINTER] connectPrinter called');

    // In Electron, printer auto-connects on startup
    if (isElectron && window.electronAPI) {
      try {
        console.log('[PRINTER] Checking Electron printer status...');
        const status = await window.electronAPI?.getPrinterStatus();
        if (!status) {
          setState((prev) => ({
            ...prev,
            isConnected: false,
            lastError: 'API Electron non disponible',
          }));
          return false;
        }

        setState((prev) => ({
          ...prev,
          isConnected: status.connected,
          printerName: status.connected ? status.type : 'Non connectée',
          lastError: status.connected ? null : 'Imprimante USB non détectée. Vérifiez la connexion USB.',
        }));

        // Don't show alert - just log for debugging
        if (!status.connected) {
          console.warn('[PRINTER] Imprimante non détectée. Vérifiez: 1. Câble USB 2. Imprimante allumée 3. Drivers installés');
        }

        return status.connected;
      } catch (error: any) {
        console.error('[PRINTER] Error checking status:', error);
        setState((prev) => ({
          ...prev,
          isConnected: false,
          lastError: 'Erreur de connexion',
        }));
        return false;
      }
    }

    // Browser mode: Use window.print() (works with default printer)
    // In Chrome kiosk mode (--kiosk-printing), this prints silently
    // Otherwise, shows the standard print dialog
    console.log('[PRINTER] Browser mode: using window.print() with default printer');
    setState({
      isConnected: true,
      isPrinting: false,
      lastError: null,
      printerName: 'Impression navigateur',
    });
    return true;
  }, []);

  /**
   * Disconnect from printer
   */
  const disconnectPrinter = useCallback(async (): Promise<void> => {
    if (port) {
      try {
        await port.close();
      } catch (error) {
        console.error('Error closing port:', error);
      }
      setPort(null);
    }

    setState({
      isConnected: false,
      isPrinting: false,
      lastError: null,
      printerName: null,
    });
  }, [port]);

  /**
   * Send data to printer
   */
  const sendToPrinter = useCallback(
    async (data: string): Promise<boolean> => {
      if (!port) {
        setState((prev) => ({
          ...prev,
          lastError: 'Printer not connected',
        }));
        return false;
      }

      try {
        setState((prev) => ({ ...prev, isPrinting: true, lastError: null }));

        const writer = port.writable.getWriter();
        const encoder = new TextEncoder();

        await writer.write(encoder.encode(data));

        writer.releaseLock();

        setState((prev) => ({ ...prev, isPrinting: false }));
        return true;
      } catch (error: any) {
        const errorMsg = error.message || 'Print failed';
        setState((prev) => ({
          ...prev,
          isPrinting: false,
          lastError: errorMsg,
        }));
        return false;
      }
    },
    [port]
  );

  /**
   * Print receipt
   */
  const printReceipt = useCallback(
    async (data: ReceiptData): Promise<boolean> => {
      console.log('[PRINTER] printReceipt called. isConnected:', state.isConnected, 'port:', !!port);

      // If running in Electron, use silent printing
      if (isElectron && window.electronAPI) {
        try {
          setState((prev) => ({ ...prev, isPrinting: true }));
          const result = await window.electronAPI?.printReceipt(data);
          if (!result) {
            setState((prev) => ({
              ...prev,
              isPrinting: false,
              lastError: 'API Electron non disponible',
            }));
            return false;
          }

          setState((prev) => ({
            ...prev,
            isPrinting: false,
            lastError: result.success ? null : result.error || 'Print failed',
          }));
          return result.success;
        } catch (error: any) {
          setState((prev) => ({
            ...prev,
            isPrinting: false,
            lastError: error.message || 'Electron print failed',
          }));
          return false;
        }
      }

      // If connected to USB printer via Web Serial, use ESC/POS (silent printing)
      if (state.isConnected && port) {
        console.log('[PRINTER] ✅ Using Web Serial API (silent print)');
        const escPosData = generateEscPosReceipt(data);
        return sendToPrinter(escPosData);
      }

      // Browser mode: Use iframe printing with HTML receipt
      // In Chrome kiosk mode (--kiosk-printing), this prints silently
      console.log('[PRINTER] Using browser print (iframe + HTML receipt)');
      try {
        setState((prev) => ({ ...prev, isPrinting: true }));
        printReceiptBrowser('', data);
        setState((prev) => ({ ...prev, isPrinting: false }));
        console.log('[PRINTER] Browser print triggered.');
        return true;
      } catch (error: any) {
        setState((prev) => ({
          ...prev,
          isPrinting: false,
          lastError: error.message || 'Print failed',
        }));
        return false;
      }
    },
    [state.isConnected, port, sendToPrinter]
  );

  /**
   * Print test page
   */
  const printTest = useCallback(async (): Promise<boolean> => {
    const testData: ReceiptData = {
      storeName: 'Test Store',
      saleNumber: 'TEST-001',
      cashierName: 'Test',
      items: [
        {
          productName: 'Test Product',
          shortCode: 'TST-001',
          quantity: 1,
          unitPrice: 100,
          totalPrice: 100,
        },
      ],
      subtotal: 100,
      total: 100,
      paymentMethod: 'CASH',
      amountReceived: 100,
      changeGiven: 0,
    };

    return printReceipt(testData);
  }, [printReceipt]);

  /**
   * Open cash drawer only (without printing)
   * Useful for returns/refunds
   */
  const openDrawer = useCallback(async (): Promise<boolean> => {
    // If running in Electron, use Electron API
    if (isElectron && window.electronAPI) {
      try {
        const result = await window.electronAPI?.openCashDrawer();
        if (!result) {
          setState((prev) => ({
            ...prev,
            lastError: 'API Electron non disponible',
          }));
          return false;
        }

        if (!result.success) {
          setState((prev) => ({
            ...prev,
            lastError: result.error || 'Failed to open drawer',
          }));
        }
        return result.success;
      } catch (error: any) {
        setState((prev) => ({
          ...prev,
          lastError: error.message || 'Electron drawer open failed',
        }));
        return false;
      }
    }

    // Web Serial fallback
    if (!state.isConnected || !port) {
      setState((prev) => ({
        ...prev,
        lastError: 'Printer not connected. Connect printer to open drawer.',
      }));
      return false;
    }

    const drawerCommand = generateOpenDrawerCommand();
    return sendToPrinter(drawerCommand);
  }, [state.isConnected, port, sendToPrinter]);

  return {
    state,
    connectPrinter,
    disconnectPrinter,
    printReceipt,
    printTest,
    openDrawer,
  };
}

export type { PrinterState, UseThermalPrinterReturn };
