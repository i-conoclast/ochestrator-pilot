# Executive Summary

**Orchestra CLI** is a 3-depth sub-agent orchestration tool powered by Claude Code as the LLM backend. Users submit high-level tasks via CLI, and the system orchestrates execution through three distinct layers:

- **L1 Orchestrator** (user-facing CLI) applies policies, manages routing, and provides observability
- **L2 Coordinator** decomposes tasks into a workflow (DAG or staged plan) with explicit steps and dependencies
- **L3 Worker(s)** execute concrete actions using whitelisted tools and return artifacts and status upward

All execution stages are tracked via JSONL logs, protected by whitelist-based security policies, and support `--plan-only` / `--dry-run` modes for safe offline execution. The MVP can be completed within 2 weeks and can be implemented in TypeScript or Python.

## Key Features

- **3-Layer Architecture**: Clear separation of concerns (orchestration, coordination, execution)
- **LLM-Powered Planning**: Claude Code generates task decomposition plans
- **Security-First**: Whitelist-based tool access, FS/network sandboxing, secret redaction
- **Observable**: JSONL logs, trace ID propagation, markdown run reports
- **Safe Execution**: `--plan-only` and `--dry-run` modes prevent unintended side effects
- **Retry & Recovery**: Exponential backoff, partial failure handling, idempotent operations

## Target Use Cases

1. **Automated Development Workflows**: Generate code, run tests, commit changes
2. **Infrastructure Automation**: Setup projects, install dependencies, configure environments
3. **Data Processing Pipelines**: Multi-step ETL with dependency management
4. **Code Quality Checks**: Lint, format, test, and report in coordinated steps

## Timeline

- **MVP**: 2 weeks (14 days)
- **Post-MVP Enhancements**: Weeks 3-4
- **Mid-term Features**: Months 2-3 (distributed execution, plugins)
- **Long-term Vision**: Months 4+ (autonomous agents, learning optimization)
