import { createContext, type PropsWithChildren, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { solarSolucoesBrand } from '@/design-system/brand';

import { usePreferencesStore } from '@/stores/preferences-store';

import {
  createThemeColors,
  elevation,
  motion,
  opacity,
  radii,
  shadows,
  sizes,
  spacing,
  typeScale,
  typography,
  type DynamicColorSeed,
  type ThemeMode,
} from './design-tokens';

export type Theme = {
  isDark: boolean;
  mode: 'light' | 'dark';
  preference: ThemeMode;
  dynamicColorSeed: DynamicColorSeed;
  colors: ReturnType<typeof createThemeColors>;
  radii: typeof radii;
  spacing: typeof spacing;
  typography: typeof typography;
  typeScale: typeof typeScale;
  elevation: typeof elevation;
  shadows: typeof shadows;
  motion: typeof motion;
  opacity: typeof opacity;
  sizes: typeof sizes;
  setThemeMode: (mode: ThemeMode) => void;
  setDynamicColorSeed: (seed: DynamicColorSeed) => void;
  brand: typeof solarSolucoesBrand;
};

const defaultColors = createThemeColors('light');
const noop = () => undefined;

const ThemeContext = createContext<Theme>({
  isDark: false,
  mode: 'light',
  preference: 'system',
  dynamicColorSeed: 'solis',
  colors: defaultColors,
  radii,
  spacing,
  typography,
  typeScale,
  elevation,
  shadows,
  sizes,
  motion,
  opacity,
  brand: solarSolucoesBrand,
  setThemeMode: noop,
  setDynamicColorSeed: noop,
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const colorScheme = useColorScheme();
  const preference = usePreferencesStore((state) => state.themeMode);
  const dynamicColorSeed = usePreferencesStore((state) => state.dynamicColorSeed);
  const setThemeMode = usePreferencesStore((state) => state.setThemeMode);
  const setDynamicColorSeed = usePreferencesStore((state) => state.setDynamicColorSeed);
  const mode = preference === 'system' ? (colorScheme === 'dark' ? 'dark' : 'light') : preference;
  const theme = useMemo<Theme>(
    () => ({
      isDark: mode === 'dark',
      mode,
      preference,
      dynamicColorSeed,
      colors: createThemeColors(mode, dynamicColorSeed),
      radii,
      spacing,
      typography,
      typeScale,
      elevation,
      shadows,
      sizes,
      setThemeMode,
      motion,
      opacity,
      brand: solarSolucoesBrand,
      setDynamicColorSeed,
    }),
    [dynamicColorSeed, mode, preference, setDynamicColorSeed, setThemeMode],
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): Theme {
  return useContext(ThemeContext);
}
