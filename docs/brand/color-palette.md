# Paleta de interface provisória

Esta não é a paleta oficial da Solar Soluções. São tokens preexistentes do
Design System, mantidos como fallback até a entrega de um logo aprovado.

| Papel            | Claro     | Escuro    | Uso                |
| ---------------- | --------- | --------- | ------------------ |
| Ação primária    | `#08785B` | `#2DD4A2` | ações e foco       |
| Acento solar     | `#B7F34A` | `#D9FF8A` | destaque discreto  |
| Sustentabilidade | `#08785B` | `#6EE7BE` | contexto ambiental |
| Disponível       | `#08785B` | `#6EE7BE` | estação disponível |
| Ocupado          | `#9A5B00` | `#FBC36A` | estação ocupada    |
| Offline          | `#596170` | `#A8B2C3` | estação offline    |
| Falha            | `#B42318` | `#FFB4AB` | falha de estação   |

Status sempre inclui texto ou ícone, nunca somente cor. Texto branco sobre a
ação primária clara e as combinações principais de superfícies são verificadas
por teste WCAG AA.

Gradientes oficiais não foram definidos. Após receber os ativos, as cores
deverão ser extraídas por ferramenta, registradas em HEX/RGB e novamente
validadas por contraste.

## Aplicação operacional provisória

Mapa e badges usam os papéis `stationAvailable`, `stationBusy`,
`stationOffline` e `stationFaulted`, sem depender somente da cor. Gráficos de
potência usam `chartPrimary`, `chartSecondary`, `chartGrid` e `chartAxis`, com
resumo textual acessível.

Nenhum `palette-extraction.json` foi gerado: sem ativo mestre oficial, qualquer
frequência, HEX, RGB ou seleção semântica seria fabricada. Por isso
`palette.approved` permanece `false`, a origem permanece
