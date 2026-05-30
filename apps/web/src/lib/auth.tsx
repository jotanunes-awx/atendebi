'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type AtendeBIRole =
  | 'ATENDEBI_ADMIN'
  | 'ATENDEBI_DIRETORIA'
  | 'ATENDEBI_GESTOR'
  | 'ATENDEBI_QUALIDADE'
  | 'ATENDEBI_COMERCIAL'
  | 'ATENDEBI_ATENDENTE';

export type MockUser = {
  name: string;
  email: string;
  role: AtendeBIRole;
  tenant: string;
  avatar: string;
};

type AuthContextValue = {
  user: MockUser | null;
  isAuthenticated: boolean;
  isReady: boolean;
  login: () => void;
  logout: () => void;
};

const AUTH_STORAGE_KEY = 'atendebi-auth-session';

export const mockUser: MockUser = {
  name: 'Daniel Fernando',
  email: 'daniel.fernando@jotanunes.com',
  role: 'ATENDEBI_ADMIN',
  tenant: 'Jotanunes',
  avatar: 'DF',
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): MockUser | null {
  try {
    const storedSession = window.localStorage.getItem(AUTH_STORAGE_KEY);

    if (!storedSession) {
      return null;
    }

    const parsedSession = JSON.parse(storedSession) as Partial<MockUser>;

    if (!parsedSession.email || !parsedSession.role || !parsedSession.name) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    return {
      name: parsedSession.name,
      email: parsedSession.email,
      role: parsedSession.role,
      tenant: parsedSession.tenant ?? mockUser.tenant,
      avatar: parsedSession.avatar ?? mockUser.avatar,
    };
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setUser(readStoredUser());
    setIsReady(true);
  }, []);

  const login = useCallback(() => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockUser));
    setUser(mockUser);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isReady,
      login,
      logout,
    }),
    [isReady, login, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
