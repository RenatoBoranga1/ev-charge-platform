import { describe, expect, it } from 'vitest';

import {
  createThemeColors,
  darkColors,
  dynamicSeeds,
  lightColors,
  motion,
  opacity,
  palette,
  radii,
  sizes,
  spacing,
  typeScale,
} from './index';

describe('design tokens', () => {
  it('exposes complete light and dark semantic color sets', () => {
    expect(Object.keys(lightColors)).toEqual(Object.keys(darkColors));

    for (const colors of [lightColors, darkColors]) {
      expect(Object.values(colors).every((value) => value.length > 0)).toBe(true);
    }
  });

  it('applies every supported dynamic seed in both color schemes', () => {
    for (const seed of Object.keys(dynamicSeeds) as Array<keyof typeof dynamicSeeds>) {
      const light = createThemeColors('light', seed);
      const dark = createThemeColors('dark', seed);

      expect(light.primary).toBe(dynamicSeeds[seed].primary);
      expect(light.focus).toBe(dynamicSeeds[seed].primary);
      expect(dark.primary).toBe(dynamicSeeds[seed].darkPrimary);
      expect(dark.focus).toBe(dynamicSeeds[seed].darkPrimaryPressed);
    }
  });

  it('keeps layout, motion and accessibility values valid', () => {
    expect(Object.values(spacing)).toEqual([...Object.values(spacing)].sort((a, b) => a - b));
    expect(Object.values(radii).every((value) => value >= 0)).toBe(true);
    expect(sizes.minimumTouchTarget).toBeGreaterThanOrEqual(48);
    expect(motion.durationFast).toBeLessThan(motion.durationMedium);
    expect(motion.durationMedium).toBeLessThan(motion.durationSlow);
    expect(Object.values(opacity).every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(typeScale.bodyLarge.lineHeight).toBeGreaterThan(typeScale.bodyLarge.fontSize);
    expect(palette.primary[700]).toMatch(/^#[0-9A-F]{6}$/i);
  });
});