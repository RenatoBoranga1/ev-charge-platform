import type { ImageSourcePropType } from 'react-native';

import type { BrandAsset, BrandAssetStatus, BrandAssetTarget, BrandConfig } from './brand-config';

const officialAsset = (
  accessibilityLabel: string,
  source: ImageSourcePropType,
  sourceFile: string,
  targets: BrandAssetTarget[],
  status: BrandAssetStatus = 'official',
  required = true,
): BrandAsset => ({
  accessibilityLabel,
  source,
  sourceFile,
  status,
  targets,
  required,
});

const sources = {
  logoLight: require('../../../assets/brand/solis-logo-light.png') as ImageSourcePropType,
  logoDark: require('../../../assets/brand/solis-logo-dark.png') as ImageSourcePropType,
  symbol: require('../../../assets/brand/solis-symbol.png') as ImageSourcePropType,
  splash: require('../../../assets/brand/solis-splash-icon.png') as ImageSourcePropType,
};

export const solarSolucoesBrand: BrandConfig = {
  id: 'solar-solucoes',
  companyName: 'Solar Soluções',
  productName: 'Solis',
  shortName: 'Solis',
  tagline: 'Energia que move o futuro.',
  description: 'Plataforma inteligente de recarga de veículos elétricos.',
  assets: {
    logoLight: officialAsset(
      'Solis, Solar Soluções',
      sources.logoLight,
      'apps/mobile-driver/assets/brand/solis-logo-light.png',
      ['mobile-runtime', 'web'],
    ),
    logoDark: officialAsset(
      'Solis, Solar Soluções',
      sources.logoDark,
      'apps/mobile-driver/assets/brand/solis-logo-dark.png',
      ['mobile-runtime', 'web'],
    ),
    symbol: officialAsset(
      'Símbolo Solis',
      sources.symbol,
      'apps/mobile-driver/assets/brand/solis-symbol.png',
      ['mobile-runtime', 'web', 'store'],
    ),
    adaptiveIconForeground: officialAsset(
      'Símbolo Solis para ícone adaptativo',
      sources.symbol,
      'apps/mobile-driver/assets/brand/solis-symbol.png',
      ['android', 'store'],
    ),
    splash: officialAsset(
      'Símbolo Solis para tela de abertura',
      sources.splash,
      'apps/mobile-driver/assets/brand/solis-splash-icon.png',
      ['mobile-runtime', 'android', 'ios'],
    ),
    favicon: officialAsset(
      'Símbolo Solis para favicon',
      sources.symbol,
      'apps/mobile-driver/assets/brand/solis-symbol.png',
      ['web'],
    ),
  },
  palette: {
    approved: false,
    source: 'extracted-from-official-assets',
    extractionFile: 'docs/brand/palette-extraction.json',
  },
  support: {},
};
