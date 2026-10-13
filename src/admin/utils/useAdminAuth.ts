import { useState, useEffect, useRef } from 'react';
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
    } catch (err) {
      const status = (err as AdminRequestError).status;
      setState({
        isAuthenticated: false,
        isLoading: false,
        error: status === 401 ? 'Invalid credentials.' : err instanceof Error ? err.message : 'Login failed',
      });
      return false;
    }
    try {
      await adminApi.getSession();
    } catch {
      // The password was right, but the follow-up request carried no
      // session cookie — this used to read "Invalid credentials."
      setState({
        isAuthenticated: false,
        isLoading: false,
        error: 'Signed in, but the browser did not keep the session cookie. Allow cookies for this site and try again.',
      });
      return false;
    }
    setState({ isAuthenticated: true, isLoading: false, error: null });
    return true;
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
  // Only the latest call may write state. Without this, switching a filter
  // quickly (ar → en, 30 → 90 days, page 2 → 3) let the slower, older
  // response land last and show under the newer filter.
  const latestRequest = useRef(0);

  const load = async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      if (requestId === latestRequest.current) setData(result);
    } catch (err) {
      if (requestId === latestRequest.current) setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  };

  useEffect(() => { load(); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  // Unmount: drop whatever is still in flight.
  useEffect(() => () => { latestRequest.current += 1; }, []);

  return { data, loading, error, reload: load };
};
