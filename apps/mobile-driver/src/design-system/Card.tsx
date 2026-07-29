import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';

type CardVariant = 'elevated' | 'filled' | 'outlined';

interface CardProps extends PropsWithChildren {
  accessibilityLabel?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: CardVariant;
}

export function Card({
  accessibilityLabel,
  children,
  onPress,
  style,
  variant = 'elevated',
}: CardProps) {
  const { colors, radii, shadows } = useAppTheme();
  const surfaceStyle: StyleProp<ViewStyle> = [
    styles.card,
    variant === 'elevated' ? shadows.level1 : undefined,
    {
      backgroundColor: variant === 'filled' ? colors.surfaceContainer : colors.surface,
      borderColor: variant === 'outlined' ? colors.outlineVariant : 'transparent',
      borderRadius: radii.xl,
    },
    style,
  ];

  if (!onPress) {
    return (
      <View accessibilityLabel={accessibilityLabel} style={surfaceStyle}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [surfaceStyle, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 18,
  },
  pressed: {
    opacity: 0.78,
  },
});
