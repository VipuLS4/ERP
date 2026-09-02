import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { canEdit, logAudit } from '../lib/auth';
import { PageHeader, FormField, inputClass, buttonClass } from './ui/Common';
import { LoadingState } from './ui/States';
import { useToast } from './ui/Toast';

interface SettingsData {
  id: string;
  business_name: string;
  business_type: string;
  address: string | null;
  mobile: string | null;
  email: string | null;
  gst_number: string | null;
  invoice_prefix: string;
  currency: string;
  opening_stock_value: number;
  opening_cash: number;
  production_variance_percent: number;
  allow_negative_stock: boolean;
}

export const Settings = () => {
  const { role } = useAuth();
  const { toast } = useToast();
  const editable = canEdit(role || undefined);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase.from('settings').select('*').limit(1).maybeSingle();
      if (error) throw error;
      if (data) {
        setSettings(data as SettingsData);
      } else {
        const { data: newSettings, error: insertError } = await supabase.from('settings').insert({
          business_name: 'Raj & Brothers',
          business_type: 'Rice Bran Filtration / Processing',
          invoice_prefix: 'INV',
          currency: 'INR',
        }).select().single();
        if (insertError) throw insertError;
        setSettings(newSettings as SettingsData);
      }
    } catch (e) { console.error('Error loading settings:', e); }
    finally { setLoading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('settings').update({
        business_name: settings.business_name,
        business_type: settings.business_type,
        address: settings.address,
        mobile: settings.mobile,
        email: settings.email,
        gst_number: settings.gst_number,
        invoice_prefix: settings.invoice_prefix,
        currency: settings.currency,
        opening_stock_value: settings.opening_stock_value,
        opening_cash: settings.opening_cash,
        production_variance_percent: settings.production_variance_percent,
        allow_negative_stock: settings.allow_negative_stock,
        updated_at: new Date().toISOString(),
      }).eq('id', settings.id);
      if (error) throw error;
      await logAudit('Settings updated', 'Settings');
      toast('Settings saved successfully', 'success');
    } catch (e) { console.error('Error saving settings:', e); toast('Error saving settings', 'error'); }
    setSaving(false);
  };

  if (loading) return <LoadingState message="Loading settings..." />;
  if (!settings) return <div className="p-6 text-gray-500">Failed to load settings.</div>;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Business configuration" />
      <form onSubmit={handleSave} className="max-w-2xl space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Business Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Business Name" required>
              <input type="text" value={settings.business_name} disabled={!editable} onChange={(e) => setSettings({ ...settings, business_name: e.target.value })} className={inputClass} required />
            </FormField>
            <FormField label="Business Type">
              <input type="text" value={settings.business_type || ''} disabled={!editable} onChange={(e) => setSettings({ ...settings, business_type: e.target.value })} className={inputClass} />
            </FormField>
          </div>
          <div className="mt-4">
            <FormField label="Address">
              <textarea value={settings.address || ''} disabled={!editable} onChange={(e) => setSettings({ ...settings, address: e.target.value })} className={inputClass} rows={2} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <FormField label="Mobile"><input type="tel" value={settings.mobile || ''} disabled={!editable} onChange={(e) => setSettings({ ...settings, mobile: e.target.value })} className={inputClass} /></FormField>
            <FormField label="Email"><input type="email" value={settings.email || ''} disabled={!editable} onChange={(e) => setSettings({ ...settings, email: e.target.value })} className={inputClass} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <FormField label="GST Number"><input type="text" value={settings.gst_number || ''} disabled={!editable} onChange={(e) => setSettings({ ...settings, gst_number: e.target.value })} className={inputClass} /></FormField>
            <FormField label="Invoice Prefix"><input type="text" value={settings.invoice_prefix || ''} disabled={!editable} onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value })} className={inputClass} /></FormField>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Financial Settings</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Opening Stock Value"><input type="number" step="0.01" value={settings.opening_stock_value || 0} disabled={!editable} onChange={(e) => setSettings({ ...settings, opening_stock_value: parseFloat(e.target.value) || 0 })} className={inputClass} /></FormField>
            <FormField label="Opening Cash"><input type="number" step="0.01" value={settings.opening_cash || 0} disabled={!editable} onChange={(e) => setSettings({ ...settings, opening_cash: parseFloat(e.target.value) || 0 })} className={inputClass} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <FormField label="Production Variance %"><input type="number" step="0.01" value={settings.production_variance_percent || 5} disabled={!editable} onChange={(e) => setSettings({ ...settings, production_variance_percent: parseFloat(e.target.value) || 5 })} className={inputClass} /></FormField>
            <FormField label="Currency"><input type="text" value={settings.currency || 'INR'} disabled={!editable} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className={inputClass} /></FormField>
          </div>
          <div className="mt-4">
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={settings.allow_negative_stock || false} disabled={!editable} onChange={(e) => setSettings({ ...settings, allow_negative_stock: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">Allow negative stock (not recommended)</span>
            </label>
          </div>
        </div>

        {editable && (
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className={buttonClass.primary + ' disabled:opacity-50'}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
