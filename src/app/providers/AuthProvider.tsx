import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  type User as FirebaseUser,
  browserSessionPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase/config';
import type { UserProfile } from '../../types/auth';
import { toast } from '../../utils/toast';
import { AuthContext, type AuthContextValue } from './auth-context';

type AuthProviderProps = {
  children: ReactNode;
};

const WARNING_DELAY_MS = 10 * 60 * 1000;
const LOGOUT_DELAY_MS = 15 * 60 * 1000;

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const warningTimerRef = useRef<number | null>(null);
  const logoutTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let unsubscribe = () => {};
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        setIsLoading(true);

        /*
          Keeps the session alive across page reloads in the current browser tab,
          while still avoiding long-term persistence after the tab is closed.
        */
        await setPersistence(auth, browserSessionPersistence);

        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (!isMounted) {
            return;
          }

          setIsLoading(true);

          if (!firebaseUser) {
            setUser(null);
            setProfile(null);
            setIsLoading(false);
            return;
          }

          try {
            const profileRef = doc(db, 'users', firebaseUser.uid);
            const profileSnapshot = await getDoc(profileRef);

            /*
              Allows the invited user to remain authenticated even before their
              Firestore profile is created during the email-link onboarding flow.
            */
            if (!profileSnapshot.exists()) {
              setUser(firebaseUser);
              setProfile(null);
              setIsLoading(false);
              return;
            }

            const profileData = profileSnapshot.data();

            setUser(firebaseUser);
            setProfile({
              uid: profileSnapshot.id,
              firstName: profileData.firstName ?? '',
              lastName: profileData.lastName ?? '',
              email: profileData.email ?? firebaseUser.email ?? '',
              role:
                profileData.role === 'admin' ||
                profileData.role === 'professor' ||
                profileData.role === 'student'
                  ? profileData.role
                  : 'student',
              teamId: profileData.teamId ?? null,
              status:
                profileData.status === 'inactive' ||
                profileData.status === 'invited'
                  ? profileData.status
                  : 'active',
            });
          } catch {
            setUser(null);
            setProfile(null);
            toast.error(
              'No fue posible cargar la sesión',
              'Revisa las reglas de Firestore y la estructura del documento de usuario.'
            );
          } finally {
            setIsLoading(false);
          }
        });
      } catch {
        setIsLoading(false);
        toast.error(
          'No fue posible inicializar la autenticación',
          'Revisa la configuración base de Firebase Authentication.'
        );
      }
    };

    void initializeAuth();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const clearIdleTimers = () => {
      if (warningTimerRef.current) {
        window.clearTimeout(warningTimerRef.current);
      }

      if (logoutTimerRef.current) {
        window.clearTimeout(logoutTimerRef.current);
      }
    };

    const handleAutoLogout = async () => {
      await signOut(auth);
      toast.info(
        'Sesión finalizada por inactividad',
        'Tu sesión se cerró automáticamente después de 15 minutos sin actividad.'
      );
    };

    const resetIdleTimers = () => {
      clearIdleTimers();

      warningTimerRef.current = window.setTimeout(() => {
        toast.warning(
          'Sesión por expirar',
          'Tu sesión se cerrará en 5 minutos por inactividad.'
        );
      }, WARNING_DELAY_MS);

      logoutTimerRef.current = window.setTimeout(() => {
        void handleAutoLogout();
      }, LOGOUT_DELAY_MS);
    };

    const handleActivity = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }

      resetIdleTimers();
    };

    resetIdleTimers();

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('click', handleActivity);
    document.addEventListener('visibilitychange', handleActivity);

    return () => {
      clearIdleTimers();

      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('click', handleActivity);
      document.removeEventListener('visibilitychange', handleActivity);
    };
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      isAuthenticated: Boolean(user && profile),
      isLoading,
      signInUser: async (email: string, password: string) => {
        await setPersistence(auth, browserSessionPersistence);
        await signInWithEmailAndPassword(auth, email, password);
      },
      signOutUser: async () => {
        await signOut(auth);
      },
    }),
    [user, profile, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}