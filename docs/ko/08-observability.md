# 관찰 가능성 및 Telemetry

## 로깅 아키텍처

### JSONL 로그 형식

모든 로그는 쉬운 파싱 및 분석을 위해 JSON Lines (JSONL) 형식으로 출력됩니다.

#### 스키마

```typescript
interface LogEntry {
  timestamp: string;      // ISO8601
  trace_id: string;       // 전체 실행에 대한 UUID
  task_id?: string;       // 특정 태스크에 대한 UUID (선택 사항)
  level: 'debug' | 'info' | 'warn' | 'error';
  component: 'L1' | 'L2' | 'L3';
  message: string;
  payload?: {
    duration_ms?: number;
    exit_code?: number;
    error?: string;
    [key: string]: any;
  };
}
```

#### 로그 예시

```jsonl
{"timestamp":"2025-10-02T14:30:00.000Z","trace_id":"abc-123","task_id":null,"level":"info","component":"L1","message":"Run started","payload":{"intent":"Create README"}}
{"timestamp":"2025-10-02T14:30:00.100Z","trace_id":"abc-123","task_id":"task-001","level":"info","component":"L3","message":"Tool execution","payload":{"tool":"echo","args":["Hello"]}}
{"timestamp":"2025-10-02T14:30:00.200Z","trace_id":"abc-123","task_id":"task-001","level":"info","component":"L3","message":"Tool completed","payload":{"duration_ms":50,"exit_code":0}}
```

### 로그 레벨

| 레벨 | 사용 | 예시 |
|-------|-------|----------|
| **debug** | 상세 진단 정보 | - LLM 프롬프트/응답<br>- 내부 상태 전환<br>- 의존성 해결 단계 |
| **info** | 일반 운영 이벤트 | - 태스크 시작/완료<br>- 계획 생성<br>- 아티팩트 생성 |
| **warn** | 경고 조건 | - 재시도 시도<br>- 더 이상 사용되지 않는 도구 사용<br>- 성능 저하 |
| **error** | 에러 이벤트 | - 태스크 실패<br>- 설정 에러<br>- 정책 위반 |

## Trace ID 전파

### 구현

```typescript
import { AsyncLocalStorage } from 'async_hooks';

const traceContext = new AsyncLocalStorage<string>();

export function setTraceId(id: string) {
  traceContext.enterWith(id);
}

export function getTraceId(): string {
  return traceContext.getStore() || 'unknown';
}
```

### 사용

```typescript
// L1 Orchestrator가 시작 시 trace ID 설정
const runId = uuid();
setTraceId(runId);

// 이후 모든 로그에 자동으로 trace_id 포함
log('info', 'Task started'); // trace_id 자동 채워짐
```

### Trace ID 흐름

```
User Request
    ↓
L1 generates trace_id (UUID)
    ↓
AsyncLocalStorage.enterWith(trace_id)
    ↓
L1 → L2 (trace_id in context)
    ↓
L2 → L3 (trace_id propagated)
    ↓
All logs include trace_id
```

## Run 디렉토리 구조

각 실행은 `./runs/` 아래에 타임스탬프가 찍힌 디렉토리를 생성합니다:

```
./runs/{timestamp}/
├── config.yaml          # 설정 스냅샷
├── plan.json            # L2가 생성한 계획 (DAG)
├── tasks.jsonl          # 모든 태스크 실행 로그
├── artifacts/           # L3 워커의 출력 파일
│   ├── README.md
│   └── lint_output.txt
├── metrics.json         # 집계된 메트릭
└── report.md            # 사람이 읽을 수 있는 요약
```

### 디렉토리 명명

- 형식: `YYYYMMDDTHHmmss` (예: `20251002T143025`)
- 시간순 정렬
- 실행당 고유

### 파일 설명

