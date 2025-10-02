# Code Scaffolding (TypeScript + pnpm)

## Project Structure

```
orchestra-cli/
├── src/
│   ├── cli/
│   │   ├── index.ts          # CLI entry point
│   │   └── commands.ts        # Subcommands (run, agent, eval)
│   ├── config/
│   │   ├── loader.ts          # YAML loader
│   │   └── schema.ts          # Zod validation schemas
│   ├── logger/
│   │   └── index.ts           # JSONL logger + trace_id
│   ├── l1/
│   │   ├── orchestrator.ts    # L1 main logic
│   │   ├── policy.ts          # Policy engine
│   │   └── reporter.ts        # Markdown report generator
│   ├── l2/
│   │   ├── coordinator.ts     # L2 main logic
│   │   ├── llm_adapter.ts     # Claude Code client
│   │   └── dag.ts             # DAG generation & topological sort
│   ├── l3/
│   │   ├── worker.ts          # L3 main logic
│   │   ├── executor.ts        # subprocess wrapper
│   │   └── retry.ts           # Retry logic with backoff
│   ├── types/
│   │   └── task.ts            # Task message types
│   └── index.ts               # Library entry point
├── tests/
│   ├── unit/
│   │   ├── config.test.ts
│   │   ├── logger.test.ts
│   │   ├── l1.test.ts
│   │   ├── l2.test.ts
│   │   └── l3.test.ts
│   ├── integration/
│   │   ├── end-to-end.test.ts
│   │   └── plan-only.test.ts
│   └── fixtures/
│       └── scenarios/
│           ├── simple_readme.yaml
│           └── typescript_build.yaml
├── config/
│   └── orchestra.config.yaml
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
├── vitest.config.ts
└── README.md
```

## Package Configuration

### `package.json`

```json
{
  "name": "orchestra-cli",
  "version": "1.0.0",
  "description": "3-depth agent orchestration CLI powered by Claude Code",
  "type": "module",
  "bin": {
    "orchestra": "./dist/cli/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts",
    "prepublishOnly": "pnpm build"
  },
  "dependencies": {
    "commander": "^11.1.0",
    "yaml": "^2.3.4",
    "zod": "^3.22.4",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/uuid": "^9.0.7",
    "@typescript-eslint/eslint-plugin": "^6.13.0",
    "@typescript-eslint/parser": "^6.13.0",
    "eslint": "^8.54.0",
    "prettier": "^3.1.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0"
  },
  "keywords": [
    "cli",
    "orchestration",
    "agent",
    "automation",
    "llm"
  ],
  "license": "MIT"
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/'],
    },
  },
});
```

## Core Implementation Stubs

### `src/cli/index.ts` (CLI Entry Point)

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { runCommand, agentCommand, evalCommand } from './commands';

const program = new Command();

program
  .name('orchestra')
  .description('3-Depth Agent Orchestration CLI')
  .version('1.0.0');

program
  .command('run <task>')
  .description('Execute a high-level task')
  .option('--plan-only', 'Generate plan only, do not execute')
  .option('--dry-run', 'Simulate execution without running tools')
  .option('--max-depth <n>', 'Agent depth limit', '3')
  .option('--retries <n>', 'Retry count override')
  .option('--concurrency <n>', 'Parallel worker count', '1')
  .option('--out <path>', 'Run directory path', './runs')
  .option('--config <path>', 'Configuration file', './orchestra.config.yaml')
  .action(runCommand);

program
  .command('agent')
  .description('Manage agents')
  .command('ls')
  .description('List all agents')
  .action(agentCommand.list);

program
  .command('agent')
  .command('inspect <level>')
  .description('Inspect agent details')
  .action(agentCommand.inspect);

program
  .command('eval')
  .description('Run evaluation scenarios')
  .command('run <scenario>')
  .option('--report <format>', 'Report format (md|json)', 'md')
  .action(evalCommand.run);

program.parse();
```

### `src/config/schema.ts` (Zod Schemas)

```typescript
import { z } from 'zod';

