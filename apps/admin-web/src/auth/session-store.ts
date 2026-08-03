import type {
  AdminPermission,
  AdminRole,
  AdminSession,
} from '@solis/admin-contracts';
import { create } from 'zustand';

interface AdminSessionState {
  initialized: boolean;
  session: AdminSession | null;
  clear: () => void;
  hasPermission: (permission: AdminPermission) => boolean;
  hasRole: (role: AdminRole) => boolean;
  setInitialized: (initialized: boolean) => void;
  setSession: (session: AdminSession) => void;
}

export const useAdminSession = create<AdminSessionState>((set, get) => ({
  initialized: false,
  session: null,
  clear: () => set({ initialized: true, session: null }),
  hasPermission: (permission) =>
    get().session?.membership.permissions.includes(permission) ?? false,
  hasRole: (role) =>
    get().session?.membership.roles.includes(role) ?? false,
  setInitialized: (initialized) => set({ initialized }),
  setSession: (session) => set({ initialized: true, session }),
}));

export function resetAdminSessionForTests(): void {
  useAdminSession.setState({ initialized: false, session: null });
}
