import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { getInitialRoute, useAuth } from '@/auth/AuthProvider';

export default function IndexScreen() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={getInitialRoute(isAuthenticated)} />;
}
