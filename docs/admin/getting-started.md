# Primeiros passos no portal administrativo

## Desenvolvimento local

1. Instale dependências com `pnpm install --frozen-lockfile`.
2. Suba PostgreSQL/PostGIS e Redis.
3. Defina `DATABASE_URL`, `REDIS_URL`, segredos JWT e
   `SEED_DEMO_DATA=true` somente no ambiente local.
4. Execute `pnpm db:migrate` e `pnpm db:seed`.
5. Inicie a API com `pnpm dev:backend`.
6. Inicie o portal com `pnpm --filter @solis/admin-web dev`.

O portal fica em `http://localhost:4173`; a API e o Swagger ficam em
`http://localhost:8000` e `http://localhost:8000/docs`.

`VITE_API_URL` pode permanecer vazio no desenvolvimento para usar o proxy do
Vite. Valores `VITE_*` são públicos e nunca devem conter senha ou segredo.

## Sessão segura

O login retorna um access token curto mantido apenas no store em memória. O
refresh token não é acessível ao JavaScript e usa cookie HttpOnly. O cookie
`solis_admin_csrf` é enviado no header `X-CSRF-Token` no refresh. Em produção,
publique portal e API em origens explicitamente autorizadas por `CORS_ORIGINS`
e sobre HTTPS.

## Dados demonstrativos

O seed administrativo só roda quando `SEED_DEMO_DATA=true`. A senha vem de
`DEMO_ADMIN_PASSWORD`; nenhuma credencial real é versionada. A conta de exemplo
é `admin@solis.local` e deve existir apenas em ambientes controlados.

## Verificação

```text
pnpm --filter @solis/admin-web lint
pnpm --filter @solis/admin-web typecheck
pnpm --filter @solis/admin-web test -- --coverage
pnpm --filter @solis/admin-web build
pnpm --filter @solis/admin-web e2e
pnpm e2e:admin
```

O E2E Playwright usa API simulada no navegador. `e2e:admin` valida autenticação,
tenant, persistência, tarifas, relatório e auditoria contra a API real.
