import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const useTone = (tone: Tone) => {
  const { colors } = useAppTheme();
  if (tone === 'primary') {
    return {
      background: colors.primaryContainer,
      foreground: colors.onPrimaryContainer,
    };
  }
  if (tone === 'neutral') {
    return {
      background: colors.surfaceContainerHigh,
      foreground: colors.onSurfaceVariant,
    };
  }
  return { background: `${colors[tone]}1F`, foreground: colors[tone] };
};

interface TagProps {
  label: string;
  tone?: Tone;
}

export function Tag({ label, tone = 'neutral' }: TagProps) {
  const { radii, typeScale } = useAppTheme();
  const colors = useTone(tone);

  return (
    <View
      style={[
        styles.tag,
        { backgroundColor: colors.background, borderRadius: radii.pill },
      ]}
    >
      <Text style={[typeScale.labelMedium, { color: colors.foreground }]}>
        {label}
      </Text>
    </View>
  );
}

interface BadgeProps {
  label?: string;
  max?: number;
  tone?: Exclude<Tone, 'neutral'>;
  value?: number;
}

export function Badge({
  label,
  max = 99,
  tone = 'danger',
  value,
}: BadgeProps) {
  const { colors, radii, typeScale } = useAppTheme();
  const content =
    label ?? (value === undefined ? '' : value > max ? `${max}+` : String(value));

  return (
    <View
      accessibilityLabel={content}
      style={[
        styles.badge,
        { backgroundColor: colors[tone], borderRadius: radii.pill },
      ]}
    >
      {content ? (
        <Text style={[typeScale.labelSmall, { color: colors.onPrimary }]}>
          {content}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    minHeight: 28,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  badge: {
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
});
