import { forwardRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';

interface AppTextFieldProps extends TextInputProps {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
}

export const AppTextField = forwardRef<TextInput, AppTextFieldProps>(
  function AppTextField({ label, error, hint, style, ...props }, ref) {
    const { colors, radii } = useAppTheme();

    return (
      <View style={styles.container}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            {
              color: colors.text,
              backgroundColor: colors.surface,
              borderColor: error ? colors.danger : colors.border,
              borderRadius: radii.md,
            },
            style,
          ]}
          {...props}
        />
        {error ? (
          <Text accessibilityRole="alert" style={[styles.helper, { color: colors.danger }]}>
            {error}
          </Text>
        ) : hint ? (
          <Text style={[styles.helper, { color: colors.textMuted }]}>{hint}</Text>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 14, fontWeight: '700' },
  input: {
    minHeight: 50,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  helper: { fontSize: 13, lineHeight: 18 },
});
