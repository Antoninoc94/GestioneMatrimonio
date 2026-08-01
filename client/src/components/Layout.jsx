import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import {
  LayoutDashboard, Users, FileText, DollarSign, CalendarCheck,
  MapPin, FolderOpen, Lightbulb, Settings, LogOut, Heart, Menu, X
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/fornitori', icon: Users, label: 'Fornitori' },
  { to: '/preventivi', icon: FileText, label: 'Preventivi' },
  { to: '/budget', icon: DollarSign, label: 'Budget & Costi' },
  { to: '/scadenze', icon: CalendarCheck, label: 'Scadenze' },
  { to: '/location', icon: MapPin, label: 'Location & Chiesa' },
  { to: '/documenti', icon: FolderOpen, label: 'Documenti' },
  { to: '/idee', icon: Lightbulb, label: 'Idee' },
  { to: '/impostazioni', icon: Settings, label: 'Impostazioni' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 flex flex-col transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
              <Heart size={16} className="text-rose-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">Il Nostro Matrimonio</div>
              <div className="text-xs text-gray-400">Gestione completa</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center text-xs font-bold text-rose-600">
              {user?.nome?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-700">{user?.nome}</div>
              <div className="text-xs text-gray-400">{user?.ruolo}</div>
            </div>
          </div>
          <button onClick={logout} className="sidebar-link w-full text-left">
            <LogOut size={16} />
            Esci
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
          <button onClick={() => setMobileOpen(true)} className="text-gray-600">
            <Menu size={22} />
          </button>
          <span className="font-bold text-gray-800">Il Nostro Matrimonio</span>
        </div>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
