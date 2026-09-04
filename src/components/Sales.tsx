import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { canEdit } from '../lib/auth';
import { logAudit, generateTransactionNumber } from '../lib/auth';
import type { Sale, Customer, Product, StockItem } from '../lib/types';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { DataTable, type Column } from './ui/DataTable';
import { PageHeader, Badge, FormField, inputClass, buttonClass } from './ui/Common';
import { LoadingState, EmptyState } from './ui/States';
import { useToast } from './ui/Toast';

export const Sales = () => {
  const { role } = useAuth();
  const { toast } = useToast();
  const editable = canEdit(role || undefined);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const [formData, setFormData] = useState({
    sale_date: new Date().toISOString().split('T')[0],
    customer_id: '',
    product_id: '',
    quantity_kg: '',
    rate_per_kg: '',
    payment_received: '',
    payment_date: new Date().toISOString().split('T')[0],
    remarks: '',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [sRes, cRes, pRes, stRes] = await Promise.all([
        supabase.from('sales').select('*').order('sale_date', { ascending: false }),
        supabase.from('customers').select('*').order('name'),
        supabase.from('products').select('*').eq('is_active', true).neq('product_type', 'Raw Material'),
        supabase.from('stock').select('*'),
      ]);
      setSales(sRes.data || []);
      setCustomers(cRes.data || []);
      setProducts(pRes.data || []);
      setStockItems(stRes.data || []);
    } catch (e) { console.error('Error loading sales data:', e); }
    finally { setLoading(false); }
  };

  const availableStock = (productName: string): number => {
    const item = stockItems.find(s => s.product_name === productName);
    return item ? Number(item.current_stock_kg) : 0;
  };

  const selectedProduct = products.find(p => p.id === formData.product_id);
  const selectedProductName = selectedProduct?.name || '';
  const currentStock = availableStock(selectedProductName);
  const quantity = parseFloat(formData.quantity_kg) || 0;
  const rate = parseFloat(formData.rate_per_kg) || 0;
  const totalAmount = quantity * rate;
  const paymentReceived = parseFloat(formData.payment_received) || 0;
  const outstandingBalance = totalAmount - paymentReceived;
  const insufficientStock = quantity > currentStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) { toast('Please select a product', 'error'); return; }
    if (insufficientStock) { toast(`Insufficient stock! Available: ${currentStock} Kg`, 'error'); return; }

    try {
      const invoiceNumber = await generateTransactionNumber('sales', 'INV', 'invoice_number');
      const customer = customers.find(c => c.id === formData.customer_id);
      const productName = selectedProduct.name;

      const { data: saleData, error } = await supabase.from('sales').insert({
        invoice_number: invoiceNumber,
        sale_date: formData.sale_date,
        customer_id: formData.customer_id || null,
        customer_name: customer?.name || 'Walk-in Customer',
        customer_mobile: customer?.mobile || null,
        customer_address: customer?.address || null,
        product_name: productName,
        product_id: formData.product_id,
        quantity_kg: quantity,
        rate_per_kg: rate,
        total_amount: totalAmount,
        discount: 0,
        tax_amount: 0,
        other_charges: 0,
        payment_received: paymentReceived,
        outstanding_balance: outstandingBalance,
        payment_method: 'Cash',
        payment_status: outstandingBalance <= 0 ? 'Paid' : 'Partial',
        remarks: formData.remarks || null,
        status: 'Completed',
      }).select().single();

      if (error) throw error;

      // Reduce stock
      const stockItem = stockItems.find(s => s.product_name === productName);
      if (stockItem) {
        const newStock = Number(stockItem.current_stock_kg) - quantity;
        await supabase.from('stock').update({ current_stock_kg: newStock, last_updated: new Date().toISOString() }).eq('id', stockItem.id);
        await supabase.from('stock_movements').insert({
          movement_date: formData.sale_date,
          transaction_number: invoiceNumber,
          product_id: formData.product_id,
          product_name: productName,
          transaction_type: 'Sale',
          quantity_in: 0,
          quantity_out: quantity,
          balance: newStock,
          reference: 'Sales Invoice',
          reference_id: saleData.id,
          remarks: `Sold ${quantity} Kg to ${customer?.name || 'Walk-in'}`,
        });
      }

      // Update customer balance
      if (customer) {
        const newBalance = Number(customer.balance) + outstandingBalance;
        await supabase.from('customers').update({ balance: newBalance }).eq('id', customer.id);
        await supabase.from('customer_transactions').insert({
          customer_id: customer.id,
          transaction_date: formData.sale_date,
          transaction_type: 'Sale',
          sale_id: saleData.id,
          amount: totalAmount,
          debit: totalAmount,
          credit: 0,
          balance: newBalance,
          notes: `Invoice ${invoiceNumber}`,
        });
        if (paymentReceived > 0) {
          const balAfter = newBalance - paymentReceived;
          await supabase.from('customers').update({ balance: balAfter }).eq('id', customer.id);
          await supabase.from('customer_transactions').insert({
            customer_id: customer.id,
            transaction_date: formData.payment_date,
            transaction_type: 'Payment',
            sale_id: saleData.id,
            amount: paymentReceived,
            debit: 0,
            credit: paymentReceived,
            balance: balAfter,
            notes: `Payment for ${invoiceNumber}`,
          });
        }
      }

      await logAudit('Sale created', 'Sales', invoiceNumber);
      toast('Sale recorded successfully', 'success');
      setShowForm(false);
      setFormData({ sale_date: new Date().toISOString().split('T')[0], customer_id: '', product_id: '', quantity_kg: '', rate_per_kg: '', payment_received: '', payment_date: new Date().toISOString().split('T')[0], remarks: '' });
      loadData();
    } catch (e) { console.error('Error creating sale:', e); toast('Error creating sale', 'error'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      // Restore stock
      const stockItem = stockItems.find(s => s.product_name === deleteTarget.product_name);
      if (stockItem) {
        const newStock = Number(stockItem.current_stock_kg) + Number(deleteTarget.quantity_kg);
        await supabase.from('stock').update({ current_stock_kg: newStock, last_updated: new Date().toISOString() }).eq('id', stockItem.id);
        await supabase.from('stock_movements').insert({
          movement_date: new Date().toISOString().split('T')[0],
          transaction_number: deleteTarget.invoice_number,
          product_name: deleteTarget.product_name,
          transaction_type: 'Sale Reversal',
          quantity_in: Number(deleteTarget.quantity_kg),
          quantity_out: 0,
          balance: newStock,
          reference: 'Sale Deleted',
          reference_id: deleteTarget.id,
          remarks: `Stock restored from deleted invoice ${deleteTarget.invoice_number}`,
        });
      }
      await supabase.from('sales').delete().eq('id', deleteTarget.id);
      await logAudit('Sale deleted', 'Sales', deleteTarget.invoice_number);
      toast('Sale deleted and stock restored', 'success');
      loadData();
    } catch (e) { console.error('Error deleting sale:', e); toast('Error deleting sale', 'error'); }
    setDeleteTarget(null);
  };

  const columns: Column<Sale>[] = [
    { key: 'invoice_number', header: 'Invoice #', sortable: true, render: (s) => <span className="font-medium text-forest-700">{s.invoice_number}</span> },
    { key: 'sale_date', header: 'Date', sortable: true, render: (s) => new Date(s.sale_date).toLocaleDateString() },
    { key: 'customer_name', header: 'Customer', render: (s) => s.customer_name },
    { key: 'product_name', header: 'Product', render: (s) => <Badge text={s.product_name} color="blue" /> },
    { key: 'quantity_kg', header: 'Qty (Kg)', align: 'right', sortable: true, render: (s) => Number(s.quantity_kg).toLocaleString('en-IN') },
    { key: 'rate_per_kg', header: 'Rate/Kg', align: 'right', render: (s) => `₹${Number(s.rate_per_kg).toLocaleString('en-IN')}` },
    { key: 'total_amount', header: 'Total', align: 'right', sortable: true, render: (s) => <span className="font-semibold">₹{Number(s.total_amount).toLocaleString('en-IN')}</span> },
    { key: 'payment_received', header: 'Received', align: 'right', render: (s) => <span className="text-green-600">₹{Number(s.payment_received).toLocaleString('en-IN')}</span> },
    { key: 'outstanding_balance', header: 'Outstanding', align: 'right', render: (s) => <span className={Number(s.outstanding_balance) > 0 ? 'text-red-600 font-semibold' : ''}>₹{Number(s.outstanding_balance).toLocaleString('en-IN')}</span> },
    { key: 'status', header: 'Status', align: 'center', render: (s) => <Badge text={s.payment_status} color={s.payment_status === 'Paid' ? 'green' : 'amber'} /> },
    { key: 'actions', header: '', align: 'center', render: (s) => editable && <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete"><Trash2 size={16} /></button> },
  ];

  if (loading) return <LoadingState message="Loading sales..." />;

  return (
    <div>
      <PageHeader
        title="Sales"
        subtitle={`${sales.length} invoices recorded`}
        actions={editable && <button onClick={() => setShowForm(true)} className={buttonClass.primary}><Plus size={16} /> New Sale</button>}
      />

      {sales.length === 0 ? <EmptyState message="No sales found. Create your first sales invoice!" /> : <DataTable columns={columns} data={sales} searchKeys={['invoice_number', 'customer_name', 'product_name']} searchPlaceholder="Search sales..." />}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Sales Invoice" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Invoice Date" required><input type="date" value={formData.sale_date} onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })} className={inputClass} required /></FormField>
            <FormField label="Customer" required>
              <select value={formData.customer_id} onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })} className={inputClass} required>
                <option value="">Select Customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.customer_id})</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Product" required>
              <select value={formData.product_id} onChange={(e) => { const p = products.find(p => p.id === e.target.value); setFormData({ ...formData, product_id: e.target.value, rate_per_kg: p ? String(p.sale_rate) : '' }); }} className={inputClass} required>
                <option value="">Select Product</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.product_type})</option>)}
              </select>
            </FormField>
            <FormField label={`Quantity (Kg) ${selectedProductName ? `(Available: ${currentStock} Kg)` : ''}`} required>
              <input type="number" step="0.01" value={formData.quantity_kg} onChange={(e) => setFormData({ ...formData, quantity_kg: e.target.value })} className={inputClass} max={currentStock} required disabled={!formData.product_id} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Rate per Kg" required><input type="number" step="0.01" value={formData.rate_per_kg} onChange={(e) => setFormData({ ...formData, rate_per_kg: e.target.value })} className={inputClass} required /></FormField>
            <FormField label="Payment Received"><input type="number" step="0.01" value={formData.payment_received} onChange={(e) => setFormData({ ...formData, payment_received: e.target.value })} className={inputClass} /></FormField>
          </div>
          <FormField label="Payment Date"><input type="date" value={formData.payment_date} onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })} className={inputClass} /></FormField>
          <FormField label="Remarks"><input type="text" value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} className={inputClass} /></FormField>

          <div className={`rounded-lg p-4 ${insufficientStock ? 'bg-red-50 border border-red-200' : 'bg-forest-50'}`}>
            {insufficientStock ? (
              <p className="text-sm font-medium text-red-700">Insufficient stock! Available: {currentStock} Kg, Requested: {quantity} Kg</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Total Amount:</span><span className="font-bold">₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Outstanding:</span><span className="font-bold text-red-600">₹{outstandingBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className={buttonClass.primary + ' flex-1 justify-center'} disabled={insufficientStock}>Save Sale</button>
            <button type="button" onClick={() => setShowForm(false)} className={buttonClass.secondary + ' flex-1 justify-center'}>Cancel</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Sale" message={`Are you sure you want to delete invoice "${deleteTarget?.invoice_number}"? Stock will be restored.`} confirmLabel="Delete" />
    </div>
  );
};
