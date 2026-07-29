import type { BrandAsset, BrandConfig } from './brand-config';

const missingAsset = (accessibilityLabel: string): BrandAsset => ({
  accessibilityLabel,
  source: null,
  status: 'missing',
});

export const solarSolucoesBrand: BrandConfig = {
  id: 'solar-solucoes',
  companyName: 'Solar Soluções',
  productName: 'Solis',
  shortName: 'Solis',
  tagline: 'Energia que move o futuro.',
  description: 'Plataforma inteligente de recarga de veículos elétricos.',
  assets: {
    logoLight: missingAsset('Logo claro oficial da Solis pendente'),
    logoDark: missingAsset('Logo escuro oficial da Solis pendente'),
    symbol: missingAsset('Símbolo oficial da Solis pendente'),
    adaptiveIconForeground: missingAsset('Ícone adaptativo oficial da Solis pendente'),
    splash: missingAsset('Splash oficial da Solis pendente'),
    favicon: missingAsset('Favicon oficial da Solis pendente'),
  },
  palette: {
    approved: false,
    source: 'design-system-fallback',
  },
  support: {},
};
