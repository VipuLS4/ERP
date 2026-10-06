import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { canEdit, logAudit, generateTransactionNumber } from '../lib/auth';
import type { Employee, SalaryPayment } from '../lib/types';
import { Plus, Trash2, DollarSign, History, Download, Eye, ArrowLeft } from 'lucide-react';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { DataTable, type Column } from './ui/DataTable';
import { PageHeader, Badge, FormField, inputClass, buttonClass } from './ui/Common';
import { LoadingState, EmptyState } from './ui/States';
import { useToast } from './ui/Toast';
import { generateSalarySlipPdf } from '../lib/pdf';

export const Salary = () => {
  const { role } = useAuth();
  const { toast } = useToast();
  const editable = canEdit(role || undefined);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [deleteEmployeeTarget, setDeleteEmployeeTarget] = useState<Employee | null>(null);

  const [employeeForm, setEmployeeForm] = useState({ name: '', mobile: '', designation: '', monthly_salary: '', joined_date: '' });
  const [salaryForm, setSalaryForm] = useState({
    employee_id: '',
    month_year: '',
    gross_salary: '',
    advance: '',
    deduction: '',
    remarks: '',
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

  const handleDeleteEmployee = async () => {
    if (!deleteEmployeeTarget) return;
    try {
      await supabase.from('salary_payments').delete().eq('employee_id', deleteEmployeeTarget.id);
      const { error } = await supabase.from('employees').delete().eq('id', deleteEmployeeTarget.id);
      if (error) throw error;
      await logAudit('Employee deleted', 'Salary', deleteEmployeeTarget.employee_id);
      toast('Employee deleted', 'success');
      loadData();
    } catch (e) { console.error('Error deleting employee:', e); toast('Error deleting employee', 'error'); }
    setDeleteEmployeeTarget(null);
  };

  const fmtINR = (n: number) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const salaryRecords = payments.filter(p => p.net_salary > 0);

  const employeeStats = (emp: Employee) => {
    const records = salaryRecords.filter(p => p.employee_id === emp.id);
    const totalSalary = records.reduce((s, p) => s + Number(p.net_salary), 0);
    const totalPaid = records.reduce((s, p) => s + Number(p.amount_paid), 0);
    const outstanding = records.reduce((s, p) => s + Math.max(0, Number(p.balance)), 0);
    return { totalSalary, totalPaid, outstanding, recordCount: records.length };
  };

  const employeeColumns: Column<Employee>[] = [
    { key: 'employee_id', header: 'Emp ID', sortable: true, render: (e) => <span className="font-medium text-forest-700">{e.employee_id}</span> },
    { key: 'name', header: 'Name', sortable: true, render: (e) => <span className="font-medium">{e.name}</span> },
    { key: 'designation', header: 'Designation', render: (e) => e.designation || '-' },
    { key: 'monthly_salary', header: 'Monthly Salary', align: 'right', render: (e) => fmtINR(Number(e.monthly_salary)) },
    {
      key: 'outstanding', header: 'Outstanding', align: 'right', sortable: true,
      render: (e) => {
        const { outstanding } = employeeStats(e);
        return <span className={outstanding > 0 ? 'font-semibold text-red-600' : 'text-green-600'}>{fmtINR(outstanding)}</span>;
      },
    },
    { key: 'status', header: 'Status', align: 'center', render: (e) => <Badge text={e.status || 'Active'} color={e.status === 'Active' ? 'green' : 'gray'} /> },
    {
      key: 'actions', header: 'Actions', align: 'center',
      render: (e) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={(ev) => { ev.stopPropagation(); setSelectedEmployee(e); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="View Details"><Eye size={16} /></button>
          {editable && <button onClick={(ev) => { ev.stopPropagation(); setDeleteEmployeeTarget(e); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete"><Trash2 size={16} /></button>}
        </div>
      ),
    },
  ];

  if (loading) return <LoadingState message="Loading salary data..." />;

  if (selectedEmployee) return <EmployeeDetail employee={selectedEmployee} payments={payments} onBack={() => { setSelectedEmployee(null); loadData(); }} />;

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

      {employees.length === 0 ? <EmptyState message="No employees yet. Add your first employee!" /> : <DataTable columns={employeeColumns} data={employees} searchKeys={['name', 'employee_id', 'designation']} searchPlaceholder="Search employees..." />}

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

      <ConfirmDialog open={!!deleteEmployeeTarget} onClose={() => setDeleteEmployeeTarget(null)} onConfirm={handleDeleteEmployee} title="Delete Employee" message={`Delete employee "${deleteEmployeeTarget?.name}"? All salary records will also be deleted.`} confirmLabel="Delete" />
    </div>
  );
};

function EmployeeDetail({ employee, payments, onBack }: { employee: Employee; payments: SalaryPayment[]; onBack: () => void }) {
  const { role } = useAuth();
  const { toast } = useToast();
  const editable = canEdit(role || undefined);
  const [activeTab, setActiveTab] = useState<'records' | 'payments' | 'ledger'>('records');
  const [showReleaseForm, setShowReleaseForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SalaryPayment | null>(null);
  const [historyTarget, setHistoryTarget] = useState<SalaryPayment | null>(null);
  const [releasePayments, setReleasePayments] = useState<SalaryPayment[]>([]);
  const [slipLoading, setSlipLoading] = useState<string | null>(null);
  const [localPayments, setLocalPayments] = useState<SalaryPayment[]>(payments);

  const [releaseForm, setReleaseForm] = useState({
    salary_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    amount_paid: '',
    payment_method: 'Cash',
    notes: '',
  });

  useEffect(() => { setLocalPayments(payments); }, [payments]);

  const fmtINR = (n: number) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const empSalaryRecords = localPayments.filter(p => p.employee_id === employee.id && p.net_salary > 0);
  const empReleaseRecords = localPayments.filter(p => p.employee_id === employee.id && p.net_salary === 0 && p.amount_paid > 0);
  const empAllRecords = [...empSalaryRecords, ...empReleaseRecords].sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

  const totalSalary = empSalaryRecords.reduce((s, p) => s + Number(p.net_salary), 0);
  const totalPaid = empSalaryRecords.reduce((s, p) => s + Number(p.amount_paid), 0);
  const outstanding = empSalaryRecords.reduce((s, p) => s + Math.max(0, Number(p.balance)), 0);

  const handleReleaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const salary = localPayments.find(p => p.id === releaseForm.salary_id);
      if (!salary) return;
      const releaseAmount = Number(releaseForm.amount_paid);
      const { data: freshSalary } = await supabase.from('salary_payments').select('amount_paid, net_salary, balance').eq('id', releaseForm.salary_id).maybeSingle();
      const currentPaid = Number(freshSalary?.amount_paid || 0);
      const netSalary = Number(freshSalary?.net_salary || 0);
      const newTotalPaid = currentPaid + releaseAmount;
      const newBalance = netSalary - newTotalPaid;

      const { error } = await supabase.from('salary_payments').update({
        amount_paid: newTotalPaid,
        balance: newBalance,
        payment_date: releaseForm.payment_date,
        payment_method: releaseForm.payment_method,
      }).eq('id', releaseForm.salary_id);
      if (error) throw error;

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
      reloadDetailData();
    } catch (e) { console.error('Error releasing salary:', e); toast('Error releasing salary', 'error'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await supabase.from('salary_payments').delete().eq('id', deleteTarget.id);
      await logAudit('Salary record deleted', 'Salary', deleteTarget.salary_number);
      toast('Salary record deleted', 'success');
      reloadDetailData();
    } catch (e) { console.error('Error deleting salary record:', e); toast('Error deleting record', 'error'); }
    setDeleteTarget(null);
  };

  const reloadDetailData = async () => {
    const { data } = await supabase.from('salary_payments').select('*').eq('employee_id', employee.id).order('payment_date', { ascending: false });
    setLocalPayments(data || []);
  };

  const openHistory = (salary: SalaryPayment) => {
    const releases = localPayments.filter(p => p.employee_id === salary.employee_id && p.month_year === salary.month_year && p.net_salary === 0 && p.amount_paid > 0);
    setReleasePayments(releases);
    setHistoryTarget(salary);
    setShowHistory(true);
  };

  const downloadSalarySlip = async (salary: SalaryPayment) => {
    try {
      setSlipLoading(salary.id);
      await generateSalarySlipPdf(employee, salary);
    } catch (e) {
      console.error('Error generating salary slip:', e);
      toast('Could not generate salary slip', 'error');
    } finally {
      setSlipLoading(null);
    }
  };

  const recordColumns: Column<SalaryPayment>[] = [
    { key: 'salary_number', header: 'Salary #', sortable: true, render: (p) => <span className="font-medium text-forest-700">{p.salary_number}</span> },
    { key: 'month_year', header: 'Month', sortable: true, render: (p) => p.month_year },
    { key: 'gross_salary', header: 'Gross', align: 'right', render: (p) => fmtINR(Number(p.gross_salary)) },
    { key: 'advance', header: 'Advance', align: 'right', render: (p) => fmtINR(Number(p.advance)) },
    { key: 'deduction', header: 'Deduction', align: 'right', render: (p) => fmtINR(Number(p.deduction)) },
    { key: 'net_salary', header: 'Net Salary', align: 'right', render: (p) => <span className="font-semibold">{fmtINR(Number(p.net_salary))}</span> },
    { key: 'amount_paid', header: 'Paid', align: 'right', render: (p) => <span className="text-green-600">{fmtINR(Number(p.amount_paid))}</span> },
    { key: 'balance', header: 'Balance', align: 'right', render: (p) => <span className={Number(p.balance) > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>{fmtINR(Number(p.balance))}</span> },
    {
      key: 'actions', header: 'Actions', align: 'center',
      render: (p) => p.net_salary > 0 ? (
        <div className="flex items-center justify-center gap-1">
          {editable && Number(p.balance) > 0 && <button onClick={(e) => { e.stopPropagation(); setReleaseForm({ ...releaseForm, salary_id: p.id, amount_paid: String(Number(p.balance)) }); setShowReleaseForm(true); }} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition" title="Pay Salary"><DollarSign size={16} /></button>}
          <button onClick={(e) => { e.stopPropagation(); openHistory(p); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Payment History"><History size={16} /></button>
          <button onClick={(e) => { e.stopPropagation(); downloadSalarySlip(p); }} disabled={slipLoading === p.id} className="p-1.5 text-forest-700 hover:bg-forest-50 rounded-lg transition disabled:opacity-50" title="Download Salary Slip"><Download size={16} /></button>
          {editable && <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete"><Trash2 size={16} /></button>}
        </div>
      ) : <Badge text="Release" color="gray" />,
    },
  ];

  const tabs = [
    { id: 'records', label: 'Salary Records' },
    { id: 'payments', label: 'Payment History' },
    { id: 'ledger', label: 'Complete Ledger' },
  ] as const;

  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition">
        <ArrowLeft size={16} /> Back to Employees
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{employee.name}</h1>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 mt-3 text-sm">
              <div><span className="text-gray-500">Emp ID:</span> <span className="font-medium">{employee.employee_id}</span></div>
              <div><span className="text-gray-500">Mobile:</span> <span className="font-medium">{employee.mobile || '-'}</span></div>
              <div><span className="text-gray-500">Designation:</span> <span className="font-medium">{employee.designation || '-'}</span></div>
              <div><span className="text-gray-500">Monthly Salary:</span> <span className="font-medium">{fmtINR(Number(employee.monthly_salary))}</span></div>
              <div><span className="text-gray-500">Joined:</span> <span className="font-medium">{employee.joined_date ? new Date(employee.joined_date).toLocaleDateString() : '-'}</span></div>
              <div><span className="text-gray-500">Status:</span> <Badge text={employee.status || 'Active'} color={employee.status === 'Active' ? 'green' : 'gray'} /></div>
            </div>
          </div>
          {editable && outstanding > 0 && (
            <button onClick={() => {
              const nextSalary = empSalaryRecords.find(p => Number(p.balance) > 0);
              if (nextSalary) {
                setReleaseForm({ ...releaseForm, salary_id: nextSalary.id, amount_paid: String(Number(nextSalary.balance)) });
                setShowReleaseForm(true);
              }
            }} className={buttonClass.success}>
              <DollarSign size={16} /> Pay Outstanding
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Salary</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{fmtINR(totalSalary)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Paid</p>
          <p className="text-lg font-bold text-green-600 mt-1">{fmtINR(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Outstanding</p>
          <p className="text-lg font-bold text-red-600 mt-1">{fmtINR(outstanding)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Salary Records</p>
          <p className="text-lg font-bold text-blue-600 mt-1">{empSalaryRecords.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex gap-1 border-b border-gray-200 px-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === tab.id ? 'border-forest-700 text-forest-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'records' && (
            empSalaryRecords.length === 0 ? <EmptyState message="No salary records for this employee yet." /> : <DataTable columns={recordColumns} data={empSalaryRecords} searchKeys={['salary_number', 'month_year']} searchPlaceholder="Search salary records..." />
          )}

          {activeTab === 'payments' && (
            empReleaseRecords.length === 0 ? <EmptyState message="No payments released yet for this employee." /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Release #</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Month</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Method</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Remarks</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {empReleaseRecords.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-sm font-medium text-forest-700">{p.salary_number}</td>
                        <td className="px-4 py-2.5 text-sm">{new Date(p.payment_date).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 text-sm">{p.month_year}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-semibold text-green-600">{fmtINR(Number(p.amount_paid))}</td>
                        <td className="px-4 py-2.5 text-sm">{p.payment_method || 'Cash'}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-500">{p.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === 'ledger' && (
            empAllRecords.length === 0 ? <EmptyState message="No transactions found for this employee." /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Reference</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Month</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Net Salary (Debit)</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Payment (Credit)</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Balance</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {empAllRecords.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-sm">{new Date(p.payment_date).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 text-sm font-medium text-forest-700">{p.salary_number}</td>
                        <td className="px-4 py-2.5 text-sm">{p.month_year}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-red-600">{Number(p.net_salary) > 0 ? fmtINR(Number(p.net_salary)) : '-'}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-green-600">{Number(p.amount_paid) > 0 ? fmtINR(Number(p.amount_paid)) : '-'}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-semibold">{fmtINR(Number(p.balance))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>

      <Modal open={showReleaseForm} onClose={() => setShowReleaseForm(false)} title="Pay Salary" size="md">
        <form onSubmit={handleReleaseSubmit} className="space-y-4">
          {(() => {
            const salary = localPayments.find(p => p.id === releaseForm.salary_id);
            return salary ? (
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Employee:</span><span className="font-medium">{employee.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Salary Month:</span><span className="font-medium">{salary.month_year}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Net Salary:</span><span className="font-medium">{fmtINR(Number(salary.net_salary))}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Already Paid:</span><span className="font-medium text-green-600">{fmtINR(Number(salary.amount_paid))}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Remaining Balance:</span><span className="font-medium text-red-600">{fmtINR(Number(salary.balance))}</span></div>
              </div>
            ) : null;
          })()}
          <FormField label="Payment Date" required><input type="date" value={releaseForm.payment_date} onChange={(e) => setReleaseForm({ ...releaseForm, payment_date: e.target.value })} className={inputClass} required /></FormField>
          <FormField label="Payment Amount" required><input type="number" step="0.01" value={releaseForm.amount_paid} onChange={(e) => setReleaseForm({ ...releaseForm, amount_paid: e.target.value })} className={inputClass} required /></FormField>
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
            <button type="submit" className={buttonClass.success + ' flex-1 justify-center'}><DollarSign size={16} /> Pay Salary</button>
            <button type="button" onClick={() => setShowReleaseForm(false)} className={buttonClass.secondary + ' flex-1 justify-center'}>Cancel</button>
          </div>
        </form>
      </Modal>

      <Modal open={showHistory} onClose={() => setShowHistory(false)} title={`Payment History — ${historyTarget?.salary_number}`} size="md">
        {historyTarget && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Net Salary</p><p className="font-bold">{fmtINR(Number(historyTarget.net_salary))}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Total Paid</p><p className="font-bold text-green-600">{fmtINR(Number(historyTarget.amount_paid))}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Balance</p><p className="font-bold text-red-600">{fmtINR(Number(historyTarget.balance))}</p></div>
            </div>
            {releasePayments.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Payment Date</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
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
            ) : <EmptyState message="No payments recorded yet for this salary." />}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Salary Record" message={`Are you sure you want to delete salary record "${deleteTarget?.salary_number}"?`} confirmLabel="Delete" />
    </div>
  );
}
