import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AdminAuthProvider } from '../auth/AdminAuthProvider';
import { LoginPage } from '../auth/LoginPage';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { AuditPage } from '../features/audit/AuditPage';
import { CommandsPage } from '../features/commands/CommandsPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { DriversPage } from '../features/drivers/DriversPage';
import { OperatorsPage } from '../features/operators/OperatorsPage';
import { PaymentsPage } from '../features/payments/PaymentsPage';
import { ReconciliationPage } from '../features/payments/ReconciliationPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { SessionDetailPage } from '../features/sessions/SessionDetailPage';
import { SessionsPage } from '../features/sessions/SessionsPage';
import { MapPage } from '../features/stations/MapPage';
import { StationDetailPage } from '../features/stations/StationDetailPage';
import { StationFormPage } from '../features/stations/StationFormPage';
import { StationsPage } from '../features/stations/StationsPage';
import { TariffFormPage } from '../features/tariffs/TariffFormPage';
import { TariffsPage } from '../features/tariffs/TariffsPage';
import { AdminShell } from '../layouts/AdminShell';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: (failureCount, error) =>
        !(error instanceof Error && 'status' in error && error.status === 403) &&
        failureCount < 2,
      staleTime: 15_000,
    },
  },
});

function ProtectedShell() {
  return (
    <ProtectedRoute>
      <AdminShell />
    </ProtectedRoute>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AdminAuthProvider>
          <Routes>
            <Route element={<LoginPage />} path="/login" />
            <Route element={<ProtectedShell />} path="/admin">
              <Route index element={<DashboardPage />} />
              <Route element={<MapPage />} path="map" />
              <Route element={<StationsPage />} path="stations" />
              <Route element={<ProtectedRoute permission="stations.create"><StationFormPage /></ProtectedRoute>} path="stations/new" />
              <Route element={<StationDetailPage />} path="stations/:stationId" />
              <Route element={<TariffsPage />} path="tariffs" />
              <Route element={<ProtectedRoute permission="tariffs.create"><TariffFormPage /></ProtectedRoute>} path="tariffs/new" />
              <Route element={<SessionsPage />} path="sessions" />
              <Route element={<SessionDetailPage />} path="sessions/:sessionId" />
              <Route element={<CommandsPage />} path="commands" />
              <Route element={<DriversPage />} path="drivers" />
              <Route element={<PaymentsPage />} path="payments" />
              <Route element={<ProtectedRoute permission="payments.reconcile"><ReconciliationPage /></ProtectedRoute>} path="reconciliation" />
              <Route element={<OperatorsPage />} path="operators" />
              <Route element={<ReportsPage />} path="reports" />
              <Route element={<AuditPage />} path="audit" />
            </Route>
            <Route element={<Navigate replace to="/admin" />} path="*" />
          </Routes>
        </AdminAuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
