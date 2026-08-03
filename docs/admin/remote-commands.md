# Comandos remotos

O catálogo apresenta seis tipos conceituais, mas `supportedRemoteCommandTypes`
habilita somente `REMOTE_START` e `REMOTE_STOP`, já suportados pelo
`ChargerGateway`. Tipos não implementados retornam
`REMOTE_COMMAND_NOT_SUPPORTED` e não são oferecidos como executáveis.

Cada solicitação exige permissão específica, justificativa, confirmação no
portal e `Idempotency-Key`. A chave é única por tenant e vinculada ao hash do
payload. Repetição idêntica retorna o comando existente; repetição com outro
payload retorna conflito. Corridas de criação são recuperadas após `P2002`, sem
novo dispatch.

A criação `QUEUED`, auditoria de solicitação e Outbox são uma única transação.
Aceitação ou falha também atualiza comando, auditoria e Outbox atomicamente.
`SENT` nunca é exibido como aceitação. O domínio continua responsável por
validar sessão, conector, estado e política financeira.

Snapshots e mensagens de erro passam pelo sanitizador de auditoria. Frames OCPP,
tokens e credenciais não são devolvidos pela API administrativa.
