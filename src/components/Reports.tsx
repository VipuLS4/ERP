import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { FileText } from 'lucide-react';
import { PageHeader } from './ui/Common';
import { LoadingState, EmptyState } from './ui/States';

interface VendorRow {
  id: string;
  vendor_id: string;
  name: string;
  mobile: string | null;
  balance: number;
  totalPurchase: number;
  totalPaid: number;
  totalBags: number;
  totalKg: number;
}

interface CustomerRow {
  id: string;
  customer_id: string;
  name: string;
  mobile: string | null;
  balance: number;
  totalSales: number;
  totalReceived: number;
  totalQtyKg: number;
}

export const Reports = () => {
  const [reportType, setReportType] = useState('profit-summary');
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [production, setProduction] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

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
    return {
      start: customStart || start.toISOString().split('T')[0],
      end: customEnd || now.toISOString().split('T')[0],
    };
  }, [dateFilter, customStart, customEnd]);

  useEffect(() => { loadReportData(); }, [dateRange]);

  const loadReportData = async () => {
    try {
      const [vRes, cRes, pRes, sRes, eRes, stRes, prodRes] = await Promise.all([
        supabase.from('vendors').select('*').order('name'),
        supabase.from('customers').select('*').order('name'),
        supabase.from('purchases').select('*, vendors(name, vendor_id)').gte('purchase_date', dateRange.start).lte('purchase_date', dateRange.end).order('purchase_date', { ascending: false }),
        supabase.from('sales').select('*').gte('sale_date', dateRange.start).lte('sale_date', dateRange.end).order('sale_date', { ascending: false }),
        supabase.from('plant_expenses').select('*').gte('expense_date', dateRange.start).lte('expense_date', dateRange.end).order('expense_date', { ascending: false }),
        supabase.from('stock').select('*'),
        supabase.from('production_batches').select('*').gte('batch_date', dateRange.start).lte('batch_date', dateRange.end).order('batch_date', { ascending: false }),
      ]);

      const vendorList = vRes.data || [];
      const customerList = cRes.data || [];
      const purchaseList = pRes.data || [];
      const salesList = sRes.data || [];
      const expenseList = eRes.data || [];

      const vendorRows: VendorRow[] = await Promise.all(vendorList.map(async (v) => {
        const [vPurs, vRecs, vTxs] = await Promise.all([
          supabase.from('purchases').select('total_amount, quantity_kg, number_of_bags').eq('vendor_id', v.id),
          supabase.from('material_receipts').select('net_weight, number_of_bags').eq('vendor_id', v.id),
          supabase.from('vendor_transactions').select('credit, transaction_type').eq('vendor_id', v.id),
        ]);
        return {
          id: v.id, vendor_id: v.vendor_id, name: v.name, mobile: v.mobile,
          balance: Number(v.balance),
          totalPurchase: (vPurs.data || []).reduce((s, p) => s + Number(p.total_amount), 0),
          totalPaid: (vTxs.data || []).filter(t => t.transaction_type === 'Payment').reduce((s, t) => s + Number(t.credit), 0),
          totalBags: (vRecs.data || []).reduce((s, r) => s + Number(r.number_of_bags || 0), 0),
          totalKg: (vRecs.data || []).reduce((s, r) => s + Number(r.net_weight), 0),
        };
      }));

      const customerRows: CustomerRow[] = await Promise.all(customerList.map(async (c) => {
        const [cSales, cTxs] = await Promise.all([
          supabase.from('sales').select('total_amount, quantity_kg').eq('customer_id', c.id),
          supabase.from('customer_transactions').select('credit, transaction_type').eq('customer_id', c.id),
        ]);
        return {
          id: c.id, customer_id: c.customer_id, name: c.name, mobile: c.mobile,
          balance: Number(c.balance),
          totalSales: (cSales.data || []).reduce((s, sl) => s + Number(sl.total_amount), 0),
          totalReceived: (cTxs.data || []).filter(t => t.transaction_type === 'Payment').reduce((s, t) => s + Number(t.credit), 0),
          totalQtyKg: (cSales.data || []).reduce((s, sl) => s + Number(sl.quantity_kg), 0),
        };
      }));

      setVendors(vendorRows);
      setCustomers(customerRows);
      setPurchases(purchaseList);
      setSales(salesList);
      setExpenses(expenseList);
      setStock(stRes.data || []);
      setProduction(prodRes.data || []);
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState message="Loading reports..." />;

  const fmtINR = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}

  const totalPurchases = purchases.reduce((s, p) => s + Number(p.total_amount), 0);
  const totalSales = sales.reduce((s, sl) => s + Number(sl.total_amount), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const netProfit = totalSales - totalPurchases - totalExpenses;
  const totalVendorOutstanding = vendors.reduce((s, v) => s + v.balance, 0);
  const totalCustomerOutstanding = customers.reduce((s, c) => s + c.balance, 0);

  const reportTypes = [
    { value: 'profit-summary', label: 'Profit Summary' },
    { value: 'purchase-report', label: 'Purchase Report' },
    { value: 'sales-report', label: 'Sales Report' },
    { value: 'expense-report', label: 'Expense Report' },
    { value: 'vendor-outstanding', label: 'Vendor Outstanding' },
    { value: 'vendor-material', label: 'Vendor Material Received' },
    { value: 'customer-outstanding', label: 'Customer Outstanding' },
    { value: 'customer-sales', label: 'Customer-wise Sales' },
    { value: 'stock-report', label: 'Stock Report' },
    { value: 'production-report', label: 'Production Report' },
  ];

  const dateFilterButtons: { key: typeof dateFilter; label: string }[] = [
    { key: 'today', label: 'Today' }, { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' }, { key: 'year', label: 'Year' }, { key: 'all', label: 'All' },
  ];

  return (
    <div>
      <PageHeader title="Reports" subtitle="Business intelligence and financial reports" />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Report Type</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-w-[200px]">
              {reportTypes.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Date Range</label>
            <div className="flex flex-wrap gap-1.5">
              {dateFilterButtons.map((btn) => (
                <button key={btn.key} onClick={() => { setDateFilter(btn.key); setCustomStart(''); setCustomEnd(''); }}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition ${dateFilter === btn.key && !customStart ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">From</label>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">To</label>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
        </div>
      </div>

      {reportType === 'profit-summary' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Profit Summary Report</h2>
            <FileText size={24} className="text-blue-600" />
          </div>
          <div className="space-y-4">
            <div className="flex justify-between py-3 border-b"><span className="text-gray-700 font-medium">Total Sales Revenue</span><span className="text-green-600 font-bold text-lg">+ {fmtINR(totalSales)}</span></div>
            <div className="flex justify-between py-3 border-b"><span className="text-gray-700 font-medium">Total Purchase Cost</span><span className="text-red-600 font-bold text-lg">- {fmtINR(totalPurchases)}</span></div>
            <div className="flex justify-between py-3 border-b"><span className="text-gray-700 font-medium">Total Plant Expenses</span><span className="text-red-600 font-bold text-lg">- {fmtINR(totalExpenses)}</span></div>
            <div className="flex justify-between py-4 bg-blue-50 rounded-lg px-4 mt-4"><span className="text-gray-900 font-bold text-xl">Estimated Profit</span><span className={`font-bold text-2xl ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtINR(netProfit)}</span></div>
          </div>
        </div>
      )}

      {reportType === 'purchase-report' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b"><h2 className="text-xl font-bold text-gray-900">Purchase Report</h2></div>
          {purchases.length === 0 ? <EmptyState message="No purchases in this period" /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50"><tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Purchase #</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Vendor</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Qty (Kg)</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Rate</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Balance</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-sm">{new Date(p.purchase_date).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-sm font-medium text-blue-600">{p.purchase_number || '-'}</td>
                      <td className="px-4 py-2.5 text-sm">{p.vendors?.name || '-'}</td>
                      <td className="px-4 py-2.5 text-sm text-right">{Number(p.quantity_kg).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2.5 text-sm text-right">₹{Number(p.rate_per_kg).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-semibold">{fmtINR(Number(p.total_amount))}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-red-600">{fmtINR(Number(p.balance_amount))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50"><tr><td colSpan={5} className="px-4 py-3 text-right font-bold">Total:</td><td className="px-4 py-3 text-right font-bold text-lg">{fmtINR(totalPurchases)}</td><td></td></tr></tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {reportType === 'sales-report' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b"><h2 className="text-xl font-bold text-gray-900">Sales Report</h2></div>
          {sales.length === 0 ? <EmptyState message="No sales in this period" /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50"><tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Invoice #</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Customer</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Qty (Kg)</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Outstanding</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {sales.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-sm font-medium text-blue-600">{s.invoice_number}</td>
                      <td className="px-4 py-2.5 text-sm">{new Date(s.sale_date).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-sm">{s.customer_name}</td>
                      <td className="px-4 py-2.5 text-sm text-right">{Number(s.quantity_kg).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-semibold">{fmtINR(Number(s.total_amount))}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-red-600">{fmtINR(Number(s.outstanding_balance))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50"><tr><td colSpan={4} className="px-4 py-3 text-right font-bold">Total:</td><td className="px-4 py-3 text-right font-bold text-lg">{fmtINR(totalSales)}</td><td></td></tr></tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {reportType === 'expense-report' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b"><h2 className="text-xl font-bold text-gray-900">Expense Report</h2></div>
          {expenses.length === 0 ? <EmptyState message="No expenses in this period" /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50"><tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Notes</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-sm">{new Date(e.expense_date).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-sm"><span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{e.expense_type}</span></td>
                      <td className="px-4 py-2.5 text-sm text-right font-semibold text-red-600">{fmtINR(Number(e.amount))}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-500">{e.notes || e.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50"><tr><td colSpan={2} className="px-4 py-3 text-right font-bold">Total:</td><td className="px-4 py-3 text-right font-bold text-lg">{fmtINR(totalExpenses)}</td><td></td></tr></tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {reportType === 'vendor-outstanding' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b"><h2 className="text-xl font-bold text-gray-900">Vendor Outstanding Report</h2></div>
          {vendors.length === 0 ? <EmptyState message="No vendors found" /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50"><tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Vendor</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Mobile</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Total Purchase</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Total Paid</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Outstanding</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {vendors.sort((a, b) => b.balance - a.balance).map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-sm font-medium">{v.name}</td>
                      <td className="px-4 py-2.5 text-sm">{v.mobile || '-'}</td>
                      <td className="px-4 py-2.5 text-sm text-right">{fmtINR(v.totalPurchase)}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-green-600">{fmtINR(v.totalPaid)}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-semibold text-red-600">{fmtINR(v.balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50"><tr><td colSpan={3} className="px-4 py-3 text-right font-bold">TOTAL VENDOR OUTSTANDING:</td><td className="px-4 py-3 text-right font-bold text-lg text-red-600">{fmtINR(totalVendorOutstanding)}</td></tr></tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {reportType === 'vendor-material' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b"><h2 className="text-xl font-bold text-gray-900">Vendor Material Received Report</h2></div>
          {vendors.length === 0 ? <EmptyState message="No vendors found" /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50"><tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Vendor</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Bags Received</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Kg Received</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Purchase Value</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Avg Rate</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {vendors.filter(v => v.totalKg > 0).sort((a, b) => b.totalKg - a.totalKg).map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-sm font-medium">{v.name}</td>
                      <td className="px-4 py-2.5 text-sm text-right">{v.totalBags}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-semibold">{fmt(v.totalKg)} Kg</td>
                      <td className="px-4 py-2.5 text-sm text-right">{fmtINR(v.totalPurchase)}</td>
                      <td className="px-4 py-2.5 text-sm text-right">₹{v.totalKg > 0 ? fmt(v.totalPurchase / v.totalKg) : '0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {reportType === 'customer-outstanding' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b"><h2 className="text-xl font-bold text-gray-900">Customer Outstanding Report</h2></div>
          {customers.length === 0 ? <EmptyState message="No customers found" /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50"><tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Customer</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Mobile</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Total Sales</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Total Received</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Outstanding</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {customers.sort((a, b) => b.balance - a.balance).map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-sm font-medium">{c.name}</td>
                      <td className="px-4 py-2.5 text-sm">{c.mobile || '-'}</td>
                      <td className="px-4 py-2.5 text-sm text-right">{fmtINR(c.totalSales)}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-green-600">{fmtINR(c.totalReceived)}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-semibold text-red-600">{fmtINR(c.balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50"><tr><td colSpan={3} className="px-4 py-3 text-right font-bold">TOTAL CUSTOMER RECEIVABLE:</td><td className="px-4 py-3 text-right font-bold text-lg text-red-600">{fmtINR(totalCustomerOutstanding)}</td></tr></tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {reportType === 'customer-sales' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b"><h2 className="text-xl font-bold text-gray-900">Customer-wise Sales Report</h2></div>
          {customers.length === 0 ? <EmptyState message="No customers found" /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50"><tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Customer</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Qty Sold (Kg)</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Sales Value</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Amount Received</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Outstanding</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {customers.filter(c => c.totalSales > 0).sort((a, b) => b.totalSales - a.totalSales).map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-sm font-medium">{c.name}</td>
                      <td className="px-4 py-2.5 text-sm text-right">{fmt(c.totalQtyKg)}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-semibold">{fmtINR(c.totalSales)}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-green-600">{fmtINR(c.totalReceived)}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-semibold text-red-600">{fmtINR(c.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {reportType === 'stock-report' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b"><h2 className="text-xl font-bold text-gray-900">Stock Report</h2></div>
          {stock.length === 0 ? <EmptyState message="No stock data found" /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50"><tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Product</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Current Stock (Kg)</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Minimum Stock (Kg)</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {stock.map((s) => {
                    const low = Number(s.minimum_stock_kg) > 0 && Number(s.current_stock_kg) < Number(s.minimum_stock_kg);
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-sm font-medium">{s.product_name}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-semibold">{fmt(Number(s.current_stock_kg))}</td>
                        <td className="px-4 py-2.5 text-sm text-right">{Number(s.minimum_stock_kg) > 0 ? fmt(Number(s.minimum_stock_kg)) : '-'}</td>
                        <td className="px-4 py-2.5 text-center">{low ? <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Low</span> : <span className="px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">OK</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {reportType === 'production-report' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b"><h2 className="text-xl font-bold text-gray-900">Production Report</h2></div>
          {production.length === 0 ? <EmptyState message="No production in this period" /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50"><tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Batch #</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Input (Kg)</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Output (Kg)</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Waste (Kg)</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Yield %</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {production.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-sm font-medium text-blue-600">{p.batch_number}</td>
                      <td className="px-4 py-2.5 text-sm">{new Date(p.batch_date).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-sm text-right">{fmt(Number(p.input_quantity_kg))}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-semibold">{fmt(Number(p.total_output_kg))}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-red-600">{fmt(Number(p.waste_kg))}</td>
                      <td className="px-4 py-2.5 text-sm text-right">{Number(p.input_quantity_kg) > 0 ? ((Number(p.total_output_kg) / Number(p.input_quantity_kg)) * 100).toFixed(1) : '0'}%</td>
                      <td className="px-4 py-2.5 text-center"><span className="px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
