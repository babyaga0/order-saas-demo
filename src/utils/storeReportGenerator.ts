/**
 * Store Performance Report Generator
 * Generates PDF-ready HTML for admin store performance reports
 */

interface StockAlert {
  productName: string;
  variationName?: string | null;
  quantity: number;
}

interface SaleItem {
  id: string;
  saleNumber: string;
  totalAmount: number;
  paymentMethod: string;
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

interface StoreReportData {
  storeName: string;
  period: {
    startDate: string;
    endDate: string;
  };
  sales: {
    count: number;
    totalAmount: number;
    totalDiscount: number;
    avgBasket: number;
  };
  returns: {
    count: number;
    byCondition: Array<{ condition: string; count: number }>;
    magasinCount?: number;
    cathedisCount?: number;
  };
  byPaymentMethod: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
  topProducts: Array<{
    productName: string;
    quantity: number;
    revenue: number;
  }>;
  recentSales: SaleItem[];
  stockAlerts?: StockAlert[];
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
 * Format date range
 */
function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const end = new Date(endDate).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `${start} - ${end}`;
}

/**
 * Format datetime
 */
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
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
 * Generate HTML for store performance report
 */
export function generateStoreReportHTML(data: StoreReportData): string {
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
  <title>Rapport Performance - ${data.storeName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #333;
      padding: 20px;
      max-width: 900px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #f97316;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: bold;
      color: #f97316;
      margin-bottom: 5px;
    }
    .header h2 {
      font-size: 18px;
      color: #333;
      margin-bottom: 5px;
    }
    .header .period {
      font-size: 14px;
      color: #666;
      margin-top: 10px;
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .card {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    .card-label {
      font-size: 10px;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .card-value {
      font-size: 18px;
      font-weight: bold;
      color: #333;
    }
    .card-value.green { color: #16a34a; }
    .card-value.blue { color: #2563eb; }
    .card-value.orange { color: #f97316; }
    .card-value.purple { color: #9333ea; }
    .card-sub {
      font-size: 9px;
      color: #888;
      margin-top: 2px;
    }
    .section {
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 13px;
      font-weight: bold;
      background: #f97316;
      color: white;
      padding: 8px 12px;
      border-radius: 4px 4px 0 0;
      margin-bottom: 0;
    }
    .section-content {
      border: 1px solid #dee2e6;
      border-top: none;
      border-radius: 0 0 4px 4px;
      padding: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 6px 8px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      color: #666;
    }
    td {
      font-size: 11px;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .two-columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    .payment-box {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      padding: 12px;
    }
    .payment-box h4 {
      font-size: 11px;
      color: #666;
      margin-bottom: 6px;
    }
    .payment-box .amount {
      font-size: 16px;
      font-weight: bold;
    }
    .payment-box .count {
      font-size: 10px;
      color: #888;
    }
    .product-rank {
      display: inline-block;
      width: 20px;
      height: 20px;
      background: #fed7aa;
      border-radius: 50%;
      text-align: center;
      line-height: 20px;
      font-size: 10px;
      font-weight: bold;
      color: #f97316;
      margin-right: 8px;
    }
    .alert-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 500;
    }
    .alert-badge.rupture {
      background: #fee2e2;
      color: #dc2626;
    }
    .alert-badge.low {
      background: #fef9c3;
      color: #ca8a04;
    }
    .items-detail {
      font-size: 10px;
      color: #555;
      padding: 2px 8px 6px 18px;
      background: #fafafa;
      border-bottom: 1px solid #eee;
    }
    .items-detail span {
      display: inline-block;
      margin-right: 14px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #dee2e6;
      text-align: center;
      font-size: 10px;
      color: #888;
    }
    @media print {
      body {
        padding: 10px;
      }
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>ATLAS DENIM</h1>
    <h2>${data.storeName}</h2>
    <p class="period">Rapport de performance: ${formatDateRange(data.period.startDate, data.period.endDate)}</p>
  </div>

  <div class="summary-cards">
    <div class="card">
      <div class="card-label">Chiffre d'Affaires</div>
      <div class="card-value green">${formatDH(data.sales.totalAmount)}</div>
      <div class="card-sub">${data.sales.count} ventes</div>
    </div>
    <div class="card">
      <div class="card-label">Panier Moyen</div>
      <div class="card-value blue">${formatDH(data.sales.avgBasket)}</div>
      <div class="card-sub">par transaction</div>
    </div>
    <div class="card">
      <div class="card-label">Retours Magasin</div>
      <div class="card-value orange">${data.returns.magasinCount ?? data.returns.count}</div>
      <div class="card-sub">${data.returns.byCondition.find(r => r.condition === 'RESTOCKABLE')?.count || 0} restockable</div>
    </div>
    <div class="card">
      <div class="card-label">Retours Cathedis</div>
      <div class="card-value orange">${data.returns.cathedisCount ?? 0}</div>
      <div class="card-sub">colis retournés</div>
    </div>
    <div class="card">
      <div class="card-label">Remises</div>
      <div class="card-value purple">${formatDH(data.sales.totalDiscount)}</div>
      <div class="card-sub">total accordees</div>
    </div>
  </div>

  <div class="two-columns">
    <div class="section">
      <h3 class="section-title">Modes de Paiement</h3>
      <div class="section-content">
        <div class="payment-box" style="margin-bottom: 10px;">
          <h4>ESPECES</h4>
          <div class="amount" style="color: #16a34a;">${formatDH(cashTotal)}</div>
          <div class="count">${cashCount} transaction(s)</div>
        </div>
        <div class="payment-box">
          <h4>CARTE</h4>
          <div class="amount" style="color: #2563eb;">${formatDH(cardTotal)}</div>
          <div class="count">${cardCount} transaction(s)</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h3 class="section-title">Top Produits</h3>
      <div class="section-content">
        ${data.topProducts.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th class="text-center">Qte</th>
              <th class="text-right">CA</th>
            </tr>
          </thead>
          <tbody>
            ${data.topProducts.slice(0, 5).map((p, idx) => `
            <tr>
              <td><span class="product-rank">${idx + 1}</span>${p.productName.substring(0, 25)}</td>
              <td class="text-center">${p.quantity}</td>
              <td class="text-right">${formatDH(p.revenue)}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
        ` : '<p style="text-align: center; color: #888; padding: 20px;">Aucun produit vendu</p>'}
      </div>
    </div>
  </div>

  ${data.stockAlerts && data.stockAlerts.length > 0 ? `
  <div class="section">
    <h3 class="section-title">Alertes Stock (${data.stockAlerts.length})</h3>
    <div class="section-content">
      <table>
        <thead>
          <tr>
            <th>Produit</th>
            <th>Variation</th>
            <th class="text-right">Stock</th>
          </tr>
        </thead>
        <tbody>
          ${data.stockAlerts.map(alert => `
          <tr>
            <td>${alert.productName}</td>
            <td>${alert.variationName || '-'}</td>
            <td class="text-right">
              <span class="alert-badge ${alert.quantity === 0 ? 'rupture' : 'low'}">
                ${alert.quantity === 0 ? 'Rupture' : alert.quantity + ' pcs'}
              </span>
            </td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
  ` : ''}

  <div class="section">
    <h3 class="section-title">Transactions (${data.recentSales.length})</h3>
    <div class="section-content">
      ${data.recentSales.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>Date</th>
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
            <td>${formatDateTime(sale.createdAt)}</td>
            <td>${sale.saleNumber}</td>
            <td class="text-center">${sale.itemCount}</td>
            <td>${translateMethod(sale.paymentMethod)}</td>
            <td class="text-right">${formatDH(sale.totalAmount)}</td>
            <td>${data.storeName}</td>
          </tr>
          ${itemsDetail ? `<tr><td colspan="6" class="items-detail">${itemsDetail}</td></tr>` : ''}`;
          }).join('')}
        </tbody>
      </table>
      ` : '<p style="text-align: center; color: #888; padding: 20px;">Aucune vente pour cette periode</p>'}
    </div>
  </div>

  <div class="footer">
    <p>Rapport genere le ${new Date().toLocaleString('fr-FR')}</p>
    <p>ATLAS DENIM - Systeme de gestion</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Open print dialog with store report
 */
export function printStoreReport(data: StoreReportData): void {
  const html = generateStoreReportHTML(data);
  const printWindow = window.open('', '_blank', 'width=1000,height=800');

  if (!printWindow) {
    alert('Impossible d\'ouvrir la fenetre d\'impression. Verifiez les bloqueurs de popup.');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  // Wait for content to load, then print
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

export type { StoreReportData, SaleItem, StockAlert };
