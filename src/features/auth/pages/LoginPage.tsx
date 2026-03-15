import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';
import { useAuth } from '../../../hooks/useAuth';
import { positiveActionButtonClass } from '../../../utils/buttonStyles';
import { getFirebaseAuthErrorMessage } from '../../../utils/firebaseAuthErrors';
import { toast } from '../../../utils/toast';

type LoginPageProps = {
  isDarkMode: boolean;
  onToggleTheme: () => void;
};

export function LoginPage({ isDarkMode, onToggleTheme }: LoginPageProps) {
  const navigate = useNavigate();
  const { signInUser } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast.warning(
        'Campos incompletos',
        'Debes ingresar tu correo electrónico y contraseña.'
      );
      return;
    }

    try {
      setIsSubmitting(true);

      await signInUser(email.trim(), password);

      toast.success(
        'Inicio de sesión correcto',
        'Tu acceso fue validado correctamente.'
      );

      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast.error(
        'No se pudo iniciar sesión',
        getFirebaseAuthErrorMessage(error)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)] transition-colors">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6">
        <div className="flex justify-end">
          <ThemeToggle isDarkMode={isDarkMode} onToggle={onToggleTheme} />
        </div>

        <div className="grid flex-1 items-center gap-10 lg:grid-cols-2">
          <section className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Simulador empresarial
            </p>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--app-fg)] sm:text-5xl">
              Plataforma académica para gestión y simulación de empresas.
            </h1>

            <p className="mt-6 text-base leading-7 text-slate-600 dark:text-slate-400">
              Administra equipos, empresas simuladas, planilla, impuestos,
              préstamos y periodos operativos dentro de una experiencia moderna,
              clara y profesional.
            </p>
          </section>

          <section className="w-full max-w-md rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-8 shadow-sm">
            <header>
              <h2 className="text-2xl font-semibold tracking-tight">
                Iniciar sesión
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Accede con tu correo institucional o cuenta asignada.
              </p>
            </header>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="nombre@correo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition placeholder:text-slate-400 focus:border-slate-500"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition placeholder:text-slate-400 focus:border-slate-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`${positiveActionButtonClass} w-full`}
              >
                {isSubmitting ? 'Validando acceso...' : 'Entrar al sistema'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}