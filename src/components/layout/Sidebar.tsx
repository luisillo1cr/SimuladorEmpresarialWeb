import { NavLink, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { negativeActionButtonClass } from '../../utils/buttonStyles';
import { useAuth } from '../../hooks/useAuth';

type SidebarProps = {
  isOpen?: boolean;
  onClose?: () => void;
  onLogout?: () => void;
};

export function Sidebar({
  isOpen = false,
  onClose,
  onLogout,
}: SidebarProps) {
  const { profile } = useAuth();
  const location = useLocation();

  useEffect(() => {
    onClose?.();
  }, [location.pathname, onClose]);

  const navigationItems = [
    { label: 'Dashboard', to: '/dashboard', visible: true },
    {
      label: 'Mi empresa',
      to: '/my-company',
      visible: profile?.role === 'student',
    },
    {
      label: 'Usuarios',
      to: '/admin/users',
      visible: profile?.role === 'admin' || profile?.role === 'professor',
    },
    {
      label: 'Equipos',
      to: '/admin/teams',
      visible: profile?.role === 'admin' || profile?.role === 'professor',
    },
    {
      label: 'Empresas',
      to: '/admin/companies',
      visible: profile?.role === 'admin' || profile?.role === 'professor',
    },
  ];

  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[color:var(--app-border)] bg-white/85 backdrop-blur-xl transition-transform duration-300 dark:bg-[#2a2a2a]/88',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        'xl:sticky xl:top-0 xl:h-screen xl:translate-x-0 xl:shrink-0',
      ].join(' ')}
    >
      <div className="border-b border-[color:var(--app-border)] px-6 py-5">
        <div className="flex items-start justify-between gap-3 xl:block">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Simulador Web
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--app-fg)]">
              Panel Empresarial
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] text-slate-500 transition hover:text-[var(--app-fg)] xl:hidden"
            aria-label="Cerrar menú"
          >
            ×
          </button>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <ul className="space-y-2">
          {navigationItems
            .filter((item) => item.visible)
            .map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      'block rounded-2xl border px-4 py-3 text-sm font-medium transition',
                      isActive
                        ? 'border-[color:var(--app-border)] bg-[var(--app-surface)] text-[var(--app-fg)] shadow-sm'
                        : 'border-transparent text-slate-700 hover:border-[color:var(--app-border)] hover:bg-[var(--app-surface)] hover:text-[var(--app-fg)] dark:text-slate-300 dark:hover:bg-[#343434]',
                    ].join(' ')
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
        </ul>
      </nav>

      {onLogout ? (
        <div className="border-t border-[color:var(--app-border)] px-4 py-4">
          <button
            type="button"
            onClick={onLogout}
            className={`${negativeActionButtonClass} w-full`}
          >
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </aside>
  );
}
