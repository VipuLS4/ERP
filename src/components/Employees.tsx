import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { canEdit, logAudit } from '../lib/auth';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { DataTable, type Column } from './ui/DataTable';
import { PageHeader, Badge, FormField, inputClass, buttonClass } from './ui/Common';
import { LoadingState, EmptyState } from './ui/States';
import { useToast } from './ui/Toast';

interface Employee {
  id: string;
  employee_id: string;
  name: string;
  mobile: string | null;
  designation: string | null;
  department: string | null;
  monthly_salary: number;
  salary_balance: number;
  status: string;
  joined_date: string | null;
}

export const Employees = () => {
  const { role } = useAuth();
  const { toast } = useToast();
  const editable = canEdit(role || undefined);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    name: '', mobile: '', designation: '', department: '',
    monthly_salary: '', joined_date: '', status: 'Active',
  });

  useEffect(() => { loadEmployees(); }, []);

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase.from('employees').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setEmployees(data || []);
    } catch (e) { console.error('Error loading employees:', e); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { count } = await supabase.from('employees').select('*', { count: 'exact', head: true });
      const employeeId = `EMP${String((count || 0) + 1).padStart(3, '0')}`;
      const { error } = await supabase.from('employees').insert({
        employee_id: employeeId,
        name: formData.name,
        mobile: formData.mobile || null,
        designation: formData.designation || null,
        department: formData.department || null,
        monthly_salary: parseFloat(formData.monthly_salary) || 0,
        joined_date: formData.joined_date || null,
        status: formData.status,
      });
      if (error) throw error;
      await logAudit('Employee created', 'Employees', employeeId);
      toast('Employee added successfully', 'success');
      setShowForm(false);
      setFormData({ name: '', mobile: '', designation: '', department: '', monthly_salary: '', joined_date: '', status: 'Active' });
      loadEmployees();
    } catch (e) { console.error('Error creating employee:', e); toast('Error creating employee', 'error'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('employees').update({ status: 'Inactive' }).eq('id', deleteTarget.id);
      if (error) throw error;
      await logAudit('Employee deactivated', 'Employees', deleteTarget.employee_id);
      toast('Employee deactivated', 'success');
      loadEmployees();
    } catch (e) { console.error('Error deactivating employee:', e); toast('Error deactivating employee', 'error'); }
    setDeleteTarget(null);
  };

  const columns: Column<Employee>[] = [
    { key: 'employee_id', header: 'Emp ID', sortable: true, render: (e) => <span className="font-medium text-blue-600">{e.employee_id}</span> },
    { key: 'name', header: 'Name', sortable: true, render: (e) => <span className="font-medium">{e.name}</span> },
    { key: 'mobile', header: 'Mobile', render: (e) => e.mobile || '-' },
    { key: 'designation', header: 'Designation', render: (e) => e.designation || '-' },
    { key: 'department', header: 'Department', render: (e) => e.department || '-' },
    { key: 'monthly_salary', header: 'Monthly Salary', align: 'right', render: (e) => `₹${Number(e.monthly_salary || 0).toLocaleString('en-IN')}` },
    { key: 'salary_balance', header: 'Salary Balance', align: 'right', render: (e) => <span className={Number(e.salary_balance) > 0 ? 'text-red-600 font-semibold' : ''}>₹{Number(e.salary_balance || 0).toLocaleString('en-IN')}</span> },
    { key: 'joined_date', header: 'Joined', render: (e) => e.joined_date ? new Date(e.joined_date).toLocaleDateString() : '-' },
    { key: 'status', header: 'Status', align: 'center', render: (e) => <Badge text={e.status || 'Active'} color={e.status === 'Active' ? 'green' : 'gray'} /> },
    {
      key: 'actions', header: 'Actions', align: 'center',
      render: (e) => editable && e.status === 'Active' ? (
        <button onClick={(ev) => { ev.stopPropagation(); setDeleteTarget(e); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition" title="Deactivate"><Trash2 size={16} /></button>
      ) : null,
    },
  ];

  if (loading) return <LoadingState message="Loading employees..." />;

  return (
    <div>
      <PageHeader title="Employee Management" subtitle={`${employees.length} employees`}
        actions={editable && <button onClick={() => setShowForm(true)} className={buttonClass.primary}><Plus size={16} /> Add Employee</button>} />

      {employees.length === 0 ? <EmptyState message="No employees found. Add your first employee!" /> : <DataTable columns={columns} data={employees} searchKeys={['name', 'employee_id', 'mobile', 'designation']} searchPlaceholder="Search employees..." />}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add New Employee" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Employee Name" required><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputClass} required /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Mobile"><input type="tel" value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value })} className={inputClass} /></FormField>
            <FormField label="Designation"><input type="text" value={formData.designation} onChange={(e) => setFormData({ ...formData, designation: e.target.value })} className={inputClass} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Department"><input type="text" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} className={inputClass} /></FormField>
            <FormField label="Monthly Salary" required><input type="number" step="0.01" value={formData.monthly_salary} onChange={(e) => setFormData({ ...formData, monthly_salary: e.target.value })} className={inputClass} required /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Joining Date"><input type="date" value={formData.joined_date} onChange={(e) => setFormData({ ...formData, joined_date: e.target.value })} className={inputClass} /></FormField>
            <FormField label="Status"><select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className={inputClass}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></FormField>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className={buttonClass.primary + ' flex-1 justify-center'}>Add Employee</button>
            <button type="button" onClick={() => setShowForm(false)} className={buttonClass.secondary + ' flex-1 justify-center'}>Cancel</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Deactivate Employee" message={`Deactivate employee "${deleteTarget?.name}"? They will no longer be able to log in.`} confirmLabel="Deactivate" />
    </div>
  );
};
