import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';

interface LoadingProps {
  label?: string;
  size?: 'small' | 'large';
}

export function Loading({ label, size = 'small' }: LoadingProps) {
  const { colors, typeScale } = useAppTheme();

  return (
    <View
      accessibilityLabel={label ?? 'Carregando'}
      accessibilityLiveRegion="polite"
      style={styles.loading}
    >
      <ActivityIndicator color={colors.primary} size={size} />
      {label ? (
        <Text style={[typeScale.bodyMedium, { color: colors.textMuted }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

interface SkeletonProps {
  height?: number;
  radius?: number;
  width?: number | `${number}%`;
}

export function Skeleton({
  height = 16,
  radius = 8,
  width = '100%',
}: SkeletonProps) {
  const { colors } = useAppTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: colors.surfaceContainerHigh,
        opacity: 0.72,
      }}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
});
