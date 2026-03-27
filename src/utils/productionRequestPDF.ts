import jsPDF from 'jspdf';

interface ProductionRequest {
  id: string;
  requestNumber: string;
  title: string;
  status: string;
  notes: string;
  dueDate: string | null;
  estimatedQuantity: number | null;
  destinationStore: { id: string; name: string; address: string } | null;
  createdBy: { id: string; fullName: string; email: string };
  reviewedBy?: { id: string; fullName: string; email: string };
  items: any[];
  createdAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  shipment: any | null;
}

const STATUS_LABELS: Record<string, { label: string; r: number; g: number; b: number }> = {
  PENDING:            { label: 'En attente',      r: 245, g: 158, b: 11  },
  ACCEPTED:           { label: 'Acceptée',         r: 59,  g: 130, b: 246 },
  REJECTED:           { label: 'Rejetée',          r: 239, g: 68,  b: 68  },
  IN_PRODUCTION:      { label: 'En production',    r: 168, g: 85,  b: 247 },
  QUALITY_CHECK:      { label: 'Contrôle qualité', r: 20,  g: 184, b: 166 },
  COMPLETED:          { label: 'Terminée',         r: 34,  g: 197, b: 94  },
  SHIPPED:            { label: 'Expédiée',         r: 249, g: 115, b: 22  },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-MA', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

export function generateProductionRequestPDF(request: ProductionRequest): void {
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
  doc.setTextColor(148, 163, 184);
  doc.text('Bon de Production', MARGIN, 17);

  // Request number (right side)
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const reqLabel = `DEMANDE ${request.requestNumber}`;
  const reqLabelW = doc.getTextWidth(reqLabel);
  doc.text(reqLabel, PAGE_W - MARGIN - reqLabelW, 11);

  // Date (right side)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  const dateStr = formatDate(request.createdAt);
  const dateW = doc.getTextWidth(dateStr);
  doc.text(dateStr, PAGE_W - MARGIN - dateW, 17);

  // Accent line
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 28, PAGE_W, 1.2, 'F');

  y = 38;

  // ─── Info block ───────────────────────────────────────────────────────────
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  const infoBoxH = request.notes ? 32 : 26;
  doc.roundedRect(MARGIN, y, CONTENT_W, infoBoxH, 2, 2, 'FD');

  // Status badge (top-right of info block)
  const statusInfo = STATUS_LABELS[request.status] || { label: request.status, r: 100, g: 116, b: 139 };
  const badgeLabel = statusInfo.label;
  const badgeW = doc.getTextWidth(badgeLabel) + 8;
  doc.setFillColor(statusInfo.r, statusInfo.g, statusInfo.b);
  doc.roundedRect(PAGE_W - MARGIN - badgeW - 2, y + 4, badgeW, 6.5, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(badgeLabel, PAGE_W - MARGIN - badgeW / 2 - 2, y + 8.8, { align: 'center' });

  // Title
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TITRE', MARGIN + 5, y + 8);
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(request.title || '—', MARGIN + 5, y + 14);

  // Store
  const storeName = request.destinationStore?.name || 'Non défini';
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('MAGASIN', MARGIN + 70, y + 8);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(storeName, MARGIN + 70, y + 14);

  // Due date
  if (request.dueDate) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('DATE LIMITE', MARGIN + 130, y + 8);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(formatDate(request.dueDate), MARGIN + 130, y + 14);
  }

  // Créé par / Validé par
  let metaY = y + 20;
  const metaParts: string[] = [];
  if (request.createdBy?.fullName) metaParts.push(`Créé par: ${request.createdBy.fullName}`);
  if (request.reviewedBy?.fullName) metaParts.push(`Validé par: ${request.reviewedBy.fullName}`);
  if (metaParts.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(metaParts.join('    ·    '), MARGIN + 5, metaY);
    metaY += 6;
  }

  // Notes
  if (request.notes) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    const notesLabel = `Notes: ${request.notes}`;
    const maxW = CONTENT_W - 10;
    let displayNotes = notesLabel;
    while (doc.getTextWidth(displayNotes) > maxW && displayNotes.length > 8) {
      displayNotes = displayNotes.slice(0, -1);
    }
    if (displayNotes !== notesLabel) displayNotes += '…';
    doc.text(displayNotes, MARGIN + 5, metaY);
  }

  y += infoBoxH + 8;

  // ─── Items Table ──────────────────────────────────────────────────────────
  const COL_PRODUCT = 75;
  const COL_VAR     = 45;
  const COL_CODE    = 40;
  const COL_QTY     = CONTENT_W - COL_PRODUCT - COL_VAR - COL_CODE;

  // Table header
  doc.setFillColor(15, 23, 42);
  doc.rect(MARGIN, y, CONTENT_W, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('PRODUIT',    MARGIN + 4,                              y + 5.5);
  doc.text('VARIATION',  MARGIN + COL_PRODUCT + 4,               y + 5.5);
  doc.text('CODE',       MARGIN + COL_PRODUCT + COL_VAR + 4,     y + 5.5);
  doc.text('QTÉ',        MARGIN + COL_PRODUCT + COL_VAR + COL_CODE + COL_QTY / 2, y + 5.5, { align: 'center' });

  y += 8;

  // Group items by product name
  const grouped: Record<string, any[]> = {};
  for (const item of request.items) {
    const name = item.product?.name || 'Produit inconnu';
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push(item);
  }

  let rowIdx = 0;
  let totalQty = 0;

  for (const [productName, items] of Object.entries(grouped)) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const qty: number = item.quantityRequested || 0;
      totalQty += qty;

      if (y > PAGE_H - 25) {
        doc.addPage();
        y = 16;
      }

      const isEven = rowIdx % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.setDrawColor(241, 245, 249);
      doc.rect(MARGIN, y, CONTENT_W, 7.5, 'FD');

      // Product name (first row only)
      if (i === 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        let displayName = productName;
        const maxW = COL_PRODUCT - 8;
        while (doc.getTextWidth(displayName) > maxW && displayName.length > 4) {
          displayName = displayName.slice(0, -1);
        }
        if (displayName !== productName) displayName += '…';
        doc.text(displayName, MARGIN + 4, y + 5);
      }

      // Variation
      const variation = item.productVariation;
      const varLabel = variation
        ? (variation.length
            ? `T${variation.size} / L${variation.length}`
            : `Taille ${variation.size}`)
        : '—';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(varLabel, MARGIN + COL_PRODUCT + 4, y + 5);

      // Short code
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(variation?.shortCode || item.product?.shortCode || '—', MARGIN + COL_PRODUCT + COL_VAR + 4, y + 5);

      // Quantity
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(String(qty), MARGIN + COL_PRODUCT + COL_VAR + COL_CODE + COL_QTY / 2, y + 5, { align: 'center' });

      y += 7.5;
      rowIdx++;
    }

    // Divider between products
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
  }

  // ─── Total row ────────────────────────────────────────────────────────────
  if (y > PAGE_H - 20) { doc.addPage(); y = 16; }

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(MARGIN, y, CONTENT_W, 9, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL', MARGIN + 4, y + 6);
  doc.text(`${totalQty} unités`, MARGIN + COL_PRODUCT + COL_VAR + COL_CODE + COL_QTY / 2, y + 6, { align: 'center' });

  y += 9;

  // Rejection reason (if any)
  if (request.rejectionReason) {
    y += 6;
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(252, 165, 165);
    doc.roundedRect(MARGIN, y, CONTENT_W, 10, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(185, 28, 28);
    doc.text('Motif de rejet:', MARGIN + 4, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(request.rejectionReason, MARGIN + 30, y + 5);
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
  const fileName = `demande-${request.requestNumber}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
