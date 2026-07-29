# Branding Solar Soluções no aplicativo Solis

`ThemeProvider` entrega `brand`, temas, cores, tipografia, elevação, movimento e
opacidade. O tema Solis continua suportando `light`, `dark` e `system`, assim
como a preferência já persistida no Zustand.

O primeiro conjunto moderniza transversalmente:

- login com hero institucional;
- dashboard com hero de alta hierarquia;
- botões, cards, busca e navegação;
- tokens de estação e gráfico;
- tipografia numérica;
- catálogo DEV protegido.

Rotas, queries, DTOs, cache, autenticação, charging, OCPP, mapa, dashboard e
histórico permanecem inalterados.

## Limitação

Sem ativos oficiais, splash, ícone adaptativo e logos não foram substituídos.
O bundle Android valida apenas JavaScript e assets resolvidos; não equivale à
homologação nativa em dispositivo.

## Segundo conjunto funcional

Este conjunto mantém a paleta provisória e moderniza componentes reais:

- pins e status de estação com tokens semânticos;
- detalhes da estação com fallbacks honestos para metadados ausentes;
- recarga ativa com estado de conexão, retry, fluxo
  `energia → carregador → veículo` e gráfico com resumo textual;
- histórico, timeline e métricas com tokens específicos de gráfico;
- perfil e garagem com hierarquia institucional e dados reais;
- cadastro e recuperação com `BrandHero`, sem alterar formulários ou contratos.

Máquina de estados, idempotência, MeterValues, tarifa, OCPP, queries, cursor,
`asOf`, optimistic locking, ownership e rotas foram preservados. Não foram
