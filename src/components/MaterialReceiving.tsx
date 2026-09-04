import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { canEdit } from '../lib/auth';
import { logAudit, generateTransactionNumber } from '../lib/auth';
import type { MaterialReceipt, Vendor, Product } from '../lib/types';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { DataTable, type Column } from './ui/DataTable';
import { PageHeader, Badge, FormField, inputClass, buttonClass } from './ui/Common';
import { LoadingState, EmptyState } from './ui/States';
import { useToast } from './ui/Toast';

export const MaterialReceiving = () => {
  const { role } = useAuth();
  const { toast } = useToast();
  const editable = canEdit(role || undefined);
  const [receipts, setReceipts] = useState<MaterialReceipt[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MaterialReceipt | null>(null);
  const [formData, setFormData] = useState({
    receipt_date: new Date().toISOString().split('T')[0],
    vendor_id: '',
    vehicle_number: '',
    challan_number: '',
    number_of_bags: '',
    gross_weight: '',
    tare_weight: '',
    material_type: 'Rice Bran',
    product_id: '',
    purchase_rate: '',
    received_by: '',
    remarks: '',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [rRes, vRes, pRes] = await Promise.all([
        supabase.from('material_receipts').select('*').order('receipt_date', { ascending: false }),
        supabase.from('vendors').select('*').order('name'),
        supabase.from('products').select('*').eq('product_type', 'Raw Material').eq('is_active', true),
      ]);
      setReceipts(rRes.data || []);
      setVendors(vRes.data || []);
      setProducts(pRes.data || []);
    } catch (e) { console.error('Error loading data:', e); }
    finally { setLoading(false); }
  };

  const netWeight = (parseFloat(formData.gross_weight) || 0) - (parseFloat(formData.tare_weight) || 0);
  const purchaseRate = parseFloat(formData.purchase_rate) || 0;
  const totalPurchaseValue = netWeight * purchaseRate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const receiptNumber = await generateTransactionNumber('material_receipts', 'MR', 'receipt_number');
      const gross = parseFloat(formData.gross_weight) || 0;
      const tare = parseFloat(formData.tare_weight) || 0;
      const net = gross - tare;
      const vendor = vendors.find(v => v.id === formData.vendor_id);
      const product = products.find(p => p.id === formData.product_id);
      const productName = product?.name || formData.material_type;

      const { data: receiptData, error } = await supabase.from('material_receipts').insert({
        receipt_number: receiptNumber,
        receipt_date: formData.receipt_date,
        vendor_id: formData.vendor_id || null,
        vendor_name: vendor?.name || null,
        vehicle_number: formData.vehicle_number || null,
        challan_number: formData.challan_number || null,
        number_of_bags: formData.number_of_bags ? parseInt(formData.number_of_bags) : null,
        gross_weight: gross,
        tare_weight: tare,
        net_weight: net,
        material_type: productName,
        product_id: formData.product_id || null,
        purchase_rate_per_kg: purchaseRate,
        total_purchase_value: totalPurchaseValue,
        received_by: formData.received_by || null,
        remarks: formData.remarks || null,
        status: 'Received',
      }).select().single();

      if (error) throw error;

      // Update stock
      const { data: stockData } = await supabase.from('stock').select('id, current_stock_kg').eq('product_name', productName).maybeSingle();
      if (stockData) {
        const newStock = Number(stockData.current_stock_kg) + net;
        await supabase.from('stock').update({ current_stock_kg: newStock, last_updated: new Date().toISOString() }).eq('id', stockData.id);
        await supabase.from('stock_movements').insert({
          movement_date: formData.receipt_date,
          transaction_number: receiptNumber,
          product_name: productName,
          transaction_type: 'Material Receiving',
          quantity_in: net,
          quantity_out: 0,
          balance: newStock,
          reference: 'Material Receiving',
          reference_id: receiptData.id,
          created_by: formData.received_by || null,
          remarks: `Received ${net} Kg @ ₹${purchaseRate}/Kg = ₹${totalPurchaseValue} (Gross: ${gross}, Tare: ${tare})`,
        });
      }

      await logAudit('Material received', 'Material Receiving', receiptNumber);
      toast('Material received successfully', 'success');
      setShowForm(false);
      setFormData({ receipt_date: new Date().toISOString().split('T')[0], vendor_id: '', vehicle_number: '', challan_number: '', number_of_bags: '', gross_weight: '', tare_weight: '', material_type: 'Rice Bran', product_id: '', purchase_rate: '', received_by: '', remarks: '' });
      loadData();
    } catch (e) { console.error('Error creating receipt:', e); toast('Error creating receipt', 'error'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { data: stockData } = await supabase.from('stock').select('id, current_stock_kg').eq('product_name', deleteTarget.material_type).maybeSingle();
      if (stockData) {
        const newStock = Number(stockData.current_stock_kg) - Number(deleteTarget.net_weight);
        await supabase.from('stock').update({ current_stock_kg: newStock, last_updated: new Date().toISOString() }).eq('id', stockData.id);
        await supabase.from('stock_movements').insert({
          movement_date: new Date().toISOString().split('T')[0],
          transaction_number: deleteTarget.receipt_number,
          product_name: deleteTarget.material_type,
          transaction_type: 'Material Reversal',
          quantity_in: 0,
          quantity_out: Number(deleteTarget.net_weight),
          balance: newStock,
          reference: 'Material Receiving',
          reference_id: deleteTarget.id,
          remarks: `Stock reversed from deleted receipt ${deleteTarget.receipt_number}`,
        });
      }
      await supabase.from('material_receipts').delete().eq('id', deleteTarget.id);
      await logAudit('Material receipt deleted', 'Material Receiving', deleteTarget.receipt_number);
      toast('Receipt deleted and stock reversed', 'success');
      loadData();
    } catch (e) { console.error('Error deleting receipt:', e); toast('Error deleting receipt', 'error'); }
    setDeleteTarget(null);
  };

  const columns: Column<MaterialReceipt>[] = [
    { key: 'receipt_number', header: 'Receipt #', sortable: true, render: (r) => <span className="font-medium text-blue-600">{r.receipt_number}</span> },
    { key: 'receipt_date', header: 'Date', sortable: true, render: (r) => new Date(r.receipt_date).toLocaleDateString() },
    { key: 'vendor_name', header: 'Vendor', render: (r) => r.vendor_name || '-' },
    { key: 'vehicle_number', header: 'Vehicle', render: (r) => r.vehicle_number || '-' },
    { key: 'challan_number', header: 'Challan', render: (r) => r.challan_number || '-' },
    { key: 'number_of_bags', header: 'Bags', align: 'right', render: (r) => r.number_of_bags || '-' },
    { key: 'gross_weight', header: 'Gross (Kg)', align: 'right', render: (r) => Number(r.gross_weight).toLocaleString('en-IN') },
    { key: 'tare_weight', header: 'Tare (Kg)', align: 'right', render: (r) => Number(r.tare_weight).toLocaleString('en-IN') },
    { key: 'net_weight', header: 'Net (Kg)', align: 'right', sortable: true, render: (r) => <span className="font-semibold">{Number(r.net_weight).toLocaleString('en-IN')}</span> },
    { key: 'purchase_rate_per_kg', header: 'Rate/Kg', align: 'right', render: (r) => r.purchase_rate_per_kg ? `₹${Number(r.purchase_rate_per_kg).toLocaleString('en-IN')}` : '-' },
    { key: 'total_purchase_value', header: 'Total Value', align: 'right', render: (r) => r.total_purchase_value ? `₹${Number(r.total_purchase_value).toLocaleString('en-IN')}` : '-' },
    { key: 'material_type', header: 'Material', render: (r) => <Badge text={r.material_type} color="blue" /> },
    { key: 'status', header: 'Status', align: 'center', render: (r) => <Badge text={r.status} color="green" /> },
    { key: 'actions', header: '', align: 'center', render: (r) => editable && <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete"><Trash2 size={16} /></button> },
  ];

  if (loading) return <LoadingState message="Loading material receipts..." />;

  return (
    <div>
      <PageHeader
        title="Material Receiving"
        subtitle={`${receipts.length} receipts recorded`}
        actions={editable && <button onClick={() => setShowForm(true)} className={buttonClass.primary}><Plus size={16} /> New Receipt</button>}
      />

      {receipts.length === 0 ? <EmptyState message="No receipts found. Record your first material receipt!" /> : <DataTable columns={columns} data={receipts} searchKeys={['receipt_number', 'vehicle_number', 'challan_number', 'vendor_name']} searchPlaceholder="Search receipts..." />}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Material Receipt" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Receipt Date" required><input type="date" value={formData.receipt_date} onChange={(e) => setFormData({ ...formData, receipt_date: e.target.value })} className={inputClass} required /></FormField>
            <FormField label="Vendor">
              <select value={formData.vendor_id} onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })} className={inputClass}>
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
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Gross Weight (Kg)" required><input type="number" step="0.01" value={formData.gross_weight} onChange={(e) => setFormData({ ...formData, gross_weight: e.target.value })} className={inputClass} required /></FormField>
            <FormField label="Tare Weight (Kg)" required><input type="number" step="0.01" value={formData.tare_weight} onChange={(e) => setFormData({ ...formData, tare_weight: e.target.value })} className={inputClass} required /></FormField>
            <FormField label="Material Type" required>
              <select value={formData.product_id} onChange={(e) => setFormData({ ...formData, product_id: e.target.value, material_type: products.find(p => p.id === e.target.value)?.name || 'Rice Bran' })} className={inputClass} required>
                <option value="">Select Material</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Purchase Rate per Kg"><input type="number" step="0.01" value={formData.purchase_rate} onChange={(e) => setFormData({ ...formData, purchase_rate: e.target.value })} className={inputClass} /></FormField>
            <FormField label="Received By"><input type="text" value={formData.received_by} onChange={(e) => setFormData({ ...formData, received_by: e.target.value })} className={inputClass} /></FormField>
          </div>
          <FormField label="Remarks"><input type="text" value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} className={inputClass} /></FormField>

          <div className="bg-blue-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Net Weight (Gross - Tare):</span>
              <span className="font-bold text-blue-600 text-lg">{netWeight.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Kg</span>
            </div>
            {purchaseRate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Purchase Value:</span>
                <span className="font-bold text-green-600 text-lg">₹{totalPurchaseValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className={buttonClass.primary + ' flex-1 justify-center'}>Save Receipt</button>
            <button type="button" onClick={() => setShowForm(false)} className={buttonClass.secondary + ' flex-1 justify-center'}>Cancel</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Receipt" message="Are you sure you want to delete this material receipt? Stock will be adjusted." confirmLabel="Delete" />
    </div>
  );
};
