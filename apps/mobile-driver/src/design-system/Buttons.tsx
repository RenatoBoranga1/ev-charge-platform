import type { ComponentProps } from 'react';

import { AppButton } from '@/components/AppButton';

type ButtonProps = Omit<ComponentProps<typeof AppButton>, 'variant'>;

export function PrimaryButton(props: ButtonProps) {
  return <AppButton {...props} variant="primary" />;
}

export function SecondaryButton(props: ButtonProps) {
  return <AppButton {...props} variant="secondary" />;
}

export function OutlinedButton(props: ButtonProps) {
  return <AppButton {...props} variant="outline" />;
}
