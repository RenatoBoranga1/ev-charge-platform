export type LogContext = Readonly<Record<string, unknown>>;

export interface LogSink {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

class ConsoleLogSink implements LogSink {
  info(message: string, context?: LogContext): void {
    console.info(message, context ?? {});
  }

  warn(message: string, context?: LogContext): void {
    console.warn(message, context ?? {});
  }

  error(message: string, context?: LogContext): void {
    console.error(message, context ?? {});
  }
}

export class Logger {
  constructor(private readonly sink: LogSink) {}

  info(message: string, context?: LogContext): void {
    this.sink.info(message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.sink.warn(message, context);
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    this.sink.error(message, {
      ...context,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}

export const AppLogger = new Logger(new ConsoleLogSink());
