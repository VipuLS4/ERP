import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { canEdit, logAudit, generateTransactionNumber } from '../lib/auth';
import type { Vendor, VendorTransaction, Purchase, MaterialReceipt } from '../lib/types';
import { Plus, Eye, Trash2, DollarSign, Package, ArrowLeft } from 'lucide-react';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { DataTable, type Column } from './ui/DataTable';
import { PageHeader, Badge, FormField, inputClass, buttonClass } from './ui/Common';
import { LoadingState, EmptyState } from './ui/States';
import { useToast } from './ui/Toast';

interface VendorStats {
  totalPurchase: number;
  totalPaid: number;
  outstanding: number;
  totalBags: number;
  totalKg: number;
  avgRate: number;
}

export const Vendors = () => {
  const { role } = useAuth();
  const { toast } = useToast();
  const editable = canEdit(role || undefined);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState({ name: '', mobile: '', address: '', opening_balance: '', status: 'Active', remarks: '' });

  useEffect(() => { loadVendors(); }, []);

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase.from('vendors').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setVendors(data || []);
    } catch (e) { console.error('Error loading vendors:', e); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const vendorId = await generateTransactionNumber('vendors', 'VEN');
      const openingBal = parseFloat(formData.opening_balance) || 0;
      const { data: newVendor, error } = await supabase.from('vendors').insert({
        vendor_id: vendorId, name: formData.name, mobile: formData.mobile,
        address: formData.address || null, opening_balance: openingBal, balance: openingBal,
        status: formData.status, remarks: formData.remarks || null,
      }).select().single();
      if (error) throw error;

      if (openingBal > 0) {
        await supabase.from('vendor_transactions').insert({
          vendor_id: newVendor.id, transaction_date: new Date().toISOString().split('T')[0],
          transaction_type: 'Opening Balance', amount: openingBal, debit: openingBal, credit: 0,
          balance: openingBal, notes: 'Opening balance',
        });
      }

      await logAudit('Vendor created', 'Vendors', vendorId);
      toast('Vendor created successfully', 'success');
      setShowForm(false);
      setFormData({ name: '', mobile: '', address: '', opening_balance: '', status: 'Active', remarks: '' });
      loadVendors();
    } catch (e) { console.error('Error creating vendor:', e); toast('Error creating vendor', 'error'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await supabase.from('vendor_transactions').delete().eq('vendor_id', deleteTarget.id);
      const { error } = await supabase.from('vendors').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      await logAudit('Vendor deleted', 'Vendors', deleteTarget.vendor_id);
      toast('Vendor deleted', 'success');
      loadVendors();
    } catch (e) { console.error('Error deleting vendor:', e); toast('Error deleting vendor', 'error'); }
    setDeleteTarget(null);
  };

  const columns: Column<Vendor>[] = [
    { key: 'vendor_id', header: 'Vendor ID', sortable: true, render: (v) => <span className="font-medium text-blue-600">{v.vendor_id}</span> },
    { key: 'name', header: 'Name', sortable: true, render: (v) => <span className="font-medium">{v.name}</span> },
    { key: 'mobile', header: 'Mobile' },
    { key: 'opening_balance', header: 'Opening Bal', align: 'right', render: (v) => `₹${Number(v.opening_balance || 0).toLocaleString('en-IN')}` },
    { key: 'balance', header: 'Outstanding', align: 'right', sortable: true, render: (v) => <span className="font-semibold text-red-600">₹{Number(v.balance).toLocaleString('en-IN')}</span> },
    { key: 'status', header: 'Status', align: 'center', render: (v) => <Badge text={v.status || 'Active'} color={v.status === 'Active' ? 'green' : 'gray'} /> },
    {
      key: 'actions', header: 'Actions', align: 'center',
      render: (v) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setSelectedVendor(v); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="View Details"><Eye size={16} /></button>
          {editable && <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(v); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete"><Trash2 size={16} /></button>}
        </div>
      ),
    },
  ];

  if (loading) return <LoadingState message="Loading vendors..." />;

  if (selectedVendor) return <VendorDetail vendor={selectedVendor} onBack={() => { setSelectedVendor(null); loadVendors(); }} />;

  return (
    <div>
      <PageHeader title="Vendor Management" subtitle={`${vendors.length} vendors registered`}
        actions={editable && <button onClick={() => setShowForm(true)} className={buttonClass.primary}><Plus size={16} /> Add Vendor</button>} />

      {vendors.length === 0 ? <EmptyState message="No vendors found. Add your first vendor!" /> : <DataTable columns={columns} data={vendors} searchKeys={['name', 'vendor_id', 'mobile']} searchPlaceholder="Search vendors..." />}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add New Vendor" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Vendor Name" required><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputClass} required /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Mobile Number" required><input type="tel" value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value })} className={inputClass} required /></FormField>
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
            <button type="submit" className={buttonClass.primary + ' flex-1 justify-center'}>Create Vendor</button>
            <button type="button" onClick={() => setShowForm(false)} className={buttonClass.secondary + ' flex-1 justify-center'}>Cancel</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Vendor" message={`Delete vendor "${deleteTarget?.name}"? All related transactions will also be deleted.`} confirmLabel="Delete" />
    </div>
  );
};

