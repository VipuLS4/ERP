import { supabase } from './supabase';
import type { RoleKey } from './types';

export const ROLE_ACCESS: Record<RoleKey, string[]> = {
  super_admin: [
    'dashboard', 'vendors', 'customers', 'purchases', 'material-receiving',
    'production', 'stock', 'sales', 'expenses', 'employees', 'salary',
    'reports', 'user-management', 'settings',
  ],
  plant_manager: [
    'dashboard', 'material-receiving', 'production', 'stock', 'reports',
  ],
  production_supervisor: [
    'production', 'stock', 'reports',
  ],
  store_employee: [
    'material-receiving', 'stock',
  ],
  purchase_employee: [
    'vendors', 'purchases', 'material-receiving', 'reports',
  ],
  sales_employee: [
    'customers', 'sales', 'reports',
  ],
  accountant: [
    'vendors', 'customers', 'purchases', 'expenses', 'salary', 'reports',
  ],
  viewer: [
    'dashboard', 'vendors', 'customers', 'purchases', 'material-receiving',
    'production', 'stock', 'sales', 'expenses', 'employees', 'salary',
    'reports',
  ],
};

export const isReadOnly = (role: RoleKey | undefined): boolean => role === 'viewer';

export const canAccess = (role: RoleKey | undefined, page: string): boolean => {
  if (!role) return false;
  return ROLE_ACCESS[role]?.includes(page) ?? false;
};

export const canEdit = (role: RoleKey | undefined): boolean => {
  if (!role) return false;
  return role !== 'viewer';
};

export async function fetchUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*, roles(*)')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function upsertUserProfile(userId: string, email: string) {
  const { data: existing } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('user_profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('user_id', userId);
    return;
  }

  const { data: superAdminRole } = await supabase
    .from('roles')
    .select('id')
    .eq('role_key', 'super_admin')
    .maybeSingle();

  await supabase.from('user_profiles').insert({
    user_id: userId,
    name: email.split('@')[0],
    email,
    role_id: superAdminRole?.id || null,
    status: 'Active',
    last_login: new Date().toISOString(),
  });
}

export async function logAudit(action: string, module: string, transactionNumber?: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('name')
      .eq('user_id', user.id)
      .maybeSingle();

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_name: profile?.name || user.email,
      action,
      module,
      transaction_number: transactionNumber || null,
    });
  } catch {
    // best-effort
  }
}

export async function generateTransactionNumber(table: string, prefix: string, _numberField?: string): Promise<string> {
  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  const num = String((count || 0) + 1).padStart(5, '0');
  return `${prefix}-${num}`;
}
