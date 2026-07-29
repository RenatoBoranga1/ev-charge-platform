import type { ImageSourcePropType } from 'react-native';

export type BrandAssetStatus = 'missing' | 'official' | 'derived-from-official';
export type BrandAssetTarget = 'mobile-runtime' | 'android' | 'ios' | 'web' | 'store';

export interface BrandAsset {
  accessibilityLabel: string;
  source: ImageSourcePropType | null;
  status: BrandAssetStatus;
  targets: BrandAssetTarget[];
  required: boolean;
  sourceFile?: string;
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
    source: 'official-assets' | 'extracted-from-official-assets' | 'design-system-fallback';
    extractionFile?: string;
  };
  support: {
    email?: string;
    website?: string;
  };
}

export function hasOfficialBrandAssets(brand: BrandConfig): boolean {
  return Object.values(brand.assets).every((asset) => isAvailableBrandAsset(asset));
}

const supportedTargets = new Set<BrandAssetTarget>([
  'mobile-runtime',
  'android',
  'ios',
  'web',
  'store',
]);

function isValidImageSource(source: unknown): boolean {
  if (typeof source === 'string') {
    return source.trim().length > 0;
  }
  if (typeof source === 'number') {
    return Number.isInteger(source) && source > 0;
  }
  if (Array.isArray(source)) {
    return source.length > 0 && source.every(isValidImageSource);
  }
  if (!source || typeof source !== 'object') {
    return false;
  }
  const uri = Reflect.get(source, 'uri');
  if (typeof uri === 'string' && uri.trim().length > 0) {
    return true;
  }
  const testUri = Reflect.get(source, 'testUri');
  if (typeof testUri === 'string' && testUri.trim().length > 0) {
    return true;
  }
  const defaultSource = Reflect.get(source, 'default');
  return defaultSource !== undefined && isValidImageSource(defaultSource);
}

export function isValidBrandAsset(asset: BrandAsset): boolean {
  if (!asset.accessibilityLabel.trim()) return false;
  if (
    asset.targets.length === 0 ||
    new Set(asset.targets).size !== asset.targets.length ||
    asset.targets.some((target) => !supportedTargets.has(target))
  ) {
    return false;
  }

  if (asset.status === 'missing') {
    return asset.source === null;
  }

  return (
    isValidImageSource(asset.source) &&
    typeof asset.sourceFile === 'string' &&
    asset.sourceFile.trim().length > 0
  );
}

export function isAvailableBrandAsset(asset: BrandAsset): boolean {
  return asset.status !== 'missing' && isValidBrandAsset(asset);
}

function hasRequiredAssetsForTargets(
  brand: BrandConfig,
  targets: ReadonlySet<BrandAssetTarget>,
): boolean {
  const requiredAssets = Object.values(brand.assets).filter(
    (asset) => asset.required && asset.targets.some((target) => targets.has(target)),
  );
  return requiredAssets.length > 0 && requiredAssets.every(isAvailableBrandAsset);
}

export function hasRequiredMobileBrandAssets(brand: BrandConfig): boolean {
  return hasRequiredAssetsForTargets(
    brand,
    new Set<BrandAssetTarget>(['mobile-runtime', 'android', 'ios']),
  );
}

export function hasRequiredWebBrandAssets(brand: BrandConfig): boolean {
  return hasRequiredAssetsForTargets(brand, new Set<BrandAssetTarget>(['web']));
}

export function hasCompleteBrandAssetSet(brand: BrandConfig): boolean {
  const assets = Object.values(brand.assets);
  return (
    assets.every(isValidBrandAsset) &&
    assets.filter((asset) => asset.required).every(isAvailableBrandAsset)
  );
}
