type LogLevel = 'debug' | 'info' | 'silent'

const WEIGHTS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  silent: 2,
}

function normalizeLogLevel(value: unknown): LogLevel {
  if (value === 'debug' || value === 'info' || value === 'silent')
    return value
  return 'info'
}

function canLog(currentLevel: LogLevel, targetLevel: Exclude<LogLevel, 'silent'>): boolean {
  return WEIGHTS[targetLevel] >= WEIGHTS[currentLevel] && currentLevel !== 'silent'
}

export function createLogger(rawLevel: unknown) {
  const level = normalizeLogLevel(rawLevel)

  return {
    debug(message: string, context?: Record<string, unknown>) {
      if (!canLog(level, 'debug'))
        return
      if (context)
        console.log(message, context)
      else
        console.log(message)
    },
    info(message: string, context?: Record<string, unknown>) {
      if (!canLog(level, 'info'))
        return
      if (context)
        console.log(message, context)
      else
        console.log(message)
    },
    warn(message: string, context?: Record<string, unknown>) {
      if (level === 'silent')
        return
      if (context)
        console.warn(message, context)
      else
        console.warn(message)
    },
    error(message: string, context?: Record<string, unknown>) {
      if (level === 'silent')
        return
      if (context)
        console.error(message, context)
      else
        console.error(message)
    },
  }
}
