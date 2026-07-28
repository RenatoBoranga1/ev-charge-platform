import { useLocalSearchParams } from 'expo-router';

import { ChargingSessionDetailsScreen } from '@/history/ChargingSessionDetailsScreen';

export default function ChargingSessionDetailsRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  return <ChargingSessionDetailsScreen sessionId={sessionId ?? ''} />;
}
