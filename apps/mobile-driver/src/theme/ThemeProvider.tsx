import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
} from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, radii, spacing, typography } from './tokens';

type Theme = {
  isDark: boolean;
  colors: typeof lightColors;
  radii: typeof radii;
  spacing: typeof spacing;
  typography: typeof typography;
};

const ThemeContext = createContext<Theme>({
  isDark: false,
  colors: lightColors,
  radii,
  spacing,
  typography,
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const colorScheme = useColorScheme();
  const theme = useMemo<Theme>(
    () => ({
      isDark: colorScheme === 'dark',
      colors: colorScheme === 'dark' ? darkColors : lightColors,
      radii,
      spacing,
      typography,
    }),
    [colorScheme],
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): Theme {
  return useContext(ThemeContext);
}
