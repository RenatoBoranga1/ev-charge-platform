import type { PropsWithChildren } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';

interface AppModalProps extends PropsWithChildren {
  visible: boolean;
  title: string;
  onClose: () => void;
}

export function AppModal({
  visible,
  title,
  onClose,
  children,
}: AppModalProps) {
  const { colors, radii } = useAppTheme();

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View
          accessibilityViewIsModal
          style={[
            styles.content,
            { backgroundColor: colors.surface, borderRadius: radii.lg },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Pressable
              accessibilityLabel="Fechar"
              accessibilityRole="button"
              hitSlop={10}
              onPress={onClose}
            >
              <Text style={[styles.close, { color: colors.textMuted }]}>Fechar</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: { padding: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { flex: 1, fontSize: 20, fontWeight: '800' },
  close: { minHeight: 44, textAlignVertical: 'center', fontWeight: '700' },
});
