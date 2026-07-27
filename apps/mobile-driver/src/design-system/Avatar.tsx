import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';

interface AvatarProps {
  accessibilityLabel?: string;
  name: string;
  size?: number;
  source?: ImageSourcePropType;
}

const initialsFor = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

export function Avatar({
  accessibilityLabel,
  name,
  size = 48,
  source,
}: AvatarProps) {
  const { colors, radii } = useAppTheme();

  return (
    <View
      accessibilityLabel={accessibilityLabel ?? `Avatar de ${name}`}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: radii.pill,
          backgroundColor: colors.primaryContainer,
        },
      ]}
    >
      {source ? (
        <Image source={source} style={styles.image} />
      ) : (
        <Text
          style={{
            color: colors.onPrimaryContainer,
            fontSize: Math.max(12, size * 0.34),
            fontWeight: '800',
          }}
        >
          {initialsFor(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
