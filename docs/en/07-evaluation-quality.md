# Evaluation & Quality Assurance

## Testing Strategy

### Test Pyramid

```
        /\
       /  \      E2E Tests (5%)
      /____\     - Full workflow scenarios
     /      \    - Golden test fixtures
    /________\   Integration Tests (25%)
   /          \  - L1→L2→L3 interactions
  /____________\ - Component integration
 /              \ Unit Tests (70%)
/________________\ - Individual modules
                   - Pure functions
```

## Test Matrix

| Test Type | Target | Tools | Coverage Goal | Files |
|-----------|--------|-------|---------------|-------|
| **Unit** | config, logger, DAG, retry, executor | Vitest | 80%+ | `tests/unit/*.test.ts` |
| **Integration** | L1→L2→L3 end-to-end | Vitest | Main paths 100% | `tests/integration/*.test.ts` |
| **Golden** | Fixed scenarios (fixtures) | YAML + diff | 3+ scenarios | `tests/fixtures/scenarios/*.yaml` |
| **Security** | Whitelist bypass, sandbox escape | Manual + automated | 0 vulnerabilities | `tests/security/*.test.ts` |
| **Performance** | Latency, throughput | Vitest + benchmarks | Baseline metrics | `tests/performance/*.test.ts` |

## Unit Test Examples

### `tests/unit/config.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config/loader';
import { writeFileSync, unlinkSync } from 'fs';

describe('Config Loader', () => {
  const testConfigPath = './test-config.yaml';

  afterEach(() => {
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  it('should load valid config', () => {
    const validConfig = `
version: "1.0"
policies:
  allow_network: false
  default_fs_mode: "read-only"
  max_task_duration_sec: 300
  max_total_duration_sec: 1800
whitelist_tools: [echo, ls]
llm:
  backend: "claude_code"
  model: "claude-sonnet-4-5"
  prompts:
    planner: "test prompt"
    summarizer: "test summary"
retries:
  max: 2
  backoff_base_sec: 2
concurrency:
  max_workers: 4
paths:
  runs: "./runs"
  logs: "./runs/{run_id}/tasks.jsonl"
  artifacts: "./runs/{run_id}/artifacts"
  report: "./runs/{run_id}/report.md"
security:
  fs:
    allow_read: ["./"]
    allow_write: ["./runs"]
  net:
    allow_domains: []
  redact_secrets: true
telemetry:
  level: "info"
  format: "jsonl"
  trace_id_header: "X-Orchestra-Trace-ID"
`;
    writeFileSync(testConfigPath, validConfig);
    const config = loadConfig(testConfigPath);

    expect(config.version).toBe('1.0');
    expect(config.policies.allow_network).toBe(false);
    expect(config.whitelist_tools).toContain('echo');
  });

  it('should reject invalid config', () => {
    const invalidConfig = `
version: "1.0"
policies:
  allow_network: "not a boolean"
`;
    writeFileSync(testConfigPath, invalidConfig);

    expect(() => loadConfig(testConfigPath)).toThrow();
  });
});
```

### `tests/unit/logger.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { setTraceId, getTraceId, log } from '../../src/logger';

describe('Logger', () => {
  it('should set and get trace ID', () => {
    setTraceId('test-trace-123');
    expect(getTraceId()).toBe('test-trace-123');
  });

  it('should log with trace ID', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();

    setTraceId('test-trace-456');
    log('info', 'Test message', { key: 'value' });

    expect(consoleErrorSpy).toHaveBeenCalled();
    const logEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

    expect(logEntry.trace_id).toBe('test-trace-456');
    expect(logEntry.level).toBe('info');
    expect(logEntry.message).toBe('Test message');
    expect(logEntry.payload.key).toBe('value');

    consoleErrorSpy.mockRestore();
  });
});
```

## Integration Test Examples

### `tests/integration/end-to-end.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { orchestrate } from '../../src/l1/orchestrator';
import { existsSync, readFileSync } from 'fs';

describe('End-to-End Execution', () => {
  it('should execute simple task successfully', async () => {
    const options = {
      config: './config/orchestra.config.yaml',
      planOnly: false,
      dryRun: true,
      concurrency: 1,
      out: './test-runs',
    };

    await orchestrate('Create README.md', options);

    // Verify run directory created
    expect(existsSync('./test-runs')).toBe(true);

    // Verify plan.json exists
    const runDirs = readdirSync('./test-runs');
    const latestRun = runDirs.sort().reverse()[0];
    const planPath = `./test-runs/${latestRun}/plan.json`;

    expect(existsSync(planPath)).toBe(true);

    const plan = JSON.parse(readFileSync(planPath, 'utf-8'));
    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0].tools).toBeDefined();
  });

  it('should respect --plan-only flag', async () => {
    const options = {
      config: './config/orchestra.config.yaml',
      planOnly: true,
      out: './test-runs',
    };

    await orchestrate('Build project', options);

    const runDirs = readdirSync('./test-runs');
    const latestRun = runDirs.sort().reverse()[0];

    // Should have plan.json but no execution logs
    expect(existsSync(`./test-runs/${latestRun}/plan.json`)).toBe(true);
    expect(existsSync(`./test-runs/${latestRun}/tasks.jsonl`)).toBe(false);
  });
});
```

## Golden Test Fixtures

### `tests/fixtures/scenarios/simple_readme.yaml`

```yaml
name: "Simple README Creation"
description: "Verify L2 decomposes README generation + lint into 2 steps"

