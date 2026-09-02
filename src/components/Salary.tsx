import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, X, Trash2, DollarSign } from 'lucide-react';

interface Employee {
  id: string;
  employee_id: string;
  name: string;
  mobile: string | null;
  designation: string | null;
  monthly_salary: number;
  salary_balance: number;
  status: string;
  joined_date: string | null;
}

interface SalaryPayment {
  id: string;
  employee_id: string;
  payment_date: string;
  amount_paid: number;
  month_year: string;
  notes: string | null;
  employees: { name: string; employee_id: string };
}

export const Salary = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'employees' | 'payments'>('employees');

  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    mobile: '',
    designation: '',
    monthly_salary: '',
    joined_date: '',
  });

  const [paymentForm, setPaymentForm] = useState({
    employee_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    amount_paid: '',
    month_year: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [employeesRes, paymentsRes] = await Promise.all([
        supabase.from('employees').select('*').order('created_at', { ascending: false }),
        supabase
          .from('salary_payments')
          .select('*, employees(name, employee_id)')
          .order('payment_date', { ascending: false }),
      ]);

      if (employeesRes.error) throw employeesRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      setEmployees(employeesRes.data || []);
      setPayments(paymentsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateEmployeeId = async () => {
    const { count } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true });
    return `EMP${String((count || 0) + 1).padStart(3, '0')}`;
  };

  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const employeeId = await generateEmployeeId();
      const { error } = await supabase.from('employees').insert({
        employee_id: employeeId,
        name: employeeForm.name,
        mobile: employeeForm.mobile || null,
        designation: employeeForm.designation || null,
        monthly_salary: parseFloat(employeeForm.monthly_salary),
        joined_date: employeeForm.joined_date || null,
      });

      if (error) throw error;

      setShowEmployeeForm(false);
      setEmployeeForm({ name: '', mobile: '', designation: '', monthly_salary: '', joined_date: '' });
      loadData();
    } catch (error) {
      console.error('Error creating employee:', error);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amountPaid = parseFloat(paymentForm.amount_paid);

      const { error: paymentError } = await supabase.from('salary_payments').insert({
        employee_id: paymentForm.employee_id,
        payment_date: paymentForm.payment_date,
        amount_paid: amountPaid,
        month_year: paymentForm.month_year,
        notes: paymentForm.notes || null,
      });

      if (paymentError) throw paymentError;

      const employee = employees.find(e => e.id === paymentForm.employee_id);
      const newBalance = (employee?.salary_balance || 0) - amountPaid;

      await supabase
        .from('employees')
        .update({ salary_balance: newBalance })
        .eq('id', paymentForm.employee_id);

      setShowPaymentForm(false);
      setPaymentForm({
        employee_id: '',
        payment_date: new Date().toISOString().split('T')[0],
        amount_paid: '',
        month_year: '',
        notes: '',
      });
      loadData();
    } catch (error) {
      console.error('Error creating payment:', error);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    try {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting employee:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Salary Management</h1>
        <div className="flex gap-3">
          {activeTab === 'employees' && (
            <button
              onClick={() => setShowEmployeeForm(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <Plus size={20} />
              Add Employee
            </button>
          )}
          {activeTab === 'payments' && (
            <button
              onClick={() => setShowPaymentForm(true)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
            >
              <DollarSign size={20} />
              Record Payment
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('employees')}
          className={`px-6 py-2 rounded-lg font-medium transition ${
            activeTab === 'employees'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Employees
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-6 py-2 rounded-lg font-medium transition ${
            activeTab === 'payments'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Payment History
        </button>
      </div>

      {showEmployeeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Add New Employee</h2>
              <button onClick={() => setShowEmployeeForm(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleEmployeeSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={employeeForm.name}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                <input
                  type="tel"
                  value={employeeForm.mobile}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, mobile: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                <input
                  type="text"
                  value={employeeForm.designation}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, designation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Salary *</label>
                <input
                  type="number"
                  step="0.01"
                  value={employeeForm.monthly_salary}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, monthly_salary: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Joining Date</label>
                <input
                  type="date"
                  value={employeeForm.joined_date}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, joined_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  Add Employee
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmployeeForm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Record Salary Payment</h2>
              <button onClick={() => setShowPaymentForm(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
                <select
                  value={paymentForm.employee_id}
                  onChange={(e) => setPaymentForm({ ...paymentForm, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employee_id})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
                <input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid *</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentForm.amount_paid}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount_paid: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month/Year *</label>
                <input
                  type="text"
                  value={paymentForm.month_year}
                  onChange={(e) => setPaymentForm({ ...paymentForm, month_year: e.target.value })}
                  placeholder="e.g., January 2024"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={2}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
                >
                  Save Payment
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentForm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'employees' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Employee ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Designation</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Mobile</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Monthly Salary</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Balance</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {employees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{employee.employee_id}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{employee.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{employee.designation || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{employee.mobile || '-'}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">
                      ₹{employee.monthly_salary.toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-red-600 font-semibold">
                      ₹{employee.salary_balance.toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        employee.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {employee.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <button
                        onClick={() => handleDeleteEmployee(employee.id)}
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
            {employees.length === 0 && (
              <p className="text-center py-8 text-gray-500">No employees found. Add your first employee!</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Employee</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Month/Year</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Amount Paid</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{payment.employees.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{payment.month_year}</td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-green-600">
                      ₹{payment.amount_paid.toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{payment.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {payments.length === 0 && (
              <p className="text-center py-8 text-gray-500">No payments found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
