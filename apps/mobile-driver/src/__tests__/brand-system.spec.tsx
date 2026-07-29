import { render } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import {
  type BrandAsset,
  type BrandConfig,
  BrandHero,
  BrandMark,
  contrastRatio,
  hasCompleteBrandAssetSet,
  hasOfficialBrandAssets,
  hasRequiredMobileBrandAssets,
  hasRequiredWebBrandAssets,
  isAvailableBrandAsset,
  isValidBrandAsset,
  meetsWcagAA,
  solarSolucoesBrand,
} from '@/design-system';
import { usePreferencesStore } from '@/stores/preferences-store';
import { createThemeColors, motion, opacity, typeScale } from '@/theme/design-tokens';
import { ThemeProvider } from '@/theme/ThemeProvider';

function Providers({ children }: PropsWithChildren) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

function availableAsset(asset: BrandAsset, status: BrandAsset['status'] = 'official'): BrandAsset {
  return {
    ...asset,
    source: { uri: 'file:///official/solis.svg' },
    sourceFile: 'assets/brand/solis/solis-master.svg',
    status,
  };
}

function brandWithAssets(assets: BrandConfig['assets']): BrandConfig {
  return { ...solarSolucoesBrand, assets };
}

function missingAsset(asset: BrandAsset): BrandAsset {
  return {
    accessibilityLabel: asset.accessibilityLabel,
    required: asset.required,
    source: null,
    status: 'missing',
    targets: asset.targets,
  };
}

function transformBrandAssets(
  transform: (asset: BrandAsset) => BrandAsset,
  assets = solarSolucoesBrand.assets,
): BrandConfig['assets'] {
  return {
    logoLight: transform(assets.logoLight),
    logoDark: transform(assets.logoDark),
    symbol: transform(assets.symbol),
    adaptiveIconForeground: transform(assets.adaptiveIconForeground),
    splash: transform(assets.splash),
    favicon: transform(assets.favicon),
  };
}

describe('Solar Soluções brand system', () => {
  beforeEach(() => {
    usePreferencesStore.setState({
      dynamicColorSeed: 'solis',
      themeMode: 'light',
    });
  });

  it('separates company and product while exposing the delivered official assets', () => {
    expect(solarSolucoesBrand).toMatchObject({
      companyName: 'Solar Soluções',
      productName: 'Solis',
      palette: {
        approved: false,
        extractionFile: 'docs/brand/palette-extraction.json',
        source: 'extracted-from-official-assets',
      },
    });
    expect(hasOfficialBrandAssets(solarSolucoesBrand)).toBe(true);
    expect(hasRequiredMobileBrandAssets(solarSolucoesBrand)).toBe(true);
    expect(hasRequiredWebBrandAssets(solarSolucoesBrand)).toBe(true);
    expect(hasCompleteBrandAssetSet(solarSolucoesBrand)).toBe(true);
    expect(
      Object.values(solarSolucoesBrand.assets).every(
        (asset) =>
          asset.status === 'official' &&
          asset.source !== null &&
          asset.sourceFile?.startsWith('apps/mobile-driver/assets/brand/'),
      ),
    ).toBe(true);
  });

  it('renders accessible official marks and the branded hero', () => {
    const screen = render(
      <Providers>
        <BrandMark />
        <BrandHero eyebrow="Solar Soluções" title="Olá, Marina" />
      </Providers>,
    );

    expect(screen.getAllByLabelText('Solis, Solar Soluções')).toHaveLength(2);
    expect(screen.getByRole('header', { name: 'Olá, Marina' })).toBeTruthy();
    expect(screen.getByText('Energia que move o futuro.')).toBeTruthy();
  });

  it('keeps critical text combinations at WCAG AA contrast', () => {
    const light = createThemeColors('light');
    const dark = createThemeColors('dark');

    expect(meetsWcagAA(light.text, light.background)).toBe(true);
    expect(meetsWcagAA(light.onPrimary, light.primary)).toBe(true);
    expect(meetsWcagAA(light.onPrimaryContainer, light.primaryContainer)).toBe(true);
    expect(meetsWcagAA(dark.text, dark.background)).toBe(true);
    expect(meetsWcagAA(dark.onPrimary, dark.primary)).toBe(true);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21);
    expect(() => contrastRatio('invalid', '#000000')).toThrow();
  });

  it('exposes numeric, motion and interaction tokens centrally', () => {
    expect(typeScale.numericLarge.fontWeight).toBe('800');
    expect(motion.durationFast).toBeLessThan(motion.durationSlow);
    expect(opacity.disabled).toBeLessThan(opacity.pressed);
  });
  it('validates mobile and web requirements independently', () => {
    const mobileTargets = new Set(['mobile-runtime', 'android', 'ios']);
    const missingAssets = transformBrandAssets(missingAsset);
    const missing = brandWithAssets(missingAssets);
    const mobileOnly = brandWithAssets(
      transformBrandAssets(
        (asset) =>
          asset.targets.some((target) => mobileTargets.has(target)) ? availableAsset(asset) : asset,
        missingAssets,
      ),
    );
    const webOnly = brandWithAssets(
      transformBrandAssets(
        (asset) => (asset.targets.includes('web') ? availableAsset(asset) : asset),
        missingAssets,
      ),
    );

    expect(hasRequiredMobileBrandAssets(missing)).toBe(false);
    expect(hasRequiredWebBrandAssets(missing)).toBe(false);
    expect(hasCompleteBrandAssetSet(missing)).toBe(false);
    expect(hasRequiredMobileBrandAssets(mobileOnly)).toBe(true);
    expect(hasRequiredWebBrandAssets(mobileOnly)).toBe(false);
    expect(hasRequiredWebBrandAssets(webOnly)).toBe(true);
    expect(hasRequiredMobileBrandAssets(webOnly)).toBe(false);
  });

  it('accepts complete sets and assets derived from an official master', () => {
    const completeAssets = transformBrandAssets(availableAsset);
    const complete = brandWithAssets(completeAssets);
    const derived = brandWithAssets({
      ...completeAssets,
      symbol: availableAsset(solarSolucoesBrand.assets.symbol, 'derived-from-official'),
    });

    expect(hasOfficialBrandAssets(complete)).toBe(true);
    expect(hasCompleteBrandAssetSet(complete)).toBe(true);
    expect(hasCompleteBrandAssetSet(derived)).toBe(true);
    expect(isAvailableBrandAsset(derived.assets.symbol)).toBe(true);
  });

  it('rejects required omissions, empty origins and invalid image sources', () => {
    const requiredMissing = brandWithAssets({
      ...transformBrandAssets(availableAsset),
      splash: missingAsset(solarSolucoesBrand.assets.splash),
    });
    const emptyOrigin = {
      ...availableAsset(solarSolucoesBrand.assets.logoLight),
      sourceFile: ' ',
    };
    const invalidSource = {
      ...availableAsset(solarSolucoesBrand.assets.logoDark),
      source: { uri: '' },
    };

    expect(hasRequiredMobileBrandAssets(requiredMissing)).toBe(false);
    expect(hasCompleteBrandAssetSet(requiredMissing)).toBe(false);
    expect(isValidBrandAsset(emptyOrigin)).toBe(false);
    expect(isValidBrandAsset(invalidSource)).toBe(false);
    expect(isAvailableBrandAsset(invalidSource)).toBe(false);
  });
});
