# Design system mobile Solis

## Direção

Solis combina verde esmeralda para energia sustentável, azul para confiança
tecnológica e lima como acento pontual. A interface segue Material Design 3,
evita gradientes decorativos, preserva contraste e nunca depende apenas de cor
para informar estado.

## Arquitetura

O design system é uma camada da aplicação mobile, sem dependência do domínio ou
da API:

```text
screens / domain components
            |
            v
src/design-system -----> src/theme/ThemeProvider
            |                       |
            v                       v
legacy App* adapters       semantic design tokens
```

- `src/theme/design-tokens.ts`: paletas, sementes dinâmicas, espaçamento,
  raios, tipografia MD3, tamanhos, elevação e sombras.
- `src/theme/ThemeProvider.tsx`: resolve modo do sistema, claro ou escuro e
  entrega apenas papéis semânticos aos componentes.
- `src/stores/preferences-store.ts`: persiste o modo e a semente escolhidos no
  mesmo store Zustand já usado pelo aplicativo.
- `src/design-system/index.ts`: API pública dos componentes.
- `AppButton`, `AppCard`, `FilterChip` e demais componentes de domínio continuam
  válidos; os adapters reutilizam os novos primitivos para evitar uma migração
  disruptiva.

## Tema e cores dinâmicas

O modo padrão é `system`. O usuário pode selecionar claro ou escuro em
**Perfil > Configurações**, sem reiniciar o aplicativo. As sementes disponíveis
são:

- `solis`: identidade esmeralda original;
- `ocean`: azul tecnológico;
- `solar`: âmbar para contextos de energia.

Cada semente altera os papéis `primary`, `primaryContainer`,
`onPrimaryContainer`, `focus` e estados pressionados nas duas luminosidades.
Nenhuma tela lê valores hexadecimais diretamente para decidir comportamento.

## Tokens

- Escala de espaçamento de 0 a 48 pontos.
- Raios de 0 a circular, incluindo o raio MD3 de 28 pontos.
- Escala tipográfica completa: display, headline, title, body e label.
- Elevação de nível 0 a 5, com sombra iOS e `elevation` Android equivalentes.
- Alvo interativo mínimo de 48 pontos.
- Cores semânticas para superfície, contêiner, texto, outline, estados,
  conteúdo inverso, foco, overlay e scrim.

## Componentes

### Ações

`PrimaryButton`, `SecondaryButton`, `OutlinedButton`, `FAB`.

### Superfícies e sobreposições

`Surface`, `Card`, `BottomSheet`.

### Feedback e carregamento

`Snackbar`, `Toast`, `Loading`, `Skeleton`, `LoadingState`, `EmptyState`,
`ErrorState`. `FeedbackProvider` fornece `showSnackbar` e `showToast` sem
acoplar telas ao host visual.

### Dados e identidade

`Chip`, `Tag`, `Badge`, `SearchBar`, `Avatar`.

### Navegação

`AppBar` e `NavigationBar`. O Expo Router e a navegação por tabs existentes
continuam sendo a infraestrutura; os componentes são a apresentação.

## Acessibilidade

- Controles possuem papéis, nomes e estados acessíveis.
- Alvos interativos usam no mínimo 48 pontos.
- Feedback usa região viva e modais declaram contexto modal.
- Cores de status são acompanhadas por texto ou ícone.
- Tipografia aceita escalonamento do sistema e evita alturas fixas para texto.
- Tema claro e escuro usam pares semânticos de foreground/background.

## Catálogo

A rota `/dev/components` apresenta todos os primitivos e componentes de
domínio. Ela continua bloqueada por `isDevelopmentCatalogEnabled()` fora de
`__DEV__`.

## Testes

`design-tokens.spec.ts` verifica escalas e todas as combinações
claro/escuro/semente. `design-system.spec.tsx` cobre interações, acessibilidade,
persistência de tema, feedback global, navegação e sobreposições. O Jest usa o
mock oficial do AsyncStorage para representar a persistência sem módulo nativo.
