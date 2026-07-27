import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { DynamicColorSeed, ThemeMode } from '@/theme/design-tokens';

type ToggleKey =
  | 'chargingNotifications'
  | 'promotions'
  | 'reservationAlerts'
  | 'favoriteStationAlerts'
  | 'emailReceipts'
  | 'dataSaver';

interface PreferencesState {
  themeMode: ThemeMode;
  dynamicColorSeed: DynamicColorSeed;
  hideCableReminder: boolean;
  chargingNotifications: boolean;
  promotions: boolean;
  reservationAlerts: boolean;
  favoriteStationAlerts: boolean;
  emailReceipts: boolean;
  dataSaver: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setDynamicColorSeed: (seed: DynamicColorSeed) => void;
  setHideCableReminder: (value: boolean) => void;
  toggle: (key: ToggleKey) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      dynamicColorSeed: 'solis',
      hideCableReminder: false,
      chargingNotifications: true,
      promotions: false,
      reservationAlerts: true,
      favoriteStationAlerts: true,
      emailReceipts: true,
      dataSaver: false,
      setThemeMode: (themeMode) => set({ themeMode }),
      setDynamicColorSeed: (dynamicColorSeed) => set({ dynamicColorSeed }),
      setHideCableReminder: (hideCableReminder) => set({ hideCableReminder }),
      toggle: (key) => set((state) => ({ [key]: !state[key] })),
    }),
    {
      name: 'solis-preferences',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
