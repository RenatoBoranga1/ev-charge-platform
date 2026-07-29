# ADR 010 — Sistema de marca Solar Soluções e Solis

## Status

Aceito. Ativos oficiais integrados; paleta extraída e pendente de homologação
por manual de marca.

## Contexto

Solar Soluções é a empresa e Solis é o produto. O aplicativo já possuía Design
System Material 3, temas claro/escuro/sistema e tokens semânticos. A primeira
decisão preparou a arquitetura enquanto os ativos estavam ausentes.

Em 29 de julho de 2026 foram fornecidos nove PNGs com orientação explícita de
uso. A inspeção confirmou canal alfa real em todos, exceto no ícone opaco do
app. Origem, dimensões e SHA-256 estão em `docs/brand/brand-assets.md`.

## Decisão

- preservar e evoluir o Design System existente;
- centralizar metadados em `solarSolucoesBrand`;
- registrar ativos entregues como `official`, com arquivo-fonte e targets;
- usar logo horizontal clara/escura no `BrandMark`;
- usar o símbolo limpo como símbolo mestre, adaptive foreground e favicon;
- usar os arquivos específicos de app icon, splash e monochrome no Expo;
- manter fallback textual defensivo;
- extrair cores de modo reproduzível no
  `docs/brand/palette-extraction.json`;
- distinguir paleta extraída de paleta formalmente aprovada;
- proibir gradientes de interface até homologação de stops e regras;
- validar combinações críticas por contraste WCAG AA;
- manter o catálogo de marca exclusivamente em DEV.

## Consequências

A identidade visual deixa de depender de placeholders e passa a ser
versionada, rastreável e testável. O PNG original não é alterado; o
enquadramento da logo remove apenas espaço transparente durante a renderização.

A ausência de manual impede declarar a paleta homologada. Build Expo também não
substitui testes de APK, launcher, splash, favicon, TalkBack e dispositivo
físico.
