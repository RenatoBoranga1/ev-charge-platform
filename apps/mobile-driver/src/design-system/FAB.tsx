import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';

interface FABProps {
  accessibilityLabel: string;
  extendedLabel?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

export function FAB({
  accessibilityLabel,
  extendedLabel,
  icon,
  onPress,
}: FABProps) {
  const { colors, radii, shadows, sizes, typeScale } = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        shadows.level3,
        {
          minWidth: sizes.fab,
          height: sizes.fab,
          backgroundColor: colors.primaryContainer,
          borderRadius: radii.lg,
          opacity: pressed ? 0.78 : 1,
        },
      ]}
    >
      <Ionicons name={icon} color={colors.onPrimaryContainer} size={24} />
      {extendedLabel ? (
        <Text style={[typeScale.labelLarge, { color: colors.onPrimaryContainer }]}>
          {extendedLabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
});
