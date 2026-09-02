import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { canEdit } from '../lib/auth';
import { logAudit, generateTransactionNumber } from '../lib/auth';
import type { Vendor, VendorTransaction } from '../lib/types';
import { Plus, Eye, Trash2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { DataTable, type Column } from './ui/DataTable';
import { PageHeader, Badge, FormField, inputClass, buttonClass } from './ui/Common';
import { LoadingState, EmptyState } from './ui/States';
import { useToast } from './ui/Toast';

export const Vendors = () => {
  const { role } = useAuth();
  const { toast } = useToast();
  const editable = canEdit(role || undefined);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [transactions, setTransactions] = useState<VendorTransaction[]>([]);
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
      const vendorId = await generateTransactionNumber('vendors', 'VEN', 'vendor_id');
      const openingBal = parseFloat(formData.opening_balance) || 0;
      const { error } = await supabase.from('vendors').insert({
        vendor_id: vendorId,
        name: formData.name,
        mobile: formData.mobile,
        address: formData.address || null,
        opening_balance: openingBal,
        balance: openingBal,
        status: formData.status,
        remarks: formData.remarks || null,
      });
      if (error) throw error;

      if (openingBal > 0) {
        await supabase.from('vendor_transactions').insert({
          vendor_id: (await supabase.from('vendors').select('id').eq('vendor_id', vendorId).maybeSingle()).data?.id,
          transaction_date: new Date().toISOString().split('T')[0],
          transaction_type: 'Opening Balance',
          amount: openingBal,
          debit: openingBal,
          credit: 0,
          balance: openingBal,
          notes: 'Opening balance',
        });
      }

      await logAudit('Vendor created', 'Vendors', vendorId);
      toast('Vendor created successfully', 'success');
      setShowForm(false);
      setFormData({ name: '', mobile: '', address: '', opening_balance: '', status: 'Active', remarks: '' });
      loadVendors();
    } catch (e) { console.error('Error creating vendor:', e); toast('Error creating vendor', 'error'); }
  };

  const loadLedger = async (vendor: Vendor) => {
    try {
      const { data, error } = await supabase.from('vendor_transactions').select('*').eq('vendor_id', vendor.id).order('transaction_date', { ascending: false });
      if (error) throw error;
      setTransactions(data || []);
      setSelectedVendor(vendor);
      setShowLedger(true);
    } catch (e) { console.error('Error loading ledger:', e); }
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
    { key: 'address', header: 'Address', render: (v) => v.address || '-' },
    { key: 'opening_balance', header: 'Opening Bal', align: 'right', render: (v) => `₹${Number(v.opening_balance || 0).toLocaleString('en-IN')}` },
    { key: 'balance', header: 'Outstanding', align: 'right', sortable: true, render: (v) => <span className="font-semibold text-red-600">₹{Number(v.balance).toLocaleString('en-IN')}</span> },
    { key: 'status', header: 'Status', align: 'center', render: (v) => <Badge text={v.status || 'Active'} color={v.status === 'Active' ? 'green' : 'gray'} /> },
    {
      key: 'actions', header: 'Actions', align: 'center',
      render: (v) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); loadLedger(v); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="View Ledger"><Eye size={16} /></button>
          {editable && <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(v); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete"><Trash2 size={16} /></button>}
        </div>
      ),
    },
  ];

  if (loading) return <LoadingState message="Loading vendors..." />;

  return (
    <div>
      <PageHeader
        title="Vendor Management"
        subtitle={`${vendors.length} vendors registered`}
        actions={editable && <button onClick={() => setShowForm(true)} className={buttonClass.primary}><Plus size={16} /> Add Vendor</button>}
      />

      {vendors.length === 0 ? (
        <EmptyState message="No vendors found. Add your first vendor!" />
      ) : (
        <DataTable columns={columns} data={vendors} searchKeys={['name', 'vendor_id', 'mobile']} searchPlaceholder="Search vendors..." />
      )}

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
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
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

      <Modal open={showLedger} onClose={() => setShowLedger(false)} title={`${selectedVendor?.name} — Ledger`} size="xl">
        {selectedVendor && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-blue-50 rounded-lg p-3"><p className="text-xs text-gray-500">Vendor ID</p><p className="font-semibold text-blue-700">{selectedVendor.vendor_id}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Mobile</p><p className="font-semibold">{selectedVendor.mobile}</p></div>
              <div className="bg-red-50 rounded-lg p-3"><p className="text-xs text-gray-500">Outstanding</p><p className="font-bold text-red-600">₹{Number(selectedVendor.balance).toLocaleString('en-IN')}</p></div>
            </div>
            {transactions.length === 0 ? <EmptyState message="No transactions found" /> : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Debit</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Credit</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Balance</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Notes</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-sm">{new Date(t.transaction_date).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 text-sm"><Badge text={t.transaction_type} color="blue" /></td>
                        <td className="px-4 py-2.5 text-sm text-right text-red-600">{t.debit > 0 ? `₹${Number(t.debit).toLocaleString('en-IN')}` : '-'}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-green-600">{t.credit > 0 ? `₹${Number(t.credit).toLocaleString('en-IN')}` : '-'}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-semibold">₹{Number(t.balance).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-500">{t.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Vendor"
        message={`Are you sure you want to delete vendor "${deleteTarget?.name}"? This will also delete all related transactions.`}
        confirmLabel="Delete"
      />
    </div>
  );
};
