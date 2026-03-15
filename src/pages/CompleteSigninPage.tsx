import { useEffect, useState, type FormEvent } from 'react';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  isSignInWithEmailLink,
  signInWithEmailLink,
  updatePassword,
} from 'firebase/auth';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { ActivationOverlay } from '../components/ui/ActivationOverlay';
import { auth, db } from '../services/firebase/config';
import { normalizeEmail } from '../utils/email';
import { toast } from '../utils/toast';

type CompleteSigninPageProps = {
  isDarkMode: boolean;
  onToggleTheme: () => void;
};

type ActivationStep =
  | 'idle'
  | 'validating-link'
  | 'saving-password'
  | 'creating-profile'
  | 'finishing';

function getActivationStepText(step: ActivationStep) {
  switch (step) {
    case 'validating-link':
      return {
        label: 'Validando',
        title: 'Validando enlace',
        description:
          'Estamos confirmando que tu invitación siga siendo válida.',
      };
    case 'saving-password':
      return {
        label: 'Seguridad',
        title: 'Guardando contraseña',
        description:
          'Estamos registrando tu contraseña para futuros ingresos al sistema.',
      };
    case 'creating-profile':
      return {
        label: 'Perfil',
        title: 'Creando perfil',
        description:
          'Estamos generando tu perfil de usuario dentro del simulador.',
      };
    case 'finishing':
      return {
        label: 'Finalizando',
        title: 'Finalizando acceso',
        description: 'Estamos preparando tu ingreso inicial al dashboard.',
      };
    case 'idle':
    default:
      return {
        label: 'Procesando',
        title: 'Activando acceso',
        description: 'Estamos preparando tu cuenta dentro del sistema.',
      };
  }
}

export function CompleteSigninPage({
  isDarkMode,
  onToggleTheme,
}: CompleteSigninPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidLink, setIsValidLink] = useState(false);
  const [activationStep, setActivationStep] =
    useState<ActivationStep>('idle');

  useEffect(() => {
    setIsValidLink(isSignInWithEmailLink(auth, window.location.href));
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      toast.warning(
        'Correo requerido',
        'Debes ingresar el mismo correo al que se envió la invitación.'
      );
      return;
    }

    if (!password.trim() || !confirmPassword.trim()) {
      toast.warning(
        'Contraseña requerida',
        'Debes ingresar y confirmar tu nueva contraseña.'
      );
      return;
    }

    if (password.length < 8) {
      toast.warning(
        'Contraseña muy corta',
        'La contraseña debe tener al menos 8 caracteres.'
      );
      return;
    }

    if (password !== confirmPassword) {
      toast.warning(
        'Las contraseñas no coinciden',
        'Verifica que ambas contraseñas sean exactamente iguales.'
      );
      return;
    }

    if (!isSignInWithEmailLink(auth, window.location.href)) {
      toast.error(
        'Enlace inválido',
        'Este enlace no es válido o ya expiró.'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setActivationStep('validating-link');

      const credential = await signInWithEmailLink(
        auth,
        normalizedEmail,
        window.location.href
      );

      const currentUser = credential.user;

      setActivationStep('saving-password');
      await updatePassword(currentUser, password);

      const inviteRef = doc(db, 'invites', normalizedEmail);
      const inviteSnapshot = await getDoc(inviteRef);

      if (!inviteSnapshot.exists()) {
        throw new Error('invite-not-found');
      }

      const inviteData = inviteSnapshot.data();

      setActivationStep('creating-profile');

      const userRef = doc(db, 'users', currentUser.uid);
      const userSnapshot = await getDoc(userRef);

      if (!userSnapshot.exists()) {
        await setDoc(userRef, {
          email: normalizedEmail,
          firstName: inviteData.firstName ?? '',
          lastName: inviteData.lastName ?? '',
          role: 'student',
          status: 'active',
          teamId: null,
          invitedBy: inviteData.invitedBy ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await deleteDoc(inviteRef);

      setActivationStep('finishing');

      toast.success(
        'Acceso activado',
        'Tu cuenta fue activada y tu contraseña quedó registrada correctamente.'
      );

      window.location.assign('/dashboard');
    } catch (error) {
      const appError = error as { message?: string; code?: string };

      if (appError.message === 'invite-not-found') {
        toast.error(
          'Invitación no encontrada',
          'No existe una invitación pendiente para este correo.'
        );
      } else if (
        appError.code === 'auth/invalid-action-code' ||
        appError.code === 'auth/expired-action-code'
      ) {
        toast.error(
          'Enlace inválido',
          'El enlace ya expiró o no es válido.'
        );
      } else if (appError.code === 'auth/requires-recent-login') {
        toast.error(
          'Sesión no válida',
          'Vuelve a abrir el enlace de invitación e inténtalo nuevamente.'
        );
      } else {
        toast.error(
          'No se pudo completar el acceso',
          'Verifica el correo, la contraseña y vuelve a intentarlo.'
        );
      }
    } finally {
      setIsSubmitting(false);
      setActivationStep('idle');
    }
  };

  const activationText = getActivationStepText(activationStep);

  return (
    <>
      <main className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)] transition-colors">
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6">
          <div className="flex justify-end">
            <ThemeToggle isDarkMode={isDarkMode} onToggle={onToggleTheme} />
          </div>

          <div className="grid flex-1 items-center gap-10 lg:grid-cols-2">
            <section className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Activación de acceso
              </p>

              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--app-fg)] sm:text-5xl">
                Completa tu acceso al simulador empresarial.
              </h1>

              <p className="mt-6 text-base leading-7 text-slate-600 dark:text-slate-400">
                Ingresa el mismo correo al que se envió la invitación y define tu
                contraseña para futuros ingresos al sistema.
              </p>
            </section>

            <section className="w-full max-w-md rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-8 shadow-sm">
              <header>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Confirmar acceso
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {isValidLink
                    ? 'Completa tu correo y define tu contraseña.'
                    : 'El enlace no parece válido. Aun así puedes intentarlo con el correo correcto.'}
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
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Nueva contraseña
                  </label>
                  <input
                    id="password"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Confirmar contraseña
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repite la contraseña"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition placeholder:text-slate-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`${isSubmitting ? 'opacity-60' : ''} w-full rounded-2xl border border-[color:var(--action-positive-border)] bg-[var(--action-positive-bg)] px-4 py-3 text-sm font-medium text-[var(--action-positive-fg)] transition hover:bg-[var(--action-positive-bg-hover)] disabled:cursor-not-allowed`}
                >
                  {isSubmitting
                    ? 'Activando acceso...'
                    : 'Activar acceso y guardar contraseña'}
                </button>
              </form>
            </section>
          </div>
        </div>
      </main>

      <ActivationOverlay
        isVisible={isSubmitting}
        title={activationText.title}
        description={activationText.description}
        stepLabel={activationText.label}
      />
    </>
  );
}