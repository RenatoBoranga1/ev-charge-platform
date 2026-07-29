import { Redirect } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { isDevelopmentCatalogEnabled } from '@/config/runtime';
import {
  type BrandAsset,
  BrandHero,
  BrandMark,
  Card,
  contrastRatio,
  hasCompleteBrandAssetSet,
  hasRequiredMobileBrandAssets,
  hasRequiredWebBrandAssets,
  isAvailableBrandAsset,
  solarSolucoesBrand,
  Tag,
} from '@/design-system';
import { useAppTheme } from '@/theme/ThemeProvider';

function colorMetadata(color: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match?.[1]) return color;
  const value = match[1];
  return `${color.toUpperCase()} · RGB ${Number.parseInt(value.slice(0, 2), 16)}, ${Number.parseInt(
    value.slice(2, 4),
    16,
  )}, ${Number.parseInt(value.slice(4, 6), 16)}`;
}

export default function BrandCatalogScreen() {
  const { colors, mode, typeScale } = useAppTheme();

  if (!isDevelopmentCatalogEnabled()) return <Redirect href="/" />;

  const swatches = [
    ['Ação primária', colors.primary, colors.background],
    ['Acento solar provisório', colors.solarAccent, colors.background],
    ['Sustentabilidade', colors.sustainabilityAccent, colors.background],
    ['Disponível', colors.stationAvailable, colors.background],
    ['Ocupado', colors.stationBusy, colors.background],
    ['Offline', colors.stationOffline, colors.background],
    ['Falha', colors.stationFaulted, colors.background],
    ['Gráfico primário', colors.chartPrimary, colors.surface],
    ['Gráfico secundário', colors.chartSecondary, colors.surface],
    ['Eixo do gráfico', colors.chartAxis, colors.surface],
    ['Grade do gráfico', colors.chartGrid, colors.surface],
  ] as const;
  const assets = Object.entries(solarSolucoesBrand.assets) as [string, BrandAsset][];

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
          Ativos oficiais entregues em PNG com origem e SHA-256 registrados. A paleta abaixo foi
          extraída do símbolo mestre e ainda depende de aprovação por manual de marca.
        </Text>
        <View style={styles.readiness}>
          <Tag label="Ativos oficiais disponíveis" tone="success" />
          <Tag label="Paleta extraída, não homologada" tone="warning" />
        </View>
      </Card>

      <Text accessibilityRole="header" style={[typeScale.titleLarge, { color: colors.text }]}>
        Validação dos ativos
      </Text>
      <Card variant="outlined">
        <View style={styles.readiness}>
          <Tag
            label={`Mobile: ${
              hasRequiredMobileBrandAssets(solarSolucoesBrand) ? 'pronto' : 'incompleto'
            }`}
            tone={hasRequiredMobileBrandAssets(solarSolucoesBrand) ? 'success' : 'warning'}
          />
          <Tag
            label={`Web: ${
              hasRequiredWebBrandAssets(solarSolucoesBrand) ? 'pronto' : 'incompleto'
            }`}
            tone={hasRequiredWebBrandAssets(solarSolucoesBrand) ? 'success' : 'warning'}
          />
          <Tag
            label={`Completo: ${hasCompleteBrandAssetSet(solarSolucoesBrand) ? 'sim' : 'não'}`}
            tone={hasCompleteBrandAssetSet(solarSolucoesBrand) ? 'success' : 'warning'}
          />
        </View>
        {assets.map(([name, asset]) => (
          <View
            accessibilityLabel={`${name}: ${asset.status}. Alvos ${asset.targets.join(', ')}`}
            key={name}
            style={[styles.assetRow, { borderBottomColor: colors.outlineVariant }]}
          >
            {isAvailableBrandAsset(asset) && asset.source !== null ? (
              <Image
                accessibilityIgnoresInvertColors
                accessible={false}
                resizeMode="contain"
                source={asset.source}
                style={[styles.assetPreview, { backgroundColor: colors.surfaceContainer }]}
              />
            ) : null}
            <View style={styles.copy}>
              <Text style={[typeScale.labelLarge, { color: colors.text }]}>{name}</Text>
              <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>
                {asset.targets.join(' · ')} · {asset.required ? 'obrigatório' : 'opcional'}
              </Text>
              {asset.sourceFile ? (
                <Text numberOfLines={1} style={[typeScale.bodySmall, { color: colors.textMuted }]}>
                  {asset.sourceFile}
                </Text>
              ) : null}
            </View>
            <Tag
              label={
                asset.status === 'official'
                  ? 'Oficial'
                  : asset.status === 'derived-from-official'
                    ? 'Derivado'
                    : 'Ausente'
              }
              tone={isAvailableBrandAsset(asset) ? 'success' : 'warning'}
            />
          </View>
        ))}
      </Card>

      <Text accessibilityRole="header" style={[typeScale.titleLarge, { color: colors.text }]}>
        Tokens semânticos
      </Text>
      <View style={styles.swatches}>
        {swatches.map(([label, color, surface]) => {
          const contrast = /^#[0-9a-f]{6}$/i.test(color) ? contrastRatio(color, surface) : null;
          return (
            <View
              accessibilityLabel={`${label}: ${color}${
                contrast === null ? '' : `. Contraste ${contrast.toFixed(2)} para um`
              }`}
              key={label}
              style={styles.swatchRow}
            >
              <View
                accessibilityElementsHidden
                style={[styles.swatch, { backgroundColor: color, borderColor: colors.outline }]}
              />
              <View style={styles.copy}>
                <Text style={[typeScale.labelLarge, { color: colors.text }]}>{label}</Text>
                <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>
                  {colorMetadata(color)}
                </Text>
                {contrast !== null ? (
                  <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>
                    Contraste sobre a superfície: {contrast.toFixed(2)}:1
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  assetRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
  },
  assetPreview: { borderRadius: 10, height: 52, width: 72 },
  content: { gap: 18 },
  copy: { flex: 1 },
  readiness: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  swatch: { borderRadius: 12, borderWidth: 1, height: 48, width: 48 },
  swatchRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  swatches: { gap: 12 },
});
