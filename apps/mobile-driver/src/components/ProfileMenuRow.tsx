import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';

export function ProfileMenuRow({
  icon,
  label,
  description,
  onPress,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { colors } = useAppTheme();
  const contentColor = danger ? colors.danger : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border, opacity: pressed ? 0.62 : 1 },
      ]}
    >
      <Ionicons name={icon} size={23} color={contentColor} />
      <View style={styles.copy}>
        <Text style={[styles.label, { color: contentColor }]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, { color: colors.textMuted }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 66,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  copy: { flex: 1 },
  label: { fontSize: 15, fontWeight: '800' },
  description: { marginTop: 3, fontSize: 12, lineHeight: 17 },
});
