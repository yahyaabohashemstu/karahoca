import { useState, useEffect } from 'react';
import { adminApi, type AdminRequestError } from './adminApi';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useAdminAuth = () => {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });

  const login = async (username: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      await adminApi.login(username, password);
      await adminApi.getSession();
      setState({ isAuthenticated: true, isLoading: false, error: null });
      return true;
    } catch (err) {
      const status = (err as AdminRequestError).status;
      setState({
        isAuthenticated: false,
        isLoading: false,
        error: status === 401 ? 'Invalid credentials.' : err instanceof Error ? err.message : 'Login failed',
      });
      return false;
    }
  };

  const logout = async () => {
    try {
      await adminApi.logout();
    } catch {
      // Always clear local auth state, even if the logout request races with an expired session.
    }
    setState({ isAuthenticated: false, isLoading: false, error: null });
  };

  return { ...state, login, logout };
};

export const useAsync = <T>(fn: () => Promise<T>, deps: unknown[] = []) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, reload: load };
};

