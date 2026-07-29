import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';

interface SearchBarProps extends Omit<TextInputProps, 'onChangeText' | 'value'> {
  onChangeText: (value: string) => void;
  onClear?: () => void;
  value: string;
}

export function SearchBar({
  onChangeText,
  onClear,
  placeholder = 'Pesquisar',
  value,
  ...props
}: SearchBarProps) {
  const { colors, radii, typeScale } = useAppTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.outlineVariant,
          borderRadius: radii.lg,
        },
      ]}
    >
      <Ionicons name="search" color={colors.onSurfaceVariant} size={22} />
      <TextInput
        accessibilityLabel={placeholder}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        style={[styles.input, typeScale.bodyLarge, { color: colors.text }]}
        value={value}
        {...props}
      />
      {value ? (
        <Pressable
          accessibilityLabel="Limpar pesquisa"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => {
            onChangeText('');
            onClear?.();
          }}
          style={styles.clear}
        >
          <Ionicons name="close-circle" color={colors.onSurfaceVariant} size={20} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
  },
  clear: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
