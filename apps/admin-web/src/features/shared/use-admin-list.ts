import type { CursorPage } from '@solis/admin-contracts';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

import { useAdminSession } from '../../auth/session-store';
import { adminRequest } from '../../services/api';

export function useAdminList<T extends { id: string }>(
  resource: string,
  endpoint: string,
) {
  const tenantId = useAdminSession((state) => state.session?.membership.tenantId ?? '');
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status') ?? '';
  const cursor = searchParams.get('cursor') ?? '';
  const params = new URLSearchParams({ limit: '25' });
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (cursor) params.set('cursor', cursor);
  const query = useQuery({
    queryFn: ({ signal }) =>
      adminRequest<CursorPage<T>>(`${endpoint}?${params.toString()}`, { signal }),
    queryKey: ['admin', tenantId, resource, search, status, cursor],
  });

  function updateFilter(key: 'search' | 'status', value: string): void {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('cursor');
      return next;
    }, { replace: true });
  }

  return {
    cursor,
    query,
    search,
    setCursor: (value: string) =>
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (value) next.set('cursor', value);
        else next.delete('cursor');
        return next;
      }),
    status,
    updateFilter,
  };
}
