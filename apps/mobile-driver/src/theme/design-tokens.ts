import type { ViewStyle } from 'react-native';

import {
  elevation,
  type ElevationLevel,
} from '@solis/design-tokens';

export * from '@solis/design-tokens';

/*
export const palette = {
  primary: {
    50: '#F1F6FF',
    100: '#DFEAFC',
    200: '#B7D2F6',
    500: '#0878C8',
    600: '#0858A8',
    700: '#082868',
    900: '#081858',
  },
  secondary: {
    50: '#FFF7E6',
    100: '#FFEBC4',
    500: '#F88808',
    600: '#D86B00',
    900: '#5A2600',
  },
  accent: {
    100: '#EDFAD6',
    500: '#68B828',
    900: '#24420C',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#F7F9FC',
    100: '#EEF1F5',
    200: '#E2E7EE',
    300: '#CDD3DD',
    500: '#6B7280',
    700: '#343A46',
    800: '#202735',
    900: '#111827',
    1000: '#070B12',
  },
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB',
} as const;

export const dynamicSeeds = {
  solis: {
    primary: palette.primary[700],
    primaryPressed: palette.primary[900],
    primaryContainer: palette.primary[100],
    onPrimaryContainer: palette.primary[900],
    darkPrimary: '#63B7F4',
    darkPrimaryPressed: '#A9D8FA',
    darkPrimaryContainer: '#083878',
    darkOnPrimaryContainer: '#DDEEFF',
  },
  ocean: {
    primary: '#1667D9',
    primaryPressed: '#0D4FAE',
    primaryContainer: '#D8E7FF',
    onPrimaryContainer: '#001A41',
    darkPrimary: '#A8C7FA',
    darkPrimaryPressed: '#D4E3FF',
    darkPrimaryContainer: '#00458F',
    darkOnPrimaryContainer: '#D8E7FF',
  },
  solar: {
    primary: '#8A5200',
    primaryPressed: '#6B3F00',
    primaryContainer: '#FFDDB5',
    onPrimaryContainer: '#2B1700',
    darkPrimary: '#FFB95F',
    darkPrimaryPressed: '#FFDDB5',
    darkPrimaryContainer: '#663C00',
    darkOnPrimaryContainer: '#FFDDB5',
  },
} as const;

export type DynamicColorSeed = keyof typeof dynamicSeeds;
export type ThemeMode = 'system' | 'light' | 'dark';

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
} as const;

export const radii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  title: 30,
  heading: 22,
  subheading: 18,
  body: 16,
  caption: 13,
  metric: 28,
} as const;

const text = (
  fontSize: number,
  lineHeight: number,
  fontWeight: TextStyle['fontWeight'],
  letterSpacing = 0,
): TextStyle => ({ fontSize, lineHeight, fontWeight, letterSpacing });

export const typeScale = {
  displayLarge: text(57, 64, '400', -0.25),
  displayMedium: text(45, 52, '400'),
  displaySmall: text(36, 44, '400'),
  headlineLarge: text(32, 40, '700'),
  headlineMedium: text(28, 36, '700'),
  headlineSmall: text(24, 32, '700'),
  titleLarge: text(22, 28, '700'),
  titleMedium: text(16, 24, '700', 0.15),
  titleSmall: text(14, 20, '700', 0.1),
  bodyLarge: text(16, 24, '400', 0.5),
  bodyMedium: text(14, 20, '400', 0.25),
  bodySmall: text(12, 16, '400', 0.4),
  labelLarge: text(14, 20, '700', 0.1),
  labelMedium: text(12, 16, '700', 0.5),
  labelSmall: text(11, 16, '700', 0.5),
  numericLarge: text(34, 40, '800', -0.4),
  numericMedium: text(24, 32, '800', -0.2),
  numericSmall: text(16, 24, '700'),
} as const;

export const motion = {
  durationFast: 120,
  durationMedium: 220,
  durationSlow: 360,
  easingStandard: [0.2, 0, 0, 1] as const,
  easingEmphasized: [0.2, 0, 0, 1.2] as const,
} as const;

export const opacity = {
  disabled: 0.45,
  pressed: 0.78,
  subtle: 0.12,
  emphasis: 0.2,
} as const;

export const elevation = {
  level0: 0,
  level1: 1,
  level2: 3,
  level3: 6,
  level4: 8,
  level5: 12,
} as const;

export type ElevationLevel = keyof typeof elevation;

*/
export const shadows: Record<ElevationLevel, ViewStyle> = {
  level0: {},
  level1: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: elevation.level1,
  },
  level2: {
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: elevation.level2,
  },
  level3: {
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: elevation.level3,
  },
  level4: {
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: elevation.level4,
  },
  level5: {
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: elevation.level5,
  },
};

