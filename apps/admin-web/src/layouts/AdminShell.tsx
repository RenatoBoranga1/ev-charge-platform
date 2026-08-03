import type { AdminPermission } from '@solis/admin-contracts';
import { useEffect, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { useAdminSession } from '../auth/session-store';
import { applyThemeTokens } from '../design-system/theme';
import { logoutAdmin } from '../services/api';

interface NavigationItem {
  icon: string;
  label: string;
  path: string;
  permission: AdminPermission;
}

const navigation: NavigationItem[] = [
  { icon: '◫', label: 'Visão geral', path: '/admin', permission: 'stations.read' },
  { icon: '⌖', label: 'Mapa', path: '/admin/map', permission: 'stations.read' },
  { icon: '⚡', label: 'Estações', path: '/admin/stations', permission: 'stations.read' },
  { icon: '₿', label: 'Tarifas', path: '/admin/tariffs', permission: 'tariffs.read' },
  { icon: '◷', label: 'Sessões', path: '/admin/sessions', permission: 'sessions.read' },
  { icon: '⌁', label: 'Comandos', path: '/admin/commands', permission: 'sessions.read' },
  { icon: '♙', label: 'Motoristas', path: '/admin/drivers', permission: 'drivers.read' },
  { icon: '¤', label: 'Pagamentos', path: '/admin/payments', permission: 'payments.read' },
  { icon: '✓', label: 'Conciliação', path: '/admin/reconciliation', permission: 'payments.reconcile' },
  { icon: '♜', label: 'Operadores', path: '/admin/operators', permission: 'users.read' },
  { icon: '↧', label: 'Relatórios', path: '/admin/reports', permission: 'reports.read' },
  { icon: '≣', label: 'Auditoria', path: '/admin/audit', permission: 'audit.read' },
];

type ThemeMode = 'dark' | 'light' | 'system';

function resolvedTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode !== 'system') return mode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function AdminShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('system');
  const location = useLocation();
  const navigate = useNavigate();
  const session = useAdminSession((state) => state.session);
  const hasPermission = useAdminSession((state) => state.hasPermission);

  useEffect(() => {
    applyThemeTokens(resolvedTheme(theme));
  }, [theme]);

  useEffect(() => setSidebarOpen(false), [location.pathname]);

  async function handleLogout(): Promise<void> {
    await logoutAdmin();
    await navigate('/login', { replace: true });
  }

  return (
    <div className="admin-layout">
      <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
      <header className="topbar">
        <button
          aria-expanded={sidebarOpen}
          aria-label="Abrir navegação"
          className="icon-button menu-button"
          onClick={() => setSidebarOpen((open) => !open)}
          type="button"
        >
          ☰
        </button>
        <Link className="brand" to="/admin" aria-label="Solis Operações">
          <span className="brand-mark" aria-hidden="true">☀</span>
          <span><strong>Solis</strong><small>Solar Soluções</small></span>
        </Link>
        <div className="topbar-actions">
          <label className="theme-control">
            <span className="sr-only">Tema</span>
            <select
              aria-label="Tema da interface"
              onChange={(event) => setTheme(event.target.value as ThemeMode)}
              value={theme}
            >
              <option value="system">Sistema</option>
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </select>
          </label>
          <div className="operator-summary">
            <strong>{session?.membership.name}</strong>
            <span>{session?.membership.tenantName}</span>
          </div>
          <button className="button button-quiet" onClick={() => void handleLogout()} type="button">
            Sair
          </button>
        </div>
      </header>

      <aside className={sidebarOpen ? 'sidebar sidebar-open' : 'sidebar'} aria-label="Navegação principal">
        <nav>
          {navigation
            .filter((item) => hasPermission(item.permission))
            .map((item) => (
              <NavLink
                className={({ isActive }) => isActive ? 'nav-link nav-link-active' : 'nav-link'}
                end={item.path === '/admin'}
                key={item.path}
                to={item.path}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-footer">
          <span>Ambiente operacional</span>
          <strong>Tenant isolado</strong>
        </div>
      </aside>
      {sidebarOpen ? (
        <button
          aria-label="Fechar navegação"
          className="sidebar-scrim"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      ) : null}
      <main className="main-content" id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
