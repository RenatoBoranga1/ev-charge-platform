import type { ImageSourcePropType } from 'react-native';

export type BrandAssetStatus = 'missing' | 'official';

export interface BrandAsset {
  accessibilityLabel: string;
  source: ImageSourcePropType | null;
  status: BrandAssetStatus;
}

export interface BrandConfig {
  id: string;
  companyName: string;
  productName: string;
  shortName: string;
  tagline: string;
  description: string;
  assets: {
    logoLight: BrandAsset;
    logoDark: BrandAsset;
    symbol: BrandAsset;
    adaptiveIconForeground: BrandAsset;
    splash: BrandAsset;
    favicon: BrandAsset;
  };
  palette: {
    approved: boolean;
    source: 'official-assets' | 'design-system-fallback';
  };
  support: {
    email?: string;
    website?: string;
  };
}

export function hasOfficialBrandAssets(brand: BrandConfig): boolean {
  return Object.values(brand.assets).every(
    (asset) => asset.status === 'official' && asset.source !== null,
  );
}
