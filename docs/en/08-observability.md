# Observability & Telemetry

## Logging Architecture

### JSONL Log Format

All logs are emitted in JSON Lines (JSONL) format for easy parsing and analysis.

#### Schema

```typescript
interface LogEntry {
  timestamp: string;      // ISO8601
  trace_id: string;       // UUID for entire run
  task_id?: string;       // UUID for specific task (optional)
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

#### Example Logs

```jsonl
{"timestamp":"2025-10-02T14:30:00.000Z","trace_id":"abc-123","task_id":null,"level":"info","component":"L1","message":"Run started","payload":{"intent":"Create README"}}
{"timestamp":"2025-10-02T14:30:00.100Z","trace_id":"abc-123","task_id":"task-001","level":"info","component":"L3","message":"Tool execution","payload":{"tool":"echo","args":["Hello"]}}
{"timestamp":"2025-10-02T14:30:00.200Z","trace_id":"abc-123","task_id":"task-001","level":"info","component":"L3","message":"Tool completed","payload":{"duration_ms":50,"exit_code":0}}
```

### Log Levels

| Level | Usage | Examples |
|-------|-------|----------|
| **debug** | Detailed diagnostic information | - LLM prompts/responses<br>- Internal state transitions<br>- Dependency resolution steps |
| **info** | Normal operational events | - Task started/completed<br>- Plan generation<br>- Artifact creation |
| **warn** | Warning conditions | - Retry attempts<br>- Deprecated tool usage<br>- Performance degradation |
| **error** | Error events | - Task failures<br>- Configuration errors<br>- Policy violations |

## Trace ID Propagation

### Implementation

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

### Usage

```typescript
// L1 Orchestrator sets trace ID at start
const runId = uuid();
setTraceId(runId);

// All subsequent logs automatically include trace_id
log('info', 'Task started'); // trace_id populated automatically
```

### Trace ID Flow

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

## Run Directory Structure

Each execution creates a timestamped directory under `./runs/`:

```
./runs/{timestamp}/
├── config.yaml          # Configuration snapshot
├── plan.json            # L2 generated plan (DAG)
├── tasks.jsonl          # All task execution logs
├── artifacts/           # Output files from L3 workers
│   ├── README.md
│   └── lint_output.txt
├── metrics.json         # Aggregated metrics
└── report.md            # Human-readable summary
```

### Directory Naming

- Format: `YYYYMMDDTHHmmss` (e.g., `20251002T143025`)
- Sorted chronologically
- Unique per run

### File Descriptions

| File | Purpose | Format |
|------|---------|--------|
| `config.yaml` | Frozen config used for this run | YAML |
| `plan.json` | Task DAG and metadata | JSON |
| `tasks.jsonl` | Task-level execution logs | JSONL |
| `artifacts/` | Generated files and outputs | Various |
| `metrics.json` | Performance and success metrics | JSON |
| `report.md` | Summary report for user | Markdown |

## Metrics Collection

### Task Metrics

```typescript
interface TaskMetrics {
  duration_ms: number;        // Wall-clock time
  exit_code: number | null;   // Process exit code
  tokens_used: number | null; // LLM tokens (L2 only)
  retry_count: number;        // Number of retries
  artifacts_count: number;    // Files created
}
```

### Run Metrics

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

### Example `metrics.json`

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

## Markdown Run Report

### Template

```markdown
# Orchestra Run Report

**Run ID**: {run_id}
**Started**: {started_at}
**Completed**: {completed_at}
**Duration**: {duration_sec}s

---

## 📋 Task Summary

**Input**: {intent}

**Planned Tasks**: {total_tasks}
**Succeeded**: {success_count} ✅
**Failed**: {failure_count} ❌
**Retried**: {retry_count} 🔄

---

## 🗂️ Task Details

| ID | Description | Tools | State | Duration |
|----|-------------|-------|-------|----------|
{for task in tasks}
| {task.task_id} | {task.intent} | {task.tools} | {task.state} | {task.metrics.duration_ms}ms |
{endfor}

---

## 📦 Artifacts

{for artifact in artifacts}
- `{artifact.path}` ({artifact.size_bytes} bytes, {artifact.checksum})
{endfor}

---

## 📊 Metrics

- **Average Task Duration**: {avg_duration_ms}ms
- **LLM Tokens Used**: {total_tokens} (L2 planning)
- **Retry Rate**: {retry_rate}%

---

## 🔍 Logs

Full logs: `./runs/{run_id}/tasks.jsonl`

{if failures}
**Failed Task Logs**:
{for failed_task in failures}
- **{failed_task.task_id}**: {failed_task.logs[-1].message}
{endfor}
{endif}
```

### Example Output

```markdown
# Orchestra Run Report

**Run ID**: abc-123
**Started**: 2025-10-02T14:30:00.000Z
**Completed**: 2025-10-02T14:30:05.500Z
**Duration**: 5.5s

---

## 📋 Task Summary

**Input**: Create a README.md and run lint

**Planned Tasks**: 3
**Succeeded**: 3 ✅
**Failed**: 0 ❌
**Retried**: 1 🔄

---

## 🗂️ Task Details

| ID | Description | Tools | State | Duration |
|----|-------------|-------|-------|----------|
| task-001 | Create README skeleton | echo | done | 120ms |
| task-002 | Write description | echo | done | 180ms |
| task-003 | Run lint | node | done | 250ms |

---

## 📦 Artifacts

- `artifacts/README.md` (512 bytes, sha256:abc...)
- `artifacts/lint_output.txt` (128 bytes, sha256:def...)

---

## 📊 Metrics

- **Average Task Duration**: 183ms
- **LLM Tokens Used**: 1250 (L2 planning)
- **Retry Rate**: 33.3%

---

## 🔍 Logs

Full logs: `./runs/20251002T143000/tasks.jsonl`
```

## Query & Analysis

### Log Querying with `jq`

```bash
# Get all failed tasks
cat ./runs/*/tasks.jsonl | jq 'select(.level == "error")'

# Calculate average duration
cat ./runs/*/tasks.jsonl | jq -s 'map(.payload.duration_ms) | add/length'

# Find tasks using specific tool
cat ./runs/*/tasks.jsonl | jq 'select(.payload.tool == "pnpm")'

# Group by trace_id
cat ./runs/*/tasks.jsonl | jq -s 'group_by(.trace_id)'
```

### Log Aggregation

For production deployments, logs can be ingested into:
- **Elasticsearch**: Full-text search and visualization
- **Loki**: Log aggregation with Grafana
- **CloudWatch/Datadog**: Cloud monitoring platforms

### Example Elasticsearch Query

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

## Real-time Monitoring

### Streaming Logs

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

### Usage

```typescript
streamLogs('./runs/20251002T143000', (entry) => {
  if (entry.level === 'error') {
    console.error(`[ERROR] ${entry.message}`, entry.payload);
  }
});
```

## Alerting

### Alert Rules

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
      // Send notification (email, Slack, etc.)
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

## Debugging Tools

### Trace Viewer (CLI)

```bash
orchestra trace <run_id>
```

Displays chronological event timeline with color-coded levels.

### Task Inspector

```bash
orchestra inspect <run_id> <task_id>
```

Shows detailed task information:
- Full logs
- Input/output
- Artifacts created
- Retry history
- Performance metrics
