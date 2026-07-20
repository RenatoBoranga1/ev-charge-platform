import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { api } from '@/api';
import { AppLogger } from '@/logging/AppLogger';
import type {
  AuthSession,
  LoginInput,
  RegisterInput,
  UserProfile,
} from '@/types/domain';

import { tokenStorage } from './token-storage';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  signIn(input: LoginInput): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function getInitialRoute(isAuthenticated: boolean):
  | '/(tabs)/stations'
  | '/(auth)/login' {
  return isAuthenticated ? '/(tabs)/stations' : '/(auth)/login';
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const tokens = await tokenStorage.getTokens();
        if (!tokens) return;
        const profile = await api.users.getMe();
        if (active) setUser(profile);
      } catch (error: unknown) {
        AppLogger.warn('auth.session.restore.failed', {
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        await tokenStorage.clearTokens();
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const applySession = useCallback(async (session: AuthSession) => {
    await tokenStorage.setTokens(session.tokens);
    setUser(session.user);
  }, []);

  const signIn = useCallback(
    async (input: LoginInput) => {
      await applySession(await api.auth.login(input));
    },
    [applySession],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      await applySession(await api.auth.register(input));
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    await tokenStorage.clearTokens();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: user !== null,
      isLoading,
      user,
      signIn,
      register,
      signOut,
    }),
    [isLoading, register, signIn, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }
  return value;
}
