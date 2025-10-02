# 평가 및 품질 보증

## 테스트 전략

### 테스트 피라미드

```
        /\
       /  \      E2E Tests (5%)
      /____\     - 전체 워크플로우 시나리오
     /      \    - Golden 테스트 픽스처
    /________\   Integration Tests (25%)
   /          \  - L1→L2→L3 상호작용
  /____________\ - 컴포넌트 통합
 /              \ Unit Tests (70%)
/________________\ - 개별 모듈
                   - 순수 함수
```

## 테스트 매트릭스

| 테스트 타입 | 대상 | 도구 | 커버리지 목표 | 파일 |
|-----------|--------|-------|---------------|-------|
| **Unit** | config, logger, DAG, retry, executor | Vitest | 80%+ | `tests/unit/*.test.ts` |
| **Integration** | L1→L2→L3 종단 간 | Vitest | 주요 경로 100% | `tests/integration/*.test.ts` |
| **Golden** | 고정 시나리오 (픽스처) | YAML + diff | 3개 이상 시나리오 | `tests/fixtures/scenarios/*.yaml` |
| **Security** | 화이트리스트 우회, 샌드박스 탈출 | 수동 + 자동화 | 0 취약점 | `tests/security/*.test.ts` |
| **Performance** | 지연시간, 처리량 | Vitest + 벤치마크 | 기준 메트릭 | `tests/performance/*.test.ts` |

## 단위 테스트 예제

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

## 통합 테스트 예제

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

    // run 디렉토리 생성 확인
    expect(existsSync('./test-runs')).toBe(true);

    // plan.json 존재 확인
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

    // plan.json은 있어야 하지만 실행 로그는 없어야 함
    expect(existsSync(`./test-runs/${latestRun}/plan.json`)).toBe(true);
    expect(existsSync(`./test-runs/${latestRun}/tasks.jsonl`)).toBe(false);
  });
});
```

## Golden 테스트 픽스처

### `tests/fixtures/scenarios/simple_readme.yaml`

```yaml
name: "Simple README Creation"
description: "L2가 README 생성 + lint를 2단계로 분해하는지 확인"

input:
  intent: "Create a README.md with title and run lint"
  config_override:
    whitelist_tools: [echo, ls, node]
    policies:
      allow_network: false

expected_signals:
  plan_tasks_count: 2  # README 생성 + lint
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
description: "다단계 빌드: install → typecheck → build → test"

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

## 테스트 검증 로직

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

  // 계획 태스크 수 검증
  if (scenario.expected_signals.plan_tasks_count !== undefined) {
    expect(actualRun.plan.length).toBe(
      scenario.expected_signals.plan_tasks_count
    );
  }

  // 최종 상태 검증
  if (scenario.expected_signals.final_state) {
    expect(actualRun.final_state).toBe(scenario.expected_signals.final_state);
  }

  // 보고서 내용 검증
  if (scenario.golden_output.report_contains) {
    for (const phrase of scenario.golden_output.report_contains) {
      expect(actualRun.report).toContain(phrase);
    }
  }

  // 아티팩트 수 검증
  if (scenario.expected_signals.artifacts_count !== undefined) {
    expect(actualRun.artifacts.length).toBe(
      scenario.expected_signals.artifacts_count
    );
  }
}
```

## 오프라인 결정성 및 멱등성

### 결정성 전략

1. **LLM 설정**
   - temperature를 0으로 설정
   - 가능한 경우 고정 seed 사용
   - 프롬프트에 few-shot 예제 포함

2. **Mock 응답**
   - 테스트에서 Claude Code 응답 모킹
   - 결정적 픽스처 사용
   - 테스트 모드에서 타임스탬프 고정

3. **입력 정규화**
   - 공백 정규화
   - 순서 없는 컬렉션 정렬
   - 비결정적 메타데이터 제거

### 멱등성 전략

1. **상태 체크**
   - L3가 실행 전 태스크 완료 여부 확인
   - 변경되지 않은 입력에 대한 작업 건너뛰기
   - 파일 비교용 체크섬 사용

2. **재시도 안전성**
   - 재시도가 부작용을 중복시키지 않음
   - 실패한 부분 쓰기 정리
   - 트랜잭션 방식 아티팩트 생성

3. **Dry-Run 검증**
   - `--dry-run`이 모든 파일 쓰기 방지
   - 실행 없이 계획 검증
   - 프로덕션 환경에서 테스트 안전

## 성능 벤치마크

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
    expect(duration).toBeLessThan(5000); // 5초 미만이어야 함
  });
});
```

## CI/CD 통합

### GitHub Actions 워크플로우 (`.github/workflows/test.yml`)

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

## 품질 게이트

### Pre-commit 체크
- [ ] 모든 단위 테스트 통과
- [ ] ESLint 에러 없음
- [ ] Prettier 포맷팅 적용
- [ ] 타입 체크 통과 (`tsc --noEmit`)

### Pre-release 체크
- [ ] 모든 통합 테스트 통과
- [ ] 커버리지 ≥ 80%
- [ ] 모든 golden 시나리오 통과
- [ ] 성능 벤치마크 임계값 내
- [ ] 보안 감사 클린 (`pnpm audit`)
- [ ] 문서 업데이트됨
