# Planning & Backlog

## Epics & Milestones

### Epic 1: Core Infrastructure

#### M1.1: Project Scaffolding & Setup (Small)
- Initialize TypeScript project with pnpm
- Configure `tsconfig.json` with strict mode
- Setup folder structure (`src/`, `tests/`, `config/`)
- Configure ESLint, Prettier

#### M1.2: Configuration Loader & Validator (Medium)
- YAML parsing with `yaml` package
- Zod schema validation
- Configuration type definitions
- Default config generation

#### M1.3: Logger & Tracer (Medium)
- JSONL format logger
- `trace_id` propagation using `AsyncLocalStorage`
- Log levels (debug, info, warn, error)
- File and console output

### Epic 2: L1 Orchestrator

#### M2.1: CLI Entry Point (Small)
- `commander` argument parser
- Subcommands: `run`, `agent`, `eval`
- Version and help output
- Global options handling

#### M2.2: Run Directory Manager (Small)
- Create `./runs/{timestamp}/` directories
- Artifact storage and cleanup
- File system helpers
- Path validation

#### M2.3: Policy Engine (Medium)
- Whitelist validation
- FS/network sandbox checks
- Resource limit enforcement
- Security policy application

#### M2.4: Aggregation & Report Generation (Medium)
- Markdown template rendering
- Metrics summarization (success rate, avg duration)
- Artifact listing
- Error aggregation

### Epic 3: L2 Coordinator

#### M3.1: Claude Code Adapter (Large)
- Prompt template engine
- LLM invocation & parsing (JSON extraction)
- Few-shot example management
- Error handling and retry

#### M3.2: DAG Generator (Medium)
- Dependency topological sorting
- Cycle detection
- Task ordering algorithm
- Graph validation

#### M3.3: Task Message Builder (Small)
- L3 JSON message generation
- `task_id` / `parent_id` assignment
- Constraint propagation

### Epic 4: L3 Worker

#### M4.1: Tool Executor (Medium)
- `child_process` subprocess wrapper
- stdout/stderr streaming
- Exit code handling
- Environment variable injection

#### M4.2: Retry Logic (Small)
- Exponential backoff implementation
- State tracking (`retries` counter)
- Max retry enforcement
- Failure classification

#### M4.3: Artifact Collector (Small)
- Output file copying to `./runs/{id}/artifacts/`
- Checksum calculation (SHA256)
- Artifact metadata generation

### Epic 5: Testing & Evaluation

#### M5.1: Unit Tests (Medium)
- Test each module (config, logger, L1/L2/L3)
- Minimum 80% code coverage
- Mock LLM responses
- Edge case testing

#### M5.2: Integration Tests (Large)
- End-to-end scenarios (golden fixtures)
- `--plan-only` / `--dry-run` test cases
- Multi-task workflows
- Failure recovery scenarios

#### M5.3: Evaluation Framework (Medium)
- `orchestra eval` command implementation
- Benchmark scenarios (3+ scenarios)
- Performance metrics collection
- Report generation

### Epic 6: Documentation & Deployment

#### M6.1: README & Usage Guide (Small)
- Quick start guide
- Installation instructions
- Basic examples
- Configuration reference

#### M6.2: Example Projects (Small)
- Sample scenario files
- Common workflow templates
- Best practices documentation

#### M6.3: CI/CD Pipeline (Medium, Optional)
- GitHub Actions setup
- Automated testing
- Release automation

## Prioritization (MoSCoW)

| Category | Items |
|----------|-------|
| **Must Have** | M1.1, M1.2, M1.3, M2.1, M2.2, M3.1, M3.2, M4.1, M5.1 |
| **Should Have** | M2.3, M2.4, M3.3, M4.2, M4.3, M5.2 |
| **Could Have** | M5.3, M6.1, M6.2 |
| **Won't Have (MVP)** | M6.3, Distributed scheduler, Remote agents, Web UI |

## Critical Path

1. **Day 1-2**: M1.1, M1.2 (Scaffolding + Configuration)
2. **Day 3-4**: M1.3, M2.1, M2.2 (Logging + CLI + Run Management)
3. **Day 5-7**: M3.1, M3.2 (L2 LLM Adapter + DAG)
4. **Day 8-9**: M4.1, M4.2 (L3 Executor + Retry)
5. **Day 10**: M2.3, M2.4 (Policy + Reporting)
6. **Day 11-12**: M5.1, M5.2 (Testing)
7. **Day 13-14**: Integration, Debugging, M6.1 (README)

## 2-Week MVP Plan

| Day | Focus Areas | Deliverables |
|-----|-------------|--------------|
| **1-2** | Project initialization, config loader, folder structure | Build & run scaffold working |
| **3-4** | Logger, CLI parser, run directory management | `orchestra run --help` functional |
| **5-7** | L2 Coordinator (LLM adapter, DAG generation) | `--plan-only` mode operational |
| **8-9** | L3 Worker (tool execution, retry) | Dummy task end-to-end execution |
| **10** | L1 policy engine, report generation | Markdown report output |
| **11-12** | Write tests (unit + integration) | CI passing locally |
| **13-14** | Debugging, README, example scenarios | Releasable MVP |

## Work Breakdown Structure (WBS)

### Phase 1: Foundation (Days 1-4)
```
1. Setup
   1.1 Initialize pnpm workspace
   1.2 Configure TypeScript
   1.3 Setup testing framework (Vitest)
   1.4 Create directory structure

2. Configuration System
   2.1 Define Zod schemas
   2.2 Implement YAML loader
   2.3 Create default config
   2.4 Add validation logic

3. Logging Infrastructure
   3.1 JSONL logger implementation
   3.2 Trace ID context
   3.3 File/console output
   3.4 Log rotation (optional)
```

### Phase 2: Core Agents (Days 5-10)
```
4. L1 Orchestrator
   4.1 CLI entry point
   4.2 Run directory manager
   4.3 Policy engine
   4.4 Report generator

5. L2 Coordinator
   5.1 Claude Code client
   5.2 Prompt templates
   5.3 DAG builder
   5.4 Task message factory

6. L3 Worker
   6.1 Subprocess executor
   6.2 Retry logic
   6.3 Artifact collector
   6.4 Metrics tracker
```

### Phase 3: Quality & Polish (Days 11-14)
```
7. Testing
   7.1 Unit tests (80%+ coverage)
   7.2 Integration tests
   7.3 Golden test fixtures
   7.4 Performance benchmarks

8. Documentation
   8.1 README
   8.2 API documentation
   8.3 Example scenarios
   8.4 Troubleshooting guide
```

## Resource Allocation (Solo Developer)

- **Development**: 70% (Days 1-10, Days 13-14)
- **Testing**: 20% (Days 11-12)
- **Documentation**: 10% (Continuous, finalize Day 13-14)

## Dependencies & Blockers

### External Dependencies
- Claude Code API availability
- TypeScript/Node.js ecosystem stability
- pnpm package resolution

### Internal Dependencies
- M3.1 (LLM adapter) blocks M3.2 (DAG generator)
- M2.2 (Run manager) blocks M2.4 (Reporting)
- M4.1 (Executor) blocks M4.2 (Retry) and M4.3 (Artifacts)

### Risk Mitigation
- Mock Claude Code responses for development/testing
- Implement fallback configs for missing/invalid setup
- Create isolated test environments

## Success Metrics

### MVP Acceptance Criteria
- [ ] All Must Have features implemented
- [ ] 80%+ unit test coverage
- [ ] 3+ integration tests passing
- [ ] `--plan-only` and `--dry-run` modes functional
- [ ] README with quick start guide
- [ ] Example scenario executes successfully
