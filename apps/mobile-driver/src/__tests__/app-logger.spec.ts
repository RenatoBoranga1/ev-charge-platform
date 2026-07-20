import { AppLogger, Logger, type LogSink } from '@/logging/AppLogger';

describe('Logger', () => {
  const sink: jest.Mocked<LogSink> = {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
  const logger = new Logger(sink);

  it('delegates informational and warning events', () => {
    logger.info('ready', { port: 8000 });
    logger.warn('retry');
    expect(sink.info).toHaveBeenCalledWith('ready', { port: 8000 });
    expect(sink.warn).toHaveBeenCalledWith('retry', undefined);
  });

  it('normalizes Error values without logging secrets', () => {
    logger.error('request.failed', new TypeError('boom'), { status: 500 });
    expect(sink.error).toHaveBeenCalledWith('request.failed', {
      errorMessage: 'boom',
      errorName: 'TypeError',
      status: 500,
    });
  });

  it('writes through the default console sink', () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    AppLogger.info('info');
    AppLogger.warn('warn', { retry: true });
    AppLogger.error('error', new Error('boom'));

    expect(info).toHaveBeenCalledWith('info', {});
    expect(warn).toHaveBeenCalledWith('warn', { retry: true });
    expect(error).toHaveBeenCalled();
    info.mockRestore();
    warn.mockRestore();
    error.mockRestore();
  });

  it('normalizes unknown thrown values', () => {
    logger.error('request.failed', 'offline');
    expect(sink.error).toHaveBeenCalledWith('request.failed', {
      errorMessage: 'offline',
      errorName: 'UnknownError',
    });
  });
});
