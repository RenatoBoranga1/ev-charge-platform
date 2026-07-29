# Paleta extraída dos ativos oficiais

As cores foram medidas em `solis-symbol.png`, identificado pelo SHA-256
`215a78367fab35160865d2f07d91f1fe6c078faa418bd8a55f725516c097d439`.
O resultado reproduzível está em `docs/brand/palette-extraction.json`.

## Método

- considerar pixels com alfa maior ou igual a 240;
- agrupar RGB em intervalos de 16 valores;
- registrar frequência dos grupos;
- selecionar papéis semânticos;
- gerar tons auxiliares apenas para contraste e estados de interação.

## Cores representativas

| Papel                  | HEX       | RGB           | Origem                   |
| ---------------------- | --------- | ------------- | ------------------------ |
| Azul-marinho           | `#082868` | 8, 40, 104    | bin dominante            |
| Azul-marinho escuro    | `#081858` | 8, 24, 88     | região escura do símbolo |
| Azul elétrico          | `#0878C8` | 8, 120, 200   | faixa azul               |
| Laranja solar          | `#F88808` | 248, 136, 8   | sol                      |
| Amarelo solar          | `#F8D808` | 248, 216, 8   | raios e brilho           |
| Verde sustentabilidade | `#68B828` | 104, 184, 40  | detalhe verde            |
| Branco da marca        | `#F8F8F8` | 248, 248, 248 | plugue e aro             |

## Estado de aprovação

Os valores são derivados objetivamente de um ativo oficial, mas não substituem
um manual de marca. Por isso `palette.source` é
`extracted-from-official-assets` e `palette.approved` permanece `false`.

O tema Solis passa a usar azul-marinho como ação primária, laranja/amarelo como
acento solar e verde no contexto de sustentabilidade. Status operacionais
continuam semânticos e nunca dependem somente de cor. Combinações críticas
permanecem cobertas pelos testes WCAG AA.

Gradientes não foram promovidos a tokens oficiais. Apesar de existirem na arte,
faltam ângulos, stops e regras de aplicação aprovados.
