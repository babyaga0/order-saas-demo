import { useEffect, useRef, useCallback } from 'react';

type ScannerOptions = {
  onScan: (code: string) => void;
  enabled?: boolean;
  minLength?: number;
  timeout?: number;
};

export function useScanner({
  onScan,
  enabled = true,
  minLength = 3,
  timeout = 200,
}: ScannerOptions) {
  const scanBufferRef = useRef<string>('');
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onScanRef = useRef(onScan);

  // Keep onScan ref updated
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // Clear buffer helper
  const clearBuffer = useCallback(() => {
    scanBufferRef.current = '';
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
  }, []);

  // Setup scanner listener
  useEffect(() => {
    if (!enabled) {
      clearBuffer();
      return;
    }

    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't process scanner input when typing in form fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Scanner sends Enter to complete scan
      if (e.key === 'Enter' && scanBufferRef.current.length >= minLength) {
        const scannedCode = scanBufferRef.current;
        console.log('[SCANNER] Scanned:', scannedCode);

        // Call scan handler
        if (onScanRef.current) {
          onScanRef.current(scannedCode);
        }

        clearBuffer();
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Accumulate characters
      if (e.key.length === 1) {
        scanBufferRef.current += e.key;

        // Reset timeout
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
        }

        // Auto-clear buffer after timeout (if scan incomplete)
        scanTimeoutRef.current = setTimeout(() => {
          if (scanBufferRef.current.length > 0) {
            // Clear buffer silently (no console spam)
            scanBufferRef.current = '';
          }
        }, timeout);
      }
    };

    window.addEventListener('keypress', handleKeyPress);

    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      clearBuffer();
    };
  }, [enabled, minLength, timeout, clearBuffer]);

  return { clearBuffer };
}
