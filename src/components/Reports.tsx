import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Download } from 'lucide-react';

interface ReportData {
  totalPurchases: number;
  totalSales: number;
  totalExpenses: number;
  totalSalaries: number;
  currentStock: number;
  netProfit: number;
  vendorCount: number;
  customerCount: number;
}

export const Reports = () => {
  const [reportType, setReportType] = useState<string>('profit-summary');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData>({
    totalPurchases: 0,
    totalSales: 0,
    totalExpenses: 0,
    totalSalaries: 0,
    currentStock: 0,
    netProfit: 0,
    vendorCount: 0,
    customerCount: 0,
  });
  const [purchases, setPurchases] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = async () => {
    try {
      const [purchasesRes, salesRes, expensesRes, salariesRes, stockRes, vendorsRes, customersRes] = await Promise.all([
        supabase.from('purchases').select('*, vendors(name, vendor_id)').order('purchase_date', { ascending: false }),
        supabase.from('sales').select('*').order('sale_date', { ascending: false }),
        supabase.from('plant_expenses').select('*').order('expense_date', { ascending: false }),
        supabase.from('salary_payments').select('amount_paid'),
        supabase.from('stock').select('current_stock_kg').single(),
        supabase.from('vendors').select('*'),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
      ]);

      const totalPurchases = purchasesRes.data?.reduce((sum, p) => sum + Number(p.total_amount), 0) || 0;
      const totalSales = salesRes.data?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0;
      const totalExpenses = expensesRes.data?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const totalSalaries = salariesRes.data?.reduce((sum, s) => sum + Number(s.amount_paid), 0) || 0;
      const currentStock = Number(stockRes.data?.current_stock_kg) || 0;
      const netProfit = totalSales - totalPurchases - totalExpenses - totalSalaries;

      setData({
        totalPurchases,
        totalSales,
        totalExpenses,
        totalSalaries,
        currentStock,
        netProfit,
        vendorCount: vendorsRes.data?.length || 0,
        customerCount: customersRes.count || 0,
      });

      setPurchases(purchasesRes.data || []);
      setSales(salesRes.data || []);
      setExpenses(expensesRes.data || []);
      setVendors(vendorsRes.data || []);
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading reports...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Report Type</label>
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="profit-summary">Profit Summary</option>
          <option value="purchase-report">Purchase Report</option>
          <option value="sales-report">Sales Report</option>
          <option value="expense-report">Expense Report</option>
          <option value="vendor-report">Vendor Account Statement</option>
          <option value="stock-report">Stock Report</option>
        </select>
      </div>

      {reportType === 'profit-summary' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Profit Summary Report</h2>
            <FileText size={28} className="text-blue-600" />
          </div>
          <div className="space-y-4">
            <div className="flex justify-between py-3 border-b">
              <span className="text-gray-700 font-medium">Total Sales Revenue</span>
              <span className="text-green-600 font-bold text-lg">+ ₹{data.totalSales.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between py-3 border-b">
              <span className="text-gray-700 font-medium">Total Purchase Cost</span>
              <span className="text-red-600 font-bold text-lg">- ₹{data.totalPurchases.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between py-3 border-b">
              <span className="text-gray-700 font-medium">Total Plant Expenses</span>
              <span className="text-red-600 font-bold text-lg">- ₹{data.totalExpenses.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between py-3 border-b">
              <span className="text-gray-700 font-medium">Total Salary Payments</span>
              <span className="text-red-600 font-bold text-lg">- ₹{data.totalSalaries.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between py-4 bg-blue-50 rounded-lg px-4 mt-4">
              <span className="text-gray-900 font-bold text-xl">Net Profit</span>
              <span className={`font-bold text-2xl ${data.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{data.netProfit.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      )}

      {reportType === 'purchase-report' && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-gray-900">Purchase Report</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Vendor</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Quantity (Kg)</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Rate/Kg</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Total Amount</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">{new Date(purchase.purchase_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm">{purchase.vendors.name}</td>
                    <td className="px-6 py-4 text-sm text-right">{purchase.quantity_kg.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 text-sm text-right">₹{purchase.rate_per_kg.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 text-sm text-right font-semibold">₹{purchase.total_amount.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 text-sm text-right text-red-600">₹{purchase.balance_amount.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-right font-bold">Total:</td>
                  <td className="px-6 py-4 text-right font-bold text-lg">₹{data.totalPurchases.toLocaleString('en-IN')}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {reportType === 'sales-report' && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-gray-900">Sales Report</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Invoice #</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Customer</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Quantity (Kg)</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Total Amount</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-blue-600">{sale.invoice_number}</td>
                    <td className="px-6 py-4 text-sm">{new Date(sale.sale_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm">{sale.customer_name}</td>
                    <td className="px-6 py-4 text-sm text-right">{sale.quantity_kg.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 text-sm text-right font-semibold">₹{sale.total_amount.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 text-sm text-right text-red-600">₹{sale.outstanding_balance.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-right font-bold">Total:</td>
                  <td className="px-6 py-4 text-right font-bold text-lg">₹{data.totalSales.toLocaleString('en-IN')}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {reportType === 'expense-report' && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-gray-900">Expense Report</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Expense Type</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">{new Date(expense.expense_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {expense.expense_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-red-600">₹{expense.amount.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{expense.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-right font-bold">Total:</td>
                  <td className="px-6 py-4 text-right font-bold text-lg">₹{data.totalExpenses.toLocaleString('en-IN')}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {reportType === 'vendor-report' && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-gray-900">Vendor Account Statement</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Vendor ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Mobile</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Outstanding Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {vendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium">{vendor.vendor_id}</td>
                    <td className="px-6 py-4 text-sm">{vendor.name}</td>
                    <td className="px-6 py-4 text-sm">{vendor.mobile}</td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-red-600">
                      ₹{vendor.balance.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-right font-bold">Total Outstanding:</td>
                  <td className="px-6 py-4 text-right font-bold text-lg text-red-600">
                    ₹{vendors.reduce((sum, v) => sum + Number(v.balance), 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {reportType === 'stock-report' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Stock Report</h2>
            <FileText size={28} className="text-blue-600" />
          </div>
          <div className="space-y-4">
            <div className="flex justify-between py-3 border-b">
              <span className="text-gray-700 font-medium">Product Name</span>
              <span className="font-semibold">Rice Bran</span>
            </div>
            <div className="flex justify-between py-3 border-b">
              <span className="text-gray-700 font-medium">Total Purchases</span>
              <span className="font-semibold">{purchases.reduce((sum, p) => sum + Number(p.quantity_kg), 0).toLocaleString('en-IN')} Kg</span>
            </div>
            <div className="flex justify-between py-3 border-b">
              <span className="text-gray-700 font-medium">Total Sales</span>
              <span className="font-semibold">{sales.reduce((sum, s) => sum + Number(s.quantity_kg), 0).toLocaleString('en-IN')} Kg</span>
            </div>
            <div className="flex justify-between py-4 bg-blue-50 rounded-lg px-4 mt-4">
              <span className="text-gray-900 font-bold text-xl">Current Stock</span>
              <span className="font-bold text-2xl text-blue-600">
                {data.currentStock.toLocaleString('en-IN')} Kg
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
