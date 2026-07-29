import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { solarSolucoesBrand } from './brand';
import { BrandMark } from './BrandMark';
import { useAppTheme } from '@/theme/ThemeProvider';

interface BrandHeroProps {
  compact?: boolean;
  eyebrow?: string;
  title: string;
  description?: string;
  trailing?: ReactNode;
}

export function BrandHero({
  compact = false,
  eyebrow,
  title,
  description,
  trailing,
}: BrandHeroProps) {
  const { colors, radii, spacing, typeScale } = useAppTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.primaryContainer,
          borderColor: colors.outlineVariant,
          borderRadius: radii.xl,
          gap: spacing.lg,
          padding: compact ? spacing.lg : spacing.xl,
        },
      ]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.solarAccent, { backgroundColor: colors.solarAccent }]}
      />
      <View style={styles.topRow}>
        <BrandMark compact />
        {trailing}
      </View>
      <View style={{ gap: spacing.xs }}>
        {eyebrow ? (
          <Text
            style={[typeScale.labelMedium, styles.eyebrow, { color: colors.onPrimaryContainer }]}
          >
            {eyebrow}
          </Text>
        ) : null}
        <Text
          accessibilityRole="header"
          style={[
            compact ? typeScale.headlineSmall : typeScale.headlineMedium,
            styles.title,
            { color: colors.onPrimaryContainer },
          ]}
        >
          {title}
        </Text>
        <Text style={[typeScale.bodyMedium, { color: colors.onPrimaryContainer }]}>
          {description ?? solarSolucoesBrand.tagline}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  eyebrow: { letterSpacing: 0.8, textTransform: 'uppercase' },
  solarAccent: {
    borderBottomLeftRadius: 999,
    height: 72,
    opacity: 0.2,
    position: 'absolute',
    right: -18,
    top: -26,
    width: 112,
  },
  title: { fontWeight: '900' },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
