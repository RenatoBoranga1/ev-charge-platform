import { CorrelationIdMiddleware } from '../src/common/correlation-id.middleware';
import type { CorrelatedRequest } from '../src/common/correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  const middleware = new CorrelationIdMiddleware();

  it('preserves a bounded incoming correlation id', () => {
    const request = {
      header: jest.fn().mockReturnValue('trace-123'),
    } as unknown as CorrelatedRequest;
    const setHeader = jest.fn();
    const next = jest.fn();

    middleware.use(request, { setHeader } as never, next);
    expect(request.correlationId).toBe('trace-123');
    expect(setHeader).toHaveBeenCalledWith('x-correlation-id', 'trace-123');
    expect(next).toHaveBeenCalled();
  });

  it('generates an id when the incoming value is unsafe', () => {
    const request = {
      header: jest.fn().mockReturnValue('x'.repeat(129)),
    } as unknown as CorrelatedRequest;
    const setHeader = jest.fn();

    middleware.use(request, { setHeader } as never, jest.fn());
    expect(request.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