input:
  intent: "Create a README.md with title and run lint"
  config_override:
    whitelist_tools: [echo, ls, node]
    policies:
      allow_network: false

expected_signals:
  plan_tasks_count: 2  # README generation + lint
  task_1_tools: [echo]
  task_2_tools: [node]
  final_state: done
  artifacts_count: 1   # README.md

golden_output:
  report_contains:
    - "✅ All tasks completed"
    - "README.md"
  plan_structure:
    - task_id: "task-001"
      intent_contains: "README"
    - task_id: "task-002"
      intent_contains: "lint"
```

### `tests/fixtures/scenarios/typescript_build.yaml`

```yaml
name: "TypeScript Build Workflow"
description: "Multi-step build: install → typecheck → build → test"

input:
  intent: "Build TypeScript project and run tests"
  config_override:
    whitelist_tools: [pnpm, node]

expected_signals:
  plan_tasks_count: 4
  execution_order:
    - "install dependencies"
    - "type check"
    - "build"
    - "test"
  final_state: done

golden_output:
  report_contains:
    - "4/4 succeeded"
    - "pnpm install"
    - "pnpm build"
```

## Test Validation Logic

### `tests/validation/scenario_validator.ts`

```typescript
import { readFileSync } from 'fs';
import { parse } from 'yaml';

interface Scenario {
  name: string;
  input: {
    intent: string;
    config_override?: any;
  };
  expected_signals: {
    plan_tasks_count?: number;
    final_state?: string;
    artifacts_count?: number;
  };
  golden_output: {
    report_contains?: string[];
    plan_structure?: any[];
  };
}

export function validateScenario(
  scenarioPath: string,
  actualRun: {
    plan: any[];
    final_state: string;
    report: string;
    artifacts: any[];
  }
) {
  const scenario: Scenario = parse(readFileSync(scenarioPath, 'utf-8'));

  // Validate plan task count
  if (scenario.expected_signals.plan_tasks_count !== undefined) {
    expect(actualRun.plan.length).toBe(
      scenario.expected_signals.plan_tasks_count
    );
  }

  // Validate final state
  if (scenario.expected_signals.final_state) {
    expect(actualRun.final_state).toBe(scenario.expected_signals.final_state);
  }

  // Validate report contents
  if (scenario.golden_output.report_contains) {
    for (const phrase of scenario.golden_output.report_contains) {
      expect(actualRun.report).toContain(phrase);
    }
  }

  // Validate artifacts count
  if (scenario.expected_signals.artifacts_count !== undefined) {
    expect(actualRun.artifacts.length).toBe(
      scenario.expected_signals.artifacts_count
    );
  }
}
```

## Offline Determinism & Idempotency

### Determinism Strategy

1. **LLM Configuration**
   - Set temperature to 0
   - Use fixed seed when available
   - Include few-shot examples in prompts

2. **Mock Responses**
   - Mock Claude Code responses in tests
   - Use deterministic fixtures
   - Freeze timestamps in test mode

3. **Input Normalization**
   - Canonicalize whitespace
   - Sort unordered collections
   - Remove non-deterministic metadata

### Idempotency Strategy

1. **State Checks**
   - L3 checks if task already completed before execution
   - Skip operations on unchanged inputs
   - Use checksums for file comparisons

2. **Retry Safety**
   - Retries don't duplicate side effects
   - Failed partial writes are cleaned up
   - Transactional artifact creation

3. **Dry-Run Validation**
   - `--dry-run` prevents all file writes
   - Validates plan without execution
   - Safe for testing in production environments

## Performance Benchmarks

### `tests/performance/benchmarks.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { orchestrate } from '../../src/l1/orchestrator';

describe('Performance Benchmarks', () => {
  it('should complete simple task under 2s', async () => {
    const start = Date.now();

    await orchestrate('echo "test"', {
      config: './config/orchestra.config.yaml',
      dryRun: true,
      concurrency: 1,
    });

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(2000);
  });

  it('should handle 10 parallel tasks efficiently', async () => {
    const start = Date.now();

    await orchestrate('Run 10 echo commands', {
      config: './config/orchestra.config.yaml',
      dryRun: true,
      concurrency: 10,
    });

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000); // Should be < 5s
  });
});
```

## CI/CD Integration

### GitHub Actions Workflow (`.github/workflows/test.yml`)

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - run: pnpm lint

      - run: pnpm test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

      - run: pnpm build
```

## Quality Gates

### Pre-commit Checks
- [ ] All unit tests pass
- [ ] ESLint has no errors
- [ ] Prettier formatting applied
- [ ] Type checking passes (`tsc --noEmit`)

### Pre-release Checks
- [ ] All integration tests pass
- [ ] Coverage ≥ 80%
- [ ] All golden scenarios pass
- [ ] Performance benchmarks within thresholds
- [ ] Security audit clean (`pnpm audit`)
- [ ] Documentation updated
