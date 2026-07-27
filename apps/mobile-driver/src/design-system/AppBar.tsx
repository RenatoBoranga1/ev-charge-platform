import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';

interface AppBarProps {
  canGoBack?: boolean;
  onBack?: () => void;
  overline?: string;
  subtitle?: string;
  title: string;
  trailing?: ReactNode;
}

export function AppBar({
  canGoBack = false,
  onBack,
  overline,
  subtitle,
  title,
  trailing,
}: AppBarProps) {
  const { colors, sizes, typeScale } = useAppTheme();

  return (
    <View style={[styles.container, { minHeight: sizes.appBarHeight }]}>
      {canGoBack ? (
        <Pressable
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack ?? (() => router.back())}
          style={styles.leading}
        >
          <Ionicons name="arrow-back" color={colors.text} size={24} />
        </Pressable>
      ) : null}
      <View style={styles.copy}>
        {overline ? (
          <Text style={[typeScale.labelMedium, { color: colors.primary }]}>
            {overline}
          </Text>
        ) : null}
        <Text
          accessibilityRole="header"
          numberOfLines={2}
          style={[typeScale.titleLarge, { color: colors.text }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={2}
            style={[typeScale.bodyMedium, { color: colors.textMuted }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  leading: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  trailing: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
