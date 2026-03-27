'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseBarcodeOptions {
  onScan: (code: string) => void;
  enabled?: boolean;
  minLength?: number;
  maxDelay?: number; // Max delay between keystrokes in ms
}

/**
 * Hook to detect barcode scanner input
 *
 * Barcode scanners work like keyboards - they type characters very fast
 * and end with Enter. This hook detects that pattern and calls onScan
 * with the scanned code.
 *
 * @param options.onScan - Callback when a barcode is scanned
 * @param options.enabled - Whether scanning is enabled (default: true)
 * @param options.minLength - Minimum barcode length (default: 3)
 * @param options.maxDelay - Max delay between chars in ms (default: 50)
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  minLength = 3,
  maxDelay = 50,
}: UseBarcodeOptions) {
  const [isScanning, setIsScanning] = useState(false);
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearBuffer = useCallback(() => {
    bufferRef.current = '';
    setIsScanning(false);
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Ignore if user is typing in an input/textarea (unless it's the scan input)
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    const isScanInput = target.dataset?.scanInput === 'true';

    // Allow scanning in scan-designated inputs, but not other inputs
    if (isInput && !isScanInput) return;

    const now = Date.now();
    const timeSinceLastKey = now - lastKeyTimeRef.current;

    // If too much time passed, clear the buffer
    if (timeSinceLastKey > maxDelay && bufferRef.current.length > 0) {
      clearBuffer();
    }

    lastKeyTimeRef.current = now;

    // Handle Enter key - submit if we have a valid barcode
    if (event.key === 'Enter') {
      if (bufferRef.current.length >= minLength) {
        event.preventDefault();
        onScan(bufferRef.current);
      }
      clearBuffer();
      return;
    }

    // Only accept printable characters
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // Start scanning
      if (!isScanning) {
        setIsScanning(true);
      }

      bufferRef.current += event.key;

      // Clear timeout and set new one
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Auto-clear buffer after inactivity (scanner stopped mid-scan)
      timeoutRef.current = setTimeout(() => {
        clearBuffer();
      }, maxDelay * 2);
    }
  }, [enabled, minLength, maxDelay, onScan, clearBuffer, isScanning]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, handleKeyDown]);

  return {
    isScanning,
    clearBuffer,
  };
}

/**
 * Higher-level hook for POS scanning
 * Manages the scanning state and provides manual entry fallback
 */
export function usePOSScanner(onProductScanned: (code: string) => void) {
  const [scanMode, setScanMode] = useState<'auto' | 'manual'>('auto');
  const [manualCode, setManualCode] = useState('');

  const { isScanning, clearBuffer } = useBarcodeScanner({
    onScan: onProductScanned,
    enabled: scanMode === 'auto',
  });

  const handleManualSubmit = useCallback(() => {
    if (manualCode.trim()) {
      onProductScanned(manualCode.trim());
      setManualCode('');
    }
  }, [manualCode, onProductScanned]);

  const switchToManual = useCallback(() => {
    setScanMode('manual');
    clearBuffer();
  }, [clearBuffer]);

  const switchToAuto = useCallback(() => {
    setScanMode('auto');
    setManualCode('');
  }, []);

  return {
    scanMode,
    isScanning,
    manualCode,
    setManualCode,
    handleManualSubmit,
    switchToManual,
    switchToAuto,
  };
}

export default useBarcodeScanner;
