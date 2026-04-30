import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Activity, Stethoscope, Users, Settings, FileText, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label?: string;
}

function NavItem({ to, icon, label }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `inline-flex items-center px-4 py-2 mt-3 mb-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${
          isActive
            ? 'bg-teal-50 text-teal-700 shadow-sm border border-teal-200'
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'
        }`
      }
    >
      {icon}
      {label && <span className="ml-2">{label}</span>}
    </NavLink>
  );
}

export default function MainLayout() {
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      <nav className="bg-white shadow-sm border-b border-slate-200 shrink-0">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 flex items-center gap-2">
                <div className="bg-teal-500 text-white p-2 rounded-lg">
                  <Activity className="h-6 w-6" />
                </div>
                <span className="font-extrabold text-xl tracking-tight text-slate-800 mr-8">
                  MEDIVISION
                </span>
              </div>
              <div className="hidden sm:flex sm:space-x-2">
                <NavItem to="/accueil" icon={<Activity className="w-5 h-5" />} label="Accueil (Infirmière)" />
                <NavItem to="/consultation" icon={<Stethoscope className="w-5 h-5" />} label="Consultation" />
                <NavItem to="/comptes-rendus" icon={<FileText className="w-5 h-5" />} label="Comptes rendus" />
                <NavItem to="/patients" icon={<Users className="w-5 h-5" />} label="Patients" />
                <NavItem to="/parametres" icon={<Settings className="w-5 h-5" />} label="Paramètres" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Identité utilisateur — desktop */}
              {user?.email && (
                <span className="hidden sm:block text-xs text-slate-400 max-w-[180px] truncate">
                  {user.email}
                </span>
              )}

              {/* Bouton déconnexion */}
              <button
                onClick={handleSignOut}
                title="Se déconnecter"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition active:scale-95"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline font-medium">Déconnexion</span>
              </button>

              {/* Navigation mobile (icônes uniquement) */}
              <div className="sm:hidden flex items-center space-x-1">
                <NavItem to="/accueil" icon={<Activity className="w-6 h-6" />} />
                <NavItem to="/consultation" icon={<Stethoscope className="w-6 h-6" />} />
                <NavItem to="/comptes-rendus" icon={<FileText className="w-6 h-6" />} />
                <NavItem to="/patients" icon={<Users className="w-6 h-6" />} />
                <NavItem to="/parametres" icon={<Settings className="w-6 h-6" />} />
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>
    </div>
  );
}
