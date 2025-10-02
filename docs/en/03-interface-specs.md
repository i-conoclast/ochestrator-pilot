# Interface Specifications

## Roles & Responsibilities

| Level | Role | Responsibilities |
|-------|------|------------------|
| **L1 Orchestrator** | User Interface & Policy Manager | - Parse CLI arguments & load configuration<br>- Apply security/resource policies<br>- Create run directory & aggregate logs<br>- Call L2 & aggregate results<br>- Generate Markdown report |
| **L2 Coordinator** | Task Decomposition & Planner | - Decompose high-level task into DAG/Staged Plan via Claude Code<br>- Resolve dependencies (topological sort)<br>- Generate L3 task messages<br>- Replan on partial failures (optional) |
| **L3 Worker** | Concrete Tool Executor | - Execute only whitelisted tools<br>- Capture stdout/stderr & store artifacts<br>- Retry logic (exponential backoff)<br>- Collect execution metrics (duration, exit_code) |

## Message/Task JSON Schema

```json
{
  "task_id": "string (UUID)",
  "parent_id": "string (UUID | null)",
  "level": "1 | 2 | 3",
  "intent": "string (user request or detailed task description)",
  "inputs": {
    "args": ["string"],
    "env": {"KEY": "value"},
    "files": [{"path": "string", "content": "string"}]
  },
  "tools": ["string (whitelisted tool name)"],
  "constraints": {
    "max_duration_sec": "number",
    "max_retries": "number",
    "concurrency": "number",
    "sandbox": {"fs": "read-only | rw", "net": "allow | deny"}
  },
  "state": "planned | running | blocked | done | failed",
  "retries": "number (current retry count)",
  "logs": [
    {
      "timestamp": "ISO8601",
      "level": "info | warn | error",
      "message": "string",
      "payload": {}
    }
  ],
  "artifacts": [
    {"path": "string", "size_bytes": "number", "checksum": "string"}
  ],
  "metrics": {
    "duration_ms": "number",
    "exit_code": "number | null",
    "tokens_used": "number | null"
  },
  "timestamps": {
    "created_at": "ISO8601",
    "started_at": "ISO8601 | null",
    "completed_at": "ISO8601 | null"
  }
}
```

## Configuration File: `orchestra.config.yaml`

```yaml
# orchestra.config.yaml
version: "1.0"

policies:
  allow_network: false          # Deny network by default
  default_fs_mode: "read-only"  # Filesystem read-only by default
  max_task_duration_sec: 300
  max_total_duration_sec: 1800

whitelist_tools:
  - echo
  - ls
  - cat
  - node
  - python
  - poetry
  - pnpm
  - git
  # Tools not in whitelist are denied

llm:
  backend: "claude_code"  # Fixed
  model: "claude-sonnet-4-5-20250929"
  prompts:
    planner: |
      You are L2 Coordinator. Given this task:
      {intent}

      Constraints: {constraints}

      Produce a JSON array of sub-tasks with dependencies. Each task must:
      - have unique task_id
      - specify tools from whitelist: {whitelist_tools}
      - declare dependencies (parent_id or depends_on[])

      Output only valid JSON, no explanation.
    summarizer: |
      You are L1 Orchestrator. Summarize this run:
      Tasks: {tasks_summary}
      Artifacts: {artifacts_list}

      Produce a concise Markdown report.

retries:
  max: 2
  backoff_base_sec: 2  # exponential: 2, 4, 8...

concurrency:
  max_workers: 4  # Maximum parallel L3 workers

paths:
  runs: "./runs"
  logs: "./runs/{run_id}/tasks.jsonl"
  artifacts: "./runs/{run_id}/artifacts"
  report: "./runs/{run_id}/report.md"

security:
  fs:
    allow_read: ["./", "/tmp"]
    allow_write: ["./runs"]
  net:
    allow_domains: []  # Empty array = deny all network
  redact_secrets: true  # Auto-mask API keys, tokens in logs

telemetry:
  level: "info"  # debug | info | warn | error
  format: "jsonl"
  trace_id_header: "X-Orchestra-Trace-ID"
```

## Inter-Layer Communication Protocol

### L1 → L2 Request
```json
{
  "intent": "string (user's high-level task)",
  "constraints": {
    "max_duration_sec": 1800,
    "whitelist_tools": ["echo", "ls", "node"]
  },
  "config": {
    "llm": {...},
    "policies": {...}
  }
}
```

### L2 → L1 Response
```json
{
  "plan_id": "UUID",
  "tasks": [
    {"task_id": "...", "intent": "...", "tools": [...], "depends_on": [...]},
    ...
  ],
  "dag": {
    "nodes": ["task-001", "task-002"],
    "edges": [["task-001", "task-002"]]
  }
}
```

### L2 → L3 Task Assignment
```json
{
  "task_id": "UUID",
  "tools": ["echo"],
  "inputs": {
    "args": ["Hello", "World"]
  },
  "constraints": {
    "max_duration_sec": 30,
    "max_retries": 2
  }
}
```

### L3 → L2 Result
```json
{
  "task_id": "UUID",
  "state": "done | failed",
  "logs": [...],
  "artifacts": [...],
  "metrics": {
    "duration_ms": 150,
    "exit_code": 0
  }
}
```

## State Machine

### Task States
- `planned`: Task created, not yet started
- `running`: L3 worker executing
- `blocked`: Waiting for dependencies
- `done`: Successfully completed
- `failed`: Failed after retries exhausted

### State Transitions
```
planned → running → done
       ↓         ↘ failed
     blocked
```
