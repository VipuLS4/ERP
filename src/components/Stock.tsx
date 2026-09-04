import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Package, TrendingUp, TrendingDown, Layers, Scale } from 'lucide-react';
import { PageHeader, Badge } from './ui/Common';
import { LoadingState, EmptyState } from './ui/States';
import { DataTable, type Column } from './ui/DataTable';
import type { StockItem, StockMovement } from '../lib/types';

interface ProductStockSummary {
  product_name: string;
  product_type: string;
  opening_stock: number;
  received: number;
  produced: number;
  sold: number;
  consumed: number;
  adjusted: number;
  current_stock: number;
}

export const Stock = () => {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [summaries, setSummaries] = useState<ProductStockSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'raw-material' | 'finished' | 'ledger'>('overview');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [stRes, mvRes, pRes] = await Promise.all([
        supabase.from('stock').select('*, products!inner(product_type)').order('product_name'),
        supabase.from('stock_movements').select('*').order('movement_date', { ascending: false }).limit(200),
        supabase.from('products').select('*'),
      ]);

      setStockItems(stRes.data || []);
      setMovements(mvRes.data || []);

      const productList = pRes.data || [];
      const summaries: ProductStockSummary[] = productList.map(p => {
        const stock = (stRes.data || []).find(s => s.product_id === p.id || s.product_name === p.name);
        const productMovements = (mvRes.data || []).filter(m => m.product_name === p.name);
        const opening = Number(stock?.opening_stock_kg || 0);
        const received = productMovements.filter(m => m.transaction_type === 'Material Receiving').reduce((s, m) => s + Number(m.quantity_in), 0);
        const produced = productMovements.filter(m => m.transaction_type === 'Production').reduce((s, m) => s + Number(m.quantity_in), 0);
        const sold = productMovements.filter(m => m.transaction_type === 'Sale').reduce((s, m) => s + Number(m.quantity_out), 0);
        const consumed = productMovements.filter(m => m.transaction_type === 'Production').reduce((s, m) => s + Number(m.quantity_out), 0);
        const adjusted = productMovements.filter(m => m.transaction_type === 'Stock Adjustment' || m.transaction_type === 'Sale Reversal').reduce((s, m) => s + Number(m.quantity_in) - Number(m.quantity_out), 0);
        const current = Number(stock?.current_stock_kg || 0);
        return {
          product_name: p.name,
          product_type: p.product_type,
          opening_stock: opening,
          received,
          produced,
          sold,
          consumed,
          adjusted,
          current_stock: current,
        };
      });
      setSummaries(summaries);
    } catch (e) { console.error('Error loading stock data:', e); }
    finally { setLoading(false); }
  };

  if (loading) return <LoadingState message="Loading stock data..." />;

  const fmt = (n: number) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const rawMaterialSummary = summaries.filter(s => s.product_type === 'Raw Material');
  const finishedSummary = summaries.filter(s => s.product_type === 'Finished Product' || s.product_type === 'By-product');

  const ledgerColumns: Column<StockMovement>[] = [
    { key: 'movement_date', header: 'Date', sortable: true, render: (m) => new Date(m.movement_date).toLocaleDateString() },
    { key: 'transaction_number', header: 'Reference', render: (m) => m.transaction_number || '-' },
    { key: 'product_name', header: 'Product', render: (m) => <Badge text={m.product_name} color="blue" /> },
    { key: 'transaction_type', header: 'Transaction', render: (m) => <Badge text={m.transaction_type} color={m.transaction_type === 'Sale' ? 'red' : m.transaction_type === 'Production' ? 'amber' : m.transaction_type === 'Material Receiving' ? 'green' : 'gray'} /> },
    { key: 'quantity_in', header: 'Qty In', align: 'right', render: (m) => Number(m.quantity_in) > 0 ? <span className="text-green-600 font-medium">+{fmt(Number(m.quantity_in))}</span> : '-' },
    { key: 'quantity_out', header: 'Qty Out', align: 'right', render: (m) => Number(m.quantity_out) > 0 ? <span className="text-red-600 font-medium">-{fmt(Number(m.quantity_out))}</span> : '-' },
    { key: 'balance', header: 'Running Balance', align: 'right', render: (m) => <span className="font-semibold">{fmt(Number(m.balance))} Kg</span> },
    { key: 'remarks', header: 'Remarks', render: (m) => m.remarks || '-' },
  ];

  return (
    <div>
      <PageHeader title="Stock & Inventory" subtitle="Raw material and finished product inventory" />

      <div className="flex gap-2 mb-6 flex-wrap">
        {([
          { key: 'overview', label: 'Overview' },
          { key: 'raw-material', label: 'Raw Material (Rice Bran)' },
          { key: 'finished', label: 'Finished Products' },
          { key: 'ledger', label: 'Stock Ledger' },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab.key ? 'bg-forest-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stockItems.map(item => {
            const summary = summaries.find(s => s.product_name === item.product_name);
            const isRaw = summary?.product_type === 'Raw Material';
            return (
              <div key={item.id} className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 border-l-4 ${isRaw ? 'border-l-amber-500' : 'border-l-forest-600'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{item.product_name}</h3>
                    <p className="text-xs text-gray-500">{isRaw ? 'Raw Material' : 'Finished Product'}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${isRaw ? 'bg-amber-50 text-amber-600' : 'bg-forest-50 text-forest-700'}`}>
                    {isRaw ? <Layers size={24} /> : <Package size={24} />}
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">{fmt(Number(item.current_stock_kg))} <span className="text-base font-normal text-gray-500">Kg</span></div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Min: {fmt(Number(item.minimum_stock_kg))} Kg</span>
                  <span>Opening: {fmt(Number(item.opening_stock_kg))} Kg</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'raw-material' && (
        <div className="space-y-6">
          {rawMaterialSummary.map(s => (
            <div key={s.product_name} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b bg-amber-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{s.product_name}</h2>
                    <p className="text-sm text-gray-500">Raw Material Inventory</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Current Available Stock</p>
                    <p className="text-3xl font-bold text-amber-600">{fmt(s.current_stock)} <span className="text-base font-normal text-gray-500">Kg</span></p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Stock Calculation</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Opening Stock</span><span className="font-medium">{fmt(s.opening_stock)} Kg</span></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-gray-600">+ Material Received</span><span className="font-medium text-green-600">+ {fmt(s.received)} Kg</span></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-gray-600">- Used in Production</span><span className="font-medium text-red-600">- {fmt(s.consumed)} Kg</span></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-gray-600">± Adjustments</span><span className="font-medium">{s.adjusted >= 0 ? '+' : ''}{fmt(s.adjusted)} Kg</span></div>
                  <div className="flex justify-between py-3 bg-amber-50 rounded-lg px-4 mt-2"><span className="font-bold text-gray-900">= Current Stock</span><span className="font-bold text-lg text-amber-600">{fmt(s.current_stock)} Kg</span></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'finished' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b"><h2 className="text-xl font-bold text-gray-900">Finished Product Inventory</h2></div>
          {finishedSummary.length === 0 ? <EmptyState message="No finished products found" /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50"><tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Product</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Opening</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Produced</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Sold</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Adjustment</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Closing Stock</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {finishedSummary.map(s => (
                    <tr key={s.product_name} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-sm font-medium">{s.product_name}</td>
                      <td className="px-4 py-2.5 text-sm text-right">{fmt(s.opening_stock)}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-green-600">+{fmt(s.produced)}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-red-600">-{fmt(s.sold)}</td>
                      <td className="px-4 py-2.5 text-sm text-right">{s.adjusted >= 0 ? '+' : ''}{fmt(s.adjusted)}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-bold text-forest-700">{fmt(s.current_stock)} Kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'ledger' && (
        <div>
          {movements.length === 0 ? <EmptyState message="No stock movements found." /> : <DataTable columns={ledgerColumns} data={movements} searchKeys={['product_name', 'transaction_number', 'transaction_type']} searchPlaceholder="Search ledger..." />}
        </div>
      )}
    </div>
  );
};
