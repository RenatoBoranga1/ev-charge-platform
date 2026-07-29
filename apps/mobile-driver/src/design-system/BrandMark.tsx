import type { ImageSourcePropType } from 'react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { isAvailableBrandAsset, solarSolucoesBrand } from './brand';
import { useAppTheme } from '@/theme/ThemeProvider';

interface BrandMarkProps {
  compact?: boolean;
  showCompany?: boolean;
}

interface Crop {
  canvasHeight: number;
  canvasWidth: number;
  contentHeight: number;
  contentWidth: number;
  left: number;
  top: number;
}

const crops = {
  logoLight: {
    canvasHeight: 1024,
    canvasWidth: 1536,
    contentHeight: 333,
    contentWidth: 893,
    left: 293,
    top: 301,
  },
  logoDark: {
    canvasHeight: 1024,
    canvasWidth: 1536,
    contentHeight: 386,
    contentWidth: 1021,
    left: 210,
    top: 290,
  },
  symbol: {
    canvasHeight: 1024,
    canvasWidth: 1536,
    contentHeight: 484,
    contentWidth: 503,
    left: 510,
    top: 245,
  },
} satisfies Record<string, Crop>;

function CroppedBrandImage({
  crop,
  source,
  width,
}: {
  crop: Crop;
  source: ImageSourcePropType;
  width: number;
}) {
  const scale = width / crop.contentWidth;
  const height = crop.contentHeight * scale;

  return (
    <View style={[styles.imageFrame, { height, width }]}>
      <Image
        accessibilityIgnoresInvertColors
        accessible={false}
        resizeMode="stretch"
        source={source}
        style={{
          height: crop.canvasHeight * scale,
          left: -crop.left * scale,
          position: 'absolute',
          top: -crop.top * scale,
          width: crop.canvasWidth * scale,
        }}
      />
    </View>
  );
}

export function BrandMark({ compact = false, showCompany = true }: BrandMarkProps) {
  const { colors, isDark, typeScale } = useAppTheme();
  const asset = showCompany
    ? isDark
      ? solarSolucoesBrand.assets.logoDark
      : solarSolucoesBrand.assets.logoLight
    : solarSolucoesBrand.assets.symbol;
  const crop = showCompany ? (isDark ? crops.logoDark : crops.logoLight) : crops.symbol;
  const width = showCompany ? (compact ? 132 : 196) : compact ? 44 : 56;

  return (
    <View
      accessibilityLabel={`${solarSolucoesBrand.productName}, ${solarSolucoesBrand.companyName}`}
      accessibilityRole={isAvailableBrandAsset(asset) ? 'image' : 'text'}
      style={styles.container}
    >
      {isAvailableBrandAsset(asset) && asset.source !== null ? (
        <CroppedBrandImage crop={crop} source={asset.source} width={width} />
      ) : (
        <>
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
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  company: { letterSpacing: 1.2, textTransform: 'uppercase' },
  container: { alignItems: 'flex-start' },
  imageFrame: { overflow: 'hidden', position: 'relative' },
  product: { fontWeight: '900', letterSpacing: -0.7 },
});
