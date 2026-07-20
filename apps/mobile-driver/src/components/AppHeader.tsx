import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  canGoBack?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

export function AppHeader({
  title,
  subtitle,
  canGoBack = false,
  actionLabel,
  onAction,
}: AppHeaderProps) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View style={[styles.container, { gap: spacing.md }]}>
      {canGoBack ? (
        <Pressable
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" color={colors.text} size={24} />
        </Pressable>
      ) : null}
      <View style={styles.copy}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.text, fontSize: typography.heading }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={styles.action}
        >
          <Text style={[styles.actionText, { color: colors.primary }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  title: { fontWeight: '800' },
  subtitle: { marginTop: 3, fontSize: 14, lineHeight: 20 },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  actionText: { fontSize: 15, fontWeight: '700' },
});
