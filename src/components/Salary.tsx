import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { canEdit } from '../lib/auth';
import { logAudit, generateTransactionNumber } from '../lib/auth';
import type { Employee, SalaryPayment } from '../lib/types';
import { Plus, Trash2, Eye, DollarSign, History } from 'lucide-react';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { DataTable, type Column } from './ui/DataTable';
import { PageHeader, Badge, FormField, inputClass, buttonClass } from './ui/Common';
import { LoadingState, EmptyState } from './ui/States';
import { useToast } from './ui/Toast';

export const Salary = () => {
  const { role } = useAuth();
  const { toast } = useToast();
  const editable = canEdit(role || undefined);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'records' | 'history'>('records');
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [showReleaseForm, setShowReleaseForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SalaryPayment | null>(null);
  const [historyTarget, setHistoryTarget] = useState<SalaryPayment | null>(null);
  const [releasePayments, setReleasePayments] = useState<SalaryPayment[]>([]);

  const [employeeForm, setEmployeeForm] = useState({ name: '', mobile: '', designation: '', monthly_salary: '', joined_date: '' });
  const [salaryForm, setSalaryForm] = useState({
    employee_id: '',
    month_year: '',
    gross_salary: '',
    advance: '',
    deduction: '',
    remarks: '',
  });
  const [releaseForm, setReleaseForm] = useState({
    salary_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    amount_paid: '',
    payment_method: 'Cash',
    notes: '',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [eRes, pRes] = await Promise.all([
        supabase.from('employees').select('*').order('name'),
        supabase.from('salary_payments').select('*').order('payment_date', { ascending: false }),
      ]);
      setEmployees(eRes.data || []);
      setPayments(pRes.data || []);
    } catch (e) { console.error('Error loading salary data:', e); }
    finally { setLoading(false); }
  };

  const netSalaryCalc = (Number(salaryForm.gross_salary) || 0) + (Number(salaryForm.advance) || 0) - (Number(salaryForm.deduction) || 0);

  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const empId = `EMP${String(employees.length + 1).padStart(3, '0')}`;
      const { error } = await supabase.from('employees').insert({
        employee_id: empId,
        name: employeeForm.name,
        mobile: employeeForm.mobile || null,
        designation: employeeForm.designation || null,
        monthly_salary: parseFloat(employeeForm.monthly_salary),
        joined_date: employeeForm.joined_date || null,
        salary_balance: 0,
        status: 'Active',
      });
      if (error) throw error;
      await logAudit('Employee added', 'Salary', empId);
      toast('Employee added successfully', 'success');
      setShowEmployeeForm(false);
      setEmployeeForm({ name: '', mobile: '', designation: '', monthly_salary: '', joined_date: '' });
      loadData();
    } catch (e) { console.error('Error adding employee:', e); toast('Error adding employee', 'error'); }
  };

  const handleSalarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const salaryNumber = await generateTransactionNumber('salary_payments', 'SAL', 'salary_number');
      const employee = employees.find(emp => emp.id === salaryForm.employee_id);
      const netSalary = netSalaryCalc;

      const { error } = await supabase.from('salary_payments').insert({
        salary_number: salaryNumber,
        employee_id: salaryForm.employee_id,
        month_year: salaryForm.month_year,
        gross_salary: Number(salaryForm.gross_salary) || 0,
        advance: Number(salaryForm.advance) || 0,
        deduction: Number(salaryForm.deduction) || 0,
        net_salary: netSalary,
        amount_paid: 0,
        balance: netSalary,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'Cash',
        notes: salaryForm.remarks || null,
      });
      if (error) throw error;
      await logAudit('Salary record created', 'Salary', salaryNumber);
      toast('Salary record created', 'success');
      setShowSalaryForm(false);
      setSalaryForm({ employee_id: '', month_year: '', gross_salary: '', advance: '', deduction: '', remarks: '' });
      loadData();
    } catch (e) { console.error('Error creating salary record:', e); toast('Error creating salary record', 'error'); }
  };

  const handleReleaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const salary = payments.find(p => p.id === releaseForm.salary_id);
      if (!salary) return;
      const releaseAmount = Number(releaseForm.amount_paid);
      const newTotalPaid = Number(salary.amount_paid) + releaseAmount;
      const newBalance = Number(salary.net_salary) - newTotalPaid;

      const { error } = await supabase.from('salary_payments').update({
        amount_paid: newTotalPaid,
        balance: newBalance,
        payment_date: releaseForm.payment_date,
        payment_method: releaseForm.payment_method,
      }).eq('id', releaseForm.salary_id);
      if (error) throw error;

      // Insert a separate release record as a payment history entry
      const releaseNumber = await generateTransactionNumber('salary_payments', 'SPR', 'salary_number');
      await supabase.from('salary_payments').insert({
        salary_number: releaseNumber,
        employee_id: salary.employee_id,
        month_year: salary.month_year,
        gross_salary: 0,
        advance: 0,
        deduction: 0,
        net_salary: 0,
        amount_paid: releaseAmount,
        balance: newBalance,
        payment_date: releaseForm.payment_date,
        payment_method: releaseForm.payment_method,
        notes: `Release for ${salary.salary_number}: ${releaseForm.notes || ''}`,
      });

      await logAudit('Salary released', 'Salary', `${salary.salary_number} - ₹${releaseAmount}`);
      toast(`Salary released: ₹${releaseAmount.toLocaleString('en-IN')}`, 'success');
      setShowReleaseForm(false);
      setReleaseForm({ salary_id: '', payment_date: new Date().toISOString().split('T')[0], amount_paid: '', payment_method: 'Cash', notes: '' });
      loadData();
    } catch (e) { console.error('Error releasing salary:', e); toast('Error releasing salary', 'error'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await supabase.from('salary_payments').delete().eq('id', deleteTarget.id);
      await logAudit('Salary record deleted', 'Salary', deleteTarget.salary_number);
      toast('Salary record deleted', 'success');
      loadData();
    } catch (e) { console.error('Error deleting salary record:', e); toast('Error deleting record', 'error'); }
    setDeleteTarget(null);
  };

  const openHistory = async (salary: SalaryPayment) => {
    const releases = payments.filter(p => p.employee_id === salary.employee_id && p.month_year === salary.month_year && p.net_salary === 0 && p.amount_paid > 0);
    setReleasePayments(releases);
    setHistoryTarget(salary);
    setShowHistory(true);
  };

  const fmtINR = (n: number) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const recordColumns: Column<SalaryPayment>[] = [
    { key: 'salary_number', header: 'Salary #', sortable: true, render: (p) => <span className="font-medium text-forest-700">{p.salary_number}</span> },
    { key: 'employee_id', header: 'Employee', render: (p) => { const emp = employees.find(e => e.id === p.employee_id); return emp ? `${emp.name} (${emp.employee_id})` : '-'; } },
    { key: 'month_year', header: 'Month', sortable: true, render: (p) => p.month_year },
    { key: 'gross_salary', header: 'Gross', align: 'right', render: (p) => fmtINR(Number(p.gross_salary)) },
    { key: 'advance', header: 'Advance', align: 'right', render: (p) => fmtINR(Number(p.advance)) },
    { key: 'deduction', header: 'Deduction', align: 'right', render: (p) => fmtINR(Number(p.deduction)) },
    { key: 'net_salary', header: 'Net Salary', align: 'right', render: (p) => <span className="font-semibold">{fmtINR(Number(p.net_salary))}</span> },
    { key: 'amount_paid', header: 'Released', align: 'right', render: (p) => <span className="text-green-600">{fmtINR(Number(p.amount_paid))}</span> },
    { key: 'balance', header: 'Balance', align: 'right', render: (p) => <span className={Number(p.balance) > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>{fmtINR(Number(p.balance))}</span> },
    {
      key: 'actions', header: 'Actions', align: 'center',
      render: (p) => p.net_salary > 0 ? (
        <div className="flex items-center justify-center gap-1">
          {editable && Number(p.balance) > 0 && <button onClick={(e) => { e.stopPropagation(); setReleaseForm({ ...releaseForm, salary_id: p.id }); setShowReleaseForm(true); }} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition" title="Release Salary"><DollarSign size={16} /></button>}
          <button onClick={(e) => { e.stopPropagation(); openHistory(p); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Payment History"><History size={16} /></button>
          {editable && <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete"><Trash2 size={16} /></button>}
        </div>
      ) : <Badge text="Release" color="gray" />,
    },
  ];

  if (loading) return <LoadingState message="Loading salary data..." />;

  const salaryRecords = payments.filter(p => p.net_salary > 0);
  const releaseHistory = payments.filter(p => p.net_salary === 0 && p.amount_paid > 0);

  return (
    <div>
      <PageHeader
        title="Salary Management"
        subtitle={`${employees.length} employees · ${salaryRecords.length} salary records`}
        actions={editable && (
          <div className="flex gap-2">
            <button onClick={() => setShowEmployeeForm(true)} className={buttonClass.secondary}><Plus size={16} /> Add Employee</button>
            <button onClick={() => setShowSalaryForm(true)} className={buttonClass.primary}><Plus size={16} /> Create Salary</button>
          </div>
        )}
      />

      <div className="flex gap-2 mb-6">
        {([['records', 'Salary Records'], ['history', 'Payment History']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === key ? 'bg-forest-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'records' && (salaryRecords.length === 0 ? <EmptyState message="No salary records. Create a salary record for an employee!" /> : <DataTable columns={recordColumns} data={salaryRecords} searchKeys={['salary_number', 'month_year']} searchPlaceholder="Search salary records..." />)}

      {activeTab === 'history' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b"><h2 className="text-xl font-bold text-gray-900">Salary Payment / Release History</h2></div>
          {releaseHistory.length === 0 ? <EmptyState message="No salary releases recorded yet." /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50"><tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Release #</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Employee</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Month</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Released Amount</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Method</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Remarks</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {releaseHistory.map(p => {
                    const emp = employees.find(e => e.id === p.employee_id);
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-sm font-medium text-forest-700">{p.salary_number}</td>
                        <td className="px-4 py-2.5 text-sm">{new Date(p.payment_date).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 text-sm">{emp ? `${emp.name} (${emp.employee_id})` : '-'}</td>
                        <td className="px-4 py-2.5 text-sm">{p.month_year}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-semibold text-green-600">{fmtINR(Number(p.amount_paid))}</td>
                        <td className="px-4 py-2.5 text-sm">{p.payment_method || 'Cash'}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-500">{p.notes || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Employee Modal */}
      <Modal open={showEmployeeForm} onClose={() => setShowEmployeeForm(false)} title="Add New Employee" size="md">
        <form onSubmit={handleEmployeeSubmit} className="space-y-4">
          <FormField label="Name" required><input type="text" value={employeeForm.name} onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })} className={inputClass} required /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Mobile"><input type="tel" value={employeeForm.mobile} onChange={(e) => setEmployeeForm({ ...employeeForm, mobile: e.target.value })} className={inputClass} /></FormField>
            <FormField label="Designation"><input type="text" value={employeeForm.designation} onChange={(e) => setEmployeeForm({ ...employeeForm, designation: e.target.value })} className={inputClass} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Monthly Salary" required><input type="number" step="0.01" value={employeeForm.monthly_salary} onChange={(e) => setEmployeeForm({ ...employeeForm, monthly_salary: e.target.value })} className={inputClass} required /></FormField>
            <FormField label="Joining Date"><input type="date" value={employeeForm.joined_date} onChange={(e) => setEmployeeForm({ ...employeeForm, joined_date: e.target.value })} className={inputClass} /></FormField>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className={buttonClass.primary + ' flex-1 justify-center'}>Add Employee</button>
            <button type="button" onClick={() => setShowEmployeeForm(false)} className={buttonClass.secondary + ' flex-1 justify-center'}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Create Salary Record Modal */}
      <Modal open={showSalaryForm} onClose={() => setShowSalaryForm(false)} title="Create Salary Record" size="md">
        <form onSubmit={handleSalarySubmit} className="space-y-4">
          <FormField label="Employee" required>
            <select value={salaryForm.employee_id} onChange={(e) => { const emp = employees.find(emp => emp.id === e.target.value); setSalaryForm({ ...salaryForm, employee_id: e.target.value, gross_salary: emp ? String(emp.monthly_salary) : '' }); }} className={inputClass} required>
              <option value="">Select Employee</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_id})</option>)}
            </select>
          </FormField>
          <FormField label="Salary Month" required><input type="text" value={salaryForm.month_year} onChange={(e) => setSalaryForm({ ...salaryForm, month_year: e.target.value })} placeholder="e.g., September 2026" className={inputClass} required /></FormField>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Monthly Salary" required><input type="number" step="0.01" value={salaryForm.gross_salary} onChange={(e) => setSalaryForm({ ...salaryForm, gross_salary: e.target.value })} className={inputClass} required /></FormField>
            <FormField label="Advance"><input type="number" step="0.01" value={salaryForm.advance} onChange={(e) => setSalaryForm({ ...salaryForm, advance: e.target.value })} className={inputClass} /></FormField>
            <FormField label="Deduction"><input type="number" step="0.01" value={salaryForm.deduction} onChange={(e) => setSalaryForm({ ...salaryForm, deduction: e.target.value })} className={inputClass} /></FormField>
          </div>
          <FormField label="Remarks"><input type="text" value={salaryForm.remarks} onChange={(e) => setSalaryForm({ ...salaryForm, remarks: e.target.value })} className={inputClass} /></FormField>
          <div className="bg-forest-50 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Net Salary (Monthly + Advance - Deduction):</span>
              <span className="font-bold text-forest-700 text-lg">{fmtINR(netSalaryCalc)}</span>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className={buttonClass.primary + ' flex-1 justify-center'}>Create Salary Record</button>
            <button type="button" onClick={() => setShowSalaryForm(false)} className={buttonClass.secondary + ' flex-1 justify-center'}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Release Salary Modal */}
      <Modal open={showReleaseForm} onClose={() => setShowReleaseForm(false)} title="Release Salary Payment" size="md">
        <form onSubmit={handleReleaseSubmit} className="space-y-4">
          {(() => {
            const salary = payments.find(p => p.id === releaseForm.salary_id);
            const emp = employees.find(e => e.id === salary?.employee_id);
            return salary && emp ? (
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Employee:</span><span className="font-medium">{emp.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Salary Month:</span><span className="font-medium">{salary.month_year}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Net Salary:</span><span className="font-medium">{fmtINR(Number(salary.net_salary))}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Already Released:</span><span className="font-medium text-green-600">{fmtINR(Number(salary.amount_paid))}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Remaining Balance:</span><span className="font-medium text-red-600">{fmtINR(Number(salary.balance))}</span></div>
              </div>
            ) : null;
          })()}
          <FormField label="Release Date" required><input type="date" value={releaseForm.payment_date} onChange={(e) => setReleaseForm({ ...releaseForm, payment_date: e.target.value })} className={inputClass} required /></FormField>
          <FormField label="Release Amount" required><input type="number" step="0.01" value={releaseForm.amount_paid} onChange={(e) => setReleaseForm({ ...releaseForm, amount_paid: e.target.value })} className={inputClass} required /></FormField>
          <FormField label="Payment Method">
            <select value={releaseForm.payment_method} onChange={(e) => setReleaseForm({ ...releaseForm, payment_method: e.target.value })} className={inputClass}>
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
              <option value="UPI">UPI</option>
            </select>
          </FormField>
          <FormField label="Remarks"><input type="text" value={releaseForm.notes} onChange={(e) => setReleaseForm({ ...releaseForm, notes: e.target.value })} className={inputClass} /></FormField>
          <div className="flex gap-3 pt-2">
            <button type="submit" className={buttonClass.success + ' flex-1 justify-center'}><DollarSign size={16} /> Release Salary</button>
            <button type="button" onClick={() => setShowReleaseForm(false)} className={buttonClass.secondary + ' flex-1 justify-center'}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Payment History Modal */}
      <Modal open={showHistory} onClose={() => setShowHistory(false)} title={`Payment History — ${historyTarget?.salary_number}`} size="md">
        {historyTarget && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Net Salary</p><p className="font-bold">{fmtINR(Number(historyTarget.net_salary))}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Total Released</p><p className="font-bold text-green-600">{fmtINR(Number(historyTarget.amount_paid))}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Balance</p><p className="font-bold text-red-600">{fmtINR(Number(historyTarget.balance))}</p></div>
            </div>
            {releasePayments.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Release Date</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Released Amount</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Method</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Remarks</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {releasePayments.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-sm">{new Date(p.payment_date).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-semibold text-green-600">{fmtINR(Number(p.amount_paid))}</td>
                        <td className="px-4 py-2.5 text-sm">{p.payment_method || 'Cash'}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-500">{p.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState message="No releases recorded yet for this salary." />}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Salary Record" message={`Are you sure you want to delete salary record "${deleteTarget?.salary_number}"?`} confirmLabel="Delete" />
    </div>
  );
};