/*
export const sizes = {
  minimumTouchTarget: 48,
  buttonHeight: 52,
  appBarHeight: 64,
  navigationBarHeight: 72,
  fab: 56,
  iconSmall: 18,
  iconMedium: 24,
  iconLarge: 32,
} as const;

export interface AppColors {
  background: string;
  surface: string;
  elevatedSurface: string;
  surfaceVariant: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  text: string;
  textMuted: string;
  onSurface: string;
  onSurfaceVariant: string;
  border: string;
  outline: string;
  outlineVariant: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  disabled: string;
  onDisabled: string;
  inverseSurface: string;
  inverseOnSurface: string;
  solarAccent: string;
  sustainabilityAccent: string;
  stationAvailable: string;
  stationBusy: string;
  stationOffline: string;
  stationFaulted: string;
  chartPrimary: string;
  chartSecondary: string;
  chartAccent: string;
  chartGrid: string;
  chartAxis: string;
  chartPositive: string;
  chartNegative: string;
  chartNeutral: string;
  focus: string;
  overlay: string;
  scrim: string;
}

const lightBase: AppColors = {
  background: palette.neutral[50],
  surface: palette.neutral[0],
  elevatedSurface: palette.neutral[0],
  surfaceVariant: palette.neutral[100],
  surfaceContainer: '#F1F4F8',
  surfaceContainerHigh: '#E8EDF3',
  text: palette.neutral[900],
  textMuted: palette.neutral[500],
  onSurface: palette.neutral[900],
  onSurfaceVariant: palette.neutral[700],
  border: palette.neutral[300],
  outline: '#737985',
  outlineVariant: '#C3C8D1',
  primary: palette.primary[700],
  primaryPressed: palette.primary[900],
  onPrimary: palette.neutral[0],
  primaryContainer: palette.primary[100],
  onPrimaryContainer: palette.primary[900],
  secondary: palette.secondary[500],
  onSecondary: palette.neutral[0],
  secondaryContainer: palette.secondary[100],
  onSecondaryContainer: palette.secondary[900],
  accent: palette.accent[500],
  success: palette.success,
  warning: palette.warning,
  danger: palette.error,
  info: palette.info,
  disabled: 'rgba(17, 24, 39, 0.12)',
  onDisabled: 'rgba(17, 24, 39, 0.38)',
  inverseSurface: palette.neutral[800],
  inverseOnSurface: palette.neutral[50],
  solarAccent: '#F8A808',
  sustainabilityAccent: '#4F8D1F',
  stationAvailable: '#08785B',
  stationBusy: '#9A5B00',
  stationOffline: '#596170',
  stationFaulted: '#B42318',
  chartPrimary: '#0858A8',
  chartSecondary: '#4F8D1F',
  chartAccent: '#A64C00',
  chartGrid: '#CDD3DD',
  chartAxis: '#343A46',
  chartPositive: '#08785B',
  chartNegative: '#B42318',
  chartNeutral: '#596170',
  focus: palette.primary[500],
  overlay: 'rgba(17, 24, 39, 0.62)',
  scrim: 'rgba(0, 0, 0, 0.52)',
};

const darkBase: AppColors = {
  background: '#0B1220',
  surface: '#111B2E',
  elevatedSurface: '#17243A',
  surfaceVariant: '#243248',
  surfaceContainer: '#152136',
  surfaceContainerHigh: '#1D2B43',
  text: '#F8FAFC',
  textMuted: '#A8B2C3',
  onSurface: '#F8FAFC',
  onSurfaceVariant: '#C5CEDB',
  border: '#334155',
  outline: '#8D97A8',
  outlineVariant: '#3C4759',
  primary: '#2DD4A2',
  primaryPressed: '#6EE7BE',
  onPrimary: '#06251C',
  primaryContainer: '#075B46',
  onPrimaryContainer: '#B9F8E3',
  secondary: '#AFC4FF',
  onSecondary: '#002B75',
  secondaryContainer: '#163F93',
  onSecondaryContainer: '#D9E2FF',
  accent: palette.accent[500],
  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',
  info: '#60A5FA',
  disabled: 'rgba(248, 250, 252, 0.12)',
  onDisabled: 'rgba(248, 250, 252, 0.38)',
  inverseSurface: '#E2E7EE',
  inverseOnSurface: '#202735',
  solarAccent: '#F8D808',
  sustainabilityAccent: '#9ADC5C',
  stationAvailable: '#6EE7BE',
  stationBusy: '#FBC36A',
  stationOffline: '#A8B2C3',
  stationFaulted: '#FFB4AB',
  chartPrimary: '#AFC4FF',
  chartSecondary: '#6EE7BE',
  chartAccent: '#FBC36A',
  chartGrid: '#3C4759',
  chartAxis: '#C5CEDB',
  chartPositive: '#6EE7BE',
  chartNegative: '#FFB4AB',
  chartNeutral: '#A8B2C3',
  focus: '#6EE7BE',
  overlay: 'rgba(2, 6, 23, 0.76)',
  scrim: 'rgba(0, 0, 0, 0.72)',
};

export function createThemeColors(
  scheme: 'light' | 'dark',
  seed: DynamicColorSeed = 'solis',
): AppColors {
  const dynamic = dynamicSeeds[seed];
  const base = scheme === 'dark' ? darkBase : lightBase;

  return {
    ...base,
    primary: scheme === 'dark' ? dynamic.darkPrimary : dynamic.primary,
    primaryPressed: scheme === 'dark' ? dynamic.darkPrimaryPressed : dynamic.primaryPressed,
    primaryContainer: scheme === 'dark' ? dynamic.darkPrimaryContainer : dynamic.primaryContainer,
    onPrimaryContainer:
      scheme === 'dark' ? dynamic.darkOnPrimaryContainer : dynamic.onPrimaryContainer,
    focus: scheme === 'dark' ? dynamic.darkPrimaryPressed : dynamic.primary,
  };
}

export const lightColors: AppColors = createThemeColors('light');
export const darkColors: AppColors = createThemeColors('dark');
*/
