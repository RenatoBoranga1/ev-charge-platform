import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { AppTextField } from '@/components/AppTextField';
import { EmptyState, ErrorState } from '@/components/AsyncState';
import { FilterChip } from '@/components/FilterChip';
import { Skeleton } from '@/design-system/Loading';
import { Tag } from '@/design-system/Indicators';
import { dashboardPeriodQuery } from '@/dashboard/periods';
import { useAppTheme } from '@/theme/ThemeProvider';
import type {
  ChargingHistoryFilters as HistoryFilters,
  ChargingHistoryItem as HistoryItem,
  ChargingHistorySort as HistorySort,
  ChargingSessionMetricsData,
  ChargingSessionTimelineData,
  ChargingUiStatus,
  Vehicle,
} from '@/types/domain';
import { formatDateTime, formatDuration, formatMoney } from '@/utils/format';

const statusLabels: Record<ChargingUiStatus, string> = {
  authorized: 'Autorizada',
  cancelled: 'Cancelada',
  charging: 'Carregando',
  completed: 'Concluída',
  failed: 'Falhou',
  pending: 'Pendente',
  starting: 'Iniciando',
  stopping: 'Encerrando',
};

const timelineLabels: Record<ChargingSessionTimelineData['events'][number]['type'], string> = {
  authorized: 'Sessão autorizada',
  cancelled: 'Sessão cancelada',
  charging_started: 'Carregamento iniciado',
  completed: 'Sessão concluída',
  created: 'Sessão criada',
  failed: 'Sessão falhou',
  first_measurement: 'Primeira medição recebida',
  starting: 'Comando de início enviado',
  stopping: 'Encerramento solicitado',
};

function statusTone(status: ChargingUiStatus) {
  if (status === 'completed') return 'success' as const;
  if (status === 'failed') return 'danger' as const;
  if (status === 'cancelled') return 'warning' as const;
  return 'info' as const;
}

export const ChargingHistoryItem = memo(function ChargingHistoryItem({
  item,
  onPress,
}: {
  item: HistoryItem;
  onPress(): void;
}) {
  const { colors } = useAppTheme();
  const cost = item.cost ? formatMoney(item.cost.amount, item.cost.currency) : null;
  return (
    <AppCard
      accessibilityLabel={`${item.station.name}, ${formatDateTime(
        item.startedAt,
      )}, ${item.energyKwh} quilowatt-hora, ${statusLabels[item.status]}${cost ? `, ${cost}` : ''}`}
      onPress={onPress}
      style={styles.historyCard}
    >
      <View style={styles.row}>
        <View style={[styles.historyIcon, { backgroundColor: colors.primaryContainer }]}>
          <Ionicons name="flash-outline" color={colors.primary} size={22} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.station, { color: colors.text }]}>{item.station.name}</Text>
          <Text style={{ color: colors.textMuted }}>
            {item.station.city} · {formatDateTime(item.startedAt)}
          </Text>
        </View>
        <Tag label={statusLabels[item.status]} tone={statusTone(item.status)} />
      </View>
      <View style={styles.metrics}>
        <HistoryMetric
          icon="flash-outline"
          label="Energia"
          value={`${item.energyKwh.toFixed(2)} kWh`}
        />
        <HistoryMetric
          icon="time-outline"
          label="Duração"
          value={formatDuration(item.durationSeconds)}
        />
        {cost ? <HistoryMetric icon="receipt-outline" label="Custo" value={cost} /> : null}
      </View>
      <Text style={{ color: colors.textMuted }}>
        {item.vehicle.nickname} · {item.connector.label}
      </Text>
      {item.failureReason ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {item.failureReason}
        </Text>
      ) : null}
    </AppCard>
  );
});

