import { create } from 'zustand';

import type { StationFilters } from '@/types/domain';
import { defaultStationFilters } from '@/utils/station-filters';

interface MapState {
  selectedStationId: string | null;
  filters: StationFilters;
  setSelectedStationId: (stationId: string | null) => void;
  setFilters: (filters: StationFilters) => void;
  clearFilters: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  selectedStationId: null,
  filters: defaultStationFilters,
  setSelectedStationId: (selectedStationId) => set({ selectedStationId }),
  setFilters: (filters) => set({ filters }),
  clearFilters: () => set({ filters: defaultStationFilters }),
}));
