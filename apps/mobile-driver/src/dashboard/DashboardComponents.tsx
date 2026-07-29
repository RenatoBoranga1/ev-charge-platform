import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppTextField } from '@/components/AppTextField';
import { EmptyState, ErrorState } from '@/components/AsyncState';
import { FilterChip } from '@/components/FilterChip';
import { BrandHero } from '@/design-system';
import { Skeleton } from '@/design-system/Loading';
import { Tag } from '@/design-system/Indicators';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { ChargingHistoryItem, DashboardData, DashboardQuery } from '@/types/domain';
import { formatDateTime, formatDuration } from '@/utils/format';

import { customPeriodQuery, type DashboardPeriodPreset } from './periods';

export function DashboardHeader({ name }: { name: string }) {
  const { colors } = useAppTheme();
  return (
    <BrandHero
      compact
      eyebrow="Sua energia"
      title={name}
      description="Acompanhe sua mobilidade elétrica com clareza."
      trailing={
        <Ionicons
          accessibilityElementsHidden
          color={colors.primary}
          name="flash-outline"
          size={30}
        />
      }
    />
  );
}

export function DashboardGreeting({ name }: { name: string }) {
  const { colors } = useAppTheme();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  return (
    <View>
      <Text style={[styles.eyebrow, { color: colors.textMuted }]}>{greeting}</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {name}
      </Text>
    </View>
  );
}

interface PeriodSelectorProps {
  onChange(preset: DashboardPeriodPreset, query?: DashboardQuery): void;
  selected: DashboardPeriodPreset;
}

export function DashboardPeriodSelector({ onChange, selected }: PeriodSelectorProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | undefined>();

  const applyCustom = () => {
    try {
      onChange('CUSTOM', customPeriodQuery(from, to));
      setError(undefined);
    } catch (periodError: unknown) {
      setError(periodError instanceof Error ? periodError.message : 'Período inválido.');
    }
  };

  return (
    <View accessibilityLabel="Selecionar período do dashboard" style={styles.gap}>
      <View style={styles.chips}>
        <FilterChip
          label="Mês atual"
          onPress={() => onChange('CURRENT_MONTH')}
          selected={selected === 'CURRENT_MONTH'}
        />
        <FilterChip
          label="7 dias"
          onPress={() => onChange('LAST_7_DAYS')}
          selected={selected === 'LAST_7_DAYS'}
        />
        <FilterChip
          label="30 dias"
          onPress={() => onChange('LAST_30_DAYS')}
          selected={selected === 'LAST_30_DAYS'}
        />
        <FilterChip
          label="Personalizado"
          onPress={() => onChange('CUSTOM')}
          selected={selected === 'CUSTOM'}
        />
      </View>
      {selected === 'CUSTOM' ? (
        <View style={styles.customPeriod}>
          <AppTextField
            error={error}
            label="Data inicial"
            onChangeText={setFrom}
            placeholder="AAAA-MM-DD"
            value={from}
          />
          <AppTextField
            label="Data final"
            onChangeText={setTo}
            placeholder="AAAA-MM-DD"
            value={to}
          />
          <AppButton
            accessibilityHint="Atualiza os indicadores usando o intervalo informado"
            label="Aplicar período"
            onPress={applyCustom}
            variant="outline"
          />
        </View>
      ) : null}
    </View>
  );
}

export function PrimaryVehicleSummary({ vehicle }: { vehicle: DashboardData['primaryVehicle'] }) {
  const { colors } = useAppTheme();
  if (!vehicle) {
    return (
      <AppCard accessibilityLabel="Nenhum veículo principal definido">
        <Text style={[styles.cardTitle, { color: colors.text }]}>Veículo principal</Text>
        <Text style={{ color: colors.textMuted }}>Defina um veículo principal na garagem.</Text>
      </AppCard>
    );
  }
  return (
    <AppCard
      accessibilityLabel={`Veículo principal ${vehicle.nickname}, ${vehicle.brand} ${vehicle.model}`}
    >
      <View style={styles.row}>
        <Ionicons color={colors.primary} name="car-sport-outline" size={28} />
        <View style={styles.flex}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{vehicle.nickname}</Text>
          <Text style={{ color: colors.textMuted }}>
            {vehicle.brand} {vehicle.model}
            {vehicle.year ? ` · ${vehicle.year}` : ''}
          </Text>
        </View>
        <Tag label={`${vehicle.batteryCapacityKwh} kWh`} tone="primary" />
      </View>
    </AppCard>
  );
}

interface SummaryCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}

