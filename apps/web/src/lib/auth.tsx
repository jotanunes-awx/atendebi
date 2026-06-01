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
import {
  AccountInfo,
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AuthenticationResult,
} from '@azure/msal-browser';

export type AtendeBIRole =
  | 'ATENDEBI_ADMIN'
  | 'ATENDEBI_DIRETORIA'
  | 'ATENDEBI_GESTOR'
  | 'ATENDEBI_QUALIDADE'
  | 'ATENDEBI_COMERCIAL'
  | 'ATENDEBI_ATENDENTE';

export type AuthMode = 'mock' | 'entra';

export type AuthenticatedUser = {
  name: string;
  email: string;
  role: AtendeBIRole;
  tenant: string;
  avatar: string;
  authProvider: AuthMode;
};

type AuthContextValue = {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  isReady: boolean;
  authMode: AuthMode;
  authError: string | null;
  login: () => Promise<boolean>;
  logout: () => Promise<void>;
};

const AUTH_STORAGE_KEY = 'atendebi-auth-session';
const ROLE_VALUES: AtendeBIRole[] = [
  'ATENDEBI_ADMIN',
  'ATENDEBI_DIRETORIA',
  'ATENDEBI_GESTOR',
  'ATENDEBI_QUALIDADE',
  'ATENDEBI_COMERCIAL',
  'ATENDEBI_ATENDENTE',
];

export const authMode: AuthMode = process.env.NEXT_PUBLIC_AUTH_MODE === 'entra' ? 'entra' : 'mock';

