import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type ToggleKey =
  | 'chargingNotifications'
  | 'promotions'
  | 'reservationAlerts'
  | 'favoriteStationAlerts'
  | 'emailReceipts'
  | 'dataSaver';

interface PreferencesState {
  hideCableReminder: boolean;
  chargingNotifications: boolean;
  promotions: boolean;
  reservationAlerts: boolean;
  favoriteStationAlerts: boolean;
  emailReceipts: boolean;
  dataSaver: boolean;
  setHideCableReminder: (value: boolean) => void;
  toggle: (key: ToggleKey) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      hideCableReminder: false,
      chargingNotifications: true,
      promotions: false,
      reservationAlerts: true,
      favoriteStationAlerts: true,
      emailReceipts: true,
      dataSaver: false,
      setHideCableReminder: (hideCableReminder) => set({ hideCableReminder }),
      toggle: (key) => set((state) => ({ [key]: !state[key] })),
    }),
    {
      name: 'solis-preferences',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
