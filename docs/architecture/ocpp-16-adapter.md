# ADR-002: adaptador OCPP 1.6J no monolito modular

- Status: aceito
- Data: 2026-07-21

## Contexto

A plataforma ja possuia `ChargerGateway` como porta do dominio e `SimulatorChargerGateway` como adaptador HTTP. O primeiro recorte OCPP precisa coexistir com o simulador e compartilhar as transacoes da `ChargingSession`, sem introduzir um microservico ou tipos de protocolo no dominio.

## Decisao

O servidor OCPP 1.6J roda no processo do backend NestJS, em um `OcppModule` e porta WebSocket dedicada (9000 por padrao). A API HTTP permanece na porta 8000. Essa separacao permite politicas de payload, autenticacao, idle timeout e rate limit especificas sem criar outra unidade operacional prematuramente.

`RoutingChargerGateway` resolve o protocolo persistido do charge point por connector e delega para um dos adaptadores:

- `SimulatorChargerGateway`: preserva o simulador HTTP existente;
- `Ocpp16ChargerGateway`: traduz start/stop genericos para comandos remotos OCPP;
- `ChargerEventRelay`: leva somente eventos genericos de medicao, parada, falha e desconexao recuperavel ao dominio.

Nenhum DTO, frame, action ou enum OCPP e importado pelo dominio de charging. Uma futura extracao pode substituir apenas o adaptador e o transporte do relay.

## Protocolo e correlacao

O endpoint e `/ocpp/{chargePointIdentity}` e exige o subprotocolo `ocpp1.6`. O servidor valida a identidade no banco e, quando `OCPP_AUTH_MODE=basic`, compara a credencial com o hash Argon2. Uma identidade mantem uma conexao ativa; `OCPP_DUPLICATE_CONNECTION_POLICY` escolhe entre substituir a anterior de forma controlada ou rejeitar a nova.

CALL, CALLRESULT e CALLERROR sao correlacionados por `uniqueId`. Comandos do CSMS possuem timeout configuravel. CALLs do charge point persistem a resposta em `ocpp_messages`, permitindo devolver o mesmo resultado sem repetir efeitos. O `StartTransaction` correlaciona o idTag temporario com uma `ChargingSession`; `MeterValues` atualiza essa transacao e exige medidor cumulativo monotono; `StopTransaction` e idempotente.

Uma desconexao durante carga marca charge point e connector offline e publica `DISCONNECTED` recuperavel. Ela nao conclui nem falha falsamente a sessao OCPP; o mesmo equipamento pode reconectar, informar status e continuar a transacao.

## Seguranca e operacao

- CORS HTTP usa uma allowlist em `CORS_ORIGINS`; wildcard e rejeitado na configuracao.
- Frames usam schemas Zod estritos e `ws` limita o payload; conexoes tem rate limit, ping/pong e idle timeout.
- Logs incluem evento, identidade, action e correlation ID, mas nunca payload, idTag, senha ou descricao remota potencialmente sensivel.
- Tokens de autorizacao temporarios sao armazenados como SHA-256 e segredos Basic como Argon2.
- O Compose local usa `ws://`; producao deve terminar TLS em um proxy/load balancer e adotar os perfis de seguranca adequados.

## Consequencias e limites

A solucao mantem uma unica transacao de banco e um unico modelo operacional nesta fase. Em contrapartida, conexoes e comandos pendentes vivem na memoria da instancia: escala horizontal exigira ownership distribuido de charge points e roteamento de comandos. O recorte nao e certificacao OCPP, nao cobre todos os profiles e aceita apenas starts remotos previamente associados a uma `ChargingSession`.

## Evidencias automatizadas

- parser e schemas de CALL/CALLRESULT/CALLERROR;
- boot aceito/rejeitado, heartbeat e variantes de status;
- autenticao, subprotocolo, endpoint, conexao duplicada e reconexao;
- remote start/stop, authorize, start, meter e stop;
- mensagens repetidas, timeout, CALLERROR, meter regressivo e desconexao recuperavel;
- integracao Prisma/PostGIS e E2E `pnpm e2e:ocpp`.

## Referencias

- Open Charge Alliance, OCPP: https://openchargealliance.org/protocols/open-charge-point-protocol/
- Open Charge Alliance, OCPP 1.6 Security Whitepaper (4th edition): https://openchargealliance.org/ocpp-info-whitepapers/ocpp-1-6-security-whitepaper-4th-edition/
- Open Charge Alliance, Compliancy Testing Tool test cases: https://openchargealliance.org/wp-content/uploads/2025/09/CompliancyTestTool-TestCaseDocument.pdf
