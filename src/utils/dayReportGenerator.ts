/**
 * Day Report Generator
 * Generates PDF-ready HTML for end-of-day sales report
 */

interface SaleItem {
  id: string;
  saleNumber: string;
  totalAmount: number;
  paymentMethod: 'CASH' | 'CARD' | 'MIXED';
  itemCount: number;
  createdAt: string;
  createdBy: string;
  items?: Array<{
    productName: string;
    shortCode: string;
    size: string | null;
    length: string | null;
    quantity: number;
  }>;
}

interface ReportData {
  storeName: string;
  date: string;
  cashierName?: string;
  sales: {
    count: number;
    totalAmount: number;
  };
  returns: {
    count: number;
    refundTotal?: number;
    byCondition: Array<{ condition: string; count: number }>;
  };
  byPaymentMethod: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
  recentSales: SaleItem[];
}

/**
 * Format currency
 */
function formatDH(amount: number): string {
  return amount.toLocaleString('fr-MA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' DH';
}

/**
 * Format date
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format time
 */
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Translate payment method
 */
function translateMethod(method: string): string {
  const translations: Record<string, string> = {
    'CASH': 'Especes',
    'CARD': 'Carte',
    'MIXED': 'Mixte',
  };
  return translations[method] || method;
}

/**
 * Generate HTML for day report
 */
export function generateDayReportHTML(data: ReportData): string {
  const cashTotal = data.byPaymentMethod.find(p => p.method === 'CASH')?.amount || 0;
  const cardTotal = data.byPaymentMethod.find(p => p.method === 'CARD')?.amount || 0;
  const cashCount = data.byPaymentMethod.find(p => p.method === 'CASH')?.count || 0;
  const cardCount = data.byPaymentMethod.find(p => p.method === 'CARD')?.count || 0;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport du ${data.date} - ${data.storeName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #333;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #333;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .header h2 {
      font-size: 16px;
      color: #666;
      margin-bottom: 5px;
    }
    .header .date {
      font-size: 14px;
      color: #888;
    }
    .summary-cards {
      display: flex;
      gap: 15px;
      margin-bottom: 20px;
    }
    .card {
      flex: 1;
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
    }
    .card-label {
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .card-value {
      font-size: 20px;
      font-weight: bold;
      color: #333;
    }
    .card-value.green { color: #28a745; }
    .card-value.blue { color: #007bff; }
    .card-value.orange { color: #fd7e14; }
    .section {
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 14px;
      font-weight: bold;
      border-bottom: 1px solid #dee2e6;
      padding-bottom: 5px;
      margin-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid #dee2e6;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      color: #666;
    }
    td {
      font-size: 12px;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .totals-row {
      background: #f8f9fa;
      font-weight: bold;
    }
    .items-detail {
      font-size: 10px;
      color: #555;
      padding: 2px 10px 6px 20px;
      background: #fafafa;
      border-bottom: 1px solid #dee2e6;
    }
    .items-detail span {
      display: inline-block;
      margin-right: 14px;
    }
    .payment-breakdown {
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
    }
    .payment-box {
      flex: 1;
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 15px;
    }
    .payment-box h4 {
      font-size: 12px;
      color: #666;
      margin-bottom: 8px;
    }
    .payment-box .amount {
      font-size: 18px;
      font-weight: bold;
    }
    .payment-box .count {
      font-size: 11px;
      color: #888;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #dee2e6;
      text-align: center;
      font-size: 11px;
      color: #888;
    }
    @media print {
      @page {
        size: 80mm auto;
        margin: 3mm 2mm;
      }
      * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body {
        font-size: 10pt;
        max-width: 76mm;
        padding: 0;
        margin: 0;
      }
      .no-print { display: none; }

      /* Stack summary cards vertically */
      .summary-cards {
        flex-direction: column;
        gap: 4px;
        margin-bottom: 8px;
      }
      .card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 5px 8px;
        border-radius: 4px;
      }
      .card-label {
        font-size: 9pt;
        margin-bottom: 0;
      }
      .card-value {
        font-size: 13pt;
      }

      /* Stack payment boxes vertically */
      .payment-breakdown {
        flex-direction: column;
        gap: 4px;
        margin-bottom: 10px;
      }
      .payment-box {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 5px 8px;
        border-radius: 4px;
      }
      .payment-box h4 {
        font-size: 9pt;
        margin-bottom: 0;
      }
      .payment-box .amount {
        font-size: 12pt;
      }
      .payment-box .count {
        font-size: 8pt;
      }

      /* Table: readable on 80mm */
      th {
        font-size: 8pt;
        padding: 4px 3px;
      }
      td {
        font-size: 9pt;
        padding: 4px 3px;
      }
      .items-detail {
        font-size: 8pt;
        padding: 2px 4px 5px 10px;
      }
      .section-title {
        font-size: 11pt;
      }
      .header h1 {
        font-size: 16pt;
      }
      .header h2 {
        font-size: 11pt;
      }
      .header .date {
        font-size: 9pt;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>ATLAS DENIM</h1>
    <h2>${data.storeName}</h2>
    <p class="date">Rapport de vente du ${formatDate(data.date)}</p>
    ${data.cashierName ? `<p class="date">Caissier: ${data.cashierName}</p>` : ''}
  </div>

  <div class="summary-cards">
    <div class="card">
      <div class="card-label">Total Ventes</div>
      <div class="card-value green">${formatDH(data.sales.totalAmount)}</div>
    </div>
    <div class="card">
      <div class="card-label">Transactions</div>
      <div class="card-value blue">${data.sales.count}</div>
    </div>
    <div class="card">
      <div class="card-label">Retours</div>
      <div class="card-value orange">${data.returns.count}</div>
    </div>
  </div>

  <div class="payment-breakdown">
    <div class="payment-box">
      <h4>ESPECES</h4>
      <div class="amount">${formatDH(cashTotal)}</div>
      <div class="count">${cashCount} transaction(s)</div>
    </div>
    <div class="payment-box">
      <h4>CARTE</h4>
      <div class="amount">${formatDH(cardTotal)}</div>
      <div class="count">${cardCount} transaction(s)</div>
    </div>
  </div>

  <div class="section">
    <h3 class="section-title">Transactions du jour</h3>
    <table>
      <thead>
        <tr>
          <th>Heure</th>
          <th>Ticket</th>
          <th class="text-center">Articles</th>
          <th>Paiement</th>
          <th class="text-right">Montant</th>
          <th>Vendeur</th>
        </tr>
      </thead>
      <tbody>
        ${data.recentSales.map(sale => {
          const itemsDetail = sale.items && sale.items.length > 0
            ? sale.items.map(item => {
                const sizeLabel = item.size && item.length
                  ? `T${item.size}/L${item.length}`
                  : item.size || '';
                return `<span>• ${item.productName}${sizeLabel ? ' <b>' + sizeLabel + '</b>' : ''} ×${item.quantity}</span>`;
              }).join('')
            : '';
          return `
        <tr>
          <td>${formatTime(sale.createdAt)}</td>
          <td>${sale.saleNumber}</td>
          <td class="text-center">${sale.itemCount}</td>
          <td>${translateMethod(sale.paymentMethod)}</td>
          <td class="text-right">${formatDH(sale.totalAmount)}</td>
          <td>${data.storeName}</td>
        </tr>
        ${itemsDetail ? `<tr><td colspan="6" class="items-detail">${itemsDetail}</td></tr>` : ''}`;
        }).join('')}
        <tr class="totals-row">
          <td colspan="4">TOTAL</td>
          <td class="text-right">${formatDH(data.sales.totalAmount)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>

  ${data.returns.count > 0 ? `
  <div class="section">
    <h3 class="section-title">Retours</h3>
    <table>
      <thead>
        <tr>
          <th>Condition</th>
          <th class="text-right">Nombre</th>
        </tr>
      </thead>
      <tbody>
        ${data.returns.byCondition.map(r => `
        <tr>
          <td>${r.condition === 'RESTOCKABLE' ? 'Restockable' : 'Defectueux'}</td>
          <td class="text-right">${r.count}</td>
        </tr>
        `).join('')}
        ${(data.returns.refundTotal ?? 0) > 0 ? `
        <tr class="totals-row">
          <td>Total rembourse</td>
          <td class="text-right" style="color:#dc3545">${formatDH(data.returns.refundTotal ?? 0)}</td>
        </tr>
        ` : ''}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="footer">
    <p>Rapport genere le ${new Date().toLocaleString('fr-FR')}</p>
    <p>ATLAS DENIM - Systeme de caisse</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Open print dialog with day report
 */
export function printDayReport(data: ReportData): void {
  const html = generateDayReportHTML(data);

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
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('[PRINTER] rapport print error:', e);
    }
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 3000);
  };

  iframe.onload = () => triggerPrint();
  setTimeout(() => { if (!printed) triggerPrint(); }, 500);
}

/**
 * Download report as PDF (uses browser print to PDF)
 */
export function downloadDayReportPDF(data: ReportData): void {
  const html = generateDayReportHTML(data);
  const printWindow = window.open('', '_blank', 'width=900,height=700');

  if (!printWindow) {
    alert('Impossible d\'ouvrir la fenetre. Verifiez les bloqueurs de popup.');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  // Show instruction
  setTimeout(() => {
    printWindow.print();
    // User can select "Save as PDF" in print dialog
  }, 250);
}

export type { ReportData, SaleItem };
