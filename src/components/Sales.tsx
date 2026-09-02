import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, X, Trash2 } from 'lucide-react';

interface Customer {
  id: string;
  customer_id: string;
  name: string;
}

interface Sale {
  id: string;
  invoice_number: string;
  sale_date: string;
  customer_name: string;
  product_name: string;
  quantity_kg: number;
  rate_per_kg: number;
  total_amount: number;
  payment_received: number;
  outstanding_balance: number;
}

export const Sales = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentStock, setCurrentStock] = useState(0);
  const [formData, setFormData] = useState({
    sale_date: new Date().toISOString().split('T')[0],
    customer_name: '',
    product_name: 'Rice Bran',
    quantity_kg: '',
    rate_per_kg: '',
    payment_received: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [salesRes, customersRes, stockRes] = await Promise.all([
        supabase.from('sales').select('*').order('sale_date', { ascending: false }),
        supabase.from('customers').select('*').order('name'),
        supabase.from('stock').select('current_stock_kg').eq('product_name', 'Rice Bran').single(),
      ]);

      if (salesRes.error) throw salesRes.error;
      if (customersRes.error) throw customersRes.error;

      setSales(salesRes.data || []);
      setCustomers(customersRes.data || []);
      setCurrentStock(Number(stockRes.data?.current_stock_kg || 0));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateInvoiceNumber = async () => {
    const { count } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true });
    const invoiceNum = String((count || 0) + 1).padStart(5, '0');
    return `INV${invoiceNum}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const quantity = parseFloat(formData.quantity_kg);
      const rate = parseFloat(formData.rate_per_kg);
      const totalAmount = quantity * rate;
      const paymentReceived = parseFloat(formData.payment_received) || 0;
      const outstandingBalance = totalAmount - paymentReceived;

      if (quantity > currentStock) {
        alert(`Insufficient stock! Current stock: ${currentStock} Kg`);
        return;
      }

      const invoiceNumber = await generateInvoiceNumber();

      const { error: saleError } = await supabase.from('sales').insert({
        invoice_number: invoiceNumber,
        sale_date: formData.sale_date,
        customer_name: formData.customer_name,
        product_name: formData.product_name,
        quantity_kg: quantity,
        rate_per_kg: rate,
        total_amount: totalAmount,
        payment_received: paymentReceived,
        outstanding_balance: outstandingBalance,
      });

      if (saleError) throw saleError;

      const newStock = currentStock - quantity;
      await supabase
        .from('stock')
        .update({
          current_stock_kg: newStock,
          last_updated: new Date().toISOString(),
        })
        .eq('product_name', 'Rice Bran');

      setShowForm(false);
      setFormData({
        sale_date: new Date().toISOString().split('T')[0],
        customer_name: '',
        product_name: 'Rice Bran',
        quantity_kg: '',
        rate_per_kg: '',
        payment_received: '',
      });
      loadData();
    } catch (error) {
      console.error('Error creating sale:', error);
      alert('Error creating sale. Please try again.');
    }
  };

  const handleDelete = async (sale: Sale) => {
    if (!confirm('Are you sure you want to delete this sale?')) return;
    try {
      const newStock = currentStock + sale.quantity_kg;
      await supabase
        .from('stock')
        .update({
          current_stock_kg: newStock,
          last_updated: new Date().toISOString(),
        })
        .eq('product_name', 'Rice Bran');

      await supabase.from('sales').delete().eq('id', sale.id);
      loadData();
    } catch (error) {
      console.error('Error deleting sale:', error);
    }
  };

  const totalAmount = parseFloat(formData.quantity_kg) * parseFloat(formData.rate_per_kg) || 0;
  const outstandingBalance = totalAmount - (parseFloat(formData.payment_received) || 0);

  if (loading) {
    return <div className="text-center py-8">Loading sales...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales Invoice</h1>
          <p className="text-sm text-gray-600 mt-1">Current Stock: {currentStock.toLocaleString('en-IN')} Kg</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={20} />
          New Sale
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">New Sales Invoice</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sale Date *
                  </label>
                  <input
                    type="date"
                    value={formData.sale_date}
                    onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    list="customers-list"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Enter customer name"
                    required
                  />
                  <datalist id="customers-list">
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.name} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Name
                  </label>
                  <input
                    type="text"
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity (Kg) * <span className="text-xs text-gray-500">(Available: {currentStock} Kg)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.quantity_kg}
                    onChange={(e) => setFormData({ ...formData, quantity_kg: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    max={currentStock}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rate per Kg *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.rate_per_kg}
                    onChange={(e) => setFormData({ ...formData, rate_per_kg: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Received
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.payment_received}
                    onChange={(e) => setFormData({ ...formData, payment_received: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-700">Total Amount:</span>
                  <span className="font-bold text-gray-900">₹{totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Outstanding Balance:</span>
                  <span className="font-bold text-red-600">₹{outstandingBalance.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  Save Sale
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Invoice #</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Customer</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Product</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Quantity (Kg)</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Rate/Kg</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Total</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Received</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Balance</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-blue-600">{sale.invoice_number}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(sale.sale_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{sale.customer_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{sale.product_name}</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {sale.quantity_kg.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    ₹{sale.rate_per_kg.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                    ₹{sale.total_amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-green-600">
                    ₹{sale.payment_received.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-red-600 font-semibold">
                    ₹{sale.outstanding_balance.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    <button
                      onClick={() => handleDelete(sale)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.length === 0 && (
            <p className="text-center py-8 text-gray-500">No sales found. Create your first sale!</p>
          )}
        </div>
      </div>
    </div>
  );
};
