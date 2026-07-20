import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from './AppButton';
import { AppModal } from './AppModal';
import { useAppTheme } from '@/theme/ThemeProvider';

interface ConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmationDialog({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmationDialogProps) {
  const { colors } = useAppTheme();

  return (
    <AppModal visible={visible} title={title} onClose={onCancel}>
      <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
      <View style={styles.actions}>
        <View style={styles.action}>
          <AppButton label="Agora não" onPress={onCancel} variant="ghost" />
        </View>
        <View style={styles.action}>
          <AppButton
            label={confirmLabel}
            loading={loading}
            onPress={onConfirm}
            variant="danger"
          />
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  message: { fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
});
