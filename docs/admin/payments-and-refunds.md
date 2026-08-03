# Pagamentos, estornos e conciliação

O portal consulta `PaymentIntent` do tenant e exibe valores em minor units
serializados como string. Referências do provedor devem ser mascaradas e
request hashes, tokens de método, PAN, CVV, payloads de webhook e contas internas
do ledger não são contratos administrativos.

Estorno exige `payments.refund`, pagamento do tenant, justificativa,
confirmação e `Idempotency-Key`. `RefundService` preserva as invariantes da Fase
5: valor elegível, transação serializável, idempotência ligada ao payload,
lançamentos reversos e nenhum ajuste direto de saldo ou ledger. A ação
administrativa adiciona auditoria sem duplicar a regra financeira.

A execução da conciliação recebe o tenant do operador e usa lock Redis
tenant-scoped. Ela compara provedor e estado local sem editar lançamentos
existentes. O draft ainda não oferece resolução manual ou reprocessamento de
evento pela interface.
