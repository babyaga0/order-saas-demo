import jsPDF from 'jspdf';
import bwipjs from 'bwip-js';

interface Variation {
  id: number;
  name: string;
  shortCode: string;
  barcode: string;
  size: string;
  length: string;
  price: string;
}

interface Product {
  id: number;
  name: string;
  shortCode?: string; // required for accessories (no variations)
  price: string;
  variations: Variation[];
}

// A single label entry — works for both variation-based and accessory products
interface LabelEntry {
  productName: string;
  code: string;       // shortCode to encode in the barcode
  sizeLabel: string;  // empty string for accessories
  price: string;
}

/**
 * Generate a real Code128 barcode as base64 PNG image.
 * Accepts a pre-created canvas so the caller can reuse ONE canvas
 * for thousands of barcodes — avoids accumulating canvas objects in memory.
 */
function generateBarcodeImage(code: string, canvas: HTMLCanvasElement): { dataUrl: string; aspectRatio: number } {
  bwipjs.toCanvas(canvas, {
    bcid: 'code128',
    text: code,
    scale: 4,
    height: 30,
    includetext: false,
  });
  return {
    dataUrl: canvas.toDataURL('image/png'),
    aspectRatio: canvas.width / canvas.height,
  };
}

/**
 * Generate PDF with barcode labels.
 * Label size: 50mm wide x 25mm tall (physical label).
 * Barcode: 44mm wide, height proportional (no stretching), capped at 9mm.
 *
 * Handles two product types:
 * - Products with variations (jeans, vestes, ensembles):
 *     one label per variation, shows T:size / L:length
 * - Accessories (no variations):
 *     one label per product using the product's own shortCode, no size line
 *
 * Memory strategy for large catalogs:
 * - ONE canvas element reused for every barcode (no accumulation)
 * - Browser yields every 50 pages so GC can run and UI stays responsive
 */
export async function generateBarcodePDF(products: Product[], filename: string = 'barcodes.pdf') {
  const W = 50; // label width in mm
  const H = 25; // label height in mm

  // Build a flat list of labels covering both variations and accessories
  const labels: LabelEntry[] = [];
  products.forEach(product => {
    if (product.variations.length === 0) {
      // Accessory — one label using the product's own shortCode
      const code = product.shortCode?.trim();
      if (code) {
        labels.push({ productName: product.name, code, sizeLabel: '', price: product.price });
      }
    } else {
      // Product with size/length variations
      product.variations.forEach(variation => {
        let sizeLabel = '';
        if (variation.size && variation.length) {
          sizeLabel = `T:${variation.size} / L:${variation.length}`;
        } else if (variation.size) {
          sizeLabel = variation.size;
        }
        labels.push({ productName: product.name, code: variation.shortCode, sizeLabel, price: product.price });
      });
    }
  });

  if (labels.length === 0) return;

  // ONE shared canvas — reused for every barcode, never accumulates
  const canvas = document.createElement('canvas');

  const pdf = new jsPDF({
    orientation: 'l',
    unit: 'mm',
    format: [H, W], // jsPDF landscape: [height, width]
  });

  for (let index = 0; index < labels.length; index++) {
    const { productName, code, sizeLabel, price } = labels[index];

    if (index > 0) pdf.addPage([H, W], 'l');

    // Yield to browser every 50 pages — lets GC run, keeps tab alive
    if (index > 0 && index % 50 === 0) {
      await new Promise<void>(r => setTimeout(r, 0));
    }

    const cx = W / 2;
    let y = 2;

    // Line 1: ATLAS DENIM
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.text('ATLAS DENIM', cx, y, { align: 'center' });
    y += 2.5;

    // Line 2: Product name (truncated)
    pdf.setFontSize(5);
    pdf.setFont('helvetica', 'normal');
    const name = productName.length > 40 ? productName.substring(0, 40) : productName;
    pdf.text(name, cx, y, { align: 'center' });
    y += 2;

    // Line 3: Size / Length (skipped for accessories)
    if (sizeLabel) {
      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'bold');
      pdf.text(sizeLabel, cx, y, { align: 'center' });
      y += 2;
    }

    // Line 4: Barcode
    try {
      const { dataUrl: barcodeImg, aspectRatio } = generateBarcodeImage(code, canvas);
      const bw = 44;
      const bh = Math.min(bw / aspectRatio, 9);
      pdf.addImage(barcodeImg, 'PNG', (W - bw) / 2, y, bw, bh);
      y += bh + 2.5;
    } catch (error) {
      console.error('Barcode error for code:', code, error);
      y += 12;
    }

    // Line 5: Short code
    pdf.setFontSize(5);
    pdf.setFont('courier', 'bold');
    pdf.text(code, cx, y, { align: 'center' });
    y += 3.5;

    // Line 6: Price
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${price} DH`, cx, y, { align: 'center' });
  }

  pdf.save(filename);
}

/**
 * Generate PDF for a single product (all its variations, or one label if accessory).
 */
export async function generateSingleProductBarcodePDF(product: Product) {
  const filename = `barcodes-${product.name.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
  await generateBarcodePDF([product], filename);
}
