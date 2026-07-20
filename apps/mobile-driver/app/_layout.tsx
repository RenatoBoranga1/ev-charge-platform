import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConnectionBanner } from '@/components/ConnectionBanner';
import { AppProviders } from '@/providers/AppProviders';
import { useAppTheme } from '@/theme/ThemeProvider';

function NavigationRoot() {
  const { isDark } = useAppTheme();

  return (
    <View style={{ flex: 1 }}>
      <ConnectionBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="station/[stationId]/reserve" />
        <Stack.Screen name="dev/components" />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProviders>
        <NavigationRoot />
      </AppProviders>
    </SafeAreaProvider>
  );
}
