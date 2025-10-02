export interface Task {
  task_id: string;
  parent_id: string | null;
  level: 1 | 2 | 3;
  intent: string;
  inputs: {
    args: string[];
    env: Record<string, string>;
    files: Array<{ path: string; content: string }>;
  };
  tools: string[];
  constraints: {
    max_duration_sec: number;
    max_retries: number;
    concurrency: number;
    sandbox: {
      fs: 'read-only' | 'rw';
      net: 'allow' | 'deny';
    };
  };
  state: 'planned' | 'running' | 'blocked' | 'done' | 'failed';
  retries: number;
  logs: Array<{
    timestamp: string;
    level: string;
    message: string;
    payload: any;
  }>;
  artifacts: Array<{
    path: string;
    size_bytes: number;
    checksum: string;
  }>;
  metrics: {
    duration_ms?: number;
    exit_code?: number;
    tokens_used?: number;
  };
  timestamps: {
    created_at: string;
    started_at?: string;
    completed_at?: string;
  };
}

export interface ExecutionResult {
  exit_code: number;
  duration_ms: number;
  stdout: string;
  stderr: string;
}

export interface LogEntry {
  timestamp: string;
  trace_id: string;
  task_id?: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  component: 'L1' | 'L2' | 'L3';
  message: string;
  payload?: Record<string, any>;
}