export const configSchema = z.object({
  version: z.string(),
  policies: z.object({
    allow_network: z.boolean(),
    default_fs_mode: z.enum(['read-only', 'rw']),
    max_task_duration_sec: z.number(),
    max_total_duration_sec: z.number(),
  }),
  whitelist_tools: z.array(z.string()),
  llm: z.object({
    backend: z.literal('claude_code'),
    model: z.string(),
    prompts: z.object({
      planner: z.string(),
      summarizer: z.string(),
    }),
  }),
  retries: z.object({
    max: z.number(),
    backoff_base_sec: z.number(),
  }),
  concurrency: z.object({
    max_workers: z.number(),
  }),
  paths: z.object({
    runs: z.string(),
    logs: z.string(),
    artifacts: z.string(),
    report: z.string(),
  }),
  security: z.object({
    fs: z.object({
      allow_read: z.array(z.string()),
      allow_write: z.array(z.string()),
    }),
    net: z.object({
      allow_domains: z.array(z.string()),
    }),
    redact_secrets: z.boolean(),
  }),
  telemetry: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    format: z.literal('jsonl'),
    trace_id_header: z.string(),
  }),
});

export type Config = z.infer<typeof configSchema>;
```

### `src/config/loader.ts` (Configuration Loader)

```typescript
import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { configSchema, type Config } from './schema';

export function loadConfig(path: string): Config {
  const raw = readFileSync(path, 'utf-8');
  const data = parse(raw);
  return configSchema.parse(data);
}
```

### `src/logger/index.ts` (JSONL Logger)

```typescript
import { AsyncLocalStorage } from 'async_hooks';
import { appendFileSync } from 'fs';

const traceContext = new AsyncLocalStorage<string>();

export function setTraceId(id: string) {
  traceContext.enterWith(id);
}

export function getTraceId(): string {
  return traceContext.getStore() || 'unknown';
}

export function log(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  payload: any = {}
) {
  const entry = {
    timestamp: new Date().toISOString(),
    trace_id: getTraceId(),
    level,
    message,
    payload,
  };

  // Output to stderr as JSONL
  console.error(JSON.stringify(entry));

  // File logging handled by L1
}

export function logToFile(path: string, entry: object) {
  appendFileSync(path, JSON.stringify(entry) + '\n', 'utf-8');
}
```

### `src/types/task.ts` (Task Types)

```typescript
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
```

### `src/l1/orchestrator.ts` (L1 Orchestrator)

```typescript
import { v4 as uuid } from 'uuid';
import { loadConfig } from '../config/loader';
import { setTraceId, log } from '../logger';
import { Coordinator } from '../l2/coordinator';
import { generateReport } from './reporter';
import type { Config } from '../config/schema';
import type { Task } from '../types/task';

