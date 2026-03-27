/**
 * Receipt Generator for 80mm Thermal Printer (Xprinter)
 * Generates ESC/POS compatible receipt text
 *
 * 80mm paper = ~48 characters per line (standard font)
 */

interface ReceiptItem {
  productName: string;
  shortCode?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface ReceiptData {
  storeName: string;
  saleNumber: string;
  cashierName: string;
  items: ReceiptItem[];
  subtotal: number;
  discount?: {
    code: string;
    amount: number;
  };
  total: number;
  paymentMethod: 'CASH' | 'CARD' | 'MIXED';
  amountReceived?: number;
  changeGiven?: number;
  customerPhone?: string;
  date?: Date;
}

const RECEIPT_WIDTH = 48;
const SEPARATOR_DOUBLE = '='.repeat(RECEIPT_WIDTH);
const SEPARATOR_SINGLE = '-'.repeat(RECEIPT_WIDTH);

/**
 * Center text within receipt width
 */
function centerText(text: string): string {
  const padding = Math.max(0, Math.floor((RECEIPT_WIDTH - text.length) / 2));
  return ' '.repeat(padding) + text;
}

/**
 * Right-align amount with label on left
 */
function alignLabelAmount(label: string, amount: string): string {
  const spaces = Math.max(1, RECEIPT_WIDTH - label.length - amount.length);
  return label + ' '.repeat(spaces) + amount;
}

/**
 * Format currency in Moroccan Dirhams
 */
function formatDH(amount: number): string {
  return amount.toFixed(2) + ' DH';
}

/**
 * Format date in French format
 */
function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Translate payment method to French
 */
function translatePaymentMethod(method: string): string {
  const translations: Record<string, string> = {
    'CASH': 'ESPECES',
    'CARD': 'CARTE',
    'MIXED': 'MIXTE',
  };
  return translations[method] || method;
}

/**
 * Generate receipt text for thermal printer
 */
export function generateReceiptText(data: ReceiptData): string {
  const lines: string[] = [];
  const date = data.date || new Date();

  // Header
  lines.push(SEPARATOR_DOUBLE);
  lines.push(centerText('ATLAS DENIM'));
  lines.push(centerText(data.storeName));
  lines.push(SEPARATOR_DOUBLE);

  // Sale info
  lines.push(`Date: ${formatDate(date)}`);
  lines.push(`Ticket: ${data.saleNumber}`);
  lines.push(`Vendeur: ${data.cashierName}`);

  if (data.customerPhone) {
    lines.push(`Client: ${data.customerPhone}`);
  }

  lines.push(SEPARATOR_SINGLE);

  // Items
  for (const item of data.items) {
    // Line 1: Quantity x Code
    const qtyLine = `${item.quantity}x ${item.shortCode || item.productName.substring(0, 20)}`;
    lines.push(qtyLine);

    // Line 2: Product name (truncated)
    const nameLine = `   ${item.productName.substring(0, RECEIPT_WIDTH - 3)}`;
    lines.push(nameLine);

    // Line 3: Price calculation
    if (item.quantity > 1) {
      const priceCalc = `${item.quantity} x ${item.unitPrice.toFixed(0)} = ${formatDH(item.totalPrice)}`;
      lines.push(alignLabelAmount('', priceCalc));
    } else {
      lines.push(alignLabelAmount('', formatDH(item.totalPrice)));
    }

    lines.push(''); // Empty line between items
  }

  lines.push(SEPARATOR_SINGLE);

  // Totals
  const totalItems = data.items.reduce((sum, item) => sum + item.quantity, 0);
  lines.push(alignLabelAmount('ARTICLES:', totalItems.toString()));
  lines.push(alignLabelAmount('SOUS-TOTAL:', formatDH(data.subtotal)));

  if (data.discount && data.discount.amount > 0) {
    lines.push(alignLabelAmount(`PROMO (${data.discount.code}):`, formatDH(-data.discount.amount)));
  }

  lines.push(SEPARATOR_SINGLE);
  lines.push(alignLabelAmount('TOTAL:', formatDH(data.total)));

  // Payment info
  lines.push(`Paiement: ${translatePaymentMethod(data.paymentMethod)}`);

  if (data.paymentMethod === 'CASH' && data.amountReceived) {
    lines.push(alignLabelAmount('Recu:', formatDH(data.amountReceived)));
    if (data.changeGiven && data.changeGiven > 0) {
      lines.push(alignLabelAmount('Rendu:', formatDH(data.changeGiven)));
    }
  }

  lines.push(SEPARATOR_SINGLE);

  // Footer
  lines.push('');
  lines.push(centerText('Merci de votre visite!'));
  lines.push('');
  lines.push(centerText('Echange sous 7 jours'));
  lines.push(centerText('avec ce ticket'));
  lines.push('');
  lines.push(SEPARATOR_DOUBLE);

  return lines.join('\n');
}

/**
 * ESC/POS commands for thermal printer
 */
export const ESC_POS = {
  INIT: '\x1B\x40',           // Initialize printer
  CUT: '\x1D\x56\x00',        // Full cut
  CUT_PARTIAL: '\x1D\x56\x01', // Partial cut
  ALIGN_CENTER: '\x1B\x61\x01',
  ALIGN_LEFT: '\x1B\x61\x00',
  ALIGN_RIGHT: '\x1B\x61\x02',
  BOLD_ON: '\x1B\x45\x01',
  BOLD_OFF: '\x1B\x45\x00',
  DOUBLE_HEIGHT: '\x1B\x21\x10',
  DOUBLE_WIDTH: '\x1B\x21\x20',
  NORMAL_SIZE: '\x1B\x21\x00',
  FEED_LINES: (n: number) => `\x1B\x64${String.fromCharCode(n)}`,
  OPEN_DRAWER: '\x1B\x70\x00\x19\x19', // Open cash drawer (if connected)
};

/**
 * Generate ESC/POS formatted receipt with commands
 */
export function generateEscPosReceipt(data: ReceiptData): string {
  const lines: string[] = [];
  const date = data.date || new Date();

  // Initialize printer
  lines.push(ESC_POS.INIT);
  lines.push(ESC_POS.BOLD_ON); // Bold on for entire receipt

  // Header - centered, double size
  lines.push(ESC_POS.ALIGN_CENTER);
  lines.push(ESC_POS.DOUBLE_HEIGHT);
  lines.push('ATLAS DENIM\n');
  lines.push(ESC_POS.NORMAL_SIZE);
  lines.push(data.storeName + '\n');

  // Sale info - left aligned
  lines.push(ESC_POS.ALIGN_LEFT);
  lines.push(SEPARATOR_DOUBLE + '\n');
  lines.push(`Date: ${formatDate(date)}\n`);
  lines.push(`Ticket: ${data.saleNumber}\n`);
  lines.push(`Vendeur: ${data.cashierName}\n`);

  if (data.customerPhone) {
    lines.push(`Client: ${data.customerPhone}\n`);
  }

  lines.push(SEPARATOR_SINGLE + '\n');

  // Items
  for (const item of data.items) {
    lines.push(`${item.quantity}x ${item.shortCode || item.productName.substring(0, 20)}\n`);
    lines.push(`   ${item.productName.substring(0, RECEIPT_WIDTH - 3)}\n`);

    if (item.quantity > 1) {
      const priceCalc = `${item.quantity} x ${item.unitPrice.toFixed(0)} = ${formatDH(item.totalPrice)}`;
      lines.push(ESC_POS.ALIGN_RIGHT);
      lines.push(priceCalc + '\n');
      lines.push(ESC_POS.ALIGN_LEFT);
    } else {
      lines.push(ESC_POS.ALIGN_RIGHT);
      lines.push(formatDH(item.totalPrice) + '\n');
      lines.push(ESC_POS.ALIGN_LEFT);
    }
    lines.push('\n');
  }

  lines.push(SEPARATOR_SINGLE + '\n');

  // Totals
  const totalItemsEsc = data.items.reduce((sum, item) => sum + item.quantity, 0);
  lines.push(alignLabelAmount('ARTICLES:', totalItemsEsc.toString()) + '\n');
  lines.push(alignLabelAmount('SOUS-TOTAL:', formatDH(data.subtotal)) + '\n');

  if (data.discount && data.discount.amount > 0) {
    lines.push(alignLabelAmount(`PROMO (${data.discount.code}):`, formatDH(-data.discount.amount)) + '\n');
  }

  lines.push(SEPARATOR_SINGLE + '\n');

  // Total
  lines.push(alignLabelAmount('TOTAL:', formatDH(data.total)) + '\n');

  // Payment
  lines.push(`Paiement: ${translatePaymentMethod(data.paymentMethod)}\n`);

  if (data.paymentMethod === 'CASH' && data.amountReceived) {
    lines.push(alignLabelAmount('Recu:', formatDH(data.amountReceived)) + '\n');
    if (data.changeGiven && data.changeGiven > 0) {
      lines.push(alignLabelAmount('Rendu:', formatDH(data.changeGiven)) + '\n');
    }
  }

  lines.push(SEPARATOR_SINGLE + '\n');

  // Footer
  lines.push(ESC_POS.ALIGN_CENTER);
  lines.push('\nMerci de votre visite!\n\n');
  lines.push('Echange sous 7 jours\n');
  lines.push('avec ce ticket\n\n');

  // Feed and cut
  lines.push(ESC_POS.FEED_LINES(3));
  lines.push(ESC_POS.CUT);

  // Open cash drawer
  lines.push(ESC_POS.OPEN_DRAWER);

  return lines.join('');
}

/**
 * Generate proper HTML receipt for browser printing (80mm thermal paper)
 */
export function generateReceiptHTML(data: ReceiptData): string {
  const date = data.date || new Date();
  const paymentLabel = translatePaymentMethod(data.paymentMethod);

  let itemsHTML = '';
  for (const item of data.items) {
    const code = item.shortCode || item.productName.substring(0, 20);
    const priceStr = item.quantity > 1
      ? `${item.quantity} x ${item.unitPrice.toFixed(2)} = ${item.totalPrice.toFixed(2)} DH`
      : `${item.totalPrice.toFixed(2)} DH`;

    itemsHTML += `
      <div class="item">
        <div class="item-name">${item.quantity}x ${code}</div>
        <div class="item-price">${priceStr}</div>
      </div>`;
  }

  let discountHTML = '';
  if (data.discount && data.discount.amount > 0) {
    discountHTML = `
      <div class="line"><span>Sous-total:</span><span>${data.subtotal.toFixed(2)} DH</span></div>
      <div class="line"><span>Remise (${data.discount.code}):</span><span>-${data.discount.amount.toFixed(2)} DH</span></div>`;
  }

  let cashHTML = '';
  if (data.paymentMethod === 'CASH' && data.amountReceived) {
    cashHTML += `<div class="line"><span>Recu:</span><span>${data.amountReceived.toFixed(2)} DH</span></div>`;
    if (data.changeGiven && data.changeGiven > 0) {
      cashHTML += `<div class="line"><span>Rendu:</span><span>${data.changeGiven.toFixed(2)} DH</span></div>`;
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Ticket</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', 'Lucida Console', monospace;
    font-size: 12px;
    font-weight: bold;
    line-height: 1.3;
    width: 80mm;
    padding: 2mm 3mm;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .big { font-size: 16px; }
  .sep { border-top: 1px dashed #000; margin: 4px 0; }
  .sep-double { border-top: 2px solid #000; margin: 4px 0; }
  .line { display: flex; justify-content: space-between; }
  .item { margin: 2px 0; }
  .item-name { font-weight: bold; }
  .item-price { text-align: right; font-size: 11px; }
  .total-line { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin: 4px 0; }
  .footer { margin-top: 8px; text-align: center; font-size: 11px; }
</style>
</head>
<body>
  <div class="center bold big">ATLAS DENIM</div>
  <div class="center">${data.storeName}</div>
  <div class="sep-double"></div>
  <div>Date: ${formatDate(date)}</div>
  <div>Ticket: ${data.saleNumber}</div>
  <div>Vendeur: ${data.cashierName}</div>
  ${data.customerPhone ? `<div>Client: ${data.customerPhone}</div>` : ''}
  <div class="sep"></div>
  ${itemsHTML}
  <div class="sep"></div>
  <div class="line"><span>Articles:</span><span>${data.items.reduce((s, i) => s + i.quantity, 0)}</span></div>
  ${discountHTML}
  <div class="total-line"><span>TOTAL:</span><span>${data.total.toFixed(2)} DH</span></div>
  <div class="sep"></div>
  <div class="line"><span>Paiement:</span><span>${paymentLabel}</span></div>
  ${cashHTML}
  <div class="footer">
    <div class="sep"></div>
    <br>Merci de votre visite!<br><br>
    Echange sous 7 jours<br>avec ce ticket<br><br>
    www.atlasdenim.ma
  </div>
</body>
</html>`;
}

/**
 * Print receipt using hidden iframe (no popup blockers, works with kiosk mode)
 * In Chrome with --kiosk-printing flag, this prints silently to default printer.
 * Without kiosk mode, shows the standard print dialog.
 */
export function printReceiptBrowser(receiptTextOrHTML: string, receiptData?: ReceiptData): void {
  // Use HTML receipt if data is provided, otherwise wrap plain text
  const html = receiptData
    ? generateReceiptHTML(receiptData)
    : `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Ticket</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  body { font-family: 'Courier New', monospace; font-size: 12px; font-weight: bold;
    line-height: 1.2; width: 80mm; margin: 0; padding: 2mm 3mm; white-space: pre; color: #000;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style>
</head><body>${receiptTextOrHTML}</body></html>`;

  // Use hidden iframe instead of popup window (avoids popup blockers)
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '80mm';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    console.error('[PRINTER] Failed to access iframe document');
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Track if print was already triggered (prevent double printing)
  let printed = false;

  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (error) {
      console.error('[PRINTER] iframe print error:', error);
    }
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 3000);
  };

  // Wait for content to render, then print
  iframe.onload = () => triggerPrint();

  // Fallback: if onload doesn't fire (some browsers), trigger after timeout
  setTimeout(() => {
    if (!printed) triggerPrint();
  }, 500);
}

/**
 * Generate ESC/POS command to open cash drawer only
 */
export function generateOpenDrawerCommand(): string {
  return ESC_POS.INIT + ESC_POS.OPEN_DRAWER;
}

/**
 * Print receipt using Web Serial API (for USB thermal printers)
 */
export async function printReceiptUSB(receiptData: string): Promise<boolean> {
  if (!('serial' in navigator)) {
    console.error('Web Serial API not supported');
    return false;
  }

  try {
    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate: 9600 });

    const writer = port.writable.getWriter();
    const encoder = new TextEncoder();

    await writer.write(encoder.encode(receiptData));

    writer.releaseLock();
    await port.close();

    return true;
  } catch (error) {
    console.error('Print error:', error);
    return false;
  }
}

export type { ReceiptData, ReceiptItem };
