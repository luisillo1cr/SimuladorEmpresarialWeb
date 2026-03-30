import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { negativeActionButtonClass } from '../../utils/buttonStyles';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../services/firebase/config';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const [teamLabel, setTeamLabel] = useState<string>('');

  useEffect(() => {
    const loadTeamLabel = async () => {
      if (!profile?.teamId) {
        setTeamLabel('');
        return;
      }

      try {
        const teamSnapshot = await getDoc(doc(db, 'teams', profile.teamId));
        if (!teamSnapshot.exists()) {
          setTeamLabel('Equipo asignado');
          return;
        }

        const data = teamSnapshot.data();
        const nextLabel = String(data.name ?? data.teamName ?? '').trim();
        setTeamLabel(nextLabel || 'Equipo asignado');
      } catch {
        setTeamLabel('Equipo asignado');
      }
    };

    void loadTeamLabel();
  }, [profile?.teamId]);

  const roleLabel = useMemo(() => {
    switch (profile?.role) {
      case 'admin':
        return 'Administrador';
      case 'professor':
        return 'Docente';
      case 'student':
        return 'Estudiante';
      default:
        return 'Usuario';
    }
  }, [profile?.role]);

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
    {
      label: 'Empleados',
      to: '/admin/employees',
      visible: profile?.role === 'admin' || profile?.role === 'professor',
    },
    {
      label: 'Solicitudes',
      to: '/admin/compliance-requests',
      visible: profile?.role === 'admin' || profile?.role === 'professor',
    },
    {
      label: 'Planilla',
      to: '/admin/payroll',
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
              EmpresariOS
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--app-fg)]">
              Panel Empresarial
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface)] px-3 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                {roleLabel}
              </span>
              {profile?.teamId ? (
                <span
                  title={teamLabel || profile.teamId}
                  className="inline-flex max-w-full items-center rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface)] px-3 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300"
                >
                  <span className="max-w-[11rem] truncate">
                    {teamLabel || 'Equipo asignado'}
                  </span>
                </span>
              ) : null}
            </div>
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
        <div className="border-t border-[color:var(--app-border)] px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Navega rápido entre módulos y mantén el flujo del simulador ordenado.
          </p>
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
