import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { isDevelopmentCatalogEnabled } from '@/config/runtime';
import { BrandHero, BrandMark, Card, solarSolucoesBrand, Tag } from '@/design-system';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function BrandCatalogScreen() {
  const { colors, mode, typeScale } = useAppTheme();

  if (!isDevelopmentCatalogEnabled()) return <Redirect href="/" />;

  const swatches = [
    ['Ação primária', colors.primary],
    ['Acento solar provisório', colors.solarAccent],
    ['Sustentabilidade', colors.sustainabilityAccent],
    ['Disponível', colors.stationAvailable],
    ['Ocupado', colors.stationBusy],
    ['Offline', colors.stationOffline],
    ['Falha', colors.stationFaulted],
  ] as const;

  return (
    <Screen contentStyle={styles.content}>
      <BrandHero
        eyebrow={`Catálogo ${mode}`}
        title={solarSolucoesBrand.productName}
        description={solarSolucoesBrand.tagline}
      />
      <Card variant="outlined">
        <BrandMark />
        <Text style={[typeScale.bodyMedium, { color: colors.textMuted }]}>
          Marca textual provisória. Logos, símbolo, splash e ícones oficiais ainda não foram
          fornecidos.
        </Text>
        <Tag label="Ativos oficiais pendentes" tone="warning" />
      </Card>
      <Text accessibilityRole="header" style={[typeScale.titleLarge, { color: colors.text }]}>
        Tokens semânticos
      </Text>
      <View style={styles.swatches}>
        {swatches.map(([label, color]) => (
          <View accessibilityLabel={`${label}: ${color}`} key={label} style={styles.swatchRow}>
            <View
              accessibilityElementsHidden
              style={[styles.swatch, { backgroundColor: color, borderColor: colors.outline }]}
            />
            <View style={styles.copy}>
              <Text style={[typeScale.labelLarge, { color: colors.text }]}>{label}</Text>
              <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>{color}</Text>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18 },
  copy: { flex: 1 },
  swatch: { borderRadius: 12, borderWidth: 1, height: 48, width: 48 },
  swatchRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  swatches: { gap: 12 },
});
