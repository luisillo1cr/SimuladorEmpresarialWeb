import { createContext } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import type { UserProfile } from '../../types/auth';

export type AuthContextValue = {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signInUser: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);