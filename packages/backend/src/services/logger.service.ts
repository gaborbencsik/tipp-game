type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

function resolveMinLevel(): number {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase()
  if (raw in LEVEL_ORDER) return LEVEL_ORDER[raw as LogLevel]
  return LEVEL_ORDER.info
}

const MIN_LEVEL = resolveMinLevel()

function emit(level: LogLevel, scope: string, message: string, fields?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < MIN_LEVEL) return
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
  }
  if (fields) Object.assign(entry, fields)
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout
  stream.write(JSON.stringify(entry) + '\n')
}

export interface ILogger {
  debug(message: string, fields?: Record<string, unknown>): void
  info(message: string, fields?: Record<string, unknown>): void
  warn(message: string, fields?: Record<string, unknown>): void
  error(message: string, fields?: Record<string, unknown>): void
  child(extraScope: string): ILogger
}

export function createLogger(scope: string): ILogger {
  return {
    debug: (msg, f) => emit('debug', scope, msg, f),
    info:  (msg, f) => emit('info', scope, msg, f),
    warn:  (msg, f) => emit('warn', scope, msg, f),
    error: (msg, f) => emit('error', scope, msg, f),
    child: (extra) => createLogger(`${scope}.${extra}`),
  }
}