export async function orchestrate(intent: string, options: any) {
  const runId = uuid();
  setTraceId(runId);

  log('info', 'L1 Orchestrator started', { intent, options });

  const config = loadConfig(options.config);

  // TODO: Create run directory
  // TODO: Validate policies

  const coordinator = new Coordinator(config);
  const plan = await coordinator.createPlan(intent, config.whitelist_tools);

  if (options.planOnly) {
    log('info', 'Plan-only mode (--plan-only)');
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  // TODO: Execute L3 tasks, aggregate results, generate report
  const report = await generateReport(plan, []);
  console.log(report);
}
```

### `src/l2/coordinator.ts` (L2 Coordinator)

```typescript
import { callClaudeCode } from './llm_adapter';
import { buildDAG } from './dag';
import type { Task } from '../types/task';
import type { Config } from '../config/schema';

export class Coordinator {
  constructor(private config: Config) {}

  async createPlan(intent: string, whitelistTools: string[]): Promise<Task[]> {
    const prompt = this.config.llm.prompts.planner
      .replace('{intent}', intent)
      .replace('{whitelist_tools}', JSON.stringify(whitelistTools))
      .replace('{constraints}', JSON.stringify(this.config.policies));

    const rawPlan = await callClaudeCode(prompt, this.config.llm.model);
    const tasks: Task[] = JSON.parse(rawPlan);

    return buildDAG(tasks);
  }
}
```

### `src/l2/llm_adapter.ts` (Claude Code Adapter)

```typescript
import { log } from '../logger';

export async function callClaudeCode(
  prompt: string,
  model: string
): Promise<string> {
  log('info', 'Calling Claude Code LLM', {
    prompt: prompt.slice(0, 100),
    model
  });

  // TODO: Actual Claude Code API integration
  // For now, return dummy response
  return JSON.stringify([
    {
      task_id: 'task-001',
      parent_id: null,
      level: 3,
      intent: 'echo "Hello" > README.md',
      tools: ['echo'],
      inputs: { args: ['echo', '"Hello"', '>', 'README.md'], env: {}, files: [] },
      constraints: {
        max_duration_sec: 30,
        max_retries: 2,
        concurrency: 1,
        sandbox: { fs: 'rw', net: 'deny' }
      },
      state: 'planned',
      retries: 0,
      logs: [],
      artifacts: [],
      metrics: {},
      timestamps: { created_at: new Date().toISOString() },
    },
  ]);
}
```

### `src/l3/worker.ts` (L3 Worker)

```typescript
import { executeWithRetry } from './retry';
import { runTool } from './executor';
import type { Task } from '../types/task';

export class Worker {
  async execute(task: Task, dryRun: boolean): Promise<Task> {
    if (dryRun) {
      task.state = 'done';
      task.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: '[DRY-RUN] Simulation',
        payload: {},
      });
      return task;
    }

    return executeWithRetry(
      async () => {
        const result = await runTool(task.tools[0], task.inputs.args);
        task.state = result.exit_code === 0 ? 'done' : 'failed';
        task.metrics = {
          duration_ms: result.duration_ms,
          exit_code: result.exit_code,
        };
        return task;
      },
      task.constraints.max_retries
    );
  }
}
```

### `src/l3/executor.ts` (Tool Executor)

```typescript
import { spawn } from 'child_process';

export interface ExecutionResult {
  exit_code: number;
  duration_ms: number;
  stdout: string;
  stderr: string;
}

export async function runTool(
  tool: string,
  args: string[]
): Promise<ExecutionResult> {
  const start = Date.now();

  return new Promise((resolve) => {
    const proc = spawn(tool, args);
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => (stdout += data));
    proc.stderr?.on('data', (data) => (stderr += data));

    proc.on('close', (code) => {
      resolve({
        exit_code: code || 0,
        duration_ms: Date.now() - start,
        stdout,
        stderr,
      });
    });
  });
}
```

## Minimal Runnable Example

### Installation & Build

```bash
# Initialize project
mkdir orchestra-cli && cd orchestra-cli
pnpm init

# Install dependencies
pnpm add commander yaml zod uuid
pnpm add -D typescript @types/node @types/uuid vitest

# Copy scaffolding files (from above)
# ...

# Build
pnpm build

# Link for local testing
pnpm link --global
```

### Run Plan-Only

```bash
orchestra run "Create README" --plan-only
```

### Expected Output

```json
{
  "timestamp": "2025-10-02T14:30:00.000Z",
  "trace_id": "abc-123",
  "level": "info",
  "message": "L1 Orchestrator started",
  "payload": { "intent": "Create README", "options": { "planOnly": true } }
}
{
  "timestamp": "2025-10-02T14:30:00.100Z",
  "trace_id": "abc-123",
  "level": "info",
  "message": "Calling Claude Code LLM",
  "payload": { "prompt": "You are L2 Coordinator...", "model": "claude-sonnet-4-5-20250929" }
}
[
  {
    "task_id": "task-001",
    "parent_id": null,
    "level": 3,
    "intent": "echo \"Hello\" > README.md",
    "tools": ["echo"],
    ...
  }
]
```
