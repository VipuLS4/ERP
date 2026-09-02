import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { canEdit } from '../lib/auth';
import { logAudit, generateTransactionNumber } from '../lib/auth';
import type { Customer, CustomerTransaction } from '../lib/types';
import { Plus, Eye, Trash2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { DataTable, type Column } from './ui/DataTable';
import { PageHeader, Badge, FormField, inputClass, buttonClass } from './ui/Common';
import { LoadingState, EmptyState } from './ui/States';
import { useToast } from './ui/Toast';

export const Customers = () => {
  const { role } = useAuth();
  const { toast } = useToast();
  const editable = canEdit(role || undefined);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
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
      const customerId = await generateTransactionNumber('customers', 'CUS', 'customer_id');
      const openingBal = parseFloat(formData.opening_balance) || 0;
      const { error } = await supabase.from('customers').insert({
        customer_id: customerId,
        name: formData.name,
        mobile: formData.mobile || null,
        address: formData.address || null,
        opening_balance: openingBal,
        balance: openingBal,
        status: formData.status,
        remarks: formData.remarks || null,
      });
      if (error) throw error;

      if (openingBal > 0) {
        const { data: newCust } = await supabase.from('customers').select('id').eq('customer_id', customerId).maybeSingle();
        if (newCust) {
          await supabase.from('customer_transactions').insert({
            customer_id: newCust.id,
            transaction_date: new Date().toISOString().split('T')[0],
            transaction_type: 'Opening Balance',
            amount: openingBal,
            debit: openingBal,
            credit: 0,
            balance: openingBal,
            notes: 'Opening balance',
          });
        }
      }

      await logAudit('Customer created', 'Customers', customerId);
      toast('Customer created successfully', 'success');
      setShowForm(false);
      setFormData({ name: '', mobile: '', address: '', opening_balance: '', status: 'Active', remarks: '' });
      loadCustomers();
    } catch (e) { console.error('Error creating customer:', e); toast('Error creating customer', 'error'); }
  };

  const loadLedger = async (customer: Customer) => {
    try {
      const { data, error } = await supabase.from('customer_transactions').select('*').eq('customer_id', customer.id).order('transaction_date', { ascending: false });
      if (error) throw error;
      setTransactions(data || []);
      setSelectedCustomer(customer);
      setShowLedger(true);
    } catch (e) { console.error('Error loading ledger:', e); }
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
    { key: 'address', header: 'Address', render: (c) => c.address || '-' },
    { key: 'opening_balance', header: 'Opening Bal', align: 'right', render: (c) => `₹${Number(c.opening_balance || 0).toLocaleString('en-IN')}` },
    { key: 'balance', header: 'Outstanding', align: 'right', sortable: true, render: (c) => <span className="font-semibold text-red-600">₹{Number(c.balance).toLocaleString('en-IN')}</span> },
    { key: 'status', header: 'Status', align: 'center', render: (c) => <Badge text={c.status || 'Active'} color={c.status === 'Active' ? 'green' : 'gray'} /> },
    {
      key: 'actions', header: 'Actions', align: 'center',
      render: (c) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); loadLedger(c); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="View Ledger"><Eye size={16} /></button>
          {editable && <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete"><Trash2 size={16} /></button>}
        </div>
      ),
    },
  ];

  if (loading) return <LoadingState message="Loading customers..." />;

  return (
    <div>
      <PageHeader
        title="Customer Management"
        subtitle={`${customers.length} customers registered`}
        actions={editable && <button onClick={() => setShowForm(true)} className={buttonClass.primary}><Plus size={16} /> Add Customer</button>}
      />

      {customers.length === 0 ? (
        <EmptyState message="No customers found. Add your first customer!" />
      ) : (
        <DataTable columns={columns} data={customers} searchKeys={['name', 'customer_id', 'mobile']} searchPlaceholder="Search customers..." />
      )}

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
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
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

      <Modal open={showLedger} onClose={() => setShowLedger(false)} title={`${selectedCustomer?.name} — Ledger`} size="xl">
        {selectedCustomer && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-blue-50 rounded-lg p-3"><p className="text-xs text-gray-500">Customer ID</p><p className="font-semibold text-blue-700">{selectedCustomer.customer_id}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Mobile</p><p className="font-semibold">{selectedCustomer.mobile || '-'}</p></div>
              <div className="bg-red-50 rounded-lg p-3"><p className="text-xs text-gray-500">Outstanding</p><p className="font-bold text-red-600">₹{Number(selectedCustomer.balance).toLocaleString('en-IN')}</p></div>
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
        title="Delete Customer"
        message={`Are you sure you want to delete customer "${deleteTarget?.name}"? This will also delete all related transactions.`}
        confirmLabel="Delete"
      />
    </div>
  );
};
