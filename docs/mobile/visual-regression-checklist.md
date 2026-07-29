# Checklist de regressão visual

Validar em tema claro, escuro e sistema:

- login, cadastro e recuperação;
- dashboard com dados, vazio, loading e erro;
- mapa claro/escuro, clusters e todos os status;
- detalhe da estação e conectores;
- scanner, confirmação, recarga ativa, conclusão e erro;
- histórico, filtros, detalhe, timeline e gráfico;
- perfil, configurações, garagem e formulários;
- tab bar, headers, deep links e retorno;
- fonte padrão e ampliada;
- teclado, safe areas e textos longos;
- contraste, foco, TalkBack e redução de movimento;
- smartphones pequenos e grandes.

Antes de homologar a marca, incluir ainda splash, adaptive icon e logo oficiais
em APK de desenvolvimento e release, dispositivo físico e tema claro/escuro.

## Estado deste conjunto

Cobertura automatizada verifica gates de ativos, fallbacks, contraste, pins,
cards de estação, fluxo de recarga, reconexão, gráfico textual e histórico.
Lint, typecheck, testes, bundle e E2E devem ser repetidos após todas as
alterações.

Continuam manuais e bloqueados por ambiente/insumos: comparação com o pacote
oficial, adaptive icon, splash, favicon, paleta extraída, APK de
desenvolvimento/release, TalkBack, fonte ampliada, redução de movimento,
emulador e dispositivo físico. Nenhum desses itens pode ser marcado como
