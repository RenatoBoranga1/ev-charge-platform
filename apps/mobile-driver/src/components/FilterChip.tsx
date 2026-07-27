import { Chip } from '@/design-system/Chip';

interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
}

export function FilterChip({
  label,
  selected = false,
  onPress,
}: FilterChipProps) {
  return <Chip label={label} onPress={onPress} selected={selected} />;
}
