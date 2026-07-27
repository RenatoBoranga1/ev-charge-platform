import { useMapStore } from '@/stores/map-store';
import { defaultStationFilters } from '@/utils/station-filters';

describe('map store synchronization', () => {
  beforeEach(() => {
    useMapStore.setState({
      filters: defaultStationFilters,
      searchQuery: '',
      selectedStationId: null,
      sortMode: 'distance',
      viewMode: 'map',
    });
  });

  it('preserves search, selection, sorting and filters between map and list', () => {
    const state = useMapStore.getState();
    state.setSearchQuery('paulista');
    state.setSelectedStationId('station-a');
    state.setSortMode('power');
    state.setViewMode('list');
    state.setFilters({ ...defaultStationFilters, minimumPowerKw: 100 });

    expect(useMapStore.getState()).toMatchObject({
      searchQuery: 'paulista',
      selectedStationId: 'station-a',
      sortMode: 'power',
      viewMode: 'list',
      filters: { minimumPowerKw: 100 },
    });
  });

  it('clears filters without discarding the current view or query', () => {
    useMapStore.setState({
      filters: { ...defaultStationFilters, parkingOnly: true },
      searchQuery: 'centro',
      viewMode: 'list',
    });
    useMapStore.getState().clearFilters();

    expect(useMapStore.getState()).toMatchObject({
      filters: defaultStationFilters,
      searchQuery: 'centro',
      viewMode: 'list',
    });
  });
});
