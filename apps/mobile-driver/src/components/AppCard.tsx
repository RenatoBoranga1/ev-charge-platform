import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { Card } from '@/design-system/Card';

interface AppCardProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
}

export function AppCard({ children, style }: AppCardProps) {
  return <Card style={style}>{children}</Card>;
}
