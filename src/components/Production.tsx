import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { canEdit } from '../lib/auth';
import { logAudit, generateTransactionNumber } from '../lib/auth';
import type { ProductionBatch, ProductionOutput, Machine, Product, StockItem } from '../lib/types';
import { Plus, Trash2, Eye, Play, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { DataTable, type Column } from './ui/DataTable';
import { PageHeader, Badge, FormField, inputClass, buttonClass } from './ui/Common';
import { LoadingState, EmptyState } from './ui/States';
import { useToast } from './ui/Toast';

const SHIFTS = ['Morning', 'Afternoon', 'Night'];

interface OutputRow {
  product_id: string;
  product_name: string;
  quantity: string;
  is_waste: boolean;
}

export const Production = () => {
  const { role } = useAuth();
  const { toast } = useToast();
  const editable = canEdit(role || undefined);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showOutputs, setShowOutputs] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<ProductionBatch | null>(null);
  const [outputs, setOutputs] = useState<ProductionOutput[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ProductionBatch | null>(null);

  const [formData, setFormData] = useState({
    batch_date: new Date().toISOString().split('T')[0],
    shift: 'Morning',
    supervisor: '',
    operator: '',
    machine_id: '',
    raw_material_product_id: '',
    input_quantity_kg: '',
    start_time: '',
    end_time: '',
    remarks: '',
  });

  const [outputRows, setOutputRows] = useState<OutputRow[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [bRes, mRes, pRes, sRes] = await Promise.all([
        supabase.from('production_batches').select('*').order('batch_date', { ascending: false }),
        supabase.from('machines').select('*').order('name'),
        supabase.from('products').select('*').eq('is_active', true),
        supabase.from('stock').select('*'),
      ]);
      setBatches(bRes.data || []);
      setMachines(mRes.data || []);
      setProducts(pRes.data || []);
      setStockItems(sRes.data || []);
    } catch (e) { console.error('Error loading data:', e); }
    finally { setLoading(false); }
  };

  const rawMaterialProducts = products.filter(p => p.product_type === 'Raw Material');
  const outputProducts = products.filter(p => p.product_type !== 'Raw Material');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const batchNumber = await generateTransactionNumber('production_batches', 'PROD', 'batch_number');
      const machine = machines.find(m => m.id === formData.machine_id);
      const rawMat = products.find(p => p.id === formData.raw_material_product_id);

      const { error } = await supabase.from('production_batches').insert({
        batch_number: batchNumber,
        batch_date: formData.batch_date,
        shift: formData.shift,
        supervisor: formData.supervisor || null,
        operator: formData.operator || null,
        machine_id: formData.machine_id || null,
        machine_name: machine?.name || null,
        raw_material_product_id: formData.raw_material_product_id || null,
        raw_material_name: rawMat?.name || 'Rice Bran',
        input_quantity_kg: parseFloat(formData.input_quantity_kg),
        start_time: formData.start_time ? new Date(formData.start_time).toISOString() : null,
        end_time: formData.end_time ? new Date(formData.end_time).toISOString() : null,
        status: 'Started',
        remarks: formData.remarks || null,
      }).select().single();

      if (error) throw error;

      await logAudit('Production batch created', 'Production', batchNumber);
      toast('Production batch created', 'success');
      setShowForm(false);
      setFormData({ batch_date: new Date().toISOString().split('T')[0], shift: 'Morning', supervisor: '', operator: '', machine_id: '', raw_material_product_id: '', input_quantity_kg: '', start_time: '', end_time: '', remarks: '' });
      loadData();
    } catch (e) { console.error('Error creating batch:', e); toast('Error creating batch', 'error'); }
  };

  const openOutputs = async (batch: ProductionBatch) => {
    try {
      const { data, error } = await supabase.from('production_outputs').select('*').eq('batch_id', batch.id).order('created_at');
      if (error) throw error;
      setOutputs(data || []);
      setSelectedBatch(batch);
      if (data && data.length > 0) {
        setOutputRows(data.map(o => ({ product_id: o.product_id || '', product_name: o.product_name, quantity: String(o.output_quantity_kg), is_waste: o.is_waste })));
      } else {
        setOutputRows(outputProducts.map(p => ({ product_id: p.id, product_name: p.name, quantity: '', is_waste: p.product_type === 'Waste' })));
      }
      setShowOutputs(true);
    } catch (e) { console.error('Error loading outputs:', e); }
  };

  const totalOutput = outputRows.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
  const inputQty = selectedBatch?.input_quantity_kg || 0;
  const wasteQty = outputRows.filter(r => r.is_waste).reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
  const saleableOutput = totalOutput - wasteQty;
  const yieldPct = inputQty > 0 ? (saleableOutput / inputQty) * 100 : 0;
  const lossPct = inputQty > 0 ? (wasteQty / inputQty) * 100 : 0;
  const exceedsInput = totalOutput > inputQty;

  const isBalanced = inputQty > 0 && inputQty === totalOutput;
  const unbalancedDiff = inputQty - totalOutput;

  const handleSaveOutputs = async () => {
    if (!selectedBatch) return;
    if (exceedsInput) {
      toast('Production output cannot exceed input quantity!', 'error');
      return;
    }
    if (!isBalanced) {
      toast(`Production not balanced! Difference: ${unbalancedDiff.toLocaleString('en-IN')} Kg. Input must equal total accounted quantity.`, 'error');
      return;
    }

    try {
      // Prevent duplicate stock movements: if batch was already completed, reverse previous movements first
      const wasCompleted = selectedBatch.status === 'Completed';

      if (wasCompleted) {
        // Reverse previous stock movements for this batch
        const { data: prevMovements } = await supabase.from('stock_movements').select('*').eq('reference_id', selectedBatch.id).eq('reference', 'Production Batch');
        if (prevMovements && prevMovements.length > 0) {
          for (const m of prevMovements) {
            const stockItem = stockItems.find(s => s.product_name === m.product_name);
            if (stockItem) {
              const reversal = Number(m.quantity_out) - Number(m.quantity_in);
              const restoredStock = Number(stockItem.current_stock_kg) + reversal;
              await supabase.from('stock').update({ current_stock_kg: restoredStock, last_updated: new Date().toISOString() }).eq('id', stockItem.id);
            }
          }
          await supabase.from('stock_movements').delete().eq('reference_id', selectedBatch.id).eq('reference', 'Production Batch');
        }
      }

      // Delete existing outputs
      await supabase.from('production_outputs').delete().eq('batch_id', selectedBatch.id);

      // Insert new outputs
      const validOutputs = outputRows.filter(r => parseFloat(r.quantity) > 0);
      if (validOutputs.length > 0) {
        await supabase.from('production_outputs').insert(validOutputs.map(r => ({
          batch_id: selectedBatch.id,
          product_id: r.product_id || null,
          product_name: r.product_name,
          output_quantity_kg: parseFloat(r.quantity),
          is_waste: r.is_waste,
        })));
      }

      // Update batch
      await supabase.from('production_batches').update({
        total_output_kg: totalOutput,
        waste_kg: wasteQty,
        yield_percent: yieldPct,
        process_loss_percent: lossPct,
        status: 'Completed',
        end_time: new Date().toISOString(),
      }).eq('id', selectedBatch.id);

      // Stock movements: decrease raw material, increase finished products
      const rawMatStock = stockItems.find(s => s.product_id === selectedBatch.raw_material_product_id || s.product_name === selectedBatch.raw_material_name);
      if (rawMatStock) {
        const newRawStock = Number(rawMatStock.current_stock_kg) - inputQty;
        await supabase.from('stock').update({ current_stock_kg: newRawStock, last_updated: new Date().toISOString() }).eq('id', rawMatStock.id);
        await supabase.from('stock_movements').insert({
          movement_date: selectedBatch.batch_date,
          transaction_number: selectedBatch.batch_number,
          product_id: selectedBatch.raw_material_product_id || null,
          product_name: selectedBatch.raw_material_name,
          transaction_type: 'Production',
          quantity_in: 0,
          quantity_out: inputQty,
          balance: newRawStock,
          reference: 'Production Batch',
          reference_id: selectedBatch.id,
          remarks: `Raw material consumed for ${selectedBatch.batch_number}`,
        });
      }

      // Increase finished product stock
      for (const out of validOutputs) {
        const productName = out.product_name;
        const { data: existingStock } = await supabase.from('stock').select('id, current_stock_kg').eq('product_name', productName).maybeSingle();
        if (existingStock) {
          const newStock = Number(existingStock.current_stock_kg) + parseFloat(out.quantity);
          await supabase.from('stock').update({ current_stock_kg: newStock, last_updated: new Date().toISOString() }).eq('id', existingStock.id);
          await supabase.from('stock_movements').insert({
            movement_date: selectedBatch.batch_date,
            transaction_number: selectedBatch.batch_number,
            product_id: out.product_id || null,
            product_name: productName,
            transaction_type: 'Production',
            quantity_in: parseFloat(out.quantity),
            quantity_out: 0,
            balance: newStock,
            reference: 'Production Batch',
            reference_id: selectedBatch.id,
            remarks: `Output from ${selectedBatch.batch_number}${out.is_waste ? ' (Waste)' : ''}`,
          });
        }
      }

      await logAudit('Production completed', 'Production', selectedBatch.batch_number);
      toast('Production completed successfully', 'success');
      setShowOutputs(false);
      loadData();
    } catch (e) { console.error('Error saving outputs:', e); toast('Error saving outputs', 'error'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.status === 'Completed') {
        const { data: prevMovements } = await supabase.from('stock_movements').select('*').eq('reference_id', deleteTarget.id).eq('reference', 'Production Batch');
        if (prevMovements && prevMovements.length > 0) {
          for (const m of prevMovements) {
            const { data: stockItem } = await supabase.from('stock').select('id, current_stock_kg').eq('product_name', m.product_name).maybeSingle();
            if (stockItem) {
              const reversal = Number(m.quantity_out) - Number(m.quantity_in);
              const restoredStock = Number(stockItem.current_stock_kg) + reversal;
              await supabase.from('stock').update({ current_stock_kg: restoredStock, last_updated: new Date().toISOString() }).eq('id', stockItem.id);
            }
          }
          await supabase.from('stock_movements').delete().eq('reference_id', deleteTarget.id).eq('reference', 'Production Batch');
        }
      }
      await supabase.from('production_outputs').delete().eq('batch_id', deleteTarget.id);
      await supabase.from('production_batches').delete().eq('id', deleteTarget.id);
      await logAudit('Production batch deleted', 'Production', deleteTarget.batch_number);
      toast('Batch deleted and stock reversed', 'success');
      loadData();
    } catch (e) { console.error('Error deleting batch:', e); toast('Error deleting batch', 'error'); }
    setDeleteTarget(null);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'green';
      case 'Started': return 'blue';
      case 'In Process': return 'amber';
      case 'Cancelled': return 'red';
      default: return 'gray';
    }
  };

  const columns: Column<ProductionBatch>[] = [
    { key: 'batch_number', header: 'Batch #', sortable: true, render: (b) => <span className="font-medium text-blue-600">{b.batch_number}</span> },
    { key: 'batch_date', header: 'Date', sortable: true, render: (b) => new Date(b.batch_date).toLocaleDateString() },
    { key: 'shift', header: 'Shift', render: (b) => b.shift || '-' },
    { key: 'raw_material_name', header: 'Raw Material' },
    { key: 'input_quantity_kg', header: 'Input (Kg)', align: 'right', sortable: true, render: (b) => Number(b.input_quantity_kg).toLocaleString('en-IN') },
    { key: 'total_output_kg', header: 'Output (Kg)', align: 'right', render: (b) => Number(b.total_output_kg).toLocaleString('en-IN') },
    { key: 'yield_percent', header: 'Yield %', align: 'right', render: (b) => b.yield_percent ? `${Number(b.yield_percent).toFixed(1)}%` : '-' },
    { key: 'waste_kg', header: 'Waste (Kg)', align: 'right', render: (b) => b.waste_kg ? Number(b.waste_kg).toLocaleString('en-IN') : '-' },
    { key: 'machine_name', header: 'Machine', render: (b) => b.machine_name || '-' },
    { key: 'status', header: 'Status', align: 'center', render: (b) => <Badge text={b.status} color={statusColor(b.status) as 'green' | 'blue' | 'amber' | 'red' | 'gray'} /> },
    {
      key: 'actions', header: 'Actions', align: 'center',
      render: (b) => (
        <div className="flex items-center justify-center gap-1">
          {editable && b.status !== 'Completed' && b.status !== 'Cancelled' && (
            <button onClick={(e) => { e.stopPropagation(); openOutputs(b); }} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition" title="Enter Output"><Play size={16} /></button>
          )}
          <button onClick={(e) => { e.stopPropagation(); openOutputs(b); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="View Details"><Eye size={16} /></button>
          {editable && <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(b); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete"><Trash2 size={16} /></button>}
        </div>
      ),
    },
  ];

  if (loading) return <LoadingState message="Loading production batches..." />;

  return (
    <div>
      <PageHeader
        title="Production / Filtration"
        subtitle={`${batches.length} production batches`}
        actions={editable && <button onClick={() => setShowForm(true)} className={buttonClass.primary}><Plus size={16} /> New Batch</button>}
      />

      {batches.length === 0 ? <EmptyState message="No production batches found. Create your first batch!" /> : <DataTable columns={columns} data={batches} searchKeys={['batch_number', 'supervisor', 'operator', 'machine_name']} searchPlaceholder="Search batches..." />}

      {/* New Batch Form */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Production Batch" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Batch Date" required><input type="date" value={formData.batch_date} onChange={(e) => setFormData({ ...formData, batch_date: e.target.value })} className={inputClass} required /></FormField>
            <FormField label="Shift" required>
              <select value={formData.shift} onChange={(e) => setFormData({ ...formData, shift: e.target.value })} className={inputClass}>
                {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Supervisor"><input type="text" value={formData.supervisor} onChange={(e) => setFormData({ ...formData, supervisor: e.target.value })} className={inputClass} /></FormField>
            <FormField label="Operator"><input type="text" value={formData.operator} onChange={(e) => setFormData({ ...formData, operator: e.target.value })} className={inputClass} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Machine / Production Line">
              <select value={formData.machine_id} onChange={(e) => setFormData({ ...formData, machine_id: e.target.value })} className={inputClass}>
                <option value="">Select Machine</option>
                {machines.map(m => <option key={m.id} value={m.id}>{m.name} ({m.machine_id})</option>)}
              </select>
            </FormField>
            <FormField label="Raw Material" required>
              <select value={formData.raw_material_product_id} onChange={(e) => setFormData({ ...formData, raw_material_product_id: e.target.value })} className={inputClass} required>
                <option value="">Select Raw Material</option>
                {rawMaterialProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Input Quantity (Kg)" required><input type="number" step="0.01" value={formData.input_quantity_kg} onChange={(e) => setFormData({ ...formData, input_quantity_kg: e.target.value })} className={inputClass} required /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Time"><input type="datetime-local" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} className={inputClass} /></FormField>
            <FormField label="End Time"><input type="datetime-local" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} className={inputClass} /></FormField>
          </div>
          <FormField label="Remarks"><input type="text" value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} className={inputClass} /></FormField>
          <div className="flex gap-3 pt-2">
            <button type="submit" className={buttonClass.primary + ' flex-1 justify-center'}>Create Batch</button>
            <button type="button" onClick={() => setShowForm(false)} className={buttonClass.secondary + ' flex-1 justify-center'}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Production Output Modal */}
      <Modal open={showOutputs} onClose={() => setShowOutputs(false)} title={`${selectedBatch?.batch_number} — Production Output`} size="lg">
        {selectedBatch && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Input</p><p className="font-bold">{Number(selectedBatch.input_quantity_kg).toLocaleString('en-IN')} Kg</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Raw Material</p><p className="font-semibold text-sm">{selectedBatch.raw_material_name}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Shift</p><p className="font-semibold text-sm">{selectedBatch.shift || '-'}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Status</p><Badge text={selectedBatch.status} color={statusColor(selectedBatch.status) as 'green' | 'blue' | 'amber' | 'red' | 'gray'} /></div>
            </div>

            {selectedBatch.status !== 'Completed' && editable ? (
              <>
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Enter actual production output:</p>
                  {outputRows.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="flex-1">
                        <span className="text-sm font-medium">{row.product_name}</span>
                        {row.is_waste && <Badge text="Waste" color="red" />}
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={row.quantity}
                        onChange={(e) => {
                          const newRows = [...outputRows];
                          newRows[idx].quantity = e.target.value;
                          setOutputRows(newRows);
                        }}
                        className={inputClass + ' w-32'}
                        placeholder="0.00 Kg"
                      />
                    </div>
                  ))}
                </div>

                <div className={`rounded-lg p-4 ${exceedsInput ? 'bg-red-50 border border-red-200' : 'bg-blue-50'}`}>
                  {exceedsInput ? (
                    <div className="flex items-center gap-2 text-red-700">
                      <XCircle size={18} />
                      <p className="text-sm font-medium">Production output cannot exceed input quantity!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex justify-between"><span className="text-gray-600">Total Output:</span><span className="font-bold">{totalOutput.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Kg</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Saleable Output:</span><span className="font-bold text-green-600">{saleableOutput.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Kg</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Waste:</span><span className="font-bold text-red-600">{wasteQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Kg</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Balance:</span><span className="font-bold">{(inputQty - totalOutput).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Kg</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Yield %:</span><span className="font-bold text-green-600">{yieldPct.toFixed(1)}%</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Process Loss %:</span><span className="font-bold text-red-600">{lossPct.toFixed(1)}%</span></div>
                      </div>
                      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${inputQty - totalOutput === 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {inputQty - totalOutput === 0 ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                        <span className="text-sm font-medium">
                          {inputQty - totalOutput === 0
                            ? `Production Balanced — Input (${inputQty.toLocaleString('en-IN')} Kg) = Total Accounted (${totalOutput.toLocaleString('en-IN')} Kg)`
                            : `Unbalanced — Difference: ${(inputQty - totalOutput).toLocaleString('en-IN')} Kg (Input: ${inputQty.toLocaleString('en-IN')} Kg, Accounted: ${totalOutput.toLocaleString('en-IN')} Kg)`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={handleSaveOutputs} disabled={exceedsInput || !isBalanced} className={buttonClass.success + ' flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed'}>
                    <CheckCircle size={16} /> Complete Production
                  </button>
                  <button onClick={() => setShowOutputs(false)} className={buttonClass.secondary + ' flex-1 justify-center'}>Close</button>
                </div>
              </>
            ) : (
              <>
                {outputs.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full">
                      <thead className="bg-gray-50"><tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Product</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Quantity (Kg)</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase">Type</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {outputs.map(o => (
                          <tr key={o.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-sm font-medium">{o.product_name}</td>
                            <td className="px-4 py-2.5 text-sm text-right font-semibold">{Number(o.output_quantity_kg).toLocaleString('en-IN')} Kg</td>
                            <td className="px-4 py-2.5 text-sm text-center">{o.is_waste ? <Badge text="Waste" color="red" /> : <Badge text="Output" color="green" />}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <EmptyState message="No output recorded yet" />}

                <div className="grid grid-cols-2 gap-3 text-sm bg-blue-50 rounded-lg p-4">
                  <div className="flex justify-between"><span className="text-gray-600">Yield %:</span><span className="font-bold text-green-600">{Number(selectedBatch.yield_percent || 0).toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Process Loss %:</span><span className="font-bold text-red-600">{Number(selectedBatch.process_loss_percent || 0).toFixed(1)}%</span></div>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Batch" message={`Are you sure you want to delete batch "${deleteTarget?.batch_number}"?`} confirmLabel="Delete" />
    </div>
  );
};
