import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../hooks/useAuth';
import { getRoleLabel, getStatusLabel } from '../utils/authLabels';
import { toast } from '../utils/toast';

type ProfilePageProps = {
  isDarkMode: boolean;
  onToggleTheme: () => void;
};

export function ProfilePage({
  isDarkMode,
  onToggleTheme,
}: ProfilePageProps) {
  const navigate = useNavigate();
  const { profile, signOutUser } = useAuth();

  const handleLogout = async () => {
    await signOutUser();
    toast.info('Sesión cerrada', 'Tu sesión fue cerrada correctamente.');
    navigate('/login', { replace: true });
  };

  const handleOpenProfile = () => {
    navigate('/profile');
  };

  return (
    <AppShell
      title="Perfil"
      subtitle="Información general de tu cuenta y datos del usuario."
      isDarkMode={isDarkMode}
      onToggleTheme={onToggleTheme}
      onLogout={handleLogout}
      onOpenProfile={handleOpenProfile}
    >
      <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <article className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] text-3xl font-semibold text-[var(--app-fg)]">
              {profile?.firstName?.[0] ?? 'U'}
            </div>

            <h2 className="mt-4 text-xl font-semibold">
              {profile?.firstName} {profile?.lastName}
            </h2>

            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {profile?.email}
            </p>
          </div>
        </article>

        <article className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
          <header className="mb-6">
            <h2 className="text-lg font-semibold">Información del usuario</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Esta sección concentrará más adelante la edición de perfil, foto y
              otros datos relevantes.
            </p>
          </header>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nombre
              </p>
              <p className="mt-2 text-base font-medium">
                {profile?.firstName} {profile?.lastName}
              </p>
            </div>

            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Correo electrónico
              </p>
              <p className="mt-2 text-base font-medium">{profile?.email}</p>
            </div>

            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">Rol</p>
              <p className="mt-2 text-base font-medium">
                {getRoleLabel(profile?.role)}
              </p>
            </div>

            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Estado
              </p>
              <p className="mt-2 text-base font-medium">
                {getStatusLabel(profile?.status)}
              </p>
            </div>

            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Equipo asignado
              </p>
              <p className="mt-2 text-base font-medium">
                {profile?.teamId ?? 'Sin asignar'}
              </p>
            </div>
          </div>
        </article>
      </section>
    </AppShell>
  );
}