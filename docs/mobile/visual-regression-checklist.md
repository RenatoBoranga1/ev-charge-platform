# Checklist de regressão visual

## Automatizado nesta entrega

- [x] assets oficiais resolvidos pelo Metro;
- [x] gates mobile, web e conjunto completo;
- [x] ícone, adaptive foreground, monochrome, splash e favicon no Expo config;
- [x] logo clara/escura e fallback acessível;
- [x] contraste das combinações críticas;
- [x] mapa, detalhes da estação, recarga, histórico, perfil e garagem;
- [x] lint, typecheck, testes, build, Docker e E2Es.

## Validação visual manual

Validar em tema claro, escuro e sistema:

- [ ] login, cadastro, recuperação e dashboard;
- [ ] mapa, clusters, pins e detalhes da estação;
- [ ] scanner, confirmação, recarga ativa, conclusão e erro;
- [ ] histórico, timeline, perfil, configurações e garagem;
- [ ] fonte padrão/ampliada, teclado, safe areas e textos longos;
- [ ] smartphones pequenos e grandes;
- [ ] redução de movimento e TalkBack.

## Homologação nativa

- [ ] gerar APK de desenvolvimento e release;
- [ ] verificar ícone Android em máscaras circular, squircle e quadrada;
- [ ] verificar ícone monocromático/temático;
- [ ] verificar ícone iOS e App Store;
- [ ] verificar splash em diferentes densidades e proporções;
- [ ] verificar favicon em navegadores;
- [ ] validar Google Maps com chave restrita por package e SHA-1/SHA-256;
- [ ] validar localização e abertura do Google Maps em dispositivo físico.

Ativos integrados não equivalem a homologação nativa. O PR permanece draft
enquanto estes itens e a aprovação formal da paleta estiverem pendentes.
