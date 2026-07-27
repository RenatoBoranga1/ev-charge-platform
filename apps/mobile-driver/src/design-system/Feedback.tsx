import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/ThemeProvider';

interface SnackbarProps {
  actionLabel?: string | undefined;
  message: string;
  onAction?: (() => void) | undefined;
  onDismiss?: (() => void) | undefined;
  visible: boolean;
}

export function Snackbar({
  actionLabel,
  message,
  onAction,
  onDismiss,
  visible,
}: SnackbarProps) {
  const { colors, radii, shadows, typeScale } = useAppTheme();

  if (!visible) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.snackbar,
        shadows.level3,
        {
          backgroundColor: colors.inverseSurface,
          borderRadius: radii.sm,
        },
      ]}
    >
      <Text
        style={[
          typeScale.bodyMedium,
          styles.message,
          { color: colors.inverseOnSurface },
        ]}
      >
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={styles.action}
        >
          <Text style={[typeScale.labelLarge, { color: colors.primary }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
      {onDismiss ? (
        <Pressable
          accessibilityLabel="Fechar aviso"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onDismiss}
          style={styles.dismiss}
        >
          <Ionicons name="close" color={colors.inverseOnSurface} size={20} />
        </Pressable>
      ) : null}
    </View>
  );
}

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

interface ToastProps {
  message: string;
  onDismiss?: (() => void) | undefined;
  tone?: ToastTone | undefined;
  visible: boolean;
}

export function Toast({
  message,
  onDismiss,
  tone = 'info',
  visible,
}: ToastProps) {
  const insets = useSafeAreaInsets();
  const { colors, radii, shadows, typeScale } = useAppTheme();

  if (!visible) return null;

  const toneColor = colors[tone];
  const icon =
    tone === 'success'
      ? 'checkmark-circle'
      : tone === 'warning'
        ? 'warning'
        : tone === 'danger'
          ? 'alert-circle'
          : 'information-circle';

  return (
    <Pressable
      accessibilityLabel={`${message}. Toque para fechar.`}
      accessibilityLiveRegion="polite"
      accessibilityRole="button"
      onPress={onDismiss}
      style={[
        styles.toast,
        shadows.level3,
        {
          backgroundColor: colors.surface,
          borderColor: toneColor,
          borderRadius: radii.md,
          top: Math.max(insets.top, 12),
        },
      ]}
    >
      <Ionicons name={icon} color={toneColor} size={22} />
      <Text style={[typeScale.bodyMedium, styles.message, { color: colors.text }]}>
        {message}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  snackbar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 88,
    minHeight: 52,
    paddingLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 100,
  },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    minHeight: 52,
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 110,
  },
  message: {
    flex: 1,
  },
  action: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dismiss: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
