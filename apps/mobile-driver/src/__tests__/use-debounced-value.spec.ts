import { act, renderHook } from '@testing-library/react-native';

import { useDebouncedValue } from '@/hooks/useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('publishes only the latest value after the configured delay', () => {
    const { result, rerender } = renderHook<string, { value: string }>(
      ({ value }) => useDebouncedValue(value, 250),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'ab' });
    rerender({ value: 'abc' });
    expect(result.current).toBe('a');
    act(() => jest.advanceTimersByTime(249));
    expect(result.current).toBe('a');
    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe('abc');
  });
});
