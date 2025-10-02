# CLI User Experience

## Commands & Flags

### `orchestra run <task> [options]`

Execute a high-level task with the Orchestra orchestration system.

**Arguments:**
- `<task>`: Natural language description of the task to execute

**Options:**
- `--plan-only`: Generate plan only (L2), do not execute L3 tasks
- `--dry-run`: Simulate all tool executions without actual execution
- `--max-depth <1|2|3>`: Limit agent depth (default: 3)
- `--retries <n>`: Override retry count (default: from config)
- `--concurrency <n>`: Number of parallel L3 workers (default: 1)
- `--out <path>`: Run directory path (default: `./runs`)
- `--config <path>`: Configuration file path (default: `./orchestra.config.yaml`)

**Examples:**
```bash
# Plan only mode - see what would be executed
orchestra run "Create README and lint" --plan-only

# Dry run mode - simulate execution
orchestra run "Setup Python project" --dry-run --concurrency=2

# Full execution with custom config
orchestra run "Build and test" --config=./custom.config.yaml --retries=3
```

### `orchestra agent ls`

List all configured agent levels and their status.

**Output:**
```bash
L1: Orchestrator (active)
L2: Coordinator (claude-sonnet-4-5)
L3: Worker Pool (max_workers=4)
```

### `orchestra agent inspect <level>`

Display detailed information about a specific agent level.

**Arguments:**
- `<level>`: Agent level to inspect (L1, L2, or L3)

**Output Example:**
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

Run evaluation scenarios for testing and benchmarking.

**Arguments:**
- `<scenario>`: Path to scenario YAML file

**Options:**
- `--report <md|json>`: Report format (default: md)

**Example:**
```bash
orchestra eval run ./tests/scenarios/simple_readme.yaml --report json
```

## Console Output Examples

### Example 1: Success Case

**Input:**
```bash
orchestra run "Create a README.md and run lint" --config ./orchestra.config.yaml
```

**Console Output:**
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

### Example 2: Partial Failure & Retry

**Input:**
```bash
orchestra run "Run network check" --retries=2
```

**Console Output:**
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

### Example 3: Plan-Only Mode

**Input:**
```bash
orchestra run "Build TypeScript project and run tests" --plan-only
```

**Console Output:**
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

## Interactive Features

### Progress Indicators
- Real-time task status updates
- Progress bars for long-running tasks (optional)
- Live log streaming to console

### Error Handling
- Clear error messages with context
- Actionable troubleshooting suggestions
- Links to relevant documentation

### Output Formats
- **Human-readable**: Colored, formatted console output (default)
- **JSON**: Machine-readable output with `--json` flag
- **Quiet mode**: Minimal output with `--quiet` flag
