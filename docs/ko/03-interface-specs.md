# Interface 명세

## 역할과 책임

| 레벨 | 역할 | 책임 |
|-------|------|------------------|
| **L1 Orchestrator** | 사용자 인터페이스 & 정책 관리자 | - CLI 인자 파싱 및 설정 로드<br>- 보안/리소스 정책 적용<br>- run 디렉토리 생성 및 로그 집계<br>- L2 호출 및 결과 집계<br>- Markdown 보고서 생성 |
| **L2 Coordinator** | 태스크 분해 & 플래너 | - Claude Code를 통해 고수준 작업을 DAG/단계별 계획으로 분해<br>- 의존성 해결 (위상 정렬)<br>- L3 태스크 메시지 생성<br>- 부분 실패 시 재계획 (선택 사항) |
| **L3 Worker** | 구체적인 도구 실행자 | - 화이트리스트에 있는 도구만 실행<br>- stdout/stderr 캡처 및 아티팩트 저장<br>- 재시도 로직 (지수 백오프)<br>- 실행 메트릭 수집 (duration, exit_code) |

## 메시지/태스크 JSON 스키마

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

## 설정 파일: `orchestra.config.yaml`

```yaml
# orchestra.config.yaml
version: "1.0"

policies:
  allow_network: false          # 기본적으로 네트워크 거부
  default_fs_mode: "read-only"  # 기본적으로 파일시스템 읽기 전용
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
  # 화이트리스트에 없는 도구는 거부됨

llm:
  backend: "claude_code"  # 고정
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
  max_workers: 4  # 최대 병렬 L3 워커 수

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
    allow_domains: []  # 빈 배열 = 모든 네트워크 거부
  redact_secrets: true  # 로그에서 API 키, 토큰 자동 마스킹

telemetry:
  level: "info"  # debug | info | warn | error
  format: "jsonl"
  trace_id_header: "X-Orchestra-Trace-ID"
```

## 레이어 간 통신 프로토콜

### L1 → L2 요청
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

### L2 → L1 응답
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

### L2 → L3 태스크 할당
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

### L3 → L2 결과
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

## 상태 머신

### 태스크 상태
- `planned`: 태스크 생성됨, 아직 시작 안됨
- `running`: L3 워커 실행 중
- `blocked`: 의존성 대기 중
- `done`: 성공적으로 완료됨
- `failed`: 재시도 소진 후 실패

### 상태 전환
```
planned → running → done
       ↓         ↘ failed
     blocked
```
