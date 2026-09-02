import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Package, TrendingUp, TrendingDown } from 'lucide-react';

interface StockData {
  current_stock_kg: number;
  last_updated: string;
}

interface StockMovement {
  type: 'purchase' | 'sale';
  date: string;
  quantity: number;
  rate: number;
  amount: number;
}

export const Stock = () => {
  const [stock, setStock] = useState<StockData | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPurchased, setTotalPurchased] = useState(0);
  const [totalSold, setTotalSold] = useState(0);

  useEffect(() => {
    loadStockData();
  }, []);

  const loadStockData = async () => {
    try {
      const [stockRes, purchasesRes, salesRes] = await Promise.all([
        supabase.from('stock').select('*').eq('product_name', 'Rice Bran').single(),
        supabase.from('purchases').select('purchase_date, quantity_kg, rate_per_kg, total_amount').order('purchase_date', { ascending: false }),
        supabase.from('sales').select('sale_date, quantity_kg, rate_per_kg, total_amount').order('sale_date', { ascending: false }),
      ]);

      if (stockRes.data) {
        setStock(stockRes.data);
      }

      const movementList: StockMovement[] = [];

      if (purchasesRes.data) {
        const totalPurch = purchasesRes.data.reduce((sum, p) => sum + Number(p.quantity_kg), 0);
        setTotalPurchased(totalPurch);
        purchasesRes.data.forEach((p) => {
          movementList.push({
            type: 'purchase',
            date: p.purchase_date,
            quantity: Number(p.quantity_kg),
            rate: Number(p.rate_per_kg),
            amount: Number(p.total_amount),
          });
        });
      }

      if (salesRes.data) {
        const totalSld = salesRes.data.reduce((sum, s) => sum + Number(s.quantity_kg), 0);
        setTotalSold(totalSld);
        salesRes.data.forEach((s) => {
          movementList.push({
            type: 'sale',
            date: s.sale_date,
            quantity: Number(s.quantity_kg),
            rate: Number(s.rate_per_kg),
            amount: Number(s.total_amount),
          });
        });
      }

      movementList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setMovements(movementList);
    } catch (error) {
      console.error('Error loading stock data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading stock data...</div>;
  }

  const currentStock = stock?.current_stock_kg || 0;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Stock Management</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Current Stock</p>
              <p className="text-3xl font-bold text-gray-900">{currentStock.toLocaleString('en-IN')} Kg</p>
            </div>
            <Package size={40} className="text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Purchased</p>
              <p className="text-3xl font-bold text-green-600">{totalPurchased.toLocaleString('en-IN')} Kg</p>
            </div>
            <TrendingUp size={40} className="text-green-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Sold</p>
              <p className="text-3xl font-bold text-red-600">{totalSold.toLocaleString('en-IN')} Kg</p>
            </div>
            <TrendingDown size={40} className="text-red-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
          <div>
            <p className="text-sm text-gray-600 mb-1">Last Updated</p>
            <p className="text-lg font-semibold text-gray-900">
              {stock?.last_updated ? new Date(stock.last_updated).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Stock Formula</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-4 py-2">
            <span className="text-gray-600">Opening Stock:</span>
            <span className="font-semibold">0 Kg</span>
          </div>
          <div className="flex items-center gap-4 py-2">
            <span className="text-gray-600">+ Total Purchases:</span>
            <span className="font-semibold text-green-600">+ {totalPurchased.toLocaleString('en-IN')} Kg</span>
          </div>
          <div className="border-t-2 border-gray-300 pt-2 flex items-center gap-4 py-2">
            <span className="text-gray-600">- Total Sales:</span>
            <span className="font-semibold text-red-600">- {totalSold.toLocaleString('en-IN')} Kg</span>
          </div>
          <div className="border-t-2 border-blue-300 pt-2 flex items-center gap-4 py-3 bg-blue-50 px-4 rounded-lg mt-2">
            <span className="text-gray-900 font-bold">= Current Stock:</span>
            <span className="font-bold text-2xl text-blue-600">{currentStock.toLocaleString('en-IN')} Kg</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Stock Movements</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Quantity (Kg)</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Rate/Kg</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {movements.map((movement, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{new Date(movement.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        movement.type === 'purchase' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {movement.type === 'purchase' ? 'Purchase' : 'Sale'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-semibold">
                    <span className={movement.type === 'purchase' ? 'text-green-600' : 'text-red-600'}>
                      {movement.type === 'purchase' ? '+' : '-'}{movement.quantity.toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right">₹{movement.rate.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">₹{movement.amount.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {movements.length === 0 && <p className="text-center py-8 text-gray-500">No stock movements found.</p>}
        </div>
      </div>
    </div>
  );
};
