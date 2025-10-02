# CLI 사용자 경험

## 명령어 & 플래그

### `orchestra run <task> [options]`

Orchestra orchestration 시스템으로 고수준 작업을 실행합니다.

**인자:**
- `<task>`: 실행할 작업에 대한 자연어 설명

**옵션:**
- `--plan-only`: 계획만 생성 (L2), L3 태스크 실행 안함
- `--dry-run`: 실제 실행 없이 모든 도구 실행 시뮬레이션
- `--max-depth <1|2|3>`: 에이전트 깊이 제한 (기본값: 3)
- `--retries <n>`: 재시도 횟수 재정의 (기본값: 설정 파일)
- `--concurrency <n>`: 병렬 L3 워커 수 (기본값: 1)
- `--out <path>`: Run 디렉토리 경로 (기본값: `./runs`)
- `--config <path>`: 설정 파일 경로 (기본값: `./orchestra.config.yaml`)

**예시:**
```bash
# 계획 전용 모드 - 실행될 내용 확인
orchestra run "Create README and lint" --plan-only

# 드라이런 모드 - 실행 시뮬레이션
orchestra run "Setup Python project" --dry-run --concurrency=2

# 사용자 설정으로 완전 실행
orchestra run "Build and test" --config=./custom.config.yaml --retries=3
```

### `orchestra agent ls`

설정된 모든 에이전트 레벨과 상태를 나열합니다.

**출력:**
```bash
L1: Orchestrator (active)
L2: Coordinator (claude-sonnet-4-5)
L3: Worker Pool (max_workers=4)
```

### `orchestra agent inspect <level>`

특정 에이전트 레벨에 대한 상세 정보를 표시합니다.

**인자:**
- `<level>`: 검사할 에이전트 레벨 (L1, L2, 또는 L3)

**출력 예시:**
```bash
$ orchestra agent inspect L2

Level: L2 Coordinator
Backend: claude_code
Model: claude-sonnet-4-5-20250929
Whitelist Tools: echo, ls, cat, node, pnpm, git
Recent Calls: 15 (last 24h)
Avg Planning Time: 1.2s
Success Rate: 93.3%
```

### `orchestra eval run <scenario> [options]`

테스트 및 벤치마킹을 위한 평가 시나리오를 실행합니다.

**인자:**
- `<scenario>`: 시나리오 YAML 파일 경로

**옵션:**
- `--report <md|json>`: 보고서 형식 (기본값: md)

**예시:**
```bash
orchestra eval run ./tests/scenarios/simple_readme.yaml --report json
```

## 콘솔 출력 예시

### 예시 1: 성공 케이스

**입력:**
```bash
orchestra run "Create a README.md and run lint" --config ./orchestra.config.yaml
```

**콘솔 출력:**
```
🎭 Orchestra CLI v1.0.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Task: Create a README.md and run lint
📂 Run Directory: ./runs/20251002_143025

[L1 Orchestrator] Configuration loaded
[L1 Orchestrator] Security policies applied: FS=read-only, NET=deny
[L2 Coordinator] Calling Claude Code...
[L2 Coordinator] Plan generated (3 tasks)
  ├─ task-001: Create README.md skeleton
  ├─ task-002: Write project description
  └─ task-003: Run lint check

[L3 Worker-1] task-001 executing... (echo "# Project" > README.md)
[L3 Worker-1] task-001 completed ✓ (0.12s)
[L3 Worker-2] task-002 executing... (echo "Description" >> README.md)
[L3 Worker-2] task-002 completed ✓ (0.08s)
[L3 Worker-3] task-003 executing... (node lint-stub.js)
[L3 Worker-3] task-003 completed ✓ (0.34s)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All tasks completed (3/3 succeeded)
⏱️  Total duration: 1.2s
📊 Report: ./runs/20251002_143025/report.md
```

### 예시 2: 부분 실패 및 재시도

**입력:**
```bash
orchestra run "Run network check" --retries=2
```

**콘솔 출력:**
```
🎭 Orchestra CLI v1.0.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Task: Run network check
📂 Run Directory: ./runs/20251002_143512

[L1 Orchestrator] Configuration loaded
[L2 Coordinator] Plan generated (1 task)
  └─ task-001: curl example.com

[L3 Worker-1] task-001 executing... (curl example.com)
⚠️  [L3 Worker-1] Failed: Tool 'curl' not in whitelist
⏳ [L3 Worker-1] Retry 1/2 (waiting 2s...)
⚠️  [L3 Worker-1] Failed: Tool 'curl' not in whitelist
⏳ [L3 Worker-1] Retry 2/2 (waiting 4s...)
⚠️  [L3 Worker-1] Failed: Tool 'curl' not in whitelist
❌ [L3 Worker-1] task-001 final failure (retries exhausted)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Task failed (0/1 succeeded)
⏱️  Total duration: 6.5s
📊 Report: ./runs/20251002_143512/report.md

💡 Troubleshooting:
  - Add 'curl' to whitelist_tools in orchestra.config.yaml
  - Or enable network access (allow_network: true)
```

### 예시 3: 계획 전용 모드

**입력:**
```bash
orchestra run "Build TypeScript project and run tests" --plan-only
```

**콘솔 출력:**
```
🎭 Orchestra CLI v1.0.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Task: Build TypeScript project and run tests
📂 Run Directory: ./runs/20251002_144200

[L1 Orchestrator] Configuration loaded
[L2 Coordinator] Calling Claude Code...
[L2 Coordinator] Plan generated (4 tasks)

📋 Execution Plan:
┌──────────┬────────────────────────────┬───────────────┬──────────────┐
│ Task ID  │ Description                │ Tools         │ Dependencies │
├──────────┼────────────────────────────┼───────────────┼──────────────┤
│ task-001 │ Install dependencies       │ pnpm          │ -            │
│ task-002 │ Type check                 │ pnpm, node    │ task-001     │
│ task-003 │ Build project              │ pnpm, node    │ task-002     │
│ task-004 │ Run tests                  │ pnpm, node    │ task-003     │
└──────────┴────────────────────────────┴───────────────┴──────────────┘

ℹ️  Plan saved to: ./runs/20251002_144200/plan.json
ℹ️  Run without --plan-only to execute
```

## 인터랙티브 기능

### 진행 표시기
- 실시간 태스크 상태 업데이트
- 장시간 실행 태스크용 프로그레스 바 (선택 사항)
- 콘솔로 라이브 로그 스트리밍

### 에러 처리
- 컨텍스트가 포함된 명확한 에러 메시지
- 실행 가능한 문제 해결 제안
- 관련 문서 링크

### 출력 형식
- **사람이 읽기 쉬운 형식**: 색상 및 포맷팅된 콘솔 출력 (기본값)
- **JSON**: `--json` 플래그로 기계 판독 가능한 출력
- **조용한 모드**: `--quiet` 플래그로 최소 출력
