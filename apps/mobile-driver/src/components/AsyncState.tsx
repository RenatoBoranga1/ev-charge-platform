import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from './AppButton';
import { useAppTheme } from '@/theme/ThemeProvider';

interface StateProps {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

function StateLayout({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: StateProps & { icon: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={42} color={colors.primary} />
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {message ? (
        <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <AppButton label={actionLabel} onPress={onAction} variant="outline" />
      ) : null}
    </View>
  );
}

export function LoadingState({ title = 'Carregando' }: { title?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.message, { color: colors.textMuted }]}>{title}</Text>
    </View>
  );
}

export function EmptyState(props: StateProps) {
  return <StateLayout icon="leaf-outline" {...props} />;
}

export function ErrorState(props: StateProps) {
  return <StateLayout icon="alert-circle-outline" {...props} />;
}

export function PermissionState(props: StateProps) {
  return <StateLayout icon="shield-checkmark-outline" {...props} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 240,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  message: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
