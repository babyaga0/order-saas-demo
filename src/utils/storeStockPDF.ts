import jsPDF from 'jspdf';

interface Store {
  id: string;
  name: string;
  slug: string;
}

interface Variation {
  id: number;
  shortCode: string;
  size: string;
  length: string | null;
  stores: Record<string, number>;
}

interface StockProduct {
  productId: number;
  productName: string;
  shortCode: string;
  categories: string | null;
  variations: Variation[];
  storeStock?: Record<string, number>;
}

const CATEGORIES = [
  { value: 'jeans',       label: 'JEANS',       r: 59,  g: 130, b: 246 }, // blue-500
  { value: 'vestes',      label: 'VESTES',      r: 168, g: 85,  b: 247 }, // purple-500
  { value: 'ensembles',   label: 'ENSEMBLES',   r: 20,  g: 184, b: 166 }, // teal-500
  { value: 'accessoires', label: 'ACCESSOIRES', r: 245, g: 158, b: 11  }, // amber-500
];

function formatDate(): string {
  return new Date().toLocaleDateString('fr-MA', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
}

export function generateStoreStockPDF(store: Store, stock: StockProduct[]): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 14;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  let y = 0;

  // ─── Header Banner ────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, PAGE_W, 28, 'F');

  // Brand name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('ATLAS DENIM', MARGIN, 11);

  // Subtitle
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Rapport de stock', MARGIN, 17);

  // Store name (right side)
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const storeLabel = store.name.toUpperCase();
  const storeLabelW = doc.getTextWidth(storeLabel);
  doc.text(storeLabel, PAGE_W - MARGIN - storeLabelW, 11);

  // Date (right side)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  const dateStr = formatDate();
  const dateW = doc.getTextWidth(dateStr);
  doc.text(dateStr, PAGE_W - MARGIN - dateW, 17);

  // Thin accent line under header
  doc.setFillColor(59, 130, 246); // blue-500
  doc.rect(0, 28, PAGE_W, 1.2, 'F');

  y = 38;

  // ─── Summary bar ─────────────────────────────────────────────────────────
  const totalUnits = stock.reduce((sum, p) => {
    if (p.variations?.length > 0) {
      return sum + p.variations.reduce((s, v) => s + (v.stores[store.slug] || 0), 0);
    }
    return sum + (p.storeStock?.[store.slug] || 0);
  }, 0);

  const totalProducts = stock.length;

  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(MARGIN, y, CONTENT_W, 12, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.setFont('helvetica', 'normal');
  doc.text(`${totalProducts} produits`, MARGIN + 6, y + 7.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const unitsLabel = `${totalUnits.toLocaleString('fr-MA')} unités en stock`;
  const unitsW = doc.getTextWidth(unitsLabel);
  doc.text(unitsLabel, PAGE_W - MARGIN - 6 - unitsW, y + 7.5);

  y += 18;

  // ─── Categories loop ──────────────────────────────────────────────────────
  for (const cat of CATEGORIES) {
    const sortKey = (name: string) => name.replace(/\b\d+\b/g, '').replace(/\s+/g, ' ').trim();
    const products = stock
      .filter(p => p.categories === cat.value)
      .sort((a, b) => sortKey(a.productName).localeCompare(sortKey(b.productName)));
    if (products.length === 0) continue;

    // Check if we need a new page
    if (y > PAGE_H - 40) {
      doc.addPage();
      y = 16;
    }

    // Category header
    doc.setFillColor(cat.r, cat.g, cat.b);
    doc.roundedRect(MARGIN, y, CONTENT_W, 9, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(cat.label, MARGIN + 5, y + 6);

    // Category total
    const catTotal = products.reduce((sum, p) => {
      if (p.variations?.length > 0) {
        return sum + p.variations.reduce((s, v) => s + (v.stores[store.slug] || 0), 0);
      }
      return sum + (p.storeStock?.[store.slug] || 0);
    }, 0);
    const catTotalLabel = `${catTotal} unités`;
    const catTotalW = doc.getTextWidth(catTotalLabel);
    doc.text(catTotalLabel, MARGIN + CONTENT_W - 5 - catTotalW, y + 6);

    y += 12;

    // Table column widths
    const COL_PRODUCT = 70;
    const COL_VAR     = 38;
    const COL_CODE    = 40;
    const COL_STOCK   = CONTENT_W - COL_PRODUCT - COL_VAR - COL_CODE;

    // Table header row
    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(226, 232, 240);
    doc.rect(MARGIN, y, CONTENT_W, 7, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('PRODUIT',   MARGIN + 3,                              y + 4.8);
    doc.text('VARIATION', MARGIN + COL_PRODUCT + 3,               y + 4.8);
    doc.text('CODE',      MARGIN + COL_PRODUCT + COL_VAR + 3,     y + 4.8);
    doc.text('STOCK',     MARGIN + COL_PRODUCT + COL_VAR + COL_CODE + COL_STOCK / 2, y + 4.8, { align: 'center' });

    y += 7;

    // Rows
    let rowIdx = 0;
    for (const product of products) {
      const isAccessory = !product.variations || product.variations.length === 0;

      if (isAccessory) {
        const qty = product.storeStock?.[store.slug] || 0;

        if (y > PAGE_H - 20) { doc.addPage(); y = 16; }

        const rowBg = rowIdx % 2 === 0;
        if (rowBg) {
          doc.setFillColor(255, 255, 255);
        } else {
          doc.setFillColor(248, 250, 252);
        }
        doc.setDrawColor(241, 245, 249);
        doc.rect(MARGIN, y, CONTENT_W, 7.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        // Truncate long names
        const maxNameW = COL_PRODUCT - 6;
        let displayName = product.productName;
        while (doc.getTextWidth(displayName) > maxNameW && displayName.length > 4) {
          displayName = displayName.slice(0, -1);
        }
        if (displayName !== product.productName) displayName += '…';
        doc.text(displayName, MARGIN + 3, y + 5);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text('—', MARGIN + COL_PRODUCT + 3, y + 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(product.shortCode || '', MARGIN + COL_PRODUCT + COL_VAR + 3, y + 5);

        // Stock number
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(String(qty), MARGIN + COL_PRODUCT + COL_VAR + COL_CODE + COL_STOCK / 2, y + 5, { align: 'center' });

        y += 7.5;
        rowIdx++;
        continue;
      }

      // Products with variations — group rows under product name
      const firstVarIdx = product.variations.findIndex(v => (v.stores[store.slug] || 0) >= 0);

      for (let vi = 0; vi < product.variations.length; vi++) {
        const variation = product.variations[vi];
        const qty = variation.stores[store.slug] || 0;

        if (y > PAGE_H - 20) { doc.addPage(); y = 16; }

        const rowBg = rowIdx % 2 === 0;
        if (rowBg) {
          doc.setFillColor(255, 255, 255);
        } else {
          doc.setFillColor(248, 250, 252);
        }
        doc.setDrawColor(241, 245, 249);
        doc.rect(MARGIN, y, CONTENT_W, 7, 'FD');

        // Product name on first row only
        if (vi === 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(15, 23, 42);
          let displayName = product.productName;
          const maxNameW = COL_PRODUCT - 6;
          while (doc.getTextWidth(displayName) > maxNameW && displayName.length > 4) {
            displayName = displayName.slice(0, -1);
          }
          if (displayName !== product.productName) displayName += '…';
          doc.text(displayName, MARGIN + 3, y + 4.8);
        }

        // Variation label
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105); // slate-600
        const varLabel = variation.length
          ? `T${variation.size} / L${variation.length}`
          : `Taille ${variation.size}`;
        doc.text(varLabel, MARGIN + COL_PRODUCT + 3, y + 4.8);

        // Short code
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(variation.shortCode || '', MARGIN + COL_PRODUCT + COL_VAR + 3, y + 4.8);

        // Stock number
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(String(qty), MARGIN + COL_PRODUCT + COL_VAR + COL_CODE + COL_STOCK / 2, y + 4.8, { align: 'center' });

        y += 7;
        rowIdx++;
      }

      // Subtle divider between products
      doc.setDrawColor(226, 232, 240);
      doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
    }

    y += 8;
  }

  // ─── Footer on every page ─────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('ATLAS DENIM — Confidentiel', MARGIN, PAGE_H - 7);
    const pageLabel = `Page ${i} / ${totalPages}`;
    const pageLabelW = doc.getTextWidth(pageLabel);
    doc.text(pageLabel, PAGE_W - MARGIN - pageLabelW, PAGE_H - 7);
  }

  // ─── Save ─────────────────────────────────────────────────────────────────
  const fileName = `stock-${store.slug}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