export const mockUser: AuthenticatedUser = {
  name: 'Daniel Fernando',
  email: 'daniel.fernando@jotanunes.com',
  role: 'ATENDEBI_ADMIN',
  tenant: process.env.NEXT_PUBLIC_ATENDEBI_TENANT_NAME ?? 'Jotanunes',
  avatar: 'DF',
  authProvider: 'mock',
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
let msalClientPromise: Promise<PublicClientApplication | null> | null = null;

function readStoredUser(): AuthenticatedUser | null {
  try {
    const storedSession = window.localStorage.getItem(AUTH_STORAGE_KEY);

    if (!storedSession) {
      return null;
    }

    const parsedSession = JSON.parse(storedSession) as Partial<AuthenticatedUser>;

    if (!parsedSession.email || !parsedSession.role || !parsedSession.name) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    return {
      name: parsedSession.name,
      email: parsedSession.email,
      role: parsedSession.role,
      tenant: parsedSession.tenant ?? mockUser.tenant,
      avatar: parsedSession.avatar ?? initials(parsedSession.name),
      authProvider: parsedSession.authProvider ?? 'mock',
    };
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function initializeAuth() {
      try {
        if (authMode === 'mock') {
          setUser(readStoredUser());
          return;
        }

        const msalClient = await getMsalClient();

        if (!msalClient) {
          setAuthError('Configuração do Entra ID incompleta no frontend.');
          return;
        }

        const redirectResult = await msalClient.handleRedirectPromise();
        const account = redirectResult?.account ?? msalClient.getActiveAccount() ?? msalClient.getAllAccounts()[0];

        if (account && active) {
          msalClient.setActiveAccount(account);
          setUser(mapAccountToUser(account, redirectResult?.accessToken));
        }
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'Não foi possível iniciar a autenticação.');
      } finally {
        if (active) {
          setIsReady(true);
        }
      }
    }

    initializeAuth();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async () => {
    setAuthError(null);

    if (authMode === 'mock') {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockUser));
      setUser(mockUser);
      return true;
    }

    const msalClient = await getMsalClient();

    if (!msalClient) {
      setAuthError('Preencha NEXT_PUBLIC_ENTRA_TENANT_ID e NEXT_PUBLIC_ENTRA_CLIENT_ID.');
      return false;
    }

    try {
      const result = await msalClient.loginPopup({
        scopes: getLoginScopes(),
        prompt: 'select_account',
      });

      if (result.account) {
        msalClient.setActiveAccount(result.account);
        setUser(mapAccountToUser(result.account, result.accessToken));
        return true;
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Não foi possível entrar com Microsoft.');
    }

    return false;
  }, []);

  const logout = useCallback(async () => {
    if (authMode === 'mock') {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      setUser(null);
      return;
    }

    const msalClient = await getMsalClient();
    const account = msalClient?.getActiveAccount();
    setUser(null);

    if (msalClient && account) {
      await msalClient.logoutPopup({
        account,
        mainWindowRedirectUri: `${window.location.origin}/login`,
      });
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isReady,
      authMode,
      authError,
      login,
      logout,
    }),
    [authError, isReady, login, logout, user],
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

export async function getApiAuthHeaders(): Promise<Record<string, string>> {
  const tenantKey = process.env.NEXT_PUBLIC_ATENDEBI_TENANT_KEY ?? 'local-tenant';
  const role = parseRole(process.env.NEXT_PUBLIC_ATENDEBI_DEFAULT_ROLE) ?? mockUser.role;
  const headers: Record<string, string> = {
    'x-tenant-id': tenantKey,
    'x-roles': role,
  };

  if (authMode !== 'entra') {
    return headers;
  }

  const accessToken = await acquireApiAccessToken();

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

async function getMsalClient() {
  if (typeof window === 'undefined' || !hasEntraBrowserConfig()) {
    return null;
  }

  if (!msalClientPromise) {
    const instance = new PublicClientApplication({
      auth: {
        clientId: process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID ?? '',
        authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_ENTRA_TENANT_ID}`,
        redirectUri: process.env.NEXT_PUBLIC_ENTRA_REDIRECT_URI ?? window.location.origin,
        postLogoutRedirectUri: `${window.location.origin}/login`,
      },
      cache: {
        cacheLocation: 'localStorage',
      },
    });

    msalClientPromise = instance.initialize().then(() => instance);
  }

  return msalClientPromise;
}

async function acquireApiAccessToken() {
  const scopes = getApiScopes();
  const msalClient = await getMsalClient();
  const account = msalClient?.getActiveAccount() ?? msalClient?.getAllAccounts()[0];

  if (!msalClient || !account || scopes.length === 0) {
    return null;
  }

  try {
    const result = await msalClient.acquireTokenSilent({ account, scopes });
    return result.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      return null;
    }

    throw error;
  }
}

function mapAccountToUser(account: AccountInfo, accessToken?: string): AuthenticatedUser {
  const claims = accessToken ? decodeJwtPayload(accessToken) : {};
  const claimRoles = Array.isArray(claims.roles) ? claims.roles : [];
  const role = claimRoles.map((item) => String(item)).find(isAtendeBIRole) ?? parseRole(process.env.NEXT_PUBLIC_ATENDEBI_DEFAULT_ROLE) ?? mockUser.role;
  const name = account.name ?? String(claims.name ?? account.username ?? 'Usuário AtendeBI');

  return {
    name,
    email: account.username || String(claims.preferred_username ?? claims.email ?? ''),
    role,
    tenant: process.env.NEXT_PUBLIC_ATENDEBI_TENANT_NAME ?? mockUser.tenant,
    avatar: initials(name),
    authProvider: 'entra',
  };
}

function getLoginScopes() {
  return unique(['openid', 'profile', 'email', ...getApiScopes()]);
}

function getApiScopes() {
  return splitCsv(process.env.NEXT_PUBLIC_ENTRA_API_SCOPE);
}

function hasEntraBrowserConfig() {
  return Boolean(
    hasConfiguredValue(process.env.NEXT_PUBLIC_ENTRA_TENANT_ID) &&
      hasConfiguredValue(process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID),
  );
}

function splitCsv(value?: string) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(hasConfiguredValue);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = window.atob(normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '='));

    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function parseRole(role?: string): AtendeBIRole | null {
  return role && isAtendeBIRole(role) ? role : null;
}

function isAtendeBIRole(role: string): role is AtendeBIRole {
  return ROLE_VALUES.includes(role as AtendeBIRole);
}

function hasConfiguredValue(value?: string) {
  if (!value?.trim()) {
    return false;
  }

  const trimmed = value.trim();

  if (/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(trimmed)) {
    return false;
  }

  return !/^(SEU_|SUA_|COLE_AQUI|VALOR_|CHANGEME|CHANGE_ME|api:\/\/atendebi-local)/i.test(trimmed);
}
