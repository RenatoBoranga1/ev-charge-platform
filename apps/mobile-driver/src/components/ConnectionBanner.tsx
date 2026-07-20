import * as Network from 'expo-network';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';

export function ConnectionBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const { colors } = useAppTheme();

  useEffect(() => {
    let mounted = true;
    void Network.getNetworkStateAsync().then((state) => {
      if (mounted) setIsOffline(state.isInternetReachable === false);
    });
    const subscription = Network.addNetworkStateListener((state) => {
      setIsOffline(state.isInternetReachable === false);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  if (!isOffline) return null;

  return (
    <Text
      accessibilityLiveRegion="assertive"
      style={[styles.banner, { backgroundColor: colors.warning }]}
    >
      Sem internet. Exibindo os últimos dados disponíveis.
    </Text>
  );
}

const styles = StyleSheet.create({
  banner: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textAlign: 'center',
  },
});
