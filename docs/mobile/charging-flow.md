# Fluxo de recarga mobile

~~~mermaid
sequenceDiagram
  actor Driver as Motorista
  participant App as App Solis
  participant API as Charging API
  participant RT as Realtime Client
  Driver->>App: Confirma cabo conectado
  App->>Driver: Solicita permissão da câmera
  Driver->>App: Escaneia QR ou informa código
  App->>API: validateQr ou validateManualCode
  API-->>App: Conector e tarifa validados
  App->>Driver: Seleção de veículo e pagamento
  App->>API: start com idempotencyKey
  API-->>App: Sessão iniciada
  App->>RT: connect(sessionId)
  RT-->>App: Métricas periódicas
  Driver->>App: Confirma encerramento
  App->>API: stop(sessionId)
  API-->>App: Resumo financeiro
  App->>RT: disconnect
~~~

## Erros

Validação e início exibem erros para conector inexistente, offline, ocupado, pagamento inválido, sessão já ativa e timeout do carregador. O adapter real não faz fallback para mock.

## Realtime

MockChargingRealtimeClient atualiza tempo, energia, potência, custo e bateria estimada. A tela cancela listener e timer ao desmontar. WebSocketChargingRealtimeClient preserva o mesmo contrato para integração real.
