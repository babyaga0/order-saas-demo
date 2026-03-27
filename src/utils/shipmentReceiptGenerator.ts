import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF type for autoTable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

interface ShipmentItem {
  id: string;
  productId: number;
  productVariationId: number | null;
  quantityRequested: number | null;
  quantityExpected: number;
  quantityReceived: number | null;
  notes: string | null;
  product: {
    id: number;
    name: string;
    shortCode: string;
    imageUrl: string | null;
    price: number | string;
  };
  productVariation: {
    id: number;
    size: string;
    length: string;
    shortCode: string;
  } | null;
}

interface Shipment {
  id: string;
  shipmentNumber: string;
  status: 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  fromLocation: string;
  notes: string | null;
  discrepancyNote: string | null;
  toStore: {
    id: string;
    name: string;
    address: string | null;
  };
  productionRequest: {
    id: string;
    requestNumber: string;
    title: string;
  } | null;
  items: ShipmentItem[];
  createdAt: string;
  confirmedAt: string | null;
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  confirmedBy: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

/**
 * Load and convert image to base64
 */
async function loadImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

/**
 * Generate Shipment Receipt/Invoice PDF (Bon de Livraison) - Modern Corporate Design
 */
export async function generateShipmentReceipt(shipment: Shipment) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const margin = 15;
  let yPos = 10;

  // === HEADER WITH BACKGROUND ===
  // Header background (light orange from brand colors)
  pdf.setFillColor(255, 245, 230); // Light orange
  pdf.rect(0, 0, pageWidth, 40, 'F');

  // Load and add logo
  try {
    const logoBase64 = await loadImageAsBase64('/logo-2.webp');
    const logoWidth = 12;
    const logoHeight = 6;
    yPos = 16;
    pdf.addImage(logoBase64, 'PNG', margin, yPos - 2, logoWidth, logoHeight);

    // Company Name with Brand Orange (positioned next to logo, matching size)
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(231, 136, 38); // Orange #E78826
    pdf.text('ATLAS DENIM', margin + logoWidth + 3, yPos + 2);
  } catch (error) {
    console.error('Logo loading error:', error);
    // Fallback: Just show company name without logo
    yPos = 18;
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(231, 136, 38); // Orange #E78826
    pdf.text('ATLAS DENIM', margin, yPos);
  }

