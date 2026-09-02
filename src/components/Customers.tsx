import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { canEdit, logAudit, generateTransactionNumber } from '../lib/auth';
import type { Customer, CustomerTransaction, Sale } from '../lib/types';
import { Plus, Eye, Trash2, DollarSign, ArrowLeft } from 'lucide-react';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { DataTable, type Column } from './ui/DataTable';
import { PageHeader, Badge, FormField, inputClass, buttonClass } from './ui/Common';
import { LoadingState, EmptyState } from './ui/States';
import { useToast } from './ui/Toast';

interface CustomerStats {
  totalSales: number;
  totalReceived: number;
  outstanding: number;
  totalQtyKg: number;
}

export const Customers = () => {
  const { role } = useAuth();
  const { toast } = useToast();
  const editable = canEdit(role || undefined);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ name: '', mobile: '', address: '', opening_balance: '', status: 'Active', remarks: '' });

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setCustomers(data || []);
    } catch (e) { console.error('Error loading customers:', e); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const customerId = await generateTransactionNumber('customers', 'CUS');
      const openingBal = parseFloat(formData.opening_balance) || 0;
      const { data: newCust, error } = await supabase.from('customers').insert({
        customer_id: customerId, name: formData.name, mobile: formData.mobile || null,
        address: formData.address || null, opening_balance: openingBal, balance: openingBal,
        status: formData.status, remarks: formData.remarks || null,
      }).select().single();
      if (error) throw error;

      if (openingBal > 0) {
        await supabase.from('customer_transactions').insert({
          customer_id: newCust.id, transaction_date: new Date().toISOString().split('T')[0],
          transaction_type: 'Opening Balance', amount: openingBal, debit: openingBal, credit: 0,
          balance: openingBal, notes: 'Opening balance',
        });
      }

      await logAudit('Customer created', 'Customers', customerId);
      toast('Customer created successfully', 'success');
      setShowForm(false);
      setFormData({ name: '', mobile: '', address: '', opening_balance: '', status: 'Active', remarks: '' });
      loadCustomers();
    } catch (e) { console.error('Error creating customer:', e); toast('Error creating customer', 'error'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await supabase.from('customer_transactions').delete().eq('customer_id', deleteTarget.id);
      const { error } = await supabase.from('customers').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      await logAudit('Customer deleted', 'Customers', deleteTarget.customer_id);
      toast('Customer deleted', 'success');
      loadCustomers();
    } catch (e) { console.error('Error deleting customer:', e); toast('Error deleting customer', 'error'); }
    setDeleteTarget(null);
  };

  const columns: Column<Customer>[] = [
    { key: 'customer_id', header: 'Customer ID', sortable: true, render: (c) => <span className="font-medium text-blue-600">{c.customer_id}</span> },
    { key: 'name', header: 'Name', sortable: true, render: (c) => <span className="font-medium">{c.name}</span> },
    { key: 'mobile', header: 'Mobile', render: (c) => c.mobile || '-' },
    { key: 'opening_balance', header: 'Opening Bal', align: 'right', render: (c) => `₹${Number(c.opening_balance || 0).toLocaleString('en-IN')}` },
    { key: 'balance', header: 'Outstanding', align: 'right', sortable: true, render: (c) => <span className="font-semibold text-red-600">₹{Number(c.balance).toLocaleString('en-IN')}</span> },
    { key: 'status', header: 'Status', align: 'center', render: (c) => <Badge text={c.status || 'Active'} color={c.status === 'Active' ? 'green' : 'gray'} /> },
    {
      key: 'actions', header: 'Actions', align: 'center',
      render: (c) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setSelectedCustomer(c); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="View Details"><Eye size={16} /></button>
          {editable && <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete"><Trash2 size={16} /></button>}
        </div>
      ),
    },
  ];

  if (loading) return <LoadingState message="Loading customers..." />;

  if (selectedCustomer) return <CustomerDetail customer={selectedCustomer} onBack={() => { setSelectedCustomer(null); loadCustomers(); }} />;

  return (
    <div>
      <PageHeader title="Customer Management" subtitle={`${customers.length} customers registered`}
        actions={editable && <button onClick={() => setShowForm(true)} className={buttonClass.primary}><Plus size={16} /> Add Customer</button>} />

      {customers.length === 0 ? <EmptyState message="No customers found. Add your first customer!" /> : <DataTable columns={columns} data={customers} searchKeys={['name', 'customer_id', 'mobile']} searchPlaceholder="Search customers..." />}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add New Customer" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Customer Name" required><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputClass} required /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Mobile Number"><input type="tel" value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value })} className={inputClass} /></FormField>
            <FormField label="Opening Balance"><input type="number" step="0.01" value={formData.opening_balance} onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })} className={inputClass} placeholder="0.00" /></FormField>
          </div>
          <FormField label="Address"><textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className={inputClass} rows={2} /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Status">
              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className={inputClass}>
                <option value="Active">Active</option><option value="Inactive">Inactive</option>
              </select>
            </FormField>
            <FormField label="Remarks"><input type="text" value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} className={inputClass} /></FormField>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className={buttonClass.primary + ' flex-1 justify-center'}>Create Customer</button>
            <button type="button" onClick={() => setShowForm(false)} className={buttonClass.secondary + ' flex-1 justify-center'}>Cancel</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Customer" message={`Delete customer "${deleteTarget?.name}"? All related transactions will also be deleted.`} confirmLabel="Delete" />
    </div>
  );
};

