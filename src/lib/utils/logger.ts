import { Bindings } from "../../types";
import { Toucan } from "toucan-js";

type logLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;

const LevelWeights: Record<logLevel, number> = {
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

function shouldLog(env: Bindings, level: logLevel): boolean {
  const runtimeEnv = env.RUNTIME_ENV || 'dev';
  const minLevel = runtimeEnv === 'prod' ? 'info' : 'debug';
  return LevelWeights[level] >= LevelWeights[minLevel];
}

function initSentry(
  env: Bindings, 
  request?: Request, 
  ctx?: ExecutionContext
): Toucan | null {
  if (!env.SENTRY_DSN) return null;
  
  return new Toucan({
    dsn: env.SENTRY_DSN,
    environment: env.RUNTIME_ENV || 'dev',
    request,
    context: ctx,
    tracesSampleRate: env.RUNTIME_ENV === 'prod' ? 0.1 : 1.0,
  });
}

export function createLogger(
  env: Bindings, 
  request?: Request, 
  ctx?: ExecutionContext
) {
  const sentry = initSentry(env, request, ctx);
  const runtimeEnv = env.RUNTIME_ENV || 'dev';

  function log(level: logLevel, message: string, context?: LogContext) {
    if (!shouldLog(env, level)) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context || {}),
    };

    if (sentry) {
      if (context) {
        sentry.setExtras(context);
      }
      if (level === 'error') {
        sentry.captureException(new Error(message));
      } else if (level === 'warn') {
        sentry.captureMessage(message, 'warning');
      }
    }

    if (runtimeEnv === 'dev') {
      const emoji = {
        debug: '🔍',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
      }[level];
      console.log(`${emoji} [${level.toUpperCase()}] ${message}`, context || '');
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  return {
    debug: (message: string, context?: LogContext) => log('debug', message, context),
    info: (message: string, context?: LogContext) => log('info', message, context),
    warn: (message: string, context?: LogContext) => log('warn', message, context),
    error: (message: string, context?: LogContext) => log('error', message, context),
  };
}
