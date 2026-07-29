# Ativos de marca

## Resultado da auditoria

Nenhum ativo oficial foi encontrado em `assets/`,
`apps/mobile-driver/assets/`, `docs/brand/`, `design/` ou `public/`. As únicas
imagens existentes são capturas da interface da Fase 1 e não são ativos de
marca.

## Ativos necessários

- `solis-logo-light`;
- `solis-logo-dark`;
- `solis-symbol`;
- `solis-adaptive-icon-foreground`;
- `solis-splash`;
- `solis-favicon`.

Os arquivos devem vir acompanhados de confirmação de que são oficiais e de
direitos de uso. SVG é preferível para logos e símbolo quando compatível.

## Fallback atual

O aplicativo usa apenas os textos “Solis” e “Solar Soluções”. O catálogo DEV
identifica claramente que os ativos estão pendentes. Nenhuma imagem externa,
logo gerado ou conceito aproximado foi incluído.

## Gate do segundo conjunto

A busca foi repetida em 29 de julho de 2026 na branch
`codex/solar-solucoes-brand-refresh`. Continuam ausentes arquivos mestres,
confirmação de aprovação, autorização de uso e hashes. As duas imagens em
`docs/mobile/screenshots/` são evidências de interface e não podem ser
promovidas a ativos de marca.

`BrandAsset` agora registra:

- finalidade em `mobile-runtime`, `android`, `ios`, `web` ou `store`;
- obrigatoriedade por alvo;
- estado `missing`, `official` ou `derived-from-official`;
- arquivo mestre em `sourceFile` para todo ativo disponível.

Os helpers `hasRequiredMobileBrandAssets`,
`hasRequiredWebBrandAssets` e `hasCompleteBrandAssetSet` mantêm gates
independentes. Assim, favicon ausente não bloqueia o pacote mobile. Um ativo
oficial ou derivado só é aceito com fonte de imagem válida e origem não vazia.

| Ativo                    | Alvos                              | Obrigatório | Estado  |
| ------------------------ | ---------------------------------- | ----------- | ------- |
| logo claro               | mobile runtime, web                | sim         | ausente |
| logo escuro              | mobile runtime, web                | sim         | ausente |
| símbolo                  | mobile runtime, web, loja           | sim         | ausente |
| adaptive icon foreground | Android, loja                      | sim         | ausente |
| splash                   | mobile runtime, Android e iOS       | sim         | ausente |
| favicon                  | web                                | sim         | ausente |

Não existem derivados, hashes ou processos de transformação para registrar
