import { Linking, Platform } from 'react-native';

export interface ExternalRouteDestination {
  address?: string | null;
  label?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ExternalRouteLinks {
  primary: string;
  fallback: string;
}

export type ExternalRouteResult =
  | { ok: true; openedUrl: string }
  | {
      ok: false;
      code: 'missing-destination' | 'unavailable' | 'cancelled';
    };

interface ExternalRouteAdapter {
  canOpenURL: (url: string) => Promise<boolean>;
  openURL: (url: string) => Promise<unknown>;
}

const routeQuery = (
  destination: ExternalRouteDestination,
): string | null => {
  const hasCoordinates =
    Number.isFinite(destination.latitude) &&
    Number.isFinite(destination.longitude);
  if (hasCoordinates) {
    const coordinates = `${destination.latitude},${destination.longitude}`;
    return destination.label
      ? `${coordinates} (${destination.label.trim()})`
      : coordinates;
  }
  const address = destination.address?.trim();
  return address || null;
};

export function buildExternalRouteLinks(
  destination: ExternalRouteDestination,
  platform: 'android' | 'ios',
): ExternalRouteLinks | null {
  const query = routeQuery(destination);
  if (!query) return null;
  const encoded = encodeURIComponent(query);
  const web = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;

  return {
    primary:
      platform === 'ios'
        ? `maps://?daddr=${encoded}&dirflg=d`
        : `google.navigation:q=${encoded}&mode=d`,
    fallback: web,
  };
}

export async function openExternalRoute(
  destination: ExternalRouteDestination,
  options: {
    adapter?: ExternalRouteAdapter;
    platform?: 'android' | 'ios';
  } = {},
): Promise<ExternalRouteResult> {
  const platform =
    options.platform ?? (Platform.OS === 'ios' ? 'ios' : 'android');
  const links = buildExternalRouteLinks(destination, platform);
  if (!links) return { ok: false, code: 'missing-destination' };
  const adapter = options.adapter ?? Linking;

  try {
    if (await adapter.canOpenURL(links.primary)) {
      await adapter.openURL(links.primary);
      return { ok: true, openedUrl: links.primary };
    }
    if (await adapter.canOpenURL(links.fallback)) {
      await adapter.openURL(links.fallback);
      return { ok: true, openedUrl: links.fallback };
    }
    return { ok: false, code: 'unavailable' };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    return {
      ok: false,
      code: message.includes('cancel') ? 'cancelled' : 'unavailable',
    };
  }
}
