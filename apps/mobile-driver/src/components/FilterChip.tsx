import { Pressable, StyleSheet, Text } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';

interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
}

export function FilterChip({
  label,
  selected = false,
  onPress,
}: FilterChipProps) {
  const { colors, radii } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: radii.pill,
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primary : colors.surface,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Text style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
});
