import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { canEdit, logAudit } from '../lib/auth';
import type { RoleKey } from '../lib/types';
import { Plus, Trash2, KeyRound, Shield } from 'lucide-react';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { DataTable, type Column } from './ui/DataTable';
import { PageHeader, Badge, FormField, inputClass, buttonClass } from './ui/Common';
import { LoadingState, EmptyState } from './ui/States';
import { useToast } from './ui/Toast';

interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  department: string | null;
  status: string;
  last_login: string | null;
  role_id: string | null;
  roles?: { role_key: RoleKey; role_name: string } | null;
}

interface Role {
  id: string;
  role_key: RoleKey;
  role_name: string;
}

export const UserManagement = () => {
  const { role: currentUserRole } = useAuth();
  const { toast } = useToast();
  const editable = canEdit(currentUserRole || undefined) && currentUserRole === 'super_admin';
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [resetTarget, setResetTarget] = useState<UserProfile | null>(null);
  const [roleEditTarget, setRoleEditTarget] = useState<UserProfile | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', mobile: '', department: '', role_id: '', password: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        supabase.from('user_profiles').select('*, roles(*)').order('created_at', { ascending: false }),
        supabase.from('roles').select('*').order('role_name'),
      ]);
      if (usersRes.error) throw usersRes.error;
      setUsers(usersRes.data || []);
      setRoles(rolesRes.data || []);
    } catch (e) { console.error('Error loading data:', e); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          mobile: formData.mobile,
          department: formData.department,
          role_id: formData.role_id,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create user');

      await logAudit('User created', 'User Management', formData.email);
      toast('User created successfully', 'success');
      setShowForm(false);
      setFormData({ name: '', email: '', mobile: '', department: '', role_id: '', password: '' });
      loadData();
    } catch (e) {
      console.error('Error creating user:', e);
      toast((e as Error).message || 'Error creating user', 'error');
    }
  };

  const handleStatusToggle = async (user: UserProfile) => {
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const { error } = await supabase.from('user_profiles').update({ status: newStatus }).eq('id', user.id);
      if (error) throw error;
      await logAudit(`User ${newStatus === 'Active' ? 'activated' : 'deactivated'}`, 'User Management', user.email || user.name);
      toast(`User ${newStatus === 'Active' ? 'activated' : 'deactivated'}`, 'success');
      loadData();
    } catch (e) { console.error('Error updating user:', e); toast('Error updating user', 'error'); }
  };

  const handleResetPassword = async () => {
    if (!resetTarget?.email) { toast('User email not found', 'error'); setResetTarget(null); return; }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetTarget.email);
      if (error) throw error;
      await logAudit('Password reset triggered', 'User Management', resetTarget.email);
      toast('Password reset instructions sent to user email', 'success');
    } catch (e) { console.error('Error resetting password:', e); toast('Error sending reset instructions', 'error'); }
    setResetTarget(null);
  };

  const handleRoleUpdate = async () => {
    if (!roleEditTarget || !selectedRoleId) { toast('Please select a role', 'error'); return; }
    try {
      const { error } = await supabase.from('user_profiles').update({ role_id: selectedRoleId }).eq('id', roleEditTarget.id);
      if (error) throw error;
      await logAudit('Role assigned', 'User Management', `${roleEditTarget.name} -> ${roles.find(r => r.id === selectedRoleId)?.role_name || ''}`);
      toast('Role updated successfully', 'success');
      setRoleEditTarget(null);
      setSelectedRoleId('');
      loadData();
    } catch (e) { console.error('Error updating role:', e); toast('Error updating role', 'error'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('user_profiles').update({ status: 'Inactive' }).eq('id', deleteTarget.id);
      if (error) throw error;
      await logAudit('User deactivated', 'User Management', deleteTarget.email || deleteTarget.name);
      toast('User deactivated', 'success');
      loadData();
    } catch (e) { console.error('Error deactivating user:', e); toast('Error deactivating user', 'error'); }
    setDeleteTarget(null);
  };

  const columns: Column<UserProfile>[] = [
    { key: 'name', header: 'Name', sortable: true, render: (u) => <span className="font-medium">{u.name}</span> },
    { key: 'email', header: 'Email', render: (u) => u.email || '-' },
    { key: 'mobile', header: 'Mobile', render: (u) => u.mobile || '-' },
    { key: 'department', header: 'Department', render: (u) => u.department || '-' },
    { key: 'roles', header: 'Role', render: (u) => (
      <div className="flex items-center gap-2">
        <span className={u.roles?.role_name ? '' : 'text-amber-600 font-medium'}>{u.roles?.role_name || 'No role'}</span>
        {editable && (
          <button onClick={(e) => { e.stopPropagation(); setRoleEditTarget(u); setSelectedRoleId(u.role_id || ''); }} className="p-1 text-blue-600 hover:bg-blue-50 rounded transition" title="Assign Role">
            <Shield size={14} />
          </button>
        )}
      </div>
    ) },
    { key: 'status', header: 'Status', align: 'center', render: (u) => <Badge text={u.status || 'Active'} color={u.status === 'Active' ? 'green' : 'gray'} /> },
    { key: 'last_login', header: 'Last Login', render: (u) => u.last_login ? new Date(u.last_login).toLocaleString() : 'Never' },
    {
      key: 'actions', header: 'Actions', align: 'center',
      render: (u) => editable ? (
        <div className="flex items-center justify-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); handleStatusToggle(u); }} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition" title={u.status === 'Active' ? 'Deactivate' : 'Activate'}>
            {u.status === 'Active' ? <Trash2 size={16} /> : <Plus size={16} />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setResetTarget(u); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Reset Password"><KeyRound size={16} /></button>
        </div>
      ) : null,
    },
  ];

  if (loading) return <LoadingState message="Loading users..." />;

  if (currentUserRole !== 'super_admin') {
    return <div className="p-6"><div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center"><p className="text-amber-800 font-medium">Only Super Admins can manage users.</p></div></div>;
  }

  return (
    <div>
      <PageHeader title="User Management" subtitle={`${users.length} users`}
        actions={editable && <button onClick={() => setShowForm(true)} className={buttonClass.primary}><Plus size={16} /> Add User</button>} />

      {users.length === 0 ? <EmptyState message="No users found." /> : <DataTable columns={columns} data={users} searchKeys={['name', 'email']} searchPlaceholder="Search users..." />}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add New User" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Full Name" required><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputClass} required /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Email" required><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClass} required /></FormField>
            <FormField label="Password" required><input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className={inputClass} required minLength={6} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Mobile"><input type="tel" value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value })} className={inputClass} /></FormField>
            <FormField label="Department"><input type="text" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} className={inputClass} /></FormField>
          </div>
          <FormField label="Role" required>
            <select value={formData.role_id} onChange={(e) => setFormData({ ...formData, role_id: e.target.value })} className={inputClass} required>
              <option value="">Select Role</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.role_name}</option>)}
            </select>
          </FormField>
          <div className="flex gap-3 pt-2">
            <button type="submit" className={buttonClass.primary + ' flex-1 justify-center'}>Create User</button>
            <button type="button" onClick={() => setShowForm(false)} className={buttonClass.secondary + ' flex-1 justify-center'}>Cancel</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Deactivate User" message={`Deactivate user "${deleteTarget?.name}"? They will no longer be able to log in.`} confirmLabel="Deactivate" />

      <ConfirmDialog open={!!resetTarget} onClose={() => setResetTarget(null)} onConfirm={handleResetPassword}
        title="Reset Password" message={`Send password reset instructions to "${resetTarget?.email}"?`} confirmLabel="Send Reset" danger={false} />

      <Modal open={!!roleEditTarget} onClose={() => { setRoleEditTarget(null); setSelectedRoleId(''); }} title={`Assign Role: ${roleEditTarget?.name || ''}`} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Select a role for this user. They will only be able to access modules assigned to that role.</p>
          <FormField label="Role" required>
            <select value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)} className={inputClass} required>
              <option value="">Select Role</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.role_name}</option>)}
            </select>
          </FormField>
          <div className="flex gap-3 pt-2">
            <button onClick={handleRoleUpdate} className={buttonClass.primary + ' flex-1 justify-center'}>Update Role</button>
            <button onClick={() => { setRoleEditTarget(null); setSelectedRoleId(''); }} className={buttonClass.secondary + ' flex-1 justify-center'}>Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
