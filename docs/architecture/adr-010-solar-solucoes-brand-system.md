# ADR 010 — Sistema de marca Solar Soluções e Solis

## Status

Aceito como fundação provisória. Ativos e paleta oficiais continuam pendentes.

## Contexto

Solar Soluções é a empresa e Solis é o produto. O aplicativo já possuía um
Design System Material 3, temas claro/escuro/sistema e tokens semânticos. Não
há logo, símbolo, manual de marca, splash, adaptive icon ou favicon oficiais no
repositório.

## Decisão

- preservar e evoluir o Design System existente;
- centralizar metadados em `solarSolucoesBrand`;
- representar ativos ausentes como `status: missing` e `source: null`;
- usar marca textual acessível enquanto os ativos oficiais não chegam;
- tratar as cores atuais como `design-system-fallback`, nunca como paleta
  oficial;
- proibir gradientes oficiais enquanto não houver cores extraídas de um ativo
  aprovado;
- adicionar tokens semânticos de estação, gráficos, movimento e opacidade;
- validar combinações críticas por contraste WCAG AA;
- manter o catálogo de marca exclusivamente em ambiente DEV.

## Consequências

A identidade pode evoluir sem espalhar nomes, imagens ou cores pelas telas. O
PR deve permanecer draft até que os ativos oficiais sejam fornecidos e a
paleta seja extraída objetivamente. Nenhum contrato de backend, banco, OCPP ou
regra de negócio foi alterado.
