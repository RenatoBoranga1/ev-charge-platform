# Estações, hierarquia de recarga e tarifas

Todas as consultas partem de uma estação do tenant atual. Charge point, EVSE e
conector são alcançados por relações Prisma tenant-scoped; senha, hash e segredo
OCPP não fazem parte dos `select` administrativos.

Estações podem ser listadas, criadas, atualizadas com optimistic locking e
arquivadas por soft delete. Coordenadas são validadas e a coluna PostGIS é
atualizada junto com latitude/longitude. Arquivamento exige confirmação e
justificativa e preserva sessões, pagamentos e auditoria.

Tarifas novas começam como `DRAFT`. A publicação:

1. valida que a estação pertence ao tenant;
2. muda a publicação para `PUBLISHED`;
3. cria `TariffVersion` com snapshot Decimal serializado;
4. grava auditoria na mesma transação.

Uma tarifa publicada não possui endpoint de edição retroativa. Sessões mantêm o
`tariffSnapshot` já contratado. Arquivamento encerra vigência sem apagar
histórico.

Limitações do draft: o cadastro visual da hierarquia OCPP, rotação de credencial,
restauração de estação e a criação de uma nova versão editável de tarifa
publicada ainda não estão expostos pelo portal.