function HistoryMetric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View accessibilityLabel={`${label}: ${value}`} style={styles.historyMetric}>
      <Ionicons name={icon} color={colors.primary} size={15} />
      <Text style={[styles.historyMetricText, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export function HistoryPeriodFilter({
  onChange,
}: {
  onChange(period: Pick<HistoryFilters, 'from' | 'timezone' | 'to'>): void;
}) {
  const [selected, setSelected] = useState<'MONTH' | '7' | '30'>('30');
  const select = (value: 'MONTH' | '7' | '30') => {
    setSelected(value);
    const preset =
      value === 'MONTH' ? 'CURRENT_MONTH' : value === '7' ? 'LAST_7_DAYS' : 'LAST_30_DAYS';
    onChange(dashboardPeriodQuery(preset));
  };
  return (
    <View style={styles.chips}>
      <FilterChip label="Mês" onPress={() => select('MONTH')} selected={selected === 'MONTH'} />
      <FilterChip label="7 dias" onPress={() => select('7')} selected={selected === '7'} />
      <FilterChip label="30 dias" onPress={() => select('30')} selected={selected === '30'} />
    </View>
  );
}

export function HistoryVehicleFilter({
  onChange,
  selected,
  vehicles,
}: {
  onChange(vehicleId?: string): void;
  selected?: string;
  vehicles: Vehicle[];
}) {
  return (
    <View style={styles.chips}>
      <FilterChip label="Todos os veículos" onPress={() => onChange()} selected={!selected} />
      {vehicles.map((vehicle) => (
        <FilterChip
          key={vehicle.id}
          label={vehicle.nickname}
          onPress={() => onChange(vehicle.id)}
          selected={selected === vehicle.id}
        />
      ))}
    </View>
  );
}

export function HistoryStationFilter({
  onChange,
  value,
}: {
  onChange(value: string): void;
  value: string;
}) {
  return (
    <AppTextField
      label="Buscar estação ou cidade"
      onChangeText={onChange}
      placeholder="Ex.: Solis Centro"
      returnKeyType="search"
      value={value}
    />
  );
}

export function HistoryStatusFilter({
  onChange,
  selected,
}: {
  onChange(status?: ChargingUiStatus): void;
  selected?: ChargingUiStatus;
}) {
  const options: [ChargingUiStatus, string][] = [
    ['pending', 'Pendente'],
    ['authorized', 'Autorizada'],
    ['starting', 'Iniciando'],
    ['charging', 'Carregando'],
    ['stopping', 'Encerrando'],
    ['completed', 'Concluída'],
    ['failed', 'Falhou'],
    ['cancelled', 'Cancelada'],
  ];
  return (
    <View style={styles.chips}>
      <FilterChip label="Todos os status" onPress={() => onChange()} selected={!selected} />
      {options.map(([status, label]) => (
        <FilterChip
          key={status}
          label={label}
          onPress={() => onChange(status)}
          selected={selected === status}
        />
      ))}
    </View>
  );
}

export function HistoryConnectorFilter({
  onChange,
  selected,
}: {
  onChange(value?: HistoryFilters['connectorType']): void;
  selected?: HistoryFilters['connectorType'];
}) {
  return (
    <View style={styles.chips}>
      <FilterChip label="Todos os conectores" onPress={() => onChange()} selected={!selected} />
      <FilterChip label="CCS2" onPress={() => onChange('CCS2')} selected={selected === 'CCS2'} />
      <FilterChip
        label="Tipo 2"
        onPress={() => onChange('TYPE_2')}
        selected={selected === 'TYPE_2'}
      />
      <FilterChip
        label="CHAdeMO"
        onPress={() => onChange('CHADEMO')}
        selected={selected === 'CHADEMO'}
      />
    </View>
  );
}

export function ChargingHistorySort({
  onChange,
  selected,
}: {
  onChange(sort: HistorySort): void;
  selected: HistorySort;
}) {
  const options: [HistorySort, string][] = [
    ['RECENT', 'Mais recentes'],
    ['OLDEST', 'Mais antigas'],
    ['ENERGY_DESC', 'Maior energia'],
    ['ENERGY_ASC', 'Menor energia'],
    ['DURATION_DESC', 'Maior duração'],
    ['DURATION_ASC', 'Menor duração'],
    ['COST_DESC', 'Maior custo'],
    ['COST_ASC', 'Menor custo'],
  ];
  return (
    <View accessibilityLabel="Ordenar histórico" style={styles.chips}>
      {options.map(([value, label]) => (
        <FilterChip
          key={value}
          label={label}
          onPress={() => onChange(value)}
          selected={selected === value}
        />
      ))}
    </View>
  );
}

export function ChargingHistoryFilters({
  filters,
  onChange,
  vehicles,
}: {
  filters: HistoryFilters;
  onChange(filters: HistoryFilters): void;
  vehicles: Vehicle[];
}) {
  const omitFilter = (
    key: 'completedOnly' | 'connectorType' | 'failuresOnly' | 'status' | 'vehicleId' | 'withCost',
  ): HistoryFilters => {
    const next = { ...filters };
    delete next[key];
    return next;
  };
  return (
    <View accessibilityLabel="Filtros do histórico" style={styles.filterGroup}>
      <HistoryPeriodFilter onChange={(period) => onChange({ ...filters, ...period })} />
      <HistoryStationFilter
        onChange={(search) => onChange({ ...filters, search })}
        value={filters.search ?? ''}
      />
      <HistoryVehicleFilter
        onChange={(vehicleId) =>
          onChange(vehicleId ? { ...filters, vehicleId } : omitFilter('vehicleId'))
        }
        {...(filters.vehicleId ? { selected: filters.vehicleId } : {})}
        vehicles={vehicles}
      />
      <HistoryStatusFilter
        onChange={(status) => onChange(status ? { ...filters, status } : omitFilter('status'))}
        {...(filters.status ? { selected: filters.status } : {})}
      />
      <HistoryConnectorFilter
        onChange={(connectorType) =>
          onChange(connectorType ? { ...filters, connectorType } : omitFilter('connectorType'))
        }
        {...(filters.connectorType ? { selected: filters.connectorType } : {})}
      />
      <ChargingHistorySort
        onChange={(sort) => onChange({ ...filters, sort })}
        selected={filters.sort}
      />
      <View accessibilityLabel="Filtros rápidos" style={styles.chips}>
        <FilterChip
          label="Com custo"
          onPress={() =>
            onChange(filters.withCost ? omitFilter('withCost') : { ...filters, withCost: true })
          }
          selected={filters.withCost === true}
        />
        <FilterChip
          label="Somente falhas"
          onPress={() =>
            onChange(
              filters.failuresOnly
                ? omitFilter('failuresOnly')
                : { ...filters, failuresOnly: true },
            )
          }
          selected={filters.failuresOnly === true}
        />
        <FilterChip
          label="Somente concluídas"
          onPress={() =>
            onChange(
              filters.completedOnly
                ? omitFilter('completedOnly')
                : { ...filters, completedOnly: true },
            )
          }
          selected={filters.completedOnly === true}
        />
      </View>
    </View>
  );
}

export function ChargingHistorySkeleton() {
  return (
    <View accessibilityLabel="Carregando histórico" style={styles.filterGroup}>
      <Skeleton height={80} />
      <Skeleton height={150} />
      <Skeleton height={150} />
      <Skeleton height={150} />
    </View>
  );
}

export function ChargingHistoryEmptyState() {
  return (
    <EmptyState
      message="Ajuste os filtros ou conclua sua primeira recarga."
      title="Nenhuma sessão encontrada"
    />
  );
}

export function ChargingHistoryErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry(): void;
}) {
  return (
    <ErrorState
      actionLabel="Tentar novamente"
      message={message}
      onAction={onRetry}
      title="Não foi possível carregar o histórico"
    />
  );
}

