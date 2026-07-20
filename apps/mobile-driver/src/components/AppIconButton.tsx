import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';

interface AppIconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  filled?: boolean;
}

export function AppIconButton({
  icon,
  label,
  onPress,
  filled = false,
}: AppIconButtonProps) {
  const { colors, radii } = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          borderRadius: radii.pill,
          backgroundColor: filled ? colors.primary : colors.surface,
          borderColor: filled ? colors.primary : colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Ionicons
        name={icon}
        color={filled ? colors.onPrimary : colors.text}
        size={22}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
