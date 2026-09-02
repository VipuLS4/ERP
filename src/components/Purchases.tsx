import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { canEdit } from '../lib/auth';
import { logAudit, generateTransactionNumber } from '../lib/auth';
import type { Purchase, Vendor } from '../lib/types';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { DataTable, type Column } from './ui/DataTable';
import { PageHeader, Badge, FormField, inputClass, buttonClass } from './ui/Common';
import { LoadingState, EmptyState } from './ui/States';
import { useToast } from './ui/Toast';

export const Purchases = () => {
  const { role } = useAuth();
  const { toast } = useToast();
  const editable = canEdit(role || undefined);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null);
  const [formData, setFormData] = useState({
    purchase_date: new Date().toISOString().split('T')[0],
    vendor_id: '',
    quantity_kg: '',
    rate_per_kg: '',
    other_charges: '',
    payment_made: '',
    vehicle_number: '',
    challan_number: '',
    number_of_bags: '',
    remarks: '',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [pRes, vRes] = await Promise.all([
        supabase.from('purchases').select('*, vendors(name, vendor_id)').order('purchase_date', { ascending: false }),
        supabase.from('vendors').select('*').order('name'),
      ]);
      if (pRes.error) throw pRes.error;
      setPurchases(pRes.data || []);
      setVendors(vRes.data || []);
    } catch (e) { console.error('Error loading data:', e); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const quantity = parseFloat(formData.quantity_kg);
      const rate = parseFloat(formData.rate_per_kg);
      const otherCharges = parseFloat(formData.other_charges) || 0;
      const totalAmount = quantity * rate + otherCharges;
      const paymentMade = parseFloat(formData.payment_made) || 0;
      const balanceAmount = totalAmount - paymentMade;

      const purchaseNumber = await generateTransactionNumber('purchases', 'PUR', 'purchase_number');

      const { data: purchaseData, error: purchaseError } = await supabase.from('purchases').insert({
        purchase_number: purchaseNumber,
        purchase_date: formData.purchase_date,
        vendor_id: formData.vendor_id,
        quantity_kg: quantity,
        rate_per_kg: rate,
        total_amount: totalAmount,
        other_charges: otherCharges,
        payment_made: paymentMade,
        balance_amount: balanceAmount,
        vehicle_number: formData.vehicle_number || null,
        challan_number: formData.challan_number || null,
        number_of_bags: formData.number_of_bags ? parseInt(formData.number_of_bags) : null,
        payment_method: 'Direct',
        remarks: formData.remarks || null,
        status: 'Approved',
      }).select().single();

      if (purchaseError) throw purchaseError;

      // Update vendor balance
      const vendor = vendors.find(v => v.id === formData.vendor_id);
      const newVendorBalance = (vendor?.balance || 0) + balanceAmount;
      await supabase.from('vendors').update({ balance: newVendorBalance }).eq('id', formData.vendor_id);

      // Vendor transaction
      await supabase.from('vendor_transactions').insert({
        vendor_id: formData.vendor_id,
        transaction_date: formData.purchase_date,
        transaction_type: 'Purchase',
        purchase_id: purchaseData.id,
        amount: totalAmount,
        debit: totalAmount,
        credit: paymentMade,
        balance: newVendorBalance,
        notes: `Purchase ${purchaseNumber}: ${quantity} Kg @ ₹${rate}/Kg`,
      });

      // Update stock
      const { data: stockData } = await supabase.from('stock').select('id, current_stock_kg').eq('product_name', 'Rice Bran').maybeSingle();
      if (stockData) {
        const newStock = Number(stockData.current_stock_kg) + quantity;
        await supabase.from('stock').update({ current_stock_kg: newStock, last_updated: new Date().toISOString() }).eq('id', stockData.id);
        await supabase.from('stock_movements').insert({
          movement_date: formData.purchase_date,
          transaction_number: purchaseNumber,
          product_name: 'Rice Bran',
          transaction_type: 'Purchase',
          quantity_in: quantity,
          quantity_out: 0,
          balance: newStock,
          reference: 'Purchase',
          reference_id: purchaseData.id,
          remarks: `Purchase from ${vendor?.name}`,
        });
      }

      await logAudit('Purchase created', 'Purchases', purchaseNumber);
      toast('Purchase created successfully', 'success');
      setShowForm(false);
      setFormData({ purchase_date: new Date().toISOString().split('T')[0], vendor_id: '', quantity_kg: '', rate_per_kg: '', other_charges: '', payment_made: '', vehicle_number: '', challan_number: '', number_of_bags: '', remarks: '' });
      loadData();
    } catch (e) { console.error('Error creating purchase:', e); toast('Error creating purchase', 'error'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const vendor = vendors.find(v => v.id === deleteTarget.vendor_id);
      const newVendorBalance = (vendor?.balance || 0) - deleteTarget.balance_amount;
      await supabase.from('vendors').update({ balance: newVendorBalance }).eq('id', deleteTarget.vendor_id);

      const { data: stockData } = await supabase.from('stock').select('current_stock_kg').eq('product_name', 'Rice Bran').maybeSingle();
      if (stockData) {
        const newStock = Number(stockData.current_stock_kg) - deleteTarget.quantity_kg;
        await supabase.from('stock').update({ current_stock_kg: newStock, last_updated: new Date().toISOString() }).eq('product_name', 'Rice Bran');
      }

      await supabase.from('vendor_transactions').delete().eq('purchase_id', deleteTarget.id);
      await supabase.from('purchases').delete().eq('id', deleteTarget.id);
      await logAudit('Purchase deleted', 'Purchases', deleteTarget.purchase_number || '');
      toast('Purchase deleted', 'success');
      loadData();
    } catch (e) { console.error('Error deleting purchase:', e); toast('Error deleting purchase', 'error'); }
    setDeleteTarget(null);
  };

  const totalAmount = (parseFloat(formData.quantity_kg) || 0) * (parseFloat(formData.rate_per_kg) || 0) + (parseFloat(formData.other_charges) || 0);
  const balanceAmount = totalAmount - (parseFloat(formData.payment_made) || 0);

  const columns: Column<Purchase>[] = [
    { key: 'purchase_number', header: 'Purchase #', sortable: true, render: (p) => <span className="font-medium text-blue-600">{p.purchase_number || '-'}</span> },
    { key: 'purchase_date', header: 'Date', sortable: true, render: (p) => new Date(p.purchase_date).toLocaleDateString() },
    { key: 'vendor', header: 'Vendor', render: (p) => p.vendors?.name || '-' },
    { key: 'vehicle_number', header: 'Vehicle', render: (p) => p.vehicle_number || '-' },
    { key: 'quantity_kg', header: 'Qty (Kg)', align: 'right', sortable: true, render: (p) => Number(p.quantity_kg).toLocaleString('en-IN') },
    { key: 'rate_per_kg', header: 'Rate/Kg', align: 'right', render: (p) => `₹${Number(p.rate_per_kg).toLocaleString('en-IN')}` },
    { key: 'total_amount', header: 'Total', align: 'right', sortable: true, render: (p) => <span className="font-semibold">₹{Number(p.total_amount).toLocaleString('en-IN')}</span> },
    { key: 'payment_made', header: 'Paid', align: 'right', render: (p) => <span className="text-green-600">₹{Number(p.payment_made).toLocaleString('en-IN')}</span> },
    { key: 'balance_amount', header: 'Balance', align: 'right', render: (p) => <span className="font-semibold text-red-600">₹{Number(p.balance_amount).toLocaleString('en-IN')}</span> },
    { key: 'status', header: 'Status', align: 'center', render: (p) => <Badge text={p.status || 'Approved'} color="green" /> },
    { key: 'actions', header: '', align: 'center', render: (p) => editable && <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete"><Trash2 size={16} /></button> },
  ];

  if (loading) return <LoadingState message="Loading purchases..." />;

  return (
    <div>
      <PageHeader
        title="Purchase Management"
        subtitle={`${purchases.length} purchase records`}
        actions={editable && <button onClick={() => setShowForm(true)} className={buttonClass.primary}><Plus size={16} /> New Purchase</button>}
      />

      {purchases.length === 0 ? <EmptyState message="No purchases found. Create your first purchase!" /> : <DataTable columns={columns} data={purchases} searchKeys={['purchase_number', 'vehicle_number', 'challan_number']} searchPlaceholder="Search purchases..." />}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Purchase Entry" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Purchase Date" required><input type="date" value={formData.purchase_date} onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })} className={inputClass} required /></FormField>
            <FormField label="Vendor" required>
              <select value={formData.vendor_id} onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })} className={inputClass} required>
                <option value="">Select Vendor</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name} ({v.vendor_id})</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Vehicle Number"><input type="text" value={formData.vehicle_number} onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })} className={inputClass} /></FormField>
            <FormField label="Challan Number"><input type="text" value={formData.challan_number} onChange={(e) => setFormData({ ...formData, challan_number: e.target.value })} className={inputClass} /></FormField>
            <FormField label="Number of Bags"><input type="number" value={formData.number_of_bags} onChange={(e) => setFormData({ ...formData, number_of_bags: e.target.value })} className={inputClass} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Quantity (Kg)" required><input type="number" step="0.01" value={formData.quantity_kg} onChange={(e) => setFormData({ ...formData, quantity_kg: e.target.value })} className={inputClass} required /></FormField>
            <FormField label="Rate per Kg" required><input type="number" step="0.01" value={formData.rate_per_kg} onChange={(e) => setFormData({ ...formData, rate_per_kg: e.target.value })} className={inputClass} required /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Other Charges"><input type="number" step="0.01" value={formData.other_charges} onChange={(e) => setFormData({ ...formData, other_charges: e.target.value })} className={inputClass} placeholder="0.00" /></FormField>
            <FormField label="Payment Made"><input type="number" step="0.01" value={formData.payment_made} onChange={(e) => setFormData({ ...formData, payment_made: e.target.value })} className={inputClass} placeholder="0.00" /></FormField>
          </div>
          <FormField label="Remarks"><input type="text" value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} className={inputClass} /></FormField>

          <div className="bg-blue-50 rounded-lg p-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Total Amount:</span><span className="font-bold">₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Outstanding Balance:</span><span className="font-bold text-red-600">₹{balanceAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className={buttonClass.primary + ' flex-1 justify-center'}>Save Purchase</button>
            <button type="button" onClick={() => setShowForm(false)} className={buttonClass.secondary + ' flex-1 justify-center'}>Cancel</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Purchase" message="Are you sure you want to delete this purchase? Stock and vendor balance will be adjusted." confirmLabel="Delete" />
    </div>
  );
};
