import { normalizeManualConnectorCode } from '@/utils/manual-code';

describe('normalizeManualConnectorCode', () => {
  it('normalizes a valid manual code', () => {
    expect(normalizeManualConnectorCode(' solis-001-a ')).toBe('SOLIS-001-A');
  });

  it('rejects an invalid code', () => {
    expect(() => normalizeManualConnectorCode('001-A')).toThrow();
  });
});
