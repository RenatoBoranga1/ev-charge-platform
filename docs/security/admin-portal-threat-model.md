# Modelo de ameaças do portal administrativo

## Escopo e ativos

O modelo cobre `apps/admin-web`, endpoints `/v1/admin`, cookies de refresh,
access tokens, memberships, estações, comandos, dados financeiros, relatórios e
auditoria. Backend, PostgreSQL e Redis permanecem na zona confiável; navegador,
rede e entradas do operador são não confiáveis.

## Ameaças e controles

| Ameaça | Impacto | Controles atuais | Risco residual |
| --- | --- | --- | --- |
| Elevação de privilégio | ação superior ao papel | catálogo central, guard no backend, atribuição limitada às permissões do ator, último admin protegido | alterações futuras no mapa exigem testes de regressão |
| Acesso cross-tenant | vazamento ou mutação de outro cliente | tenant no JWT, membership ativa, filtros relacionais Prisma e IDs validados dentro do tenant | revisar toda nova query manualmente |
| Sessão roubada | controle administrativo | access curto em memória, refresh HttpOnly rotativo, revogação, `Secure` em produção, rate limit | XSS ainda pode agir durante a sessão corrente |
| CSRF | refresh/logout involuntário | SameSite e dupla submissão no refresh; mutações exigem bearer header não disponível a sites terceiros | configurações cross-site exigem nova análise |
| XSS | roubo de acesso e ações | React escaping, CSP, nenhuma renderização HTML arbitrária, access não persistido | dependências e URLs futuras devem ser auditadas |
| Comando remoto indevido | início/parada não autorizados | permissão por tipo, confirmação, motivo, idempotência, validações de domínio, auditoria e Outbox | apenas Remote Start/Stop estão homologados |
| Estorno fraudulento/duplicado | perda financeira | papel financeiro, confirmação, idempotência por payload, transação serializável, ledger imutável, auditoria | provedor real ainda não está homologado |
| Exportação excessiva | exfiltração/DoS | permissão, tenant, limite de 10.000 e campos explícitos | job assíncrono e rate limit específico ainda são necessários para grandes volumes |
| Convite interceptado | entrada de operador indevido | token aleatório armazenado somente como hash e expiração | entrega/aceitação não implementadas; não enviar token por canal inseguro |
| Alteração retroativa de tarifa | cobrança histórica incorreta | publicação cria snapshot/version; sem endpoint de edição de publicada; sessão guarda snapshot | novo fluxo de edição deve sempre criar versão |
| Enumeração | descoberta de usuários/recursos | erros genéricos, UUIDs, filtros tenant, throttling | tempos de resposta devem ser observados em produção |
| Abuso de relatórios | consumo de memória/CPU | limite de linhas e autorização | faltam quota por operador e geração assíncrona |

## Segredos e logs

Não registrar nem retornar senha, refresh/access token, cookies, segredo ou hash
OCPP, token do provedor, PAN, CVV, chave/QR Pix, payload bruto de webhook ou
request hash financeiro. `AdminAuditService` remove chaves sensíveis
recursivamente e serializa BigInt/Decimal antes de persistir.

Logs operacionais devem usar `correlationId`, `tenantId`, `operatorId`, recurso,
resultado e duração. IP e user agent só são retidos conforme política de
privacidade.

## Requisitos de implantação

- HTTPS obrigatório e HSTS no proxy de borda;
- `CORS_ORIGINS` sem wildcard;
- segredos fornecidos por secret manager;
- cookies `Secure` em produção;
- CSP preservada no backend e Nginx;
- banco/Redis sem exposição pública;
- alertas para negações repetidas, falhas de comando e estornos;
- rotação de JWT e plano de revogação de sessões.

## Critério de bloqueio

O portal não pode sair de draft se houver query administrativa sem isolamento de
tenant, atribuição de papel superior ao ator, comando sem auditoria, estorno sem
idempotência, edição retroativa de tarifa ou resposta com segredo.
