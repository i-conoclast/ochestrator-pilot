# 코드 스캐폴딩 (TypeScript + pnpm)

## 프로젝트 구조

```
orchestra-cli/
├── src/
│   ├── cli/
│   │   ├── index.ts          # CLI 진입점
│   │   └── commands.ts        # 서브커맨드 (run, agent, eval)
│   ├── config/
│   │   ├── loader.ts          # YAML 로더
│   │   └── schema.ts          # Zod 검증 스키마
│   ├── logger/
│   │   └── index.ts           # JSONL 로거 + trace_id
│   ├── l1/
│   │   ├── orchestrator.ts    # L1 메인 로직
│   │   ├── policy.ts          # 정책 엔진
│   │   └── reporter.ts        # Markdown 보고서 생성기
│   ├── l2/
│   │   ├── coordinator.ts     # L2 메인 로직
│   │   ├── llm_adapter.ts     # Claude Code 클라이언트
│   │   └── dag.ts             # DAG 생성 및 위상 정렬
│   ├── l3/
│   │   ├── worker.ts          # L3 메인 로직
│   │   ├── executor.ts        # subprocess 래퍼
│   │   └── retry.ts           # 백오프를 사용한 재시도 로직
│   ├── types/
│   │   └── task.ts            # 태스크 메시지 타입
│   └── index.ts               # 라이브러리 진입점
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

## 패키지 설정

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

## 핵심 구현 스텁

### `src/cli/index.ts` (CLI 진입점)

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

### `src/config/schema.ts` (Zod 스키마)

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

### `src/config/loader.ts` (설정 로더)

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

### `src/logger/index.ts` (JSONL 로거)

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

  // stderr로 JSONL 출력
  console.error(JSON.stringify(entry));

  // 파일 로깅은 L1에서 처리
}

export function logToFile(path: string, entry: object) {
  appendFileSync(path, JSON.stringify(entry) + '\n', 'utf-8');
}
```

### `src/types/task.ts` (태스크 타입)

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

  // TODO: run 디렉토리 생성
  // TODO: 정책 검증

  const coordinator = new Coordinator(config);
  const plan = await coordinator.createPlan(intent, config.whitelist_tools);

  if (options.planOnly) {
    log('info', 'Plan-only mode (--plan-only)');
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  // TODO: L3 태스크 실행, 결과 집계, 보고서 생성
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

### `src/l2/llm_adapter.ts` (Claude Code 어댑터)

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

  // TODO: 실제 Claude Code API 통합
  // 지금은 더미 응답 반환
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

### `src/l3/executor.ts` (도구 실행기)

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

## 최소 실행 가능 예제

### 설치 및 빌드

```bash
# 프로젝트 초기화
mkdir orchestra-cli && cd orchestra-cli
pnpm init

# 의존성 설치
pnpm add commander yaml zod uuid
pnpm add -D typescript @types/node @types/uuid vitest

# 스캐폴딩 파일 복사 (위에서)
# ...

# 빌드
pnpm build

# 로컬 테스트용 링크
pnpm link --global
```

### Plan-Only 실행

```bash
orchestra run "Create README" --plan-only
```

### 예상 출력

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
