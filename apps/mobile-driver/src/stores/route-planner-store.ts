import { create } from 'zustand';

import type { RoutePlannerResult } from '@/types/domain';

interface RoutePlannerState {
  result: RoutePlannerResult | null;
  setResult: (result: RoutePlannerResult | null) => void;
}

export const useRoutePlannerStore = create<RoutePlannerState>((set) => ({
  result: null,
  setResult: (result) => set({ result }),
}));
