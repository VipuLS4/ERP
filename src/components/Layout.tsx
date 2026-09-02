import { ReactNode, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canAccess, isReadOnly } from '../lib/auth';
import type { LucideIcon } from 'lucide-react';
import type { RoleKey } from '../lib/types';
import {
  LayoutDashboard, Users, UserCircle, ShoppingCart, Package,
  Factory, Boxes, Receipt, DollarSign, Wallet,
  FileText, Settings, LogOut, Menu, X, Search, UserCog,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onPageChange: (page: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

const ALL_MENU_ITEMS: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'vendors', label: 'Vendors', icon: Users },
  { id: 'customers', label: 'Customers', icon: UserCircle },
  { id: 'purchases', label: 'Purchases', icon: ShoppingCart },
  { id: 'material-receiving', label: 'Material Receiving', icon: Package },
  { id: 'production', label: 'Production', icon: Factory },
  { id: 'stock', label: 'Stock / Inventory', icon: Boxes },
  { id: 'sales', label: 'Sales / Invoices', icon: Receipt },
  { id: 'expenses', label: 'Expenses', icon: DollarSign },
  { id: 'employees', label: 'Employees', icon: Wallet },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'user-management', label: 'User Management', icon: UserCog },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const ROLE_LABELS: Record<RoleKey, string> = {
  super_admin: 'Super Admin',
  plant_manager: 'Plant Manager',
  production_supervisor: 'Production Supervisor',
  store_employee: 'Store Employee',
  purchase_employee: 'Purchase Employee',
  sales_employee: 'Sales Employee',
  accountant: 'Accountant',
  viewer: 'Viewer',
};

export const Layout = ({ children, currentPage, onPageChange }: LayoutProps) => {
  const { signOut, profile, role } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const visibleItems = useMemo(
    () => ALL_MENU_ITEMS.filter((item) => canAccess(role || undefined, item.id)),
    [role]
  );

  const readOnly = isReadOnly(role || undefined);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:sticky top-0 left-0 z-40 w-64 h-screen bg-[#102b1b] text-white flex flex-col transition-transform duration-200`}
      >
        <div className="px-5 py-4 border-b border-emerald-900/70 bg-[#102b1b]">
          <div className="flex items-center gap-3">
            <img src="/Logo_(3).png" alt="Raj & Brothers" className="h-12 w-12 rounded-xl object-cover bg-[#fff8e8]" />
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight text-[#fff8e8] truncate">Raj & Brothers</h1>
              <p className="text-[11px] text-[#e8b44a] mt-0.5">Rice Bran ERP</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onPageChange(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  active
                    ? 'bg-[#d49a2a] text-[#102b1b] shadow-sm'
                    : 'text-slate-300 hover:bg-emerald-950 hover:text-[#fff8e8]'
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-emerald-900/70 space-y-2">
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-white truncate">{profile?.name || 'User'}</p>
            <p className="text-xs text-[#e8b44a]/80">{role ? ROLE_LABELS[role] : ''}</p>
          </div>
          {readOnly && (
            <div className="px-3 py-1.5 text-xs text-amber-400 font-medium">
              Read-only access
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-300 hover:bg-red-500/10 transition"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 lg:px-6 py-3 flex items-center justify-between relative">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-forest-700 via-brand-300 to-forest-500" />
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h2 className="text-base font-semibold text-gray-900 hidden sm:block">
              {visibleItems.find((i) => i.id === currentPage)?.label || 'Dashboard'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
            >
              <Search size={18} className="text-gray-500" />
            </button>
          </div>
        </header>

        {searchOpen && <GlobalSearch onPageChange={onPageChange} onClose={() => setSearchOpen(false)} />}

        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

function GlobalSearch({ onPageChange, onClose }: { onPageChange: (page: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const { role } = useAuth();

  const searchablePages = useMemo(() => {
    const items = ALL_MENU_ITEMS.filter((item) => canAccess(role || undefined, item.id));
    if (!query) return items;
    return items.filter((item) =>
      item.label.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, role]);

  return (
    <div className="border-b border-gray-200 bg-white px-4 lg:px-6 py-3">
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search modules..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-600 outline-none"
        />
      </div>
      {query && (
        <div className="mt-2 flex flex-wrap gap-2">
          {searchablePages.map((item) => (
            <button
              key={item.id}
              onClick={() => { onPageChange(item.id); onClose(); }}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-forest-50 hover:text-forest-700 transition"
            >
              <item.icon size={14} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
