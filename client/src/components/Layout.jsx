import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useAppConfig } from '../AppConfigContext';
import {
  LayoutDashboard, Users, FileText, DollarSign, CalendarCheck,
  MapPin, FolderOpen, Lightbulb, Settings, LogOut, Menu,
  UserCheck, Clock, Gift, Plane, Mail
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { group: 'Ospiti & Logistica' },
  { to: '/ospiti', icon: Users, label: 'Lista Ospiti' },
  { to: '/tavoli', icon: UserCheck, label: 'Tavoli' },
  { to: '/regali', icon: Gift, label: 'Regali' },
  { group: 'Fornitori & Budget' },
  { to: '/fornitori', icon: Users, label: 'Fornitori' },
  { to: '/preventivi', icon: FileText, label: 'Preventivi' },
  { to: '/budget', icon: DollarSign, label: 'Budget & Costi' },
  { group: 'Organizzazione' },
  { to: '/scadenze', icon: CalendarCheck, label: 'Scadenze' },
  { to: '/cronologia', icon: Clock, label: 'Cronologia Giorno' },
  { to: '/location', icon: MapPin, label: 'Location & Chiesa' },
  { to: '/viaggio', icon: Plane, label: 'Viaggio di Nozze' },
  { group: 'Strumenti' },
  { to: '/inviti', icon: Mail, label: 'Inviti' },
  { to: '/documenti', icon: FolderOpen, label: 'Documenti' },
  { to: '/idee', icon: Lightbulb, label: 'Idee' },
  { to: '/impostazioni', icon: Settings, label: 'Impostazioni' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { app_name, app_emoji } = useAppConfig();
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
            <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-lg">
              {app_emoji}
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">{app_name}</div>
              <div className="text-xs text-gray-400">Gestione completa</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item, idx) => {
            if (item.group) return (
              <div key={idx} className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 pt-4 pb-1 first:pt-1">
                {item.group}
              </div>
            );
            const { to, icon: Icon, label } = item;
            return (
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
            );
          })}
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
          <span className="font-bold text-gray-800">{app_name}</span>
        </div>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
