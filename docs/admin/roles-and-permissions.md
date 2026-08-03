# Papéis e permissões administrativas

As permissões são resolvidas para o `OperatorMembership` ativo do usuário no
tenant contido no token. Não há superadministrador global implícito.

| Papel | Escopo principal |
| --- | --- |
| `TENANT_ADMIN` | todas as permissões do tenant, operadores e auditoria |
| `OPERATIONS_MANAGER` | operação, tarifas, sessões, relatórios e conciliação, sem usuários, estorno ou auditoria |
| `STATION_OPERATOR` | leitura operacional, hierarquia de recarga e início/parada remotos |
| `FINANCE_ANALYST` | pagamentos, estornos, conciliação, relatórios e auditoria |
| `SUPPORT_AGENT` | motoristas, sessões e consultas operacionais/financeiras |
| `VIEWER` | leitura sem ações críticas |

O catálogo completo e o `RolePermissionMap` ficam em
`packages/admin-contracts/src/index.ts`. O backend usa
`@RequireAdminPermissions`; esconder uma ação no React é apenas uma melhoria de
UX e nunca substitui o guard.

Regras adicionais:

- associação, consulta e mutação sempre incluem `tenantId`;
- membership desativado ou removido não autentica;
- usuário bloqueado não passa no JWT guard;
- o último `TENANT_ADMIN` ativo não pode perder o papel nem ser desativado;
- o ator não pode atribuir papéis com permissões superiores às próprias;
- alterações de papel e desativações são auditadas;
- a proteção do último administrador usa isolamento `SERIALIZABLE` para impedir
  remoções concorrentes.
