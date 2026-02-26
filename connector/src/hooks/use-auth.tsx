import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import * as authApi from "@/api/auth";
import { attemptTokenRefresh, clearAuthState, setAccessToken } from "@/lib/auth";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  organization?: { id: string; name: string };
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  register: (email: string, password: string, name: string, orgName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const me = await authApi.me();
    setUser({
      id: me.data.id,
      email: me.data.email,
      name: me.data.name,
      role: me.data.role,
      organization: me.data.organization
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    setAccessToken(response.data.access_token);
    setUser({
      id: response.data.user.id,
      email: response.data.user.email,
      name: response.data.user.name,
      role: response.data.user.role
    });
    await refreshProfile();
  }, [refreshProfile]);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const response = await authApi.loginWithGoogle({ id_token: idToken });
    setAccessToken(response.data.access_token);
    setUser({
      id: response.data.user.id,
      email: response.data.user.email,
      name: response.data.user.name,
      role: response.data.user.role
    });
    await refreshProfile();
  }, [refreshProfile]);

  const register = useCallback(
    async (email: string, password: string, name: string, orgName: string) => {
      const response = await authApi.register({
        email,
        password,
        name,
        organization_name: orgName
      });
      setAccessToken(response.data.access_token);
      setUser({
        id: response.data.user.id,
        email: response.data.user.email,
        name: response.data.user.name,
        role: response.data.user.role,
        organization: response.data.organization
      });
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearAuthState();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const refreshed = await attemptTokenRefresh();
        if (refreshed) {
          await refreshProfile();
        }
      } catch {
        clearAuthState();
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [refreshProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      loginWithGoogle,
      register,
      logout,
      refreshProfile
    }),
    [user, isLoading, login, loginWithGoogle, register, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
