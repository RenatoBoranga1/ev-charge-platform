import {
  darkColors,
  lightColors,
  motion,
  radii,
  spacing,
} from '@solis/design-tokens';

export type WebTheme = 'dark' | 'light';

export function applyThemeTokens(theme: WebTheme): void {
  const colors = theme === 'dark' ? darkColors : lightColors;
  const root = document.documentElement;
  root.dataset.theme = theme;
  const variables: Record<string, string> = {
    '--background': colors.background,
    '--border': colors.border,
    '--danger': colors.danger,
    '--focus': colors.focus,
    '--muted': colors.textMuted,
    '--primary': colors.primary,
    '--primary-container': colors.primaryContainer,
    '--solar': colors.solarAccent,
    '--success': colors.success,
    '--surface': colors.surface,
    '--surface-high': colors.surfaceContainerHigh,
    '--surface-variant': colors.surfaceVariant,
    '--sustainability': colors.sustainabilityAccent,
    '--text': colors.text,
    '--warning': colors.warning,
    '--radius': `${radii.md}px`,
    '--space': `${spacing.lg}px`,
    '--motion': `${motion.durationMedium}ms`,
  };
  for (const [name, value] of Object.entries(variables)) {
    root.style.setProperty(name, value);
  }
}