function CustomerDetail({ customer, onBack }: { customer: Customer; onBack: () => void }) {
  const { role } = useAuth();
  const { toast } = useToast();
  const editable = canEdit(role || undefined);
  const [activeTab, setActiveTab] = useState<'overview' | 'sales' | 'payments' | 'ledger'>('overview');
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<CustomerStats>({ totalSales: 0, totalReceived: 0, outstanding: 0, totalQtyKg: 0 });
  const [loading, setLoading] = useState(true);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ payment_date: new Date().toISOString().split('T')[0], amount: '', remarks: '' });

  useEffect(() => { loadCustomerData(); }, [customer.id]);

  const loadCustomerData = async () => {
    try {
      const [txRes, salesRes] = await Promise.all([
        supabase.from('customer_transactions').select('*').eq('customer_id', customer.id).order('transaction_date', { ascending: true }),
        supabase.from('sales').select('*').eq('customer_id', customer.id).order('sale_date', { ascending: false }),
      ]);

      const txs = txRes.data || [];
      const salesData = salesRes.data || [];
      setTransactions(txs);
      setSales(salesData);

      const totalSales = salesData.reduce((s, sl) => s + Number(sl.total_amount), 0);
      const totalReceived = txs.filter(t => t.transaction_type === 'Payment').reduce((s, t) => s + Number(t.credit), 0);
      const totalQtyKg = salesData.reduce((s, sl) => s + Number(sl.quantity_kg), 0);

      setStats({
        totalSales,
        totalReceived,
        outstanding: Number(customer.balance),
        totalQtyKg,
      });
    } catch (e) { console.error('Error loading customer data:', e); }
    finally { setLoading(false); }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amount = parseFloat(paymentForm.amount);
      const newBalance = Number(customer.balance) - amount;
      await supabase.from('customers').update({ balance: newBalance }).eq('id', customer.id);
      const payNum = await generateTransactionNumber('customer_transactions', 'CP');
      await supabase.from('customer_transactions').insert({
        customer_id: customer.id, transaction_date: paymentForm.payment_date,
        transaction_type: 'Payment', amount, debit: 0, credit: amount,
        balance: newBalance, notes: paymentForm.remarks || 'Customer payment',
      });
      await logAudit('Customer payment recorded', 'Customers', payNum);
      toast('Payment recorded successfully', 'success');
      setShowPaymentForm(false);
      setPaymentForm({ payment_date: new Date().toISOString().split('T')[0], amount: '', remarks: '' });
      loadCustomerData();
    } catch (e) { console.error('Error recording payment:', e); toast('Error recording payment', 'error'); }
  };

  if (loading) return <LoadingState message="Loading customer details..." />;

  const fmtINR = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'sales', label: 'Sales History' },
    { id: 'payments', label: 'Payment History' },
    { id: 'ledger', label: 'Complete Ledger' },
  ] as const;

  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition">
        <ArrowLeft size={16} /> Back to Customers
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 mt-3 text-sm">
              <div><span className="text-gray-500">Customer ID:</span> <span className="font-medium">{customer.customer_id}</span></div>
              <div><span className="text-gray-500">Mobile:</span> <span className="font-medium">{customer.mobile || '-'}</span></div>
              <div><span className="text-gray-500">Status:</span> <Badge text={customer.status || 'Active'} color={customer.status === 'Active' ? 'green' : 'gray'} /></div>
              <div><span className="text-gray-500">Opening Bal:</span> <span className="font-medium">{fmtINR(Number(customer.opening_balance))}</span></div>
              <div><span className="text-gray-500">Created:</span> <span className="font-medium">{new Date(customer.created_at).toLocaleDateString()}</span></div>
              <div><span className="text-gray-500">Address:</span> <span className="font-medium">{customer.address || '-'}</span></div>
            </div>
          </div>
          {editable && (
            <button onClick={() => setShowPaymentForm(true)} className={buttonClass.success}>
              <DollarSign size={16} /> Record Payment
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Sales</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{fmtINR(stats.totalSales)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Received</p>
          <p className="text-lg font-bold text-green-600 mt-1">{fmtINR(stats.totalReceived)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Outstanding</p>
          <p className="text-lg font-bold text-red-600 mt-1">{fmtINR(stats.outstanding)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Qty Sold</p>
          <p className="text-lg font-bold text-blue-600 mt-1">{fmt(stats.totalQtyKg)} Kg</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex gap-1 border-b border-gray-200 px-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Sales Summary</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Total Invoices:</span><span className="font-semibold">{sales.length}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Total Qty Sold:</span><span className="font-semibold">{fmt(stats.totalQtyKg)} Kg</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Total Sales Value:</span><span className="font-semibold">{fmtINR(stats.totalSales)}</span></div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Financial Summary</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Opening Balance:</span><span className="font-semibold">{fmtINR(Number(customer.opening_balance))}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Total Sales:</span><span className="font-semibold">{fmtINR(stats.totalSales)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Total Received:</span><span className="font-semibold text-green-600">{fmtINR(stats.totalReceived)}</span></div>
                  <div className="flex justify-between border-t pt-1.5"><span className="font-medium text-gray-900">Outstanding:</span><span className="font-bold text-red-600">{fmtINR(stats.outstanding)}</span></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sales' && (
            sales.length === 0 ? <EmptyState message="No sales to this customer" /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Invoice</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Product</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Qty (Kg)</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Rate</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Received</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Outstanding</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {sales.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-sm">{new Date(s.sale_date).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 text-sm font-medium text-blue-600">{s.invoice_number}</td>
                        <td className="px-4 py-2.5 text-sm">{s.product_name || '-'}</td>
                        <td className="px-4 py-2.5 text-sm text-right">{Number(s.quantity_kg).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 text-sm text-right">₹{Number(s.rate_per_kg).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-semibold">{fmtINR(Number(s.total_amount))}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-green-600">{fmtINR(Number(s.payment_received))}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-semibold text-red-600">{fmtINR(Number(s.outstanding_balance))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === 'payments' && (
            transactions.filter(t => t.transaction_type === 'Payment').length === 0 ? <EmptyState message="No payments recorded" /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Remarks</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Balance</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.filter(t => t.transaction_type === 'Payment').reverse().map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-sm">{new Date(t.transaction_date).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 text-sm"><Badge text={t.transaction_type} color="green" /></td>
                        <td className="px-4 py-2.5 text-sm text-right font-semibold text-green-600">{fmtINR(Number(t.credit))}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-500">{t.notes || '-'}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-semibold">{fmtINR(Number(t.balance))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === 'ledger' && (
            transactions.length === 0 ? <EmptyState message="No transactions found" /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Reference</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Debit (Sales)</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Credit (Payment)</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Running Balance</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-sm">{new Date(t.transaction_date).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 text-sm font-medium text-blue-600">{t.transaction_type}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-500">{t.notes || '-'}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-red-600">{t.debit > 0 ? fmtINR(Number(t.debit)) : '-'}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-green-600">{t.credit > 0 ? fmtINR(Number(t.credit)) : '-'}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-semibold">{fmtINR(Number(t.balance))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>

      <Modal open={showPaymentForm} onClose={() => setShowPaymentForm(false)} title="Customer Payment" size="sm">
        <form onSubmit={handlePayment} className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 mb-2">
            <p className="text-sm text-gray-600">Customer: <span className="font-semibold">{customer.name}</span></p>
            <p className="text-sm text-gray-600">Outstanding: <span className="font-semibold text-red-600">{fmtINR(Number(customer.balance))}</span></p>
          </div>
          <FormField label="Payment Date" required><input type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} className={inputClass} required /></FormField>
          <FormField label="Amount" required><input type="number" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} className={inputClass} required /></FormField>
          <FormField label="Remarks"><input type="text" value={paymentForm.remarks} onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })} className={inputClass} /></FormField>
          <div className="flex gap-3 pt-2">
            <button type="submit" className={buttonClass.success + ' flex-1 justify-center'}>Record Payment</button>
            <button type="button" onClick={() => setShowPaymentForm(false)} className={buttonClass.secondary + ' flex-1 justify-center'}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
