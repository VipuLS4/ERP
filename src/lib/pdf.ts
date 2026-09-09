import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabase';
import type { Customer, Product, Sale, Settings } from './types';

interface PdfOptions {
  title: string;
  filters?: { label: string; value: string }[];
  columns: string[];
  rows: (string | number)[][];
  fileName: string;
  landscape?: boolean;
  summaryRows?: { label: string; value: string }[];
}

export interface InvoicePdfOptions {
  sale: Sale;
  customer?: Customer | null;
  product?: Product | null;
  fileName?: string;
}

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

async function fetchSettings(): Promise<Settings | null> {
  const { data, error } = await supabase.from('settings').select('*').limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

function formatCurrency(value: number): string {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB');
}

async function drawHeader(doc: jsPDF, title: string, settings: Settings | null, logo: string | null): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

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

  const businessName = settings?.business_name || 'Business Name';
  const businessType = settings?.business_type || '';
  const address = settings?.address || '';
  const contact = [settings?.mobile, settings?.email].filter(Boolean).join(' | ');
  const gst = settings?.gst_number || 'GSTIN not configured';

  doc.setTextColor(16, 43, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(businessName, margin + 26, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(75, 85, 99);
  if (businessType) doc.text(businessType, margin + 26, y + 12);
  if (address) doc.text(doc.splitTextToSize(address, pageWidth - margin * 2 - 26), margin + 26, y + 17);
  if (contact) doc.text(contact, margin + 26, y + 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(16, 43, 27);
  doc.text(`GSTIN: ${gst}`, pageWidth - margin, y + 7, { align: 'right' });
  doc.setFontSize(13);
  doc.setTextColor(212, 154, 42);
  doc.text(title.toUpperCase(), pageWidth - margin, y + 19, { align: 'right' });

  y += 29;
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, y, pageWidth - margin, y);
  return y + 5;
}

function drawFooter(doc: jsPDF, settings: Settings | null): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const businessName = settings?.business_name || 'Business Name';
  const pageNum = doc.getNumberOfPages();
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB').replace(/\//g, '-');
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.text(`Generated on: ${dateStr} ${timeStr} | ${businessName} ERP | Page ${pageNum}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
}

async function buildDoc(opts: PdfOptions): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: opts.landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const [settings, logo] = await Promise.all([fetchSettings(), loadLogo()]);
  let y = await drawHeader(doc, opts.title, settings, logo);

  if (opts.filters && opts.filters.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    const filterText = opts.filters.map((f) => `${f.label}: ${f.value}`).join('    |    ');
    const wrapped = doc.splitTextToSize(filterText, pageWidth - margin * 2);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5 + 2;
  }

  autoTable(doc, {
    head: [opts.columns],
    body: opts.rows.map((r) => r.map((c) => String(c))),
    startY: y,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [16, 43, 27], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 247, 240] },
    didDrawPage: () => drawFooter(doc, settings),
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

function drawLabelValue(doc: jsPDF, label: string, value: string, x: number, y: number): void {
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'normal');
  doc.text(value, x + 25, y);
}

async function buildInvoiceDoc(opts: InvoicePdfOptions): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const settings = await fetchSettings();
  const logo = await loadLogo();
  const sale = opts.sale;
  const customer = opts.customer;
  const product = opts.product;
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = await drawHeader(doc, 'Tax Invoice', settings, logo);

  doc.setFontSize(9);
  drawLabelValue(doc, 'Invoice No:', sale.invoice_number, margin, y + 5);
  drawLabelValue(doc, 'Invoice Date:', formatDate(sale.sale_date), margin, y + 11);
  drawLabelValue(doc, 'Payment:', sale.payment_status || 'Outstanding', pageWidth - 78, y + 5);
  drawLabelValue(doc, 'Place of Supply:', sale.customer_state || 'Not specified', pageWidth - 78, y + 11);
  y += 21;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 27, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(16, 43, 27);
  doc.text('Bill To', margin + 5, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  doc.text(customer?.name || sale.customer_name || 'Walk-in Customer', margin + 5, y + 13);
  doc.text(customer?.address || sale.customer_address || '-', margin + 5, y + 18);
  doc.text([customer?.mobile || sale.customer_mobile, customer?.state || sale.customer_state].filter(Boolean).join(' | ') || '-', margin + 5, y + 23);
  y += 36;

  const taxableValue = Math.max(0, Number(sale.quantity_kg) * Number(sale.rate_per_kg) - Number(sale.discount || 0));
  const taxRate = Number(sale.tax_rate || 0);
  const taxRows: (string | number)[][] = [
    [product?.name || sale.product_name, product?.hsn_code || '-', Number(sale.quantity_kg).toLocaleString('en-IN'), formatCurrency(Number(sale.rate_per_kg)), formatCurrency(taxableValue)],
  ];
  autoTable(doc, {
    head: [['Product', 'HSN/SAC', 'Qty (Kg)', 'Rate', 'Taxable Value']],
    body: taxRows,
    startY: y,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [16, 43, 27], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 247, 240] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  const taxLabel = sale.is_inter_state ? 'IGST' : 'CGST';
  const taxAmount = Number(sale.tax_amount || 0);
  const taxBreakdown: (string | number)[][] = sale.is_inter_state
    ? [['IGST', `${taxRate.toFixed(2)}%`, formatCurrency(Number(sale.igst_amount || taxAmount))]]
    : [['CGST', `${(taxRate / 2).toFixed(2)}%`, formatCurrency(Number(sale.cgst_amount || taxAmount / 2))], ['SGST', `${(taxRate / 2).toFixed(2)}%`, formatCurrency(Number(sale.sgst_amount || taxAmount / 2))]];

  autoTable(doc, {
    head: [['Tax Type', 'Rate', 'Amount']],
    body: taxBreakdown,
    startY: y,
    margin: { left: pageWidth - margin - 85, right: margin },
    tableWidth: 85,
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [16, 43, 27], textColor: 255, fontStyle: 'bold' },
  });
  y = Math.max(y + 20, (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5);

  const totalsX = pageWidth - margin - 85;
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  const totalRows = [
    ['Taxable Value', formatCurrency(taxableValue)],
    ['Discount', formatCurrency(Number(sale.discount || 0))],
    [taxLabel, formatCurrency(taxAmount)],
    ['Total Invoice Value', formatCurrency(Number(sale.total_amount))],
    ['Received', formatCurrency(Number(sale.payment_received))],
    ['Balance Due', formatCurrency(Number(sale.outstanding_balance))],
  ];
  for (const [label, value] of totalRows) {
    doc.setFont('helvetica', label === 'Total Invoice Value' || label === 'Balance Due' ? 'bold' : 'normal');
    doc.text(label, totalsX, y);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    y += 5.5;
  }

  y += 8;
  doc.setDrawColor(209, 213, 219);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('This is a computer-generated invoice.', margin, y);
  doc.text('Authorized Signature', pageWidth - margin, y + 15, { align: 'right' });
  doc.line(pageWidth - margin - 42, y + 10, pageWidth - margin, y + 10);
  drawFooter(doc, settings);
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

export async function generateInvoicePdf(opts: InvoicePdfOptions): Promise<void> {
  const doc = await buildInvoiceDoc(opts);
  doc.save(opts.fileName || `${opts.sale.invoice_number || 'invoice'}.pdf`);
}

export async function printInvoice(opts: InvoicePdfOptions): Promise<void> {
  const doc = await buildInvoiceDoc(opts);
  doc.autoPrint();
  const url = doc.output('bloburl');
  window.open(url, '_blank');
}
