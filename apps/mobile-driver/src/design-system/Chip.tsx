import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';

interface ChipProps {
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  onRemove?: () => void;
  selected?: boolean;
}

export function Chip({
  disabled = false,
  icon,
  label,
  onPress,
  onRemove,
  selected = false,
}: ChipProps) {
  const { colors, radii, typeScale } = useAppTheme();
  const foreground = selected
    ? colors.onPrimaryContainer
    : colors.onSurfaceVariant;

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: selected
            ? colors.primaryContainer
            : colors.surface,
          borderColor: selected ? colors.primary : colors.outlineVariant,
          borderRadius: radii.sm,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityState={{ disabled, selected }}
        disabled={disabled || !onPress}
        onPress={onPress}
        style={({ pressed }) => [styles.content, pressed && styles.pressed]}
      >
        {icon ? <Ionicons name={icon} color={foreground} size={18} /> : null}
        <Text style={[typeScale.labelLarge, { color: foreground }]}>{label}</Text>
      </Pressable>
      {onRemove ? (
        <Pressable
          accessibilityLabel={`Remover ${label}`}
          accessibilityRole="button"
          disabled={disabled}
          hitSlop={8}
          onPress={onRemove}
          style={styles.remove}
        >
          <Ionicons name="close-circle" color={foreground} size={18} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    borderWidth: 1,
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    overflow: 'hidden',
  },
  content: {
    minHeight: 38,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pressed: {
    opacity: 0.72,
  },
  remove: {
    width: 40,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
