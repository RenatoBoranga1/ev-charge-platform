import type { ComponentProps } from 'react';

import { Card } from '@/design-system/Card';

type AppCardProps = ComponentProps<typeof Card>;

export function AppCard(props: AppCardProps) {
  return <Card {...props} />;
}
