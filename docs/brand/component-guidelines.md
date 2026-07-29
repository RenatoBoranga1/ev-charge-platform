# Diretrizes de componentes Solis

- Use tokens semânticos; não adicione HEX diretamente nas telas.
- Use `BrandHero` somente em pontos de alta hierarquia.
- Use `BrandMark` como fallback textual, não como logo oficial.
- Cards têm raio moderado, borda discreta e elevação baixa.
- Ações principais usam um único foco visual por contexto.
- Status precisam de texto, ícone ou descrição acessível.
- Métricas usam os tokens `numericLarge`, `numericMedium` e `numericSmall`.
- Animações devem usar os tokens de movimento e respeitar redução de movimento.
- O catálogo `/dev/brand-catalog` existe somente em DEV.

Evite gradientes sem aprovação, sombras fortes, cards aninhados, imagens
externas genéricas e informações de sustentabilidade não comprovadas.

## Superfícies operacionais

- Pins combinam cor, ícone, borda e texto acessível.
- Detalhes de estação exibem “não informado” em vez de fabricar preço,
  horário, distância ou avaliação.
- Recarga ativa usa a expressão neutra “Fluxo de recarga” e não atribui origem
  solar sem telemetria.
- Gráficos sempre possuem descrição e resumo numérico visível.
- Perfil e garagem usam dados reais das APIs; nenhuma imagem externa nova foi
