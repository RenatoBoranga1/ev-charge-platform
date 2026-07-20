import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { isDevelopmentCatalogEnabled } from '@/config/runtime';
import { AppProviders } from '@/providers/AppProviders';
import { useAppTheme } from '@/theme/ThemeProvider';

function NavigationRoot() {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors, isDark } = useAppTheme();

  if (isLoading) {
    return (
      <View
        accessibilityLabel="Restaurando sessão"
        style={[styles.loading, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ConnectionBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="station/[stationId]/reserve" />
        </Stack.Protected>
        <Stack.Protected
          guard={isAuthenticated && isDevelopmentCatalogEnabled()}
        >
          <Stack.Screen name="dev/components" />
        </Stack.Protected>
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <AppProviders>
          <NavigationRoot />
        </AppProviders>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  root: { flex: 1 },
});