function SummaryCard({ icon, label, value }: SummaryCardProps) {
  const { colors } = useAppTheme();
  return (
    <AppCard accessibilityLabel={`${label}: ${value}`} style={styles.summaryCard}>
      <Ionicons color={colors.primary} name={icon} size={24} />
      <Text style={[styles.metric, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
    </AppCard>
  );
}

export function MonthlySummaryCard({ value }: { value: number }) {
  return <SummaryCard icon="calendar-outline" label="Sessões" value={String(value)} />;
}

export function EnergySummaryCard({ value }: { value: number }) {
  return <SummaryCard icon="flash-outline" label="Energia" value={`${value.toFixed(2)} kWh`} />;
}

export function SessionsSummaryCard({ value }: { value: number }) {
  return <SummaryCard icon="time-outline" label="Tempo de recarga" value={formatDuration(value)} />;
}

export function SavingsSummaryCard({ value }: { value: number | null }) {
  return value === null ? null : (
    <SummaryCard
      icon="wallet-outline"
      label="Economia estimada"
      value={`${value.toFixed(2)} BRL`}
    />
  );
}

export function Co2SummaryCard({ value }: { value: number | null }) {
  return value === null ? null : (
    <SummaryCard
      icon="leaf-outline"
      label="CO₂ evitado estimado"
      value={`${value.toFixed(2)} kg`}
    />
  );
}

export function LastChargingSessionCard({
  session,
  onPress,
}: {
  onPress(): void;
  session: ChargingHistoryItem;
}) {
  const { colors } = useAppTheme();
  return (
    <AppCard
      accessibilityLabel={`Última recarga em ${session.station.name}, ${session.energyKwh} quilowatt-hora`}
      onPress={onPress}
    >
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Última recarga</Text>
          <Text style={[styles.sessionStation, { color: colors.text }]}>
            {session.station.name}
          </Text>
          <Text style={{ color: colors.textMuted }}>
            {formatDateTime(session.startedAt)} · {session.energyKwh.toFixed(2)} kWh
          </Text>
        </View>
        <Ionicons color={colors.primary} name="chevron-forward" size={24} />
      </View>
    </AppCard>
  );
}

export function FavoriteStationCard({ station }: { station: DashboardData['mostUsedStation'] }) {
  const { colors } = useAppTheme();
  if (!station) return null;
  return (
    <AppCard
      accessibilityLabel={`Estação mais utilizada ${station.name}, ${station.sessionCount} sessões`}
    >
      <Text style={[styles.cardTitle, { color: colors.text }]}>Estação mais utilizada</Text>
      <Text style={[styles.sessionStation, { color: colors.text }]}>{station.name}</Text>
      <Text style={{ color: colors.textMuted }}>
        {station.city ? `${station.city} · ` : ''}
        {station.sessionCount} sessões · {station.energyKwh.toFixed(2)} kWh
      </Text>
    </AppCard>
  );
}

export function QuickActions({
  onCharge,
  onGarage,
  onHistory,
  onMap,
}: {
  onCharge(): void;
  onGarage(): void;
  onHistory(): void;
  onMap(): void;
}) {
  return (
    <View accessibilityLabel="Ações rápidas" style={styles.actions}>
      <AppButton label="Mapa" onPress={onMap} variant="outline" />
      <AppButton label="Histórico" onPress={onHistory} variant="outline" />
      <AppButton label="Garagem" onPress={onGarage} variant="outline" />
      <AppButton label="Iniciar recarga" onPress={onCharge} />
    </View>
  );
}

export function DashboardSkeleton() {
  return (
    <View accessibilityLabel="Carregando dashboard" style={styles.gap}>
      <Skeleton height={72} />
      <View style={styles.summaryGrid}>
        <Skeleton height={130} width="48%" />
        <Skeleton height={130} width="48%" />
      </View>
      <Skeleton height={150} />
      <Skeleton height={120} />
    </View>
  );
}

export function DashboardEmptyState({ onMap }: { onMap(): void }) {
  return (
    <EmptyState
      actionLabel="Encontrar uma estação"
      message="Quando você concluir uma recarga, os indicadores aparecerão aqui."
      onAction={onMap}
      title="Seu dashboard está pronto"
    />
  );
}

export function DashboardErrorState({ message, onRetry }: { message: string; onRetry(): void }) {
  return (
    <ErrorState
      actionLabel="Tentar novamente"
      message={message}
      onAction={onRetry}
      title="Não foi possível carregar o dashboard"
    />
  );
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: '800', marginBottom: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  customPeriod: { gap: 10 },
  eyebrow: { fontSize: 14, fontWeight: '600' },
  flex: { flex: 1 },
  gap: { gap: 14 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: { fontSize: 23, fontWeight: '900' },
  metricLabel: { fontSize: 13, lineHeight: 18 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  sessionStation: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  summaryCard: { flex: 1, gap: 5, minWidth: 145 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  title: { fontSize: 28, fontWeight: '900' },
});
