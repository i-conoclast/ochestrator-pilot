# Orchestra CLI

> **3-Depth Agent Orchestration System powered by Claude Code**

Orchestra CLI is a hierarchical agent orchestration system with three distinct layers (L1/L2/L3) designed for safe, observable, and efficient task automation.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run (development)
pnpm dev

# Execute a task
orchestra run "Create README and lint" --plan-only
```

## 📚 Documentation

Full documentation is available in multiple languages:

- **English**: [docs/en/](./docs/en/README.md)
- **한국어**: [docs/ko/](./docs/ko/README.md)

### Key Documents

- [Architecture](./docs/en/02-architecture.md) - System design and 3-layer architecture
- [CLI UX](./docs/en/04-cli-ux.md) - Command reference and usage examples
- [Code Scaffolding](./docs/en/06-code-scaffolding.md) - Project structure guide
- [Security](./docs/en/09-security.md) - Security best practices

## 🏗️ Project Structure

```
orchestra-cli/
├── src/
│   ├── cli/          # CLI entry point
│   ├── config/       # Configuration loader & schema
│   ├── logger/       # JSONL logger
│   ├── l1/           # L1 Orchestrator
│   ├── l2/           # L2 Coordinator
│   ├── l3/           # L3 Worker
│   └── types/        # TypeScript type definitions
├── tests/
│   ├── unit/         # Unit tests
│   ├── integration/  # Integration tests
│   └── fixtures/     # Test scenarios
├── config/           # Default configuration
└── docs/             # Documentation (EN/KO)
```

## 🛠️ Tech Stack

- **Language**: TypeScript
- **Runtime**: Node.js 20+
- **Package Manager**: pnpm
- **LLM Backend**: Claude Code (Sonnet 4.5)
- **Testing**: Vitest
- **Linting**: ESLint + Prettier

## 📋 Features

- **3-Layer Architecture**: L1 (Orchestrator), L2 (Coordinator), L3 (Workers)
- **Security-First**: Whitelist-based tool access, filesystem/network sandboxing
- **Observable**: JSONL logs, trace ID propagation, markdown reports
- **Safe Execution**: `--plan-only` and `--dry-run` modes
- **LLM-Powered Planning**: Claude Code generates intelligent task decomposition
- **Retry & Recovery**: Exponential backoff, partial failure handling

## 🧪 Development

```bash
# Install dependencies
pnpm install

# Run type checking
pnpm typecheck

# Run linter
pnpm lint

# Format code
pnpm format

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage
```

## 📦 Available Commands

```bash
orchestra run <task> [options]     # Execute a task
orchestra agent ls                 # List agents
orchestra agent inspect <level>    # Inspect agent details
orchestra eval run <scenario>      # Run evaluation
```

### Options

- `--plan-only` - Generate plan only, do not execute
- `--dry-run` - Simulate execution without running tools
- `--config <path>` - Configuration file (default: `./orchestra.config.yaml`)
- `--concurrency <n>` - Number of parallel workers (default: 1)
- `--retries <n>` - Retry count override

## 🗺️ Roadmap

- [x] **Day 1-2**: Project scaffolding and basic infrastructure
- [ ] **Day 3-4**: Logger, CLI parser, run directory management
- [ ] **Day 5-7**: L2 Coordinator (LLM adapter, DAG generation)
- [ ] **Day 8-9**: L3 Worker (tool execution, retry)
- [ ] **Day 10**: L1 policy engine, report generation
- [ ] **Day 11-12**: Testing (unit + integration)
- [ ] **Day 13-14**: Debugging, polish, MVP release

See [Next Steps](./docs/en/11-next-steps.md) for detailed roadmap.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 🔗 Links

- **Documentation**: [docs/](./docs/)
- **GitHub**: https://github.com/example/orchestra-cli
- **Issues**: https://github.com/example/orchestra-cli/issues

---

**Built with ❤️ using TypeScript + Claude Code**
