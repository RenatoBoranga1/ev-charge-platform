# Branding Solar Soluções no aplicativo Solis

`ThemeProvider` entrega marca, temas, cores, tipografia, elevação, movimento e
opacidade. O aplicativo continua suportando `light`, `dark` e `system`, assim
como a preferência persistida no Zustand.

## Ativos oficiais

Os nove PNGs entregues em 29 de julho de 2026 estão em
`apps/mobile-driver/assets/brand`. `BrandConfig` registra origem, status e
targets. `BrandMark` escolhe a logo clara ou escura conforme o tema e mantém o
fallback textual somente como proteção defensiva.

A configuração Expo referencia:

- `solis-app-icon.png` para o ícone geral, Android e iOS;
- `solis-symbol.png` para foreground adaptativo e favicon;
- `solis-adaptive-icon-monochrome.png` para o ícone temático Android;
- `solis-splash-icon.png` para a tela de abertura;
- fundo azul-marinho `#082868` no splash e adaptive icon.

Os PNGs foram preservados byte a byte. O enquadramento do logo no runtime usa
apenas clipping de espaço transparente, sem modificar o arquivo.

## Paleta

A paleta Solis foi extraída do símbolo mestre com método e frequências
registrados em `docs/brand/palette-extraction.json`. Azul-marinho, azul
elétrico, laranja solar, amarelo e verde passam a orientar os tokens.

Como não foi fornecido manual com códigos autoritativos,
`palette.approved=false`. Gradientes da arte não são tokens oficiais.

## Conjuntos funcionais

O primeiro conjunto modernizou login, dashboard, botões, cards, busca,
navegação, tokens e catálogo DEV. O segundo atualizou:

- pins e status de estação com tokens semânticos;
- detalhes de estação com fallbacks honestos;
- recarga ativa com conexão, retry, fluxo
  `energia → carregador → veículo` e resumo do gráfico;
- histórico, perfil, garagem, cadastro e recuperação.

Rotas, queries, DTOs, autenticação, charging, OCPP, idempotência, tarifa,
cursor, `asOf`, optimistic locking e ownership permanecem inalterados.

## Limitações

O bundle Expo verifica resolução JavaScript e assets, mas não homologa:

- máscara e recorte do launcher em fabricantes Android;
- ícone temático/monocromático;
- splash em densidades e proporções variadas;
- favicon em navegadores;
- APK de desenvolvimento e release;
- dispositivo físico, TalkBack, fonte ampliada e redução de movimento.

Esses itens permanecem no checklist de regressão nativa do PR #8.
