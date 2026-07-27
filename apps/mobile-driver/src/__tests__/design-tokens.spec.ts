import {
  createThemeColors,
  darkColors,
  dynamicSeeds,
  elevation,
  lightColors,
  radii,
  shadows,
  sizes,
  spacing,
  typeScale,
} from '@/theme/design-tokens';

describe('Material 3 design tokens', () => {
  it('exposes complete spacing, radius, typography and elevation scales', () => {
    expect(spacing.none).toBe(0);
    expect(spacing.huge).toBe(48);
    expect(radii.pill).toBe(999);
    expect(typeScale.bodyLarge).toMatchObject({
      fontSize: 16,
      lineHeight: 24,
    });
    expect(elevation.level5).toBeGreaterThan(elevation.level1);
    expect(shadows.level0).toEqual({});
    expect(shadows.level3.elevation).toBe(elevation.level3);
    expect(sizes.minimumTouchTarget).toBeGreaterThanOrEqual(48);
  });

  it.each(Object.keys(dynamicSeeds) as (keyof typeof dynamicSeeds)[])(
    'creates accessible semantic colors for the %s seed',
    (seed) => {
      const light = createThemeColors('light', seed);
      const dark = createThemeColors('dark', seed);

      expect(light.primary).toBe(dynamicSeeds[seed].primary);
      expect(light.onPrimary).not.toBe(light.primary);
      expect(light.primaryContainer).toBe(dynamicSeeds[seed].primaryContainer);
      expect(dark.primary).toBe(dynamicSeeds[seed].darkPrimary);
      expect(dark.background).not.toBe(light.background);
      expect(dark.onSurface).not.toBe(dark.surface);
    },
  );

  it('keeps Solis as the stable default while returning independent themes', () => {
    expect(lightColors).toEqual(createThemeColors('light'));
    expect(darkColors).toEqual(createThemeColors('dark'));
    expect(createThemeColors('light')).not.toBe(createThemeColors('light'));
  });
});