| 파일 | 목적 | 형식 |
|------|---------|--------|
| `config.yaml` | 이 실행에 사용된 고정 설정 | YAML |
| `plan.json` | 태스크 DAG 및 메타데이터 | JSON |
| `tasks.jsonl` | 태스크 레벨 실행 로그 | JSONL |
| `artifacts/` | 생성된 파일 및 출력 | 다양함 |
| `metrics.json` | 성능 및 성공 메트릭 | JSON |
| `report.md` | 사용자용 요약 보고서 | Markdown |

## 메트릭 수집

### 태스크 메트릭

```typescript
interface TaskMetrics {
  duration_ms: number;        // 벽시계 시간
  exit_code: number | null;   // 프로세스 종료 코드
  tokens_used: number | null; // LLM 토큰 (L2만)
  retry_count: number;        // 재시도 횟수
  artifacts_count: number;    // 생성된 파일 수
}
```

### Run 메트릭

```typescript
interface RunMetrics {
  total_duration_ms: number;
  tasks_total: number;
  tasks_succeeded: number;
  tasks_failed: number;
  tasks_retried: number;
  avg_task_duration_ms: number;
  total_tokens_used: number;
  artifacts_total_bytes: number;
}
```

### `metrics.json` 예시

```json
{
  "run_id": "abc-123",
  "started_at": "2025-10-02T14:30:00.000Z",
  "completed_at": "2025-10-02T14:30:05.500Z",
  "total_duration_ms": 5500,
  "tasks_total": 3,
  "tasks_succeeded": 3,
  "tasks_failed": 0,
  "tasks_retried": 1,
  "avg_task_duration_ms": 183,
  "total_tokens_used": 1250,
  "artifacts_total_bytes": 4096,
  "tasks": [
    {
      "task_id": "task-001",
      "duration_ms": 120,
      "exit_code": 0,
      "retry_count": 0
    },
    {
      "task_id": "task-002",
      "duration_ms": 180,
      "exit_code": 0,
      "retry_count": 1
    },
    {
      "task_id": "task-003",
      "duration_ms": 250,
      "exit_code": 0,
      "retry_count": 0
    }
  ]
}
```

## Markdown Run 보고서

### 템플릿

```markdown
# Orchestra Run Report

**Run ID**: {run_id}
**Started**: {started_at}
**Completed**: {completed_at}
**Duration**: {duration_sec}s

---

## 📋 태스크 요약

**Input**: {intent}

**Planned Tasks**: {total_tasks}
**Succeeded**: {success_count} ✅
**Failed**: {failure_count} ❌
**Retried**: {retry_count} 🔄

---

## 🗂️ 태스크 세부사항

| ID | Description | Tools | State | Duration |
|----|-------------|-------|-------|----------|
{for task in tasks}
| {task.task_id} | {task.intent} | {task.tools} | {task.state} | {task.metrics.duration_ms}ms |
{endfor}

---

## 📦 아티팩트

{for artifact in artifacts}
- `{artifact.path}` ({artifact.size_bytes} bytes, {artifact.checksum})
{endfor}

---

## 📊 메트릭

- **Average Task Duration**: {avg_duration_ms}ms
- **LLM Tokens Used**: {total_tokens} (L2 planning)
- **Retry Rate**: {retry_rate}%

---

## 🔍 로그

Full logs: `./runs/{run_id}/tasks.jsonl`

{if failures}
**Failed Task Logs**:
{for failed_task in failures}
- **{failed_task.task_id}**: {failed_task.logs[-1].message}
{endfor}
{endif}
```

### 출력 예시

