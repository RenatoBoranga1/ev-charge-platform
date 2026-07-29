# Ativos oficiais de marca

## Entrega e classificação

Os nove PNGs fornecidos em 29 de julho de 2026 foram incorporados sem
reconstrução, remoção de fundo ou transformação generativa. Os hashes abaixo
identificam exatamente os arquivos recebidos.

Há uma inversão entre a descrição textual inicial e o conteúdo visual: o
arquivo original `(9)` contém o símbolo limpo final, enquanto o `(1)` contém a
primeira proposta horizontal com o “o” divergente. A classificação abaixo usa
o conteúdo visual e as finalidades indicadas pelo responsável da marca.

| Arquivo versionado                   |  Dimensão | Uso                                           | SHA-256                                                            |
| ------------------------------------ | --------: | --------------------------------------------- | ------------------------------------------------------------------ |
| `solis-logo-first-proposal.png`      | 1536×1024 | referência; não usar como logo principal      | `fe6488b749a1e072567c50d02118b214528422432f3a47988bdaec461e4b3595` |
| `solis-logo-light.png`               | 1536×1024 | logo horizontal principal em fundo claro      | `7d070d95c7ca4b43f3c3fbf1a33223228a3ac07483556c889afd5b1e76e49229` |
| `solis-logo-dark.png`                | 1536×1024 | logo horizontal em fundo escuro               | `ee0a664e73d0433ba10bc8a79ddefa71177aed6f8019421b11a4bec10e4ca235` |
| `solis-symbol-reference.png`         | 1536×1024 | referência ampliada do símbolo                | `ad344cba534ab3c170bedb8be311d802bfa237d4361fdf6e1a410547afad47fe` |
| `solis-app-icon.png`                 | 1254×1254 | ícone principal Android/iOS e lojas           | `c1260bffabea949f4c8dc5245a0f6cee661d37309eb3cb29aadb25d279096f48` |
| `solis-splash-icon.png`              | 1536×1024 | símbolo com respiro para splash               | `5350e4bda79e7c453cf07c5102c38da6e39ff3818f023b7dd07980a9d709c052` |
| `solis-adaptive-icon-monochrome.png` | 1536×1024 | máscara monocromática e ícone temático        | `9c404629448a10568078d5dc6f344b2af5343e30c949050fb741ace2a251e058` |
| `solis-symbol-decorative.png`        | 1536×1024 | material promocional e institucional          | `26a811e1deb337bfa4d26fbc879f2c2af226be856b3d3bba880d12f188fa5f53` |
| `solis-symbol.png`                   | 1536×1024 | símbolo mestre, adaptive foreground e favicon | `215a78367fab35160865d2f07d91f1fe6c078faa418bd8a55f725516c097d439` |

## Transparência

Todos os arquivos, exceto `solis-app-icon.png`, possuem canal alfa real. O
ícone do app é propositalmente opaco. Os halos dos demais arquivos são pixels
semitransparentes da própria arte; não há fundo cinza achatado.

## Integração

`BrandConfig` referencia diretamente os arquivos entregues. O aplicativo usa:

- logo clara ou escura conforme o tema;
- `solis-app-icon.png` como ícone geral e de iOS/Android;
- `solis-symbol.png` como foreground adaptativo e favicon;
- `solis-adaptive-icon-monochrome.png` como ícone temático Android;
- `solis-splash-icon.png` na tela de abertura.

Não foram criados derivados raster. A inspeção em APK, launcher Android,
dispositivo iOS e navegador continua obrigatória antes da homologação.
