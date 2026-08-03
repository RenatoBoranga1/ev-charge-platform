import { useEffect, type PropsWithChildren } from 'react';

import { refreshAdminSession } from '../services/api';
import { useAdminSession } from './session-store';

const refreshBeforeExpiryMs = 60_000;

export function AdminAuthProvider({ children }: PropsWithChildren) {
  const initialized = useAdminSession((state) => state.initialized);
  const session = useAdminSession((state) => state.session);
  const clear = useAdminSession((state) => state.clear);
  const setInitialized = useAdminSession((state) => state.setInitialized);

  useEffect(() => {
    if (initialized) return;
    void refreshAdminSession().catch(() => {
      clear();
      setInitialized(true);
    });
  }, [clear, initialized, setInitialized]);

  useEffect(() => {
    if (!session) return;
    const delay = Math.max(
      session.expiresInSeconds * 1_000 - refreshBeforeExpiryMs,
      30_000,
    );
    const timer = window.setTimeout(() => {
      void refreshAdminSession().catch(clear);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [clear, session]);

  return children;
}
