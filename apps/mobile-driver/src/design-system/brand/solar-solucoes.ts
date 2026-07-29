import type { BrandAsset, BrandAssetTarget, BrandConfig } from './brand-config';

const missingAsset = (
  accessibilityLabel: string,
  targets: BrandAssetTarget[],
  required = true,
): BrandAsset => ({
  accessibilityLabel,
  source: null,
  status: 'missing',
  targets,
  required,
});

export const solarSolucoesBrand: BrandConfig = {
  id: 'solar-solucoes',
  companyName: 'Solar Soluções',
  productName: 'Solis',
  shortName: 'Solis',
  tagline: 'Energia que move o futuro.',
  description: 'Plataforma inteligente de recarga de veículos elétricos.',
  assets: {
    logoLight: missingAsset('Logo claro oficial da Solis pendente', ['mobile-runtime', 'web']),
    logoDark: missingAsset('Logo escuro oficial da Solis pendente', ['mobile-runtime', 'web']),
    symbol: missingAsset('Símbolo oficial da Solis pendente', ['mobile-runtime', 'web', 'store']),
    adaptiveIconForeground: missingAsset('Ícone adaptativo oficial da Solis pendente', [
      'android',
      'store',
    ]),
    splash: missingAsset('Splash oficial da Solis pendente', ['mobile-runtime', 'android', 'ios']),
    favicon: missingAsset('Favicon oficial da Solis pendente', ['web']),
  },
  palette: {
    approved: false,
    source: 'design-system-fallback',
  },
  support: {},
};
