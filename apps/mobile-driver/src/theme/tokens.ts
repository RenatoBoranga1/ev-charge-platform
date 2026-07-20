export const palette = {
  primary: {
    50: '#ECFEF7',
    100: '#D1FAE9',
    500: '#00A878',
    600: '#008F67',
    700: '#08785B',
  },
  secondary: {
    500: '#315CFF',
    600: '#274BD6',
  },
  accent: {
    500: '#B7F34A',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#F7F9FC',
    100: '#EEF1F5',
    300: '#CDD3DD',
    500: '#6B7280',
    700: '#343A46',
    900: '#111827',
  },
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
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

export interface AppColors {
  background: string;
  surface: string;
  elevatedSurface: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  overlay: string;
}

export const lightColors: AppColors = {
  background: palette.neutral[50],
  surface: palette.neutral[0],
  elevatedSurface: palette.neutral[0],
  text: palette.neutral[900],
  textMuted: palette.neutral[500],
  border: palette.neutral[300],
  primary: palette.primary[600],
  primaryPressed: palette.primary[700],
  onPrimary: palette.neutral[0],
  secondary: palette.secondary[500],
  accent: palette.accent[500],
  success: palette.success,
  warning: palette.warning,
  danger: palette.error,
  info: palette.info,
  overlay: 'rgba(17, 24, 39, 0.62)',
};

export const darkColors: AppColors = {
  background: '#0B1220',
  surface: '#111B2E',
  elevatedSurface: '#17243A',
  text: '#F8FAFC',
  textMuted: '#A8B2C3',
  border: '#334155',
  primary: '#2DD4A2',
  primaryPressed: '#6EE7BE',
  onPrimary: '#06251C',
  secondary: '#6E8BFF',
  accent: palette.accent[500],
  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',
  info: '#60A5FA',
  overlay: 'rgba(2, 6, 23, 0.76)',
};
