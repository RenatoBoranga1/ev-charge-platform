export const messages = {
  common: {
    retry: 'Tentar novamente',
    cancel: 'Cancelar',
    continue: 'Continuar',
    save: 'Salvar',
    close: 'Fechar',
    loading: 'Carregando',
  },
  tabs: {
    stations: 'Estações',
    trips: 'Viagens',
    charge: 'Carregar',
    vehicles: 'Veículos',
    profile: 'Perfil',
  },
  stations: {
    title: 'Energia no seu caminho',
    searchPlaceholder: 'Para onde você vai?',
    nearMe: 'Perto de mim',
    fastCharge: 'Alta potência',
    planRoute: 'Planejar rota',
    empty: 'Nenhuma estação corresponde aos filtros.',
    error: 'Não foi possível carregar as estações.',
  },
  charge: {
    connectTitle: 'Conecte primeiro o cabo ao veículo',
    connectBody:
      'Para evitar falhas na inicialização, confirme que o conector está corretamente encaixado antes de escanear o QR Code.',
    scanTitle: 'Escanear carregador',
    scanStepOne: '1. Conecte o cabo ao veículo.',
    scanStepTwo: '2. Posicione o QR Code dentro da moldura.',
  },
} as const;
