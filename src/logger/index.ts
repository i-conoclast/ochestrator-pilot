import { AsyncLocalStorage } from 'async_hooks';
import { appendFileSync } from 'fs';
import type { LogEntry } from '../types/task.js';

const traceContext = new AsyncLocalStorage<string>();

export function setTraceId(id: string): void {
  traceContext.enterWith(id);
}

export function getTraceId(): string {
  return traceContext.getStore() || 'unknown';
}

export function log(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  payload: Record<string, any> = {},
  component: 'L1' | 'L2' | 'L3' = 'L1',
  taskId?: string
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    trace_id: getTraceId(),
    task_id: taskId,
    level,
    component,
    message,
    payload,
  };

  // Output to stderr as JSONL
  console.error(JSON.stringify(entry));
}

export function logToFile(path: string, entry: object): void {
  appendFileSync(path, JSON.stringify(entry) + '\n', 'utf-8');
}
