import { render } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import {
  BrandHero,
  BrandMark,
  contrastRatio,
  hasOfficialBrandAssets,
  meetsWcagAA,
  solarSolucoesBrand,
} from '@/design-system';
import { usePreferencesStore } from '@/stores/preferences-store';
import { createThemeColors, motion, opacity, typeScale } from '@/theme/design-tokens';
import { ThemeProvider } from '@/theme/ThemeProvider';

function Providers({ children }: PropsWithChildren) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('Solar Soluções brand system', () => {
  beforeEach(() => {
    usePreferencesStore.setState({
      dynamicColorSeed: 'solis',
      themeMode: 'light',
    });
  });

  it('separates company and product while flagging missing official assets', () => {
    expect(solarSolucoesBrand).toMatchObject({
      companyName: 'Solar Soluções',
      productName: 'Solis',
      palette: {
        approved: false,
        source: 'design-system-fallback',
      },
    });
    expect(hasOfficialBrandAssets(solarSolucoesBrand)).toBe(false);
    expect(
      Object.values(solarSolucoesBrand.assets).every(
        (asset) => asset.status === 'missing' && asset.source === null,
      ),
    ).toBe(true);
  });

  it('renders accessible textual fallbacks and the branded hero', () => {
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
});
