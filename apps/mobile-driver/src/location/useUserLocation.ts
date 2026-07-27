import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { locationService, type LocationService } from './LocationService';
import type {
  LocationFailure,
  LocationPermissionState,
  UserCoordinates,
} from './types';

interface UserLocationState {
  coordinates: UserCoordinates | null;
  error: LocationFailure | null;
  loading: boolean;
  permission: LocationPermissionState;
}

const initialPermission: LocationPermissionState = {
  status: 'not-requested',
  precision: 'unknown',
  canAskAgain: true,
};

export function useUserLocation(service: LocationService = locationService) {
  const [state, setState] = useState<UserLocationState>({
    coordinates: null,
    error: null,
    loading: true,
    permission: initialPermission,
  });
  const mountedRef = useRef(true);
  const operationRef = useRef<AbortController | null>(null);
  const watchStopRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    operationRef.current?.abort();
    operationRef.current = null;
    watchStopRef.current?.();
    watchStopRef.current = null;
  }, []);

  const startWatch = useCallback(
    async (controller: AbortController) => {
      const watch = await service.watchLocation((result) => {
        if (!mountedRef.current || controller.signal.aborted) return;
        if (result.ok) {
          setState((current) => ({
            ...current,
            coordinates: result.coordinates,
            error: null,
            permission: {
              status: 'granted',
              precision: result.precision,
              canAskAgain: true,
            },
          }));
        }
      }, controller.signal);
      if (watch.ok && mountedRef.current && !controller.signal.aborted) {
        watchStopRef.current = watch.handle.stop;
      }
    },
    [service],
  );

  const locate = useCallback(
    async (requestPermission: boolean) => {
      stop();
      const controller = new AbortController();
      operationRef.current = controller;
      if (mountedRef.current) {
        setState((current) => ({ ...current, loading: true, error: null }));
      }
      const result = await service.requestCurrentLocation({
        requestPermission,
        signal: controller.signal,
      });
      if (!mountedRef.current || controller.signal.aborted) return result;

      const permission = await service.getPermissionState();
      if (!mountedRef.current || controller.signal.aborted) return result;
      if (result.ok) {
        setState({
          coordinates: result.coordinates,
          error: null,
          loading: false,
          permission,
        });
        void startWatch(controller);
      } else {
        setState((current) => ({
          ...current,
          error: result.error,
          loading: false,
          permission,
        }));
      }
      return result;
    },
    [service, startWatch, stop],
  );

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    operationRef.current = controller;
    void (async () => {
      const permission = await service.getPermissionState();
      if (!mountedRef.current || controller.signal.aborted) return;
      setState((current) => ({ ...current, permission, loading: false }));
      if (permission.status === 'granted') {
        void locate(false);
      }
    })();

    return () => {
      mountedRef.current = false;
      controller.abort();
      stop();
    };
  }, [locate, service, stop]);

  const refresh = useCallback(() => locate(false), [locate]);
  const requestPermission = useCallback(() => locate(true), [locate]);
  return {
    ...state,
    refresh,
    requestPermission,
    stop,
  };
}
