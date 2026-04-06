/**
 * Simple structured JSON step logging for E2E test debugging.
 */

interface LogEntry {
  timestamp: string
  test: string
  step: string
  data?: unknown
}

const logs: LogEntry[] = []

export function logStep(test: string, step: string, data?: unknown): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    test,
    step,
    ...(data !== undefined && { data }),
  }
  logs.push(entry)
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry))
}

export function getLogs(): LogEntry[] {
  return [...logs]
}

export function clearLogs(): void {
  logs.length = 0
}