```markdown
# Orchestra Run Report

**Run ID**: abc-123
**Started**: 2025-10-02T14:30:00.000Z
**Completed**: 2025-10-02T14:30:05.500Z
**Duration**: 5.5s

---

## 📋 태스크 요약

**Input**: Create a README.md and run lint

**Planned Tasks**: 3
**Succeeded**: 3 ✅
**Failed**: 0 ❌
**Retried**: 1 🔄

---

## 🗂️ 태스크 세부사항

| ID | Description | Tools | State | Duration |
|----|-------------|-------|-------|----------|
| task-001 | Create README skeleton | echo | done | 120ms |
| task-002 | Write description | echo | done | 180ms |
| task-003 | Run lint | node | done | 250ms |

---

## 📦 아티팩트

- `artifacts/README.md` (512 bytes, sha256:abc...)
- `artifacts/lint_output.txt` (128 bytes, sha256:def...)

---

## 📊 메트릭

- **Average Task Duration**: 183ms
- **LLM Tokens Used**: 1250 (L2 planning)
- **Retry Rate**: 33.3%

---

## 🔍 로그

Full logs: `./runs/20251002T143000/tasks.jsonl`
```

## 쿼리 및 분석

### `jq`로 로그 쿼리하기

```bash
# 실패한 모든 태스크 가져오기
cat ./runs/*/tasks.jsonl | jq 'select(.level == "error")'

# 평균 지속시간 계산
cat ./runs/*/tasks.jsonl | jq -s 'map(.payload.duration_ms) | add/length'

# 특정 도구를 사용하는 태스크 찾기
cat ./runs/*/tasks.jsonl | jq 'select(.payload.tool == "pnpm")'

# trace_id로 그룹화
cat ./runs/*/tasks.jsonl | jq -s 'group_by(.trace_id)'
```

### 로그 집계

프로덕션 배포의 경우 로그를 다음으로 수집할 수 있습니다:
- **Elasticsearch**: 전문 검색 및 시각화
- **Loki**: Grafana와 함께 로그 집계
- **CloudWatch/Datadog**: 클라우드 모니터링 플랫폼

### Elasticsearch 쿼리 예시

```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "component": "L3" } },
        { "range": { "timestamp": { "gte": "2025-10-02T00:00:00Z" } } }
      ]
    }
  },
  "aggs": {
    "avg_duration": {
      "avg": { "field": "payload.duration_ms" }
    }
  }
}
```

## 실시간 모니터링

### 로그 스트리밍

```typescript
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

export function streamLogs(runDir: string, callback: (entry: LogEntry) => void) {
  const logPath = `${runDir}/tasks.jsonl`;
  const stream = createReadStream(logPath);
  const rl = createInterface({ input: stream });

  rl.on('line', (line) => {
    const entry: LogEntry = JSON.parse(line);
    callback(entry);
  });
}
```

### 사용

```typescript
streamLogs('./runs/20251002T143000', (entry) => {
  if (entry.level === 'error') {
    console.error(`[ERROR] ${entry.message}`, entry.payload);
  }
});
```

## 알림

### 알림 규칙

```typescript
interface AlertRule {
  name: string;
  condition: (entry: LogEntry) => boolean;
  action: (entry: LogEntry) => void;
}

const alerts: AlertRule[] = [
  {
    name: 'Task failure rate',
    condition: (entry) => entry.level === 'error' && entry.component === 'L3',
    action: (entry) => {
      console.error(`🚨 Task failed: ${entry.task_id}`);
      // 알림 전송 (이메일, Slack 등)
    },
  },
  {
    name: 'Slow tasks',
    condition: (entry) => entry.payload?.duration_ms > 30000,
    action: (entry) => {
      console.warn(`⚠️  Slow task detected: ${entry.task_id} (${entry.payload.duration_ms}ms)`);
    },
  },
];
```

## 디버깅 도구

### Trace Viewer (CLI)

```bash
orchestra trace <run_id>
```

색상 코드가 있는 레벨과 함께 시간순 이벤트 타임라인을 표시합니다.

### Task Inspector

```bash
orchestra inspect <run_id> <task_id>
```

상세한 태스크 정보를 표시합니다:
- 전체 로그
- 입력/출력
- 생성된 아티팩트
- 재시도 히스토리
- 성능 메트릭
