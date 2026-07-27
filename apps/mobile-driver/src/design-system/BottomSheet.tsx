import { Ionicons } from '@expo/vector-icons';
import type { PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/ThemeProvider';

interface BottomSheetProps extends PropsWithChildren {
  onDismiss: () => void;
  title?: string;
  visible: boolean;
}

export function BottomSheet({
  children,
  onDismiss,
  title,
  visible,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors, radii, shadows, typeScale } = useAppTheme();

  return (
    <Modal
      animationType="slide"
      onRequestClose={onDismiss}
      transparent
      visible={visible}
    >
      <View style={[styles.root, { backgroundColor: colors.scrim }]}>
        <Pressable
          accessibilityLabel="Fechar painel"
          accessibilityRole="button"
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            shadows.level3,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View
            style={[styles.handle, { backgroundColor: colors.outlineVariant }]}
          />
          {title ? (
            <View style={styles.header}>
              <Text style={[typeScale.titleLarge, styles.title, { color: colors.text }]}>
                {title}
              </Text>
              <Pressable
                accessibilityLabel="Fechar"
                accessibilityRole="button"
                hitSlop={8}
                onPress={onDismiss}
                style={styles.close}
              >
                <Ionicons name="close" color={colors.text} size={24} />
              </Pressable>
            </View>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    flex: 1,
  },
  close: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
