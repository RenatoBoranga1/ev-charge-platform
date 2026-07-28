import { StyleSheet, View } from 'react-native';

import { AppCard } from './AppCard';
import { Skeleton } from '@/design-system';

export function VehicleSkeleton() {
  return (
    <View accessibilityLabel="Carregando veículos" accessibilityLiveRegion="polite">
      {[0, 1, 2].map((item) => (
        <AppCard key={item}>
          <View style={styles.header}>
            <Skeleton height={54} radius={18} width={54} />
            <View style={styles.copy}>
              <Skeleton width="40%" />
              <Skeleton height={24} width="72%" />
            </View>
          </View>
          <Skeleton width="82%" />
          <View style={styles.badges}>
            <Skeleton height={30} radius={15} width={82} />
            <Skeleton height={30} radius={15} width={82} />
          </View>
        </AppCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  copy: { flex: 1, gap: 8 },
  badges: { flexDirection: 'row', gap: 8 },
});
