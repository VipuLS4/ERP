interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

interface BadgeProps {
  text: string;
  color?: 'green' | 'red' | 'blue' | 'amber' | 'gray' | 'purple';
}

const badgeColors = {
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-700',
  gray: 'bg-gray-100 text-gray-700',
  purple: 'bg-purple-100 text-purple-700',
};

export function Badge({ text, color = 'gray' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeColors[color]}`}>
      {text}
    </span>
  );
}

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, required, hint, children, className = '' }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-600 focus:border-forest-600 outline-none transition';

export const buttonClass = {
  primary: 'inline-flex items-center gap-2 px-4 py-2 bg-forest-700 text-white rounded-lg hover:bg-forest-800 transition font-medium text-sm shadow-sm',
  secondary: 'inline-flex items-center gap-2 px-4 py-2 bg-brand-100 text-forest-800 rounded-lg hover:bg-brand-200 transition font-medium text-sm',
  danger: 'inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium text-sm',
  success: 'inline-flex items-center gap-2 px-4 py-2 bg-forest-600 text-white rounded-lg hover:bg-forest-700 transition font-medium text-sm shadow-sm',
};

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

export function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: color + '15' }}>
          <div style={{ color }}>{icon}</div>
        </div>
      </div>
    </div>
  );
}
