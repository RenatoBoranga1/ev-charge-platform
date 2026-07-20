# @solis/database

Pacote de persistência do monólito modular da Solis Plataformas.

## PostGIS

A migração inicial habilita `postgis` e mantém a coluna
`stations.location geography(Point, 4326)` como `Unsupported` no Prisma.
As coordenadas também ficam em `latitude` e `longitude` para respostas comuns.

Consultas geoespaciais devem usar SQL parametrizado com `$queryRaw`, por exemplo
`ST_DWithin(location, ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography, metros)`.
O backend possui uma alternativa por latitude/longitude somente para ambientes sem
PostGIS; produção deve usar o índice GiST criado pela migração.

## Comandos

- `pnpm --filter @solis/database prisma:generate`
- `pnpm --filter @solis/database migrate:deploy`
- `pnpm --filter @solis/database seed`

O seed cria o tenant e o usuário de demonstração apenas quando
`SEED_DEMO_DATA=true`. A senha pode ser alterada por `DEMO_USER_PASSWORD`.
