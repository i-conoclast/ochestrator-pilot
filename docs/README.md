# Orchestra CLI Documentation

> **3-Depth Agent Orchestration System powered by Claude Code**

Welcome to the comprehensive documentation for Orchestra CLI! This project implements a hierarchical agent orchestration system with three distinct layers (L1/L2/L3) designed for safe, observable, and efficient task automation.

## 🌍 Choose Your Language / 언어 선택

<table>
<tr>
<td width="50%" valign="top">

### 📘 English Documentation

**[→ Read English Docs](./en/README.md)**

Comprehensive guides covering:
- Architecture & Design
- Implementation Details
- Code Examples (TypeScript + pnpm)
- Security & Best Practices
- Testing & Quality Assurance

**Quick Links:**
- [Executive Summary](./en/01-executive-summary.md)
- [Architecture](./en/02-architecture.md)
- [CLI User Guide](./en/04-cli-ux.md)
- [Code Scaffolding](./en/06-code-scaffolding.md)

</td>
<td width="50%" valign="top">

### 📗 한국어 문서

**[→ 한국어 문서 읽기](./ko/README.md)**

포괄적인 가이드:
- 아키텍처 및 설계
- 구현 세부사항
- 코드 예제 (TypeScript + pnpm)
- 보안 및 모범 사례
- 테스트 및 품질 보증

**빠른 링크:**
- [요약](./ko/01-executive-summary.md)
- [아키텍처](./ko/02-architecture.md)
- [CLI 사용자 가이드](./ko/04-cli-ux.md)
- [코드 스캐폴딩](./ko/06-code-scaffolding.md)

</td>
</tr>
</table>

## 📚 Documentation Structure

```
docs/
├── en/                          # English documentation
│   ├── 01-executive-summary.md
│   ├── 02-architecture.md
│   ├── 03-interface-specs.md
│   ├── 04-cli-ux.md
│   ├── 05-planning-backlog.md
│   ├── 06-code-scaffolding.md
│   ├── 07-evaluation-quality.md
│   ├── 08-observability.md
│   ├── 09-security.md
│   ├── 10-risks-mitigations.md
│   ├── 11-next-steps.md
│   └── README.md
├── ko/                          # 한국어 문서
│   ├── 01-executive-summary.md
│   ├── 02-architecture.md
│   ├── 03-interface-specs.md
│   ├── 04-cli-ux.md
│   ├── 05-planning-backlog.md
│   ├── 06-code-scaffolding.md
│   ├── 07-evaluation-quality.md
│   ├── 08-observability.md
│   ├── 09-security.md
│   ├── 10-risks-mitigations.md
│   ├── 11-next-steps.md
│   └── README.md
└── README.md                    # This file
```

## 🚀 What is Orchestra CLI?

Orchestra CLI is a **3-depth agent orchestration system** that enables safe, observable, and efficient automation of complex tasks through hierarchical delegation:

- **L1 Orchestrator**: User-facing CLI that applies policies and manages execution lifecycle
- **L2 Coordinator**: LLM-powered planner that decomposes tasks into DAG workflows
- **L3 Workers**: Tool executors that run whitelisted commands and collect artifacts

### Key Features

✅ **Security-First Design**: Whitelist-based tool access, filesystem sandboxing, secret redaction
✅ **Observable**: JSONL logs, trace ID propagation, markdown reports
✅ **Safe Execution**: `--plan-only` and `--dry-run` modes
✅ **Retry & Recovery**: Exponential backoff, partial failure handling
✅ **LLM-Powered**: Claude Code generates intelligent task decomposition

## 📖 Getting Started

### For First-Time Readers

1. **Start with the Executive Summary**
   - English: [en/01-executive-summary.md](./en/01-executive-summary.md)
   - 한국어: [ko/01-executive-summary.md](./ko/01-executive-summary.md)

2. **Understand the Architecture**
   - English: [en/02-architecture.md](./en/02-architecture.md)
   - 한국어: [ko/02-architecture.md](./ko/02-architecture.md)

3. **Try the CLI**
   - English: [en/04-cli-ux.md](./en/04-cli-ux.md)
   - 한국어: [ko/04-cli-ux.md](./ko/04-cli-ux.md)

### For Developers

1. **Review Code Scaffolding**
   - English: [en/06-code-scaffolding.md](./en/06-code-scaffolding.md)
   - 한국어: [ko/06-code-scaffolding.md](./ko/06-code-scaffolding.md)

2. **Check Testing Strategy**
   - English: [en/07-evaluation-quality.md](./en/07-evaluation-quality.md)
   - 한국어: [ko/07-evaluation-quality.md](./ko/07-evaluation-quality.md)

3. **Follow Security Guidelines**
   - English: [en/09-security.md](./en/09-security.md)
   - 한국어: [ko/09-security.md](./ko/09-security.md)

## 🗺️ Project Roadmap

| Phase | Timeline | Status |
|-------|----------|--------|
| **MVP** | Week 1-2 | 📝 Planning |
| **Post-MVP Enhancements** | Week 3-4 | ⏳ Pending |
| **Mid-term Features** | Month 2-3 | ⏳ Pending |
| **Long-term Vision** | Month 4+ | 💡 Ideation |

See [Next Steps & Roadmap](./en/11-next-steps.md) for details.

## 🛠️ Tech Stack

- **Language**: TypeScript
- **Runtime**: Node.js 20+
- **Package Manager**: pnpm
- **LLM Backend**: Claude Code (Sonnet 4.5)
- **Testing**: Vitest
- **Logging**: JSONL format

## 📊 Documentation Coverage

| Category | Documents | Completion |
|----------|-----------|------------|
| Core Design | 4 docs | ✅ 100% |
| Planning & Implementation | 2 docs | ✅ 100% |
| Quality & Operations | 2 docs | ✅ 100% |
| Security & Risk | 2 docs | ✅ 100% |
| Future Development | 1 doc | ✅ 100% |
| **Total** | **11 docs × 2 languages** | **✅ 22/22** |

## 🤝 Contributing

We welcome contributions to both code and documentation!

- **Found a typo?** Submit a PR with the fix
- **Have an idea?** Open an issue for discussion
- **Want to translate?** Help us add more languages

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## 📧 Support & Community

- **GitHub Issues**: [github.com/example/orchestra-cli/issues](https://github.com/example/orchestra-cli/issues)
- **Email**: support@orchestra-cli.dev
- **Discord**: [discord.gg/orchestra](https://discord.gg/orchestra)

## 📜 License

This project and its documentation are licensed under the MIT License.
See [LICENSE](../LICENSE) for details.

---

<div align="center">

**Ready to orchestrate?** Pick your language above and dive in! 🚀

[English Docs](./en/README.md) • [한국어 문서](./ko/README.md)

</div>