function VendorDetail({ vendor, onBack }: { vendor: Vendor; onBack: () => void }) {
  const { role } = useAuth();
  const { toast } = useToast();
  const editable = canEdit(role || undefined);
  const [activeTab, setActiveTab] = useState<'overview' | 'purchases' | 'payments' | 'ledger' | 'material'>('overview');
  const [transactions, setTransactions] = useState<VendorTransaction[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [receipts, setReceipts] = useState<MaterialReceipt[]>([]);
  const [stats, setStats] = useState<VendorStats>({ totalPurchase: 0, totalPaid: 0, outstanding: 0, totalBags: 0, totalKg: 0, avgRate: 0 });
  const [loading, setLoading] = useState(true);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ payment_date: new Date().toISOString().split('T')[0], amount: '', remarks: '' });

  useEffect(() => { loadVendorData(); }, [vendor.id]);

  const loadVendorData = async () => {
    try {
      const [txRes, purRes, recRes] = await Promise.all([
        supabase.from('vendor_transactions').select('*').eq('vendor_id', vendor.id).order('transaction_date', { ascending: true }),
        supabase.from('purchases').select('*').eq('vendor_id', vendor.id).order('purchase_date', { ascending: false }),
        supabase.from('material_receipts').select('*').eq('vendor_id', vendor.id).order('receipt_date', { ascending: false }),
      ]);

      const txs = txRes.data || [];
      const purs = purRes.data || [];
      const recs = recRes.data || [];

      setTransactions(txs);
      setPurchases(purs);
      setReceipts(recs);

      const totalPurchase = purs.reduce((s, p) => s + Number(p.total_amount), 0);
      const totalBags = recs.reduce((s, r) => s + Number(r.number_of_bags || 0), 0);
      const totalKg = recs.reduce((s, r) => s + Number(r.net_weight), 0);
      const avgRate = totalKg > 0 ? totalPurchase / totalKg : 0;

      setStats({
        totalPurchase,
        totalPaid: txs.filter(t => t.transaction_type === 'Payment').reduce((s, t) => s + Number(t.credit), 0),
        outstanding: Number(vendor.balance),
        totalBags, totalKg, avgRate,
      });
    } catch (e) { console.error('Error loading vendor data:', e); }
    finally { setLoading(false); }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amount = parseFloat(paymentForm.amount);
      const newBalance = Number(vendor.balance) - amount;
      await supabase.from('vendors').update({ balance: newBalance }).eq('id', vendor.id);
      const payNum = await generateTransactionNumber('vendor_transactions', 'PAY');
      await supabase.from('vendor_transactions').insert({
        vendor_id: vendor.id, transaction_date: paymentForm.payment_date,
        transaction_type: 'Payment', amount, debit: 0, credit: amount,
        balance: newBalance, notes: paymentForm.remarks || 'Vendor payment',
      });
      await logAudit('Vendor payment recorded', 'Vendors', payNum);
      toast('Payment recorded successfully', 'success');
      setShowPaymentForm(false);
      setPaymentForm({ payment_date: new Date().toISOString().split('T')[0], amount: '', remarks: '' });
      loadVendorData();
    } catch (e) { console.error('Error recording payment:', e); toast('Error recording payment', 'error'); }
  };

  if (loading) return <LoadingState message="Loading vendor details..." />;

  const fmtINR = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'purchases', label: 'Purchase History' },
    { id: 'payments', label: 'Payment History' },
    { id: 'ledger', label: 'Complete Ledger' },
    { id: 'material', label: 'Material Received' },
  ] as const;

  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition">
        <ArrowLeft size={16} /> Back to Vendors
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{vendor.name}</h1>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 mt-3 text-sm">
              <div><span className="text-gray-500">Vendor ID:</span> <span className="font-medium">{vendor.vendor_id}</span></div>
              <div><span className="text-gray-500">Mobile:</span> <span className="font-medium">{vendor.mobile || '-'}</span></div>
              <div><span className="text-gray-500">Status:</span> <Badge text={vendor.status || 'Active'} color={vendor.status === 'Active' ? 'green' : 'gray'} /></div>
              <div><span className="text-gray-500">Opening Bal:</span> <span className="font-medium">{fmtINR(Number(vendor.opening_balance))}</span></div>
              <div><span className="text-gray-500">Created:</span> <span className="font-medium">{new Date(vendor.created_at).toLocaleDateString()}</span></div>
              <div><span className="text-gray-500">Address:</span> <span className="font-medium">{vendor.address || '-'}</span></div>
            </div>
          </div>
          {editable && (
            <button onClick={() => setShowPaymentForm(true)} className={buttonClass.success}>
              <DollarSign size={16} /> Make Payment
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Purchase</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{fmtINR(stats.totalPurchase)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Paid</p>
          <p className="text-lg font-bold text-green-600 mt-1">{fmtINR(stats.totalPaid)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Outstanding</p>
          <p className="text-lg font-bold text-red-600 mt-1">{fmtINR(stats.outstanding)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Material Received</p>
          <p className="text-lg font-bold text-blue-600 mt-1">{fmt(stats.totalKg)} Kg</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Bags Received</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{stats.totalBags}</p>
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
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2"><Package size={18} className="text-blue-600" /><h3 className="text-sm font-semibold text-gray-900">Material Summary</h3></div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Total Bags:</span><span className="font-semibold">{stats.totalBags}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Total Kg:</span><span className="font-semibold">{fmt(stats.totalKg)} Kg</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Avg Rate/Kg:</span><span className="font-semibold">₹{fmt(stats.avgRate)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Total Value:</span><span className="font-semibold">{fmtINR(stats.totalPurchase)}</span></div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2"><DollarSign size={18} className="text-gray-600" /><h3 className="text-sm font-semibold text-gray-900">Financial Summary</h3></div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Opening Balance:</span><span className="font-semibold">{fmtINR(Number(vendor.opening_balance))}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Total Purchases:</span><span className="font-semibold">{fmtINR(stats.totalPurchase)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Total Paid:</span><span className="font-semibold text-green-600">{fmtINR(stats.totalPaid)}</span></div>
                    <div className="flex justify-between border-t pt-1.5"><span className="font-medium text-gray-900">Outstanding:</span><span className="font-bold text-red-600">{fmtINR(stats.outstanding)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'purchases' && (
            purchases.length === 0 ? <EmptyState message="No purchases from this vendor" /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Purchase No.</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Bags</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Kg</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Rate/Kg</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Paid</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Outstanding</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {purchases.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-sm">{new Date(p.purchase_date).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 text-sm font-medium text-blue-600">{p.purchase_number || '-'}</td>
                        <td className="px-4 py-2.5 text-sm text-right">{p.number_of_bags || '-'}</td>
                        <td className="px-4 py-2.5 text-sm text-right">{Number(p.quantity_kg).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 text-sm text-right">₹{Number(p.rate_per_kg).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-semibold">{fmtINR(Number(p.total_amount))}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-green-600">{fmtINR(Number(p.payment_made))}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-semibold text-red-600">{fmtINR(Number(p.balance_amount))}</td>
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
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Debit (Purchase)</th>
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

          {activeTab === 'material' && (
            receipts.length === 0 ? <EmptyState message="No material received from this vendor" /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Receipt No.</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Vehicle</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Challan</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Bags</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Gross (Kg)</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Tare (Kg)</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Net (Kg)</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {receipts.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-sm">{new Date(r.receipt_date).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 text-sm font-medium text-blue-600">{r.receipt_number}</td>
                        <td className="px-4 py-2.5 text-sm">{r.vehicle_number || '-'}</td>
                        <td className="px-4 py-2.5 text-sm">{r.challan_number || '-'}</td>
                        <td className="px-4 py-2.5 text-sm text-right">{r.number_of_bags || '-'}</td>
                        <td className="px-4 py-2.5 text-sm text-right">{Number(r.gross_weight).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 text-sm text-right">{Number(r.tare_weight).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-semibold">{Number(r.net_weight).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>

      <Modal open={showPaymentForm} onClose={() => setShowPaymentForm(false)} title="Vendor Payment" size="sm">
        <form onSubmit={handlePayment} className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 mb-2">
            <p className="text-sm text-gray-600">Vendor: <span className="font-semibold">{vendor.name}</span></p>
            <p className="text-sm text-gray-600">Outstanding: <span className="font-semibold text-red-600">{fmtINR(Number(vendor.balance))}</span></p>
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
