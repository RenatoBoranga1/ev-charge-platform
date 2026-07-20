# Acessibilidade mobile

- Contraste mínimo perseguido: 4,5:1 para texto normal.
- Alvos de toque com pelo menos 44 pontos.
- Estados combinam texto, ícone e cor.
- Componentes importantes expõem accessibilityLabel e accessibilityHint.
- Layouts usam ScrollView, safe areas e dimensões flexíveis.
- Texto não depende de alturas absolutas.
- Animações não são essenciais e o progresso é legível com redução de movimento.
- Tema claro e escuro acompanha o sistema.
- A câmera possui estado específico para permissão negada e caminho para configurações.
- Últimas métricas da sessão permanecem no store durante perda de conectividade.

## Checklist manual

Validar TalkBack e VoiceOver, fonte em 200%, modo escuro, dispositivo pequeno, notch, teclado aberto, contraste dos seis estados de estação e foco dos modais.