export function ChargingSessionTimeline({ data }: { data: ChargingSessionTimelineData }) {
  const { colors } = useAppTheme();
  return (
    <View accessibilityLabel="Linha do tempo da sessão" style={styles.timeline}>
      {data.events.map((event, index) => (
        <View key={`${event.type}-${event.occurredAt}`} style={styles.timelineRow}>
          <View style={[styles.dot, { backgroundColor: colors.chartSecondary }]} />
          <View style={styles.flex}>
            <Text style={[styles.timelineTitle, { color: colors.text }]}>
              {timelineLabels[event.type]}
            </Text>
            <Text style={{ color: colors.textMuted }}>{formatDateTime(event.occurredAt)}</Text>
          </View>
          {index < data.events.length - 1 ? (
            <View style={[styles.line, { backgroundColor: colors.chartGrid }]} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function ChargingSessionEnergyChart({ data }: { data: ChargingSessionMetricsData }) {
  const { colors } = useAppTheme();
  const maxPower = Math.max(1, ...data.points.map((point) => point.powerKw ?? 0));
  if (data.points.length < 2) {
    return (
      <Text style={{ color: colors.textMuted }}>
        Não há medições históricas suficientes para exibir o gráfico.
      </Text>
    );
  }
  const description = `Gráfico com ${data.points.length} pontos. Potência máxima ${
    data.summary.maximumPowerKw ?? 0
  } quilowatts e potência média ${data.summary.averagePowerKw ?? 0} quilowatts.`;
  return (
    <View style={styles.chartGroup}>
      <View
        accessibilityLabel={description}
        accessibilityRole="image"
        accessible
        style={[
          styles.chart,
          {
            borderBottomColor: colors.chartGrid,
            borderTopColor: colors.chartGrid,
          },
        ]}
      >
        {data.points.map((point) => (
          <View
            key={point.sampledAt}
            style={[
              styles.bar,
              {
                backgroundColor: colors.chartPrimary,
                height: 12 + ((point.powerKw ?? 0) / maxPower) * 76,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.chartSummary, { color: colors.chartAxis }]}>
        Máxima {data.summary.maximumPowerKw ?? 0} kW · Média {data.summary.averagePowerKw ?? 0} kW ·{' '}
        {data.summary.returnedPointCount} pontos
      </Text>
    </View>
  );
}

export function ChargingHistoryList({ children }: { children: ReactNode }) {
  return <View style={styles.list}>{children}</View>;
}

const styles = StyleSheet.create({
  bar: { borderRadius: 3, flex: 1, minWidth: 3 },
  chart: {
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 3,
    height: 100,
    paddingTop: 8,
  },
  chartGroup: { gap: 9 },
  chartSummary: { fontSize: 12, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dot: { borderRadius: 6, height: 12, marginTop: 5, width: 12 },
  filterGroup: { gap: 12 },
  flex: { flex: 1 },
  historyCard: { gap: 10, marginBottom: 10 },
  line: { height: 34, left: 5, position: 'absolute', top: 18, width: 2 },
  historyIcon: {
    alignItems: 'center',
    borderRadius: 15,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  historyMetric: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    minHeight: 32,
    paddingHorizontal: 9,
  },
  historyMetricText: { fontSize: 13, fontWeight: '800' },
  list: { gap: 10 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  station: { fontSize: 17, fontWeight: '800' },
  timeline: { gap: 2 },
  timelineRow: { flexDirection: 'row', gap: 12, minHeight: 54, position: 'relative' },
  timelineTitle: { fontSize: 15, fontWeight: '700' },
});
