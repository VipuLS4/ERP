import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../lib/auth';
import type { RoleKey } from '../lib/types';
import {
  TrendingUp, TrendingDown, Package, DollarSign, Users, Receipt,
  Factory, AlertTriangle, Landmark, ArrowUpRight,
  ShoppingCart,
} from 'lucide-react';
import { StatCard } from './ui/Common';
import { LoadingState } from './ui/States';

type DateFilter = 'today' | 'week' | 'month' | 'year' | 'all';

const ROLE_LABELS: Record<RoleKey, string> = {
  super_admin: 'Admin Dashboard',
  plant_manager: 'Plant Manager Dashboard',
  production_supervisor: 'Production Dashboard',
  store_employee: 'Store Dashboard',
  purchase_employee: 'Purchase Dashboard',
  sales_employee: 'Sales Dashboard',
  accountant: 'Accountant Dashboard',
  viewer: 'Dashboard Overview',
};

export const Dashboard = () => {
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [stats, setStats] = useState({
    totalPurchases: 0,
    totalSales: 0,
    totalExpenses: 0,
    totalSalaries: 0,
    currentStock: 0,
    netProfit: 0,
    totalVendors: 0,
    totalCustomers: 0,
    vendorPayables: 0,
    customerReceivables: 0,
    cashBalance: 0,
    bankBalance: 0,
    upiBalance: 0,
    todaySales: 0,
    todayPurchases: 0,
    todayExpenses: 0,
    todayProduction: 0,
    monthlySales: 0,
    monthlyPurchases: 0,
    monthlyProduction: 0,
    monthlyExpenses: 0,
  });
  const [salesTrend, setSalesTrend] = useState<{ date: string; amount: number }[]>([]);
  const [purchaseTrend, setPurchaseTrend] = useState<{ date: string; amount: number }[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<{ product_name: string; current_stock_kg: number; minimum_stock_kg: number }[]>([]);

  const dateRange = useMemo(() => {
    const now = new Date();
    const start = new Date();
    switch (dateFilter) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        start.setFullYear(2000);
        break;
    }
    return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
  }, [dateFilter]);

  useEffect(() => {
    loadDashboardData();
  }, [dateRange]);

  const loadDashboardData = async () => {
    try {
      const [
        purchasesRes, salesRes, expensesRes, salariesRes,
        stockRes, vendorsRes, customersRes,
        accountsRes, productionRes, lowStockRes,
      ] = await Promise.all([
        supabase.from('purchases').select('purchase_date, total_amount, quantity_kg').gte('purchase_date', dateRange.start).lte('purchase_date', dateRange.end),
        supabase.from('sales').select('sale_date, total_amount, quantity_kg').gte('sale_date', dateRange.start).lte('sale_date', dateRange.end),
        supabase.from('plant_expenses').select('expense_date, amount').gte('expense_date', dateRange.start).lte('expense_date', dateRange.end),
        supabase.from('salary_payments').select('amount_paid'),
        supabase.from('stock').select('current_stock_kg'),
        supabase.from('vendors').select('id, balance'),
        supabase.from('customers').select('id, balance'),
        supabase.from('cash_bank_accounts').select('account_name, account_type, current_balance'),
        supabase.from('production_batches').select('batch_date, input_quantity_kg, total_output_kg, status').gte('batch_date', dateRange.start).lte('batch_date', dateRange.end),
        supabase.from('stock').select('product_name, current_stock_kg, minimum_stock_kg'),
      ]);

      const totalPurchases = purchasesRes.data?.reduce((s, p) => s + Number(p.total_amount), 0) || 0;
      const totalSales = salesRes.data?.reduce((s, p) => s + Number(p.total_amount), 0) || 0;
      const totalExpenses = expensesRes.data?.reduce((s, p) => s + Number(p.amount), 0) || 0;
      const totalSalaries = salariesRes.data?.reduce((s, p) => s + Number(p.amount_paid), 0) || 0;
      const currentStock = stockRes.data?.reduce((s, p) => s + Number(p.current_stock_kg), 0) || 0;
      const netProfit = totalSales - totalPurchases - totalExpenses - totalSalaries;
      const vendorPayables = vendorsRes.data?.reduce((s, v) => s + Number(v.balance), 0) || 0;
      const customerReceivables = customersRes.data?.reduce((s, c) => s + Number(c.balance), 0) || 0;

      const cashBalance = accountsRes.data?.find(a => a.account_type === 'Cash')?.current_balance || 0;
      const bankBalance = accountsRes.data?.find(a => a.account_type === 'Bank')?.current_balance || 0;
      const upiBalance = accountsRes.data?.find(a => a.account_type === 'UPI')?.current_balance || 0;

      const today = new Date().toISOString().split('T')[0];
      const todaySales = salesRes.data?.filter(s => s.sale_date === today).reduce((s, p) => s + Number(p.total_amount), 0) || 0;
      const todayPurchases = purchasesRes.data?.filter(p => p.purchase_date === today).reduce((s, p) => s + Number(p.total_amount), 0) || 0;
      const todayExpenses = expensesRes.data?.filter(e => e.expense_date === today).reduce((s, p) => s + Number(p.amount), 0) || 0;
      const todayProduction = productionRes.data?.filter(p => p.batch_date === today).reduce((s, p) => s + Number(p.input_quantity_kg), 0) || 0;

      setStats({
        totalPurchases, totalSales, totalExpenses, totalSalaries,
        currentStock, netProfit,
        totalVendors: vendorsRes.data?.length || 0,
        totalCustomers: customersRes.data?.length || 0,
        vendorPayables, customerReceivables,
        cashBalance, bankBalance, upiBalance,
        todaySales, todayPurchases, todayExpenses, todayProduction,
        monthlySales: totalSales, monthlyPurchases: totalPurchases,
        monthlyProduction: productionRes.data?.reduce((s, p) => s + Number(p.input_quantity_kg), 0) || 0,
        monthlyExpenses: totalExpenses,
      });

      // Trends - group by date
      const salesByDate: Record<string, number> = {};
      salesRes.data?.forEach(s => {
        salesByDate[s.sale_date] = (salesByDate[s.sale_date] || 0) + Number(s.total_amount);
      });
      setSalesTrend(Object.entries(salesByDate).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date)).slice(-30));

      const purchaseByDate: Record<string, number> = {};
      purchasesRes.data?.forEach(p => {
        purchaseByDate[p.purchase_date] = (purchaseByDate[p.purchase_date] || 0) + Number(p.total_amount);
      });
      setPurchaseTrend(Object.entries(purchaseByDate).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date)).slice(-30));

      // Low stock alerts
      setLowStockAlerts(
        (lowStockRes.data || []).filter(s => Number(s.minimum_stock_kg) > 0 && Number(s.current_stock_kg) < Number(s.minimum_stock_kg))
      );
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState message="Loading dashboard..." />;

  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const fmtINR = (n: number) => `₹${fmt(n)}`;

  const dateFilterButtons: { key: DateFilter; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'year', label: 'This Year' },
    { key: 'all', label: 'All Time' },
  ];

  const showAdmin = canAccess(role || undefined, 'dashboard');
  const showFinancial = role === 'super_admin' || role === 'accountant';
  const showProduction = role === 'super_admin' || role === 'plant_manager' || role === 'production_supervisor';
  const showSales = role === 'super_admin' || role === 'sales_employee';
  const showPurchase = role === 'super_admin' || role === 'purchase_employee';
  const showStore = role === 'super_admin' || role === 'store_employee' || role === 'plant_manager';

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{role ? ROLE_LABELS[role] : 'Dashboard'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Overview of business operations</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {dateFilterButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setDateFilter(btn.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                dateFilter === btn.key
                  ? 'bg-forest-700 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-forest-50'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockAlerts.length > 0 && showStore && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">Low Stock Alerts</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockAlerts.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-amber-200 rounded-lg text-xs text-amber-700">
                {item.product_name}: {fmt(item.current_stock_kg)} Kg (min: {fmt(item.minimum_stock_kg)} Kg)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Today's stats - Admin/Manager */}
      {showAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="Today's Sales" value={fmtINR(stats.todaySales)} icon={<Receipt size={20} />} color="#10B981" />
          <StatCard title="Today's Purchases" value={fmtINR(stats.todayPurchases)} icon={<ShoppingCart size={20} />} color="#3B82F6" />
          <StatCard title="Today's Production" value={`${fmt(stats.todayProduction)} Kg`} icon={<Factory size={20} />} color="#8B5CF6" />
          <StatCard title="Today's Expenses" value={fmtINR(stats.todayExpenses)} icon={<DollarSign size={20} />} color="#F59E0B" />
        </div>
      )}

      {/* Main stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {showPurchase && (
          <StatCard title="Total Purchases" value={fmtINR(stats.totalPurchases)} icon={<TrendingDown size={20} />} color="#EF4444" />
        )}
        {showSales && (
          <StatCard title="Total Sales" value={fmtINR(stats.totalSales)} icon={<TrendingUp size={20} />} color="#10B981" />
        )}
        {showStore && (
          <StatCard title="Current Stock" value={`${fmt(stats.currentStock)} Kg`} icon={<Package size={20} />} color="#3B82F6" />
        )}
        {showFinancial && (
          <StatCard title="Net Profit" value={fmtINR(stats.netProfit)} icon={<DollarSign size={20} />} color={stats.netProfit >= 0 ? '#10B981' : '#EF4444'} />
        )}
        {showProduction && (
          <StatCard title="Production (Period)" value={`${fmt(stats.monthlyProduction)} Kg`} icon={<Factory size={20} />} color="#8B5CF6" />
        )}
        {showFinancial && (
          <StatCard title="Plant Expenses" value={fmtINR(stats.totalExpenses)} icon={<Receipt size={20} />} color="#F59E0B" />
        )}
        {showAdmin && (
          <StatCard title="Vendors" value={String(stats.totalVendors)} icon={<Users size={20} />} color="#06B6D4" />
        )}
        {showAdmin && (
          <StatCard title="Customers" value={String(stats.totalCustomers)} icon={<Users size={20} />} color="#EC4899" />
        )}
      </div>

      {/* Financial summary */}
      {showFinancial && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Landmark size={18} className="text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-900">Cash & Bank</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Cash</span><span className="font-semibold">₹{fmt(stats.cashBalance)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Bank</span><span className="font-semibold">₹{fmt(stats.bankBalance)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">UPI</span><span className="font-semibold">₹{fmt(stats.upiBalance)}</span></div>
              <div className="flex justify-between border-t pt-2"><span className="font-medium text-gray-900">Total</span><span className="font-bold text-blue-600">₹{fmt(stats.cashBalance + stats.bankBalance + stats.upiBalance)}</span></div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpRight size={18} className="text-red-600" />
              <h3 className="text-sm font-semibold text-gray-900">Payables & Receivables</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Vendor Payables</span><span className="font-semibold text-red-600">₹{fmt(stats.vendorPayables)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Customer Receivables</span><span className="font-semibold text-green-600">₹{fmt(stats.customerReceivables)}</span></div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign size={18} className="text-green-600" />
              <h3 className="text-sm font-semibold text-gray-900">Profit Summary</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Sales</span><span className="font-semibold text-green-600">+ ₹{fmt(stats.totalSales)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Purchases</span><span className="font-semibold text-red-600">- ₹{fmt(stats.totalPurchases)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Expenses</span><span className="font-semibold text-red-600">- ₹{fmt(stats.totalExpenses)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Salaries</span><span className="font-semibold text-red-600">- ₹{fmt(stats.totalSalaries)}</span></div>
              <div className="flex justify-between border-t pt-2"><span className="font-bold text-gray-900">Net Profit</span><span className={`font-bold ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>₹{fmt(stats.netProfit)}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {(showSales || showPurchase) && (salesTrend.length > 0 || purchaseTrend.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {showSales && salesTrend.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Sales Trend</h3>
              <MiniBarChart data={salesTrend} color="#10B981" />
            </div>
          )}
          {showPurchase && purchaseTrend.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Purchase Trend</h3>
              <MiniBarChart data={purchaseTrend} color="#3B82F6" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function MiniBarChart({ data, color }: { data: { date: string; amount: number }[]; color: string }) {
  const max = Math.max(...data.map((d) => d.amount), 1);
  return (
    <div className="flex items-end gap-1 h-40">
      {data.slice(-20).map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
          <div className="relative w-full flex justify-center">
            <div
              className="w-full max-w-[24px] rounded-t transition-all hover:opacity-80"
              style={{ height: `${(d.amount / max) * 120}px`, backgroundColor: color, minHeight: '2px' }}
            />
            <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition bg-gray-900 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap pointer-events-none z-10">
              ₹{d.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <span className="text-[9px] text-gray-400">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}


