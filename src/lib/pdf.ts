import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PdfOptions {
  title: string;
  filters?: { label: string; value: string }[];
  columns: string[];
  rows: (string | number)[][];
  fileName: string;
  landscape?: boolean;
  summaryRows?: { label: string; value: string }[];
}

const BRAND = {
  name: 'RAJ & BROTHERS',
  tagline: 'Rice Bran Filtration & Processing',
};

let cachedLogo: string | null = null;

async function loadLogo(): Promise<string | null> {
  if (cachedLogo !== null) return cachedLogo;
  try {
    const resp = await fetch('/Logo_(3).png');
    if (!resp.ok) throw new Error('logo fetch failed');
    const blob = await resp.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    cachedLogo = dataUrl;
    return dataUrl;
  } catch {
    cachedLogo = '';
    return null;
  }
}

async function buildDoc(opts: PdfOptions): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: opts.landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  const logo = await loadLogo();
  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, y, 22, 22); } catch { /* ignore */ }
  } else {
    doc.setFillColor(16, 43, 27);
    doc.roundedRect(margin, y, 22, 22, 3, 3, 'F');
    doc.setTextColor(232, 180, 74);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('R&B', margin + 11, y + 14, { align: 'center' });
  }

  doc.setTextColor(16, 43, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(BRAND.name, margin + 26, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(BRAND.tagline, margin + 26, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(212, 154, 42);
  doc.text(opts.title.toUpperCase(), margin + 26, y + 21);
  y += 28;

  if (opts.filters && opts.filters.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    const filterText = opts.filters.map((f) => `${f.label}: ${f.value}`).join('    |    ');
    const wrapped = doc.splitTextToSize(filterText, pageWidth - margin * 2);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5 + 2;
  }

  y += 2;
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  autoTable(doc, {
    head: [opts.columns],
    body: opts.rows.map((r) => r.map((c) => String(c))),
    startY: y,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [16, 43, 27], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 247, 240] },
    didDrawPage: () => {
      const pageNum = doc.getNumberOfPages();
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB').replace(/\//g, '-');
      const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(107, 114, 128);
      doc.text(`Generated on: ${dateStr} ${timeStr} | Raj & Brothers ERP | Page ${pageNum}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    },
  });

  let afterY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  if (opts.summaryRows && opts.summaryRows.length > 0) {
    if (afterY > pageHeight - 30) { doc.addPage(); afterY = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(16, 43, 27);
    for (const s of opts.summaryRows) {
      doc.text(s.label, pageWidth - margin - 60, afterY);
      doc.text(s.value, pageWidth - margin, afterY, { align: 'right' });
      afterY += 6;
    }
  }

  return doc;
}

export async function generatePdfReport(opts: PdfOptions) {
  const doc = await buildDoc(opts);
  doc.save(opts.fileName);
}

export async function printReport(opts: PdfOptions) {
  const doc = await buildDoc(opts);
  doc.autoPrint();
  const url = doc.output('bloburl');
  window.open(url, '_blank');
}
