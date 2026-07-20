# Dados mock

As fixtures usam entidades fictícias Solis na região central de São Paulo. Não contêm nomes, e-mails, placas, fotografias ou outros dados pessoais presentes nas referências.

O conjunto inclui:

- três estações com disponibilidade e tarifas distintas;
- veículos fictícios BEV e PHEV;
- cartão tokenizado, Pix e carteira;
- sessões anteriores, reserva, cupom e perfil;
- telemetria de sessão ativa.

## Configuração

    EXPO_PUBLIC_API_MODE=mock

Para usar API real:

    EXPO_PUBLIC_API_MODE=api
    EXPO_PUBLIC_API_URL=http://localhost:3000
    EXPO_PUBLIC_WS_URL=ws://localhost:3000/realtime

Não existe fallback silencioso. O código manual de demonstração é SOLIS-001-A.
