# Orchestra CLI Documentation (English)

Welcome to the Orchestra CLI documentation! This comprehensive guide covers the design, architecture, and implementation of the 3-depth agent orchestration system powered by Claude Code.

## 📚 Table of Contents

### Core Documentation

1. **[Executive Summary](./01-executive-summary.md)**
   - Overview of Orchestra CLI
   - Key features and benefits
   - Target use cases
   - Project timeline

2. **[Architecture](./02-architecture.md)**
   - System overview and design principles
   - 3-layer architecture (L1/L2/L3)
   - Data flow and communication protocols
   - Execution model and safety mechanisms

3. **[Interface Specifications](./03-interface-specs.md)**
   - Roles and responsibilities table
   - Task message JSON schema
   - Configuration file structure
   - State machine and transitions

4. **[CLI User Experience](./04-cli-ux.md)**
   - Commands and flags reference
   - Console output examples
   - Interactive features
   - Error handling

### Planning & Implementation

5. **[Planning & Backlog](./05-planning-backlog.md)**
   - Epics and milestones
   - Work breakdown structure (WBS)
   - 2-week MVP plan
   - MoSCoW prioritization

6. **[Code Scaffolding](./06-code-scaffolding.md)**
   - Project structure (TypeScript + pnpm)
   - Package configuration
   - Core implementation stubs
   - Minimal runnable example

### Quality & Operations

7. **[Evaluation & Quality](./07-evaluation-quality.md)**
   - Testing strategy and test matrix
   - Unit and integration tests
   - Golden test fixtures
   - CI/CD integration

8. **[Observability & Telemetry](./08-observability.md)**
   - JSONL logging architecture
   - Trace ID propagation
   - Metrics collection
   - Run directory structure

### Security & Risk Management

9. **[Security & Safety Guards](./09-security.md)**
   - Tool whitelisting
   - Filesystem and network sandboxing
   - Secret redaction
   - Resource limits and timeouts

10. **[Risks & Mitigations](./10-risks-mitigations.md)**
    - Risk assessment matrix
    - Top 10 risks with detailed analysis
    - Mitigation strategies
    - Incident playbooks

### Future Development

11. **[Next Steps & Roadmap](./11-next-steps.md)**
    - Post-MVP priorities (Weeks 3-4)
    - Mid-term features (Months 2-3)
    - Long-term vision (Months 4+)
    - Feature requests and community feedback

## 🚀 Quick Start

**New to Orchestra CLI?** Start here:

1. Read the [Executive Summary](./01-executive-summary.md) for a high-level overview
2. Review the [Architecture](./02-architecture.md) to understand system design
3. Check [CLI UX](./04-cli-ux.md) for usage examples
4. Follow [Code Scaffolding](./06-code-scaffolding.md) to set up your project

## 📖 Documentation Conventions

### Code Examples

All code examples use TypeScript + pnpm as the implementation stack:

```typescript
// Example code block
import { orchestrate } from './l1/orchestrator';

await orchestrate('Create README', { planOnly: true });
```

### Configuration Examples

Configuration files use YAML format:

```yaml
# orchestra.config.yaml
version: "1.0"
policies:
  allow_network: false
```

### Command Examples

CLI commands are shown with bash syntax:

```bash
orchestra run "Build project" --plan-only
```

## 🌍 Language Versions

- **English**: You are here! ([docs/en/](./))
- **한국어 (Korean)**: [docs/ko/](../ko/README.md)

## 📝 Document Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| 01-executive-summary.md | ✅ Complete | 2025-10-02 |
| 02-architecture.md | ✅ Complete | 2025-10-02 |
| 03-interface-specs.md | ✅ Complete | 2025-10-02 |
| 04-cli-ux.md | ✅ Complete | 2025-10-02 |
| 05-planning-backlog.md | ✅ Complete | 2025-10-02 |
| 06-code-scaffolding.md | ✅ Complete | 2025-10-02 |
| 07-evaluation-quality.md | ✅ Complete | 2025-10-02 |
| 08-observability.md | ✅ Complete | 2025-10-02 |
| 09-security.md | ✅ Complete | 2025-10-02 |
| 10-risks-mitigations.md | ✅ Complete | 2025-10-02 |
| 11-next-steps.md | ✅ Complete | 2025-10-02 |

## 🤝 Contributing

Found an error or want to improve the documentation?

1. Open an issue describing the problem
2. Submit a pull request with your changes
3. Follow the style guide (see main README.md)

## 📧 Support

- **GitHub Issues**: Report bugs or request features
- **Email**: support@orchestra-cli.dev
- **Discord**: Join our community chat

## 📜 License

This documentation is licensed under MIT License. See [LICENSE](../../LICENSE) for details.

---

**Ready to build agent orchestration systems?** Dive into the [Architecture](./02-architecture.md)! 🚀
