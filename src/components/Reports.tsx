import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Download, Printer } from 'lucide-react';
import { PageHeader, Badge, inputClass, buttonClass } from './ui/Common';
import { LoadingState, EmptyState } from './ui/States';
import { generatePdfReport, printReport } from '../lib/pdf';
import { useToast } from './ui/Toast';

interface Vendor { id: string; vendor_id: string; name: string; mobile: string | null; balance: number; opening_balance: number; }
interface Customer { id: string; customer_id: string; name: string; mobile: string | null; balance: number; opening_balance: number; }
interface Employee { id: string; employee_id: string; name: string; }

export const Reports = () => {
  const { toast } = useToast();
  const [reportType, setReportType] = useState('vendor-ledger');
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [reportData, setReportData] = useState<any>({});
  const [pdfLoading, setPdfLoading] = useState(false);

  const dateRange = useMemo(() => {
    const now = new Date();
    const start = new Date();
    switch (dateFilter) {
      case 'today': start.setHours(0, 0, 0, 0); break;
      case 'week': start.setDate(now.getDate() - 7); break;
      case 'month': start.setMonth(now.getMonth() - 1); break;
      case 'year': start.setFullYear(now.getFullYear() - 1); break;
      case 'all': start.setFullYear(2000); break;
    }
    return { start: customStart || start.toISOString().split('T')[0], end: customEnd || now.toISOString().split('T')[0] };
  }, [dateFilter, customStart, customEnd]);

  useEffect(() => { loadInitialData(); }, []);
  useEffect(() => { loadReportData(); }, [dateRange, reportType, selectedVendor, selectedEmployee, selectedMonth, selectedStatus]);

  const loadInitialData = async () => {
    try {
      const [vRes, cRes, eRes, pRes] = await Promise.all([
        supabase.from('vendors').select('*').order('name'),
        supabase.from('customers').select('*').order('name'),
        supabase.from('employees').select('*').order('name'),
        supabase.from('products').select('*'),
      ]);
      setVendors(vRes.data || []);
      setCustomers(cRes.data || []);
      setEmployees(eRes.data || []);
      setProducts(pRes.data || []);
    } catch (e) { console.error('Error loading initial data:', e); }
  };

  const loadReportData = async () => {
    setLoading(true);
    try {
      const { start, end } = dateRange;
      let data: any = {};

      if (reportType === 'vendor-ledger' || reportType === 'rice-bran-procurement') {
        let purchaseQuery = supabase.from('purchases').select('*, vendors(name, vendor_id)').gte('purchase_date', start).lte('purchase_date', end).order('purchase_date');
        if (selectedVendor) purchaseQuery = purchaseQuery.eq('vendor_id', selectedVendor);
        const [pRes, mrRes, txRes] = await Promise.all([purchaseQuery, supabase.from('material_receipts').select('*, vendors(name)').gte('receipt_date', start).lte('receipt_date', end).eq('vendor_id', selectedVendor || undefined).order('receipt_date'), selectedVendor ? supabase.from('vendor_transactions').select('*').eq('vendor_id', selectedVendor).order('transaction_date') : null]);
        data.purchases = pRes.data || [];
        data.materialReceipts = mrRes.data || [];
        data.vendorTransactions = txRes?.data || [];
      }

      if (reportType === 'raw-rice-bran-stock') {
        const mvRes = await supabase.from('stock_movements').select('*').eq('product_name', 'Rice Bran').gte('movement_date', start).lte('movement_date', end).order('movement_date');
        data.movements = mvRes.data || [];
        const stockRes = await supabase.from('stock').select('*').eq('product_name', 'Rice Bran').maybeSingle();
        data.currentStock = stockRes.data;
      }

      if (reportType === 'daily-production') {
        let prodQuery = supabase.from('production_batches').select('*').gte('batch_date', start).lte('batch_date', end).order('batch_date', { ascending: false });
        if (selectedStatus) prodQuery = prodQuery.eq('status', selectedStatus);
        const prodRes = await prodQuery;
        const batchIds = (prodRes.data || []).map(b => b.id);
        let outputs: any[] = [];
        if (batchIds.length > 0) {
          const outRes = await supabase.from('production_outputs').select('*').in('batch_id', batchIds);
          outputs = outRes.data || [];
        }
        data.production = prodRes.data || [];
        data.outputs = outputs;
      }

      if (reportType === 'finished-stock') {
        const [stRes, mvRes] = await Promise.all([supabase.from('stock').select('*, products!inner(product_type)'), supabase.from('stock_movements').select('*').gte('movement_date', start).lte('movement_date', end).order('movement_date')]);
        data.stock = (stRes.data || []).filter((s: any) => s.products?.product_type !== 'Raw Material' && s.products?.product_type !== 'Waste');
        data.movements = mvRes.data || [];
      }

      if (reportType === 'salary-report') {
        let salQuery = supabase.from('salary_payments').select('*').gte('payment_date', start).lte('payment_date', end).order('payment_date', { ascending: false });
        if (selectedEmployee) salQuery = salQuery.eq('employee_id', selectedEmployee);
        const salRes = await salQuery;
        let salaries = salRes.data || [];
        if (selectedMonth) salaries = salaries.filter(s => s.month_year === selectedMonth);
        data.salaries = salaries;
      }

      if (reportType === 'profit-summary' || reportType === 'sales-report' || reportType === 'expense-report') {
        const [sRes, pRes, eRes] = await Promise.all([
          supabase.from('sales').select('*').gte('sale_date', start).lte('sale_date', end).order('sale_date', { ascending: false }),
          supabase.from('purchases').select('*, vendors(name)').gte('purchase_date', start).lte('purchase_date', end).order('purchase_date', { ascending: false }),
          supabase.from('plant_expenses').select('*').gte('expense_date', start).lte('expense_date', end).order('expense_date', { ascending: false }),
        ]);
        data.sales = sRes.data || [];
        data.purchases = pRes.data || [];
        data.expenses = eRes.data || [];
      }

      setReportData(data);
    } catch (e) { console.error('Error loading report data:', e); }
    finally { setLoading(false); }
  };

  const fmtINR = (n: number) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const fmt = (n: number) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const getVendorName = () => vendors.find(v => v.id === selectedVendor)?.name || 'All Vendors';
  const getEmployeeName = () => employees.find(e => e.id === selectedEmployee)?.name || 'All Employees';

  const buildFilters = (): { label: string; value: string }[] => {
    const filters: { label: string; value: string }[] = [{ label: 'Period', value: `${dateRange.start} to ${dateRange.end}` }];
    if (selectedVendor) filters.push({ label: 'Vendor', value: getVendorName() });
    if (selectedEmployee) filters.push({ label: 'Employee', value: getEmployeeName() });
    if (selectedMonth) filters.push({ label: 'Month', value: selectedMonth });
    if (selectedStatus) filters.push({ label: 'Status', value: selectedStatus });
    return filters;
  };

  const handleDownloadPdf = async (config: { title: string; columns: string[]; rows: (string | number)[][]; fileName: string; landscape?: boolean; summaryRows?: { label: string; value: string }[] }) => {
    setPdfLoading(true);
    try {
      await generatePdfReport({ ...config, filters: buildFilters() });
      toast('PDF downloaded', 'success');
    } catch (e) { console.error('PDF error:', e); toast('Error generating PDF', 'error'); }
    finally { setPdfLoading(false); }
  };

  const handlePrint = async (config: { title: string; columns: string[]; rows: (string | number)[][]; fileName: string; landscape?: boolean; summaryRows?: { label: string; value: string }[] }) => {
    setPdfLoading(true);
    try {
      await printReport({ ...config, filters: buildFilters() });
    } catch (e) { console.error('Print error:', e); toast('Error printing', 'error'); }
    finally { setPdfLoading(false); }
  };

  const reportTypes = [
    { value: 'vendor-ledger', label: 'Individual Vendor Ledger' },
    { value: 'rice-bran-procurement', label: 'Rice Bran Procurement Report' },
    { value: 'raw-rice-bran-stock', label: 'Raw Rice Bran Stock Report' },
    { value: 'daily-production', label: 'Daily Production Report' },
    { value: 'finished-stock', label: 'Finished Stock Report' },
    { value: 'salary-report', label: 'Salary Report' },
    { value: 'profit-summary', label: 'Profit Summary' },
    { value: 'sales-report', label: 'Sales Report' },
    { value: 'expense-report', label: 'Expense Report' },
  ];

  const dateFilterButtons: { key: typeof dateFilter; label: string }[] = [
    { key: 'today', label: 'Today' }, { key: 'week', label: 'Week' }, { key: 'month', label: 'Month' }, { key: 'year', label: 'Year' }, { key: 'all', label: 'All' },
  ];

  const showVendorFilter = ['vendor-ledger', 'rice-bran-procurement'].includes(reportType);
  const showEmployeeFilter = reportType === 'salary-report';
  const showStatusFilter = reportType === 'daily-production';

  // Build report data for display and PDF
  const getReportConfig = (): { title: string; columns: string[]; rows: (string | number)[][]; fileName: string; landscape?: boolean; summaryRows?: { label: string; value: string }[] } => {
    switch (reportType) {
      case 'vendor-ledger': {
        const vendor = vendors.find(v => v.id === selectedVendor);
        const txns = reportData.vendorTransactions || [];
        const rows = txns.map((t: any) => [new Date(t.transaction_date).toLocaleDateString(), t.transaction_type, t.notes || '-', fmtINR(Number(t.debit)), fmtINR(Number(t.credit)), fmtINR(Number(t.balance))]);
        const totalPurchase = txns.filter((t: any) => t.transaction_type === 'Purchase').reduce((s: number, t: any) => s + Number(t.debit), 0);
        const totalPayment = txns.filter((t: any) => t.transaction_type === 'Payment').reduce((s: number, t: any) => s + Number(t.credit), 0);
        return {
          title: 'Vendor Ledger Report',
          columns: ['Date', 'Reference', 'Description', 'Purchase (Dr)', 'Payment (Cr)', 'Running Balance'],
          rows,
          fileName: `Raj_Brothers_Vendor_Ledger_${(vendor?.name || 'All').replace(/\s/g, '_')}.pdf`,
          summaryRows: [{ label: 'Opening Balance', value: fmtINR(Number(vendor?.opening_balance || 0)) }, { label: 'Total Purchase', value: fmtINR(totalPurchase) }, { label: 'Total Payment', value: fmtINR(totalPayment) }, { label: 'Closing Outstanding', value: fmtINR(Number(vendor?.balance || 0)) }],
        };
      }
      case 'rice-bran-procurement': {
        const receipts = reportData.materialReceipts || [];
        const rows = receipts.map((r: any) => [new Date(r.receipt_date).toLocaleDateString(), r.vendor_name || '-', r.receipt_number, r.number_of_bags || 0, fmt(Number(r.net_weight)), '-', '-']);
        const totalBags = receipts.reduce((s: number, r: any) => s + Number(r.number_of_bags || 0), 0);
        const totalKg = receipts.reduce((s: number, r: any) => s + Number(r.net_weight), 0);
        return {
          title: 'Rice Bran Procurement Report',
          columns: ['Date', 'Vendor', 'Reference', 'Bags', 'Rice Bran (Kg)', 'Rate', 'Total Value'],
          rows,
          fileName: 'Raj_Brothers_Rice_Bran_Procurement_Report.pdf',
          summaryRows: [{ label: 'Total Bags', value: String(totalBags) }, { label: 'Total Rice Bran Procured', value: `${fmt(totalKg)} Kg` }],
        };
      }
      case 'raw-rice-bran-stock': {
        const movements = reportData.movements || [];
        let runningBalance = 0;
        const rows = movements.map((m: any) => { runningBalance = Number(m.balance); return [new Date(m.movement_date).toLocaleDateString(), m.transaction_number || '-', m.transaction_type, Number(m.quantity_in) > 0 ? fmt(Number(m.quantity_in)) : '-', Number(m.quantity_out) > 0 ? fmt(Number(m.quantity_out)) : '-', fmt(runningBalance)]; });
        const totalIn = movements.reduce((s: number, m: any) => s + Number(m.quantity_in), 0);
        const totalOut = movements.reduce((s: number, m: any) => s + Number(m.quantity_out), 0);
        return {
          title: 'Raw Rice Bran Stock Report',
          columns: ['Date', 'Reference', 'Transaction', 'Qty In', 'Qty Out', 'Running Stock'],
          rows,
          fileName: 'Raj_Brothers_Raw_Rice_Bran_Stock_Report.pdf',
          summaryRows: [{ label: 'Total Received', value: `${fmt(totalIn)} Kg` }, { label: 'Total Used in Production', value: `${fmt(totalOut)} Kg` }, { label: 'Closing Stock', value: `${fmt(Number(reportData.currentStock?.current_stock_kg || 0))} Kg` }],
        };
      }
      case 'daily-production': {
        const batches = reportData.production || [];
        const outputs = reportData.outputs || [];
        const rows = batches.map((b: any) => {
          const batchOutputs = outputs.filter((o: any) => o.batch_id === b.id);
          const bran = batchOutputs.find((o: any) => o.product_name === 'Filtered Bran') || batchOutputs.find((o: any) => o.product_name?.includes('Bran'));
          const husk = batchOutputs.find((o: any) => o.product_name === 'Husk');
          const rice = batchOutputs.find((o: any) => o.product_name === 'Rice');
          const waste = batchOutputs.find((o: any) => o.is_waste);
          return [new Date(b.batch_date).toLocaleDateString(), b.batch_number, fmt(Number(b.input_quantity_kg)), bran ? fmt(Number(bran.output_quantity_kg)) : '-', husk ? fmt(Number(husk.output_quantity_kg)) : '-', rice ? fmt(Number(rice.output_quantity_kg)) : '-', waste ? fmt(Number(waste.output_quantity_kg)) : '-', b.status];
        });
        const totalInput = batches.reduce((s: number, b: any) => s + Number(b.input_quantity_kg), 0);
        const totalOutput = batches.reduce((s: number, b: any) => s + Number(b.total_output_kg), 0);
        const totalWaste = batches.reduce((s: number, b: any) => s + Number(b.waste_kg), 0);
        return {
          title: 'Daily Production Report',
          columns: ['Date', 'Batch', 'Rice Bran Input', 'Bran', 'Husk', 'Rice', 'Waste', 'Status'],
          rows,
          fileName: 'Raj_Brothers_Daily_Production_Report.pdf',
          landscape: true,
          summaryRows: [{ label: 'Total Input', value: `${fmt(totalInput)} Kg` }, { label: 'Total Output', value: `${fmt(totalOutput)} Kg` }, { label: 'Total Waste', value: `${fmt(totalWaste)} Kg` }],
        };
      }
      case 'finished-stock': {
        const stock = reportData.stock || [];
        const movements = reportData.movements || [];
        const rows = stock.map((s: any) => {
          const prodMovements = movements.filter((m: any) => m.product_name === s.product_name);
          const produced = prodMovements.filter((m: any) => m.transaction_type === 'Production').reduce((sum: number, m: any) => sum + Number(m.quantity_in), 0);
          const sold = prodMovements.filter((m: any) => m.transaction_type === 'Sale').reduce((sum: number, m: any) => sum + Number(m.quantity_out), 0);
          const adjusted = prodMovements.filter((m: any) => m.transaction_type === 'Stock Adjustment' || m.transaction_type === 'Sale Reversal').reduce((sum: number, m: any) => sum + Number(m.quantity_in) - Number(m.quantity_out), 0);
          return [s.product_name, fmt(Number(s.opening_stock_kg)), fmt(produced), fmt(sold), fmt(adjusted), fmt(Number(s.current_stock_kg))];
        });
        return {
          title: 'Finished Stock Report',
          columns: ['Product', 'Opening', 'Produced', 'Sold', 'Adjustment', 'Closing Stock'],
          rows,
          fileName: 'Raj_Brothers_Finished_Stock_Report.pdf',
          summaryRows: [{ label: 'Total Products', value: String(stock.length) }, { label: 'Total Closing Stock', value: `${fmt(stock.reduce((s: number, item: any) => s + Number(item.current_stock_kg), 0))} Kg` }],
        };
      }
      case 'salary-report': {
        const salaries = (reportData.salaries || []).filter((s: any) => s.net_salary > 0);
        const rows = salaries.map((s: any) => {
          const emp = employees.find(e => e.id === s.employee_id);
          return [emp ? emp.name : '-', s.month_year, fmtINR(Number(s.net_salary)), fmtINR(Number(s.amount_paid)), fmtINR(Number(s.balance))];
        });
        const totalNet = salaries.reduce((s: number, sal: any) => s + Number(sal.net_salary), 0);
        const totalReleased = salaries.reduce((s: number, sal: any) => s + Number(sal.amount_paid), 0);
        const totalBalance = salaries.reduce((s: number, sal: any) => s + Number(sal.balance), 0);
        return {
          title: 'Salary Report',
          columns: ['Employee', 'Salary Month', 'Net Salary', 'Released', 'Balance'],
          rows,
          fileName: 'Raj_Brothers_Salary_Report.pdf',
          summaryRows: [{ label: 'Total Net Salary', value: fmtINR(totalNet) }, { label: 'Total Released', value: fmtINR(totalReleased) }, { label: 'Total Balance', value: fmtINR(totalBalance) }],
        };
      }
      case 'profit-summary': {
        const totalSales = (reportData.sales || []).reduce((s: number, sl: any) => s + Number(sl.total_amount), 0);
        const totalPurchases = (reportData.purchases || []).reduce((s: number, p: any) => s + Number(p.total_amount), 0);
        const totalExpenses = (reportData.expenses || []).reduce((s: number, e: any) => s + Number(e.amount), 0);
        const netProfit = totalSales - totalPurchases - totalExpenses;
        return {
          title: 'Profit Summary Report',
          columns: ['Description', 'Amount'],
          rows: [['Total Sales Revenue', fmtINR(totalSales)], ['Total Purchase Cost', fmtINR(totalPurchases)], ['Total Plant Expenses', fmtINR(totalExpenses)], ['Estimated Profit', fmtINR(netProfit)]],
          fileName: 'Raj_Brothers_Profit_Summary.pdf',
          summaryRows: [{ label: 'Net Profit', value: fmtINR(netProfit) }],
        };
      }
      case 'sales-report': {
        const sales = reportData.sales || [];
        const rows = sales.map((s: any) => [s.invoice_number, new Date(s.sale_date).toLocaleDateString(), s.customer_name, s.product_name, fmt(Number(s.quantity_kg)), fmtINR(Number(s.total_amount)), fmtINR(Number(s.outstanding_balance))]);
        const totalSales = sales.reduce((s: number, sl: any) => s + Number(sl.total_amount), 0);
        return {
          title: 'Sales Report',
          columns: ['Invoice #', 'Date', 'Customer', 'Product', 'Qty (Kg)', 'Total', 'Outstanding'],
          rows,
          fileName: 'Raj_Brothers_Sales_Report.pdf',
          landscape: true,
          summaryRows: [{ label: 'Total Sales', value: fmtINR(totalSales) }],
        };
      }
      case 'expense-report': {
        const expenses = reportData.expenses || [];
        const rows = expenses.map((e: any) => [new Date(e.expense_date).toLocaleDateString(), e.expense_type, fmtINR(Number(e.amount)), e.notes || e.description || '-']);
        const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
        return {
          title: 'Expense Report',
          columns: ['Date', 'Type', 'Amount', 'Notes'],
          rows,
          fileName: 'Raj_Brothers_Expense_Report.pdf',
          summaryRows: [{ label: 'Total Expenses', value: fmtINR(totalExpenses) }],
        };
      }
      default: return { title: '', columns: [], rows: [], fileName: 'report.pdf' };
    }
  };

  const config = getReportConfig();

  return (
    <div>
      <PageHeader title="Reports" subtitle="Business intelligence and financial reports" />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Report Type</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)} className={inputClass + ' min-w-[200px]'}>
              {reportTypes.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Date Range</label>
            <div className="flex flex-wrap gap-1.5">
              {dateFilterButtons.map(btn => (
                <button key={btn.key} onClick={() => { setDateFilter(btn.key); setCustomStart(''); setCustomEnd(''); }} className={`px-3 py-2 text-xs font-medium rounded-lg transition ${dateFilter === btn.key && !customStart ? 'bg-forest-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{btn.label}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 items-end">
            <div><label className="block text-xs font-medium text-gray-500 mb-1.5">From</label><input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1.5">To</label><input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className={inputClass} /></div>
          </div>
          {showVendorFilter && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Vendor</label>
              <select value={selectedVendor} onChange={(e) => setSelectedVendor(e.target.value)} className={inputClass}>
                <option value="">All Vendors</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          )}
          {showEmployeeFilter && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Employee</label>
              <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className={inputClass}>
                <option value="">All Employees</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          )}
          {showStatusFilter && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
              <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className={inputClass}>
                <option value="">All Status</option>
                <option value="Draft">Draft</option>
                <option value="Started">Started</option>
                <option value="In Process">In Process</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => handleDownloadPdf(config)} disabled={pdfLoading || loading} className={buttonClass.primary + ' disabled:opacity-50'}><Download size={16} /> {pdfLoading ? 'Generating...' : 'Download PDF'}</button>
        <button onClick={() => handlePrint(config)} disabled={pdfLoading || loading} className={buttonClass.secondary + ' disabled:opacity-50'}><Printer size={16} /> Print Report</button>
      </div>

      {loading ? <LoadingState message="Loading report..." /> : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">{config.title}</h2>
            <FileText size={24} className="text-forest-600" />
          </div>
          {config.rows.length === 0 ? <EmptyState message="No data found for the selected filters" /> : (
            <>
              <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 flex flex-wrap gap-4">
                {buildFilters().map((f, i) => <span key={i}><strong>{f.label}:</strong> {f.value}</span>)}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr>
                    {config.columns.map((col, i) => <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">{col}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {config.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {row.map((cell, j) => <td key={j} className="px-4 py-2.5 text-sm">{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {config.summaryRows && config.summaryRows.length > 0 && (
                <div className="p-4 border-t bg-forest-50 space-y-1">
                  {config.summaryRows.map((s, i) => (
                    <div key={i} className="flex justify-between text-sm"><span className="text-gray-600 font-medium">{s.label}</span><span className="font-bold text-forest-800">{s.value}</span></div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
