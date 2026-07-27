import { create } from 'zustand';

import type {
  StationSortMode,
  StationViewMode,
} from '@/stations/discovery';
import type { StationFilters } from '@/types/domain';
import { defaultStationFilters } from '@/utils/station-filters';

interface MapState {
  filters: StationFilters;
  searchQuery: string;
  selectedStationId: string | null;
  sortMode: StationSortMode;
  viewMode: StationViewMode;
  clearFilters: () => void;
  setSearchQuery: (searchQuery: string) => void;
  setSelectedStationId: (stationId: string | null) => void;
  setFilters: (filters: StationFilters) => void;
  setSortMode: (sortMode: StationSortMode) => void;
  setViewMode: (viewMode: StationViewMode) => void;
}

export const useMapStore = create<MapState>((set) => ({
  filters: defaultStationFilters,
  searchQuery: '',
  selectedStationId: null,
  sortMode: 'distance',
  viewMode: 'map',
  clearFilters: () => set({ filters: defaultStationFilters }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedStationId: (selectedStationId) => set({ selectedStationId }),
  setFilters: (filters) => set({ filters }),
  setSortMode: (sortMode) => set({ sortMode }),
  setViewMode: (viewMode) => set({ viewMode }),
}));
