# Architecture

## System Overview

Orchestra CLI implements a hierarchical agent architecture with three distinct layers, each with specific responsibilities and clear communication protocols.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  User (CLI)                                              │
└────────────────────┬────────────────────────────────────┘
                     │ orchestra run "task description"
                     ▼
┌─────────────────────────────────────────────────────────┐
│  L1 Orchestrator                                         │
│  - Load configuration (orchestra.config.yaml)            │
│  - Apply policies (security, resource limits)            │
│  - Routing & lifecycle management                        │
│  - Observability (logs, metrics, run directory)          │
└────────────────────┬────────────────────────────────────┘
                     │ task_context → L2
                     ▼
┌─────────────────────────────────────────────────────────┐
│  L2 Coordinator                                          │
│  - Call Claude Code LLM (planner prompt)                 │
│  - Generate DAG/Staged Plan (dependency graph)           │
│  - Create task messages for L3                           │
└────────────────────┬────────────────────────────────────┘
                     │ tasks[] → L3 workers (parallel/sequential)
                     ▼
┌─────────────────────────────────────────────────────────┐
│  L3 Worker(s)                                            │
│  - Execute whitelisted tools (echo, ls, lint, etc.)      │
│  - Collect results/artifacts                             │
│  - Retry on failure (exponential backoff)                │
└────────────────────┬────────────────────────────────────┘
                     │ results[], artifacts[] ↑
                     ▼
        ┌─────────────────────────────┐
        │  ./runs/{timestamp}/        │
        │  - plan.json                │
        │  - tasks.jsonl              │
        │  - artifacts/               │
        │  - report.md                │
        └─────────────────────────────┘
                     │
                     ▼ (final summary & output)
                 User Console
```

## Data Flow

### 1. Downward Flow (Task Decomposition)
1. **L1 → L2**: `{intent, constraints, config}`
2. **L2 → L3**: `{task_id, parent_id, tools, inputs, ...}`

### 2. Upward Flow (Result Aggregation)
3. **L3 → L2 → L1**: `{state, logs[], artifacts[], metrics}`

## Execution Model

### Synchronous CLI with Phased Execution
- **Phase 1: Plan** - L2 generates task graph
- **Phase 2: Approve** (implicit in MVP) - User can review with `--plan-only`
- **Phase 3: Execute** - L3 workers run tasks
- **Phase 4: Aggregate** - L1 collects results and generates report

### Concurrency Model
- L3 workers execute in parallel with bounded concurrency (`--concurrency` flag)
- Task dependencies enforce sequential execution where needed
- Exponential backoff retry for failed tasks

## Task Graph Structure

L2 emits a DAG (Directed Acyclic Graph) or ordered stages where:
- Each node represents a task (references the message schema)
- Edges represent dependencies
- L1 manages lifecycle and persists to `./runs/{timestamp}/plan.json`

## Safety Mechanisms

1. **Tool Whitelisting**: L3 can only call tools declared in config. Deny by default.
2. **Filesystem Security**: Read-only by default, write allowed only to specified paths
3. **Network Isolation**: Network access disabled unless explicitly whitelisted
4. **Secret Redaction**: PII/secrets automatically redacted from logs
5. **Timeouts**: Per-task and total run timeouts enforced

## Observability

- Every action emits JSONL events with `timestamp`, `trace_id`, `task_id`, `level`, `message`, `payload`
- Run directory structure preserves all execution artifacts
- Markdown summary report generated at completion

## LLM Protocol (Claude Code)

### Planner Prompt (L2)
- Input: User intent, constraints, whitelist tools
- Output: JSON array of tasks with dependencies
- Few-shot examples ensure consistent formatting

### Summarizer Prompt (L1)
- Input: Task results, artifacts, metrics
- Output: Markdown summary report

Both prompts are stored in `orchestra.config.yaml` and can be customized per deployment.
