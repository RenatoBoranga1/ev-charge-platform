import { expect, test, type Page } from '@playwright/test';

const session = {
  accessToken: 'short-lived-access-token',
  expiresInSeconds: 900,
  membership: {
    id: 'membership-1',
    name: 'Operador Solis',
    permissions: ['stations.read'],
    roles: ['VIEWER'],
    tenantId: 'tenant-1',
    tenantName: 'Solis Plataformas',
  },
};

async function mockAdminApi(page: Page): Promise<void> {
  await page.route('**/v1/admin/auth/login', async (route) => {
    await route.fulfill({
      body: JSON.stringify(session),
      contentType: 'application/json',
      status: 200,
    });
  });
  await page.route('**/v1/admin/auth/logout', async (route) => {
    await route.fulfill({ status: 204 });
  });
  await page.route('**/v1/admin/auth/refresh', async (route) => {
    await route.fulfill({
      body: JSON.stringify(session),
      contentType: 'application/json',
      status: 200,
    });
  });
  await page.route('**/v1/admin/dashboard', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        generatedAt: '2026-08-03T12:00:00.000Z',
        metrics: {
          activeSessions: 2,
          completedSessionsThisMonth: 18,
          connectedChargePoints: 4,
          drivers: 21,
          failedCommands: 1,
          reconciliationIssues: 0,
          revenueThisMonth: '1530.50',
          stations: 3,
        },
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
}

async function login(page: Page): Promise<void> {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('E-mail').fill('operador@solis.local');
  await page.getByLabel('Senha').fill('senha-segura');
  await page.getByRole('button', { name: 'Entrar com segurança' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.beforeEach(async ({ page }) => {
  await mockAdminApi(page);
});

test('authenticates, renders the operational dashboard and logs out', async ({
  page,
}) => {
  await login(page);

  await expect(
    page.getByRole('heading', { name: 'Visão geral operacional' }),
  ).toBeVisible();
  await expect(page.getByText('3', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Solis Plataformas')).toBeVisible();

  await page.getByLabel('Tema da interface').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.setViewportSize({ height: 800, width: 390 });
  await page.getByRole('button', { name: 'Abrir navegação' }).click();
  await expect(page.getByRole('navigation')).toBeVisible();

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('hides unauthorized actions and denies a protected direct route', async ({
  page,
}) => {
  await login(page);

  await expect(page.getByRole('link', { name: 'Pagamentos' })).toHaveCount(0);
  await page.context().addCookies([
    {
      name: 'solis_admin_csrf',
      url: 'http://127.0.0.1:4173',
      value: 'csrf-token',
    },
  ]);
  await page.goto('/admin/stations/new');
  await expect(
    page.getByRole('alert').getByText('Acesso não autorizado'),
  ).toBeVisible();
});
