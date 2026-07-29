import { StyleSheet, Text, View } from 'react-native';

import { solarSolucoesBrand } from './brand';
import { useAppTheme } from '@/theme/ThemeProvider';

interface BrandMarkProps {
  compact?: boolean;
  showCompany?: boolean;
}

export function BrandMark({ compact = false, showCompany = true }: BrandMarkProps) {
  const { colors, typeScale } = useAppTheme();

  return (
    <View
      accessibilityLabel={`${solarSolucoesBrand.productName}, ${solarSolucoesBrand.companyName}`}
      accessibilityRole="text"
      style={styles.container}
    >
      <Text
        style={[
          compact ? typeScale.titleLarge : typeScale.headlineMedium,
          styles.product,
          { color: colors.text },
        ]}
      >
        {solarSolucoesBrand.productName}
      </Text>
      {showCompany ? (
        <Text style={[typeScale.labelSmall, styles.company, { color: colors.textMuted }]}>
          {solarSolucoesBrand.companyName}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  company: { letterSpacing: 1.2, textTransform: 'uppercase' },
  container: { alignItems: 'flex-start' },
  product: { fontWeight: '900', letterSpacing: -0.7 },
});
