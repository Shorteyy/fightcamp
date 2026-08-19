import type { ShoppingListCategory } from '../types/database';

// Approximates the app's dark-theme accent (oklch(0.58 0.2 25)) in RGB —
// jsPDF has no OKLCH support, so this is a print-friendly stand-in.
const ACCENT: [number, number, number] = [196, 68, 44];
const TEXT: [number, number, number] = [30, 26, 24];
const MUTED: [number, number, number] = [120, 112, 106];

// jsPDF pulls in html2canvas/DOMPurify (~370kB) it doesn't need for pure
// text/vector output — loaded on demand so it never touches the main bundle.
export async function downloadShoppingListPdf(planName: string, categories: ShoppingListCategory[]) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 60;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...TEXT);
  doc.text('FIGHT CAMP', marginX, y);
  y += 20;

  doc.setFontSize(16);
  doc.setTextColor(...ACCENT);
  doc.text(`Shopping List — ${planName}`, marginX, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, marginX, y);
  y += 26;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 40) {
      doc.addPage();
      y = 50;
    }
  };

  for (const cat of categories) {
    ensureSpace(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...ACCENT);
    doc.text(cat.category.toUpperCase(), marginX, y);
    y += 6;
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.75);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...TEXT);
    for (const item of cat.items) {
      ensureSpace(20);
      const boxSize = 9;
      doc.setDrawColor(...MUTED);
      doc.rect(marginX, y - boxSize + 2, boxSize, boxSize);
      doc.text(item.name, marginX + boxSize + 8, y);
      if (item.quantity) {
        const qtyWidth = doc.getTextWidth(item.quantity);
        doc.setTextColor(...MUTED);
        doc.text(item.quantity, pageWidth - marginX - qtyWidth, y);
        doc.setTextColor(...TEXT);
      }
      y += 18;
    }
    y += 10;
  }

  doc.save(`${planName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-shopping-list.pdf`);
}