  // Shipment Number (right side)
  yPos = 18;
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 0, 0);
  pdf.text(`N° ${shipment.shipmentNumber}`, pageWidth - margin, yPos, { align: 'right' });

  yPos = 35;

  // === MAIN TITLE ===
  pdf.setFillColor(245, 168, 110); // Softer Orange #F5A86E
  pdf.rect(margin, yPos, pageWidth - 2 * margin, 12, 'F');

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255); // White text
  pdf.text('BON DE LIVRAISON', pageWidth / 2, yPos + 8, { align: 'center' });

  yPos += 18;
  pdf.setTextColor(0, 0, 0); // Reset to black

  // === INFO CARDS ===
  const formattedDate = new Date(shipment.createdAt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  // Card 1: Date
  const cardWidth = 60;
  const cardHeight = 20;
  const cardSpacing = 3;

  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(margin, yPos, cardWidth, cardHeight, 2, 2, 'S');

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(100, 100, 100);
  pdf.text('DATE', margin + 3, yPos + 5);

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0);
  pdf.text(formattedDate, margin + 3, yPos + 11);

  // Card 2: Production Request
  if (shipment.productionRequest) {
    pdf.roundedRect(margin + cardWidth + cardSpacing, yPos, cardWidth, cardHeight, 2, 2, 'S');

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(100, 100, 100);
    pdf.text('DEMANDE', margin + cardWidth + cardSpacing + 3, yPos + 5);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    pdf.text(shipment.productionRequest.requestNumber, margin + cardWidth + cardSpacing + 3, yPos + 11);
  }

  // Card 3: Destination (full width below)
  yPos += cardHeight + 3;
  const destCardWidth = pageWidth - 2 * margin;
  pdf.roundedRect(margin, yPos, destCardWidth, cardHeight, 2, 2, 'S');

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(100, 100, 100);
  pdf.text('DESTINATION', margin + 3, yPos + 5);

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(245, 168, 110); // Softer Orange #F5A86E
  pdf.text(`Magasin ${shipment.toStore.name}`, margin + 3, yPos + 13);

  yPos += cardHeight + 10;
  pdf.setTextColor(0, 0, 0); // Reset

  // === PRODUCTS SECTION ===
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('ARTICLES EXPÉDIÉS', margin, yPos);

  yPos += 8;

  // === ITEMS TABLE ===
  // Group items by product
  const productGroups: { [key: string]: typeof shipment.items } = {};
  shipment.items.forEach(item => {
    const productCode = item.product.shortCode;
    if (!productGroups[productCode]) {
      productGroups[productCode] = [];
    }
    productGroups[productCode].push(item);
  });

  const tableData: any[] = [];

  Object.entries(productGroups).forEach(([productCode, items]) => {
    const firstItem = items[0];

    // Product header row
    tableData.push([
      { content: productCode, styles: { fontStyle: 'bold', fontSize: 9 } },
      { content: firstItem.product.name.toUpperCase(), colSpan: 2, styles: { fontStyle: 'bold', fontSize: 9 } },
      ''
    ]);

    // Items rows
    const hasRequestedData = items.some(i => i.quantityRequested != null);
    items.forEach(item => {
      const variation = item.productVariation
        ? `• Taille ${item.productVariation.size} / Longueur ${item.productVariation.length}`
        : '• Standard';

      const sizeLabel = item.productVariation
        ? `${item.productVariation.size}/${item.productVariation.length}`
        : '-';

      const diff = hasRequestedData && item.quantityRequested != null
        ? item.quantityExpected - item.quantityRequested : null;
      const diffStr = diff === null ? '' : diff === 0 ? '=' : diff > 0 ? `+${diff}` : `${diff}`;
      const diffColor: [number, number, number] = diff === null || diff === 0
        ? [100, 100, 100] : diff > 0 ? [234, 88, 12] : [220, 38, 38];

      tableData.push([
        '',
        { content: variation, styles: { fontSize: 8 } },
        { content: sizeLabel, styles: { halign: 'center', fontSize: 8 } },
        hasRequestedData
          ? { content: item.quantityRequested?.toString() ?? '-', styles: { halign: 'center', fontSize: 8 } }
          : { content: '', styles: {} },
        { content: item.quantityExpected.toString(), styles: { halign: 'center', fontStyle: 'bold' } },
        hasRequestedData
          ? { content: diffStr, styles: { halign: 'center', fontSize: 8, textColor: diffColor } }
          : { content: '', styles: {} },
      ]);
    });

    // Subtotal for this product
    const productTotal = items.reduce((sum, item) => sum + item.quantityExpected, 0);
    const requestedTotal = items.reduce((sum, item) => sum + (item.quantityRequested ?? 0), 0);
    const hasReq = items.some(i => i.quantityRequested != null);
    tableData.push([
      '',
      { content: 'Sous-total:', styles: { halign: 'right', fontStyle: 'bold', fontSize: 9 } },
      '',
      hasReq ? { content: requestedTotal.toString(), styles: { halign: 'center', fontStyle: 'bold', fontSize: 9 } } : '',
      { content: productTotal.toString(), styles: { halign: 'center', fontStyle: 'bold', fontSize: 9 } },
      '',
    ]);
  });

  const hasRequestedAny = shipment.items.some(i => i.quantityRequested != null);

  // Calculate grand total
  const grandTotal = shipment.items.reduce((sum, item) => sum + item.quantityExpected, 0);

  autoTable(pdf, {
    startY: yPos,
    head: [[
      { content: 'Réf. Produit', styles: { halign: 'left', fontStyle: 'bold' } },
      { content: 'Désignation', styles: { halign: 'left', fontStyle: 'bold' } },
      { content: 'Taille', styles: { halign: 'center', fontStyle: 'bold' } },
      ...(hasRequestedAny ? [{ content: 'Demandé', styles: { halign: 'center' as const, fontStyle: 'bold' as const } }] : []),
      { content: 'Expédié', styles: { halign: 'center', fontStyle: 'bold' } },
      ...(hasRequestedAny ? [{ content: 'Diff.', styles: { halign: 'center' as const, fontStyle: 'bold' as const } }] : []),
    ]],
    body: tableData,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: [200, 200, 200],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontSize: 9,
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250]
    },
    margin: { left: margin, right: margin }
  });

  yPos = pdf.lastAutoTable.finalY + 5;

  // === GRAND TOTAL BAR ===
  pdf.setFillColor(245, 168, 110); // Softer Orange #F5A86E
  pdf.rect(margin, yPos, pageWidth - 2 * margin, 14, 'F');

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255); // White text
  pdf.text('TOTAL GÉNÉRAL:', margin + 5, yPos + 9);
  pdf.text(`${grandTotal} UNITÉS`, pageWidth - margin - 5, yPos + 9, { align: 'right' });

  yPos += 20;
  pdf.setTextColor(0, 0, 0); // Reset

  // === SIGNATURES ===
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SIGNATURES', margin, yPos);

  yPos += 8;

  const sigBoxWidth = 80;
  const sigBoxHeight = 40;
  const sigBoxSpacing = 10;

  // EXPÉDITEUR (left box)
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(margin, yPos, sigBoxWidth, sigBoxHeight, 2, 2, 'S');

  // Box header
  pdf.setFillColor(255, 245, 230); // Light orange
  pdf.roundedRect(margin, yPos, sigBoxWidth, 8, 2, 2, 'F');

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(245, 168, 110); // Softer Orange #F5A86E
  pdf.text('EXPÉDITEUR', margin + sigBoxWidth / 2, yPos + 6, { align: 'center' });

  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Factory Manager', margin + 3, yPos + 14);
  pdf.text(`Date: ${formattedDate}`, margin + 3, yPos + 20);
  pdf.text('Signature:', margin + 3, yPos + 26);

  // Signature line
  pdf.setDrawColor(150, 150, 150);
  pdf.setLineWidth(0.2);
  pdf.line(margin + 3, yPos + 36, margin + sigBoxWidth - 3, yPos + 36);

  // DESTINATAIRE (right box)
  const rightBoxX = margin + sigBoxWidth + sigBoxSpacing;
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(rightBoxX, yPos, sigBoxWidth, sigBoxHeight, 2, 2, 'S');

  // Box header
  pdf.setFillColor(255, 245, 230); // Light orange
  pdf.roundedRect(rightBoxX, yPos, sigBoxWidth, 8, 2, 2, 'F');

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(245, 168, 110); // Softer Orange #F5A86E
  pdf.text('DESTINATAIRE', rightBoxX + sigBoxWidth / 2, yPos + 6, { align: 'center' });

  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Magasin ${shipment.toStore.name}`, rightBoxX + 3, yPos + 14);
  pdf.text('Date: ___/___/______', rightBoxX + 3, yPos + 20);
  pdf.text('Signature & Cachet:', rightBoxX + 3, yPos + 26);

  // Signature line
  pdf.line(rightBoxX + 3, yPos + 36, rightBoxX + sigBoxWidth - 3, yPos + 36);

  yPos += sigBoxHeight + 8;

  // === FOOTER ===
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.3);
  pdf.line(margin, yPos, pageWidth - margin, yPos);

  yPos += 5;
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(80, 80, 80);
  pdf.text('Ce document doit être signé par les deux parties pour validation', pageWidth / 2, yPos, { align: 'center' });

  yPos += 8;
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(120, 120, 120);
  pdf.text('Document généré automatiquement - ATLAS DENIM', pageWidth / 2, yPos, { align: 'center' });
  yPos += 3;
  pdf.text('www.atlasdenim.ma', pageWidth / 2, yPos, { align: 'center' });

  pdf.setTextColor(0, 0, 0);

  // Save PDF
  pdf.save(`BON_LIVRAISON_${shipment.shipmentNumber}.pdf`);
}
