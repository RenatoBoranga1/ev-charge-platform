import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import type { ElevationLevel } from '@/theme/design-tokens';

type SurfaceTone = 'default' | 'container' | 'container-high' | 'variant';

interface SurfaceProps extends PropsWithChildren {
  elevation?: ElevationLevel;
  rounded?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: SurfaceTone;
}

export function Surface({
  children,
  elevation = 'level0',
  rounded = false,
  style,
  tone = 'default',
}: SurfaceProps) {
  const { colors, radii, shadows } = useAppTheme();
  const backgroundColor =
    tone === 'container'
      ? colors.surfaceContainer
      : tone === 'container-high'
        ? colors.surfaceContainerHigh
        : tone === 'variant'
          ? colors.surfaceVariant
          : colors.surface;

  return (
    <View
      style={[
        styles.surface,
        shadows[elevation],
        {
          backgroundColor,
          borderRadius: rounded ? radii.lg : radii.none,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    position: 'relative',
  },
});
