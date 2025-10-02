# Next Steps & Roadmap

## Post-MVP Priorities (Weeks 3-4)

### 1. Checkpoint & Resume Support

**Problem**: Long-running tasks that timeout or fail midway require full re-execution.

**Solution**: Implement checkpoint/resume mechanism.

#### Implementation

```typescript
interface Checkpoint {
  run_id: string;
  checkpoint_at: string; // ISO8601
  completed_tasks: string[]; // task_ids
  pending_tasks: string[];
  state_snapshot: Record<string, any>;
}

export async function saveCheckpoint(runDir: string, state: Checkpoint) {
  await writeFile(
    `${runDir}/checkpoint.json`,
    JSON.stringify(state, null, 2)
  );
}

export async function resumeFromCheckpoint(runId: string) {
  const checkpoint: Checkpoint = JSON.parse(
    await readFile(`./runs/${runId}/checkpoint.json`, 'utf-8')
  );

  log('info', `Resuming from checkpoint: ${checkpoint.checkpoint_at}`);

  // Re-execute only pending tasks
  return executeTasks(checkpoint.pending_tasks);
}
```

#### CLI

```bash
orchestra resume <run_id>
```

**Estimate**: 3 days

---

### 2. Enhanced L2 Planning Capabilities

**Problem**: L2 cannot adapt to partial failures or replanning scenarios.

**Solution**: Add dynamic replanning on failures.

#### Features

1. **Failure Analysis**
   - L2 analyzes failed task logs
   - Determines if failure is transient or permanent

2. **Replanning**
   - Generate alternative task decomposition
   - Route around failed components
   - Suggest manual interventions

3. **Multi-LLM Support**
   - Fallback to GPT-4 if Claude Code unavailable
   - Compare plans from multiple LLMs (optional)

#### Example

```typescript
async function replanOnFailure(
  originalPlan: Task[],
  failedTask: Task
): Promise<Task[]> {
  const prompt = `
    Original plan failed at: ${failedTask.intent}
    Error: ${failedTask.logs[failedTask.logs.length - 1].message}

    Generate alternative plan avoiding this failure.
  `;

  return coordinator.createPlan(prompt, whitelist);
}
```

**Estimate**: 5 days

---

### 3. CI/CD Integration

**Problem**: Manual runs are not suitable for automated pipelines.

**Solution**: GitHub Actions integration and exit code conventions.

#### GitHub Actions Workflow

```yaml
# .github/workflows/orchestra.yml
name: Orchestra Build

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install Orchestra CLI
        run: pnpm add -g orchestra-cli

      - name: Run Orchestra Task
        run: |
          orchestra run "Build and test TypeScript project" \
            --config ./.orchestra/ci.config.yaml \
            --concurrency 4

      - name: Upload Run Report
        uses: actions/upload-artifact@v3
        with:
          name: orchestra-report
          path: ./runs/**/report.md
```

#### Exit Codes

- `0`: All tasks succeeded
- `1`: Configuration error
- `2`: One or more tasks failed
- `3`: Timeout
- `4`: Security violation

**Estimate**: 2 days

---

### 4. Web Dashboard (Optional)

**Problem**: Console output not suitable for long runs or remote monitoring.

**Solution**: Simple web UI for run visualization.

#### Features

- Real-time log streaming (WebSocket)
- Task DAG visualization (Cytoscape.js or D3)
- Artifact browser
- Run comparison

#### Stack

- **Backend**: Express.js + WebSocket
- **Frontend**: React + TailwindCSS
- **Database**: SQLite (for run metadata)

#### Screenshot

```
┌─────────────────────────────────────────┐
│ Orchestra Dashboard                     │
├─────────────────────────────────────────┤
│ Run: 20251002T143025         [⏸️ Pause] │
│                                         │
│ ● task-001 ✅ (0.12s)                   │
│ ● task-002 ✅ (0.08s)                   │
│ ● task-003 🔄 Running... (2.3s)         │
│                                         │
│ [View Logs] [Download Report]          │
└─────────────────────────────────────────┘
```

**Estimate**: 7 days (optional)

---

## Mid-term Features (Months 2-3)

### 1. Distributed Execution

**Goal**: Run L3 workers on remote machines for scalability.

#### Architecture

```
L1 Orchestrator (Local)
    ↓
L2 Coordinator (Local)
    ↓
Task Queue (Redis)
    ↓
L3 Workers (Remote via SSH/Docker)
    ↓
Artifact Storage (S3/MinIO)
```

#### Configuration

```yaml
workers:
  - host: worker1.example.com
    ssh_key: ~/.ssh/id_rsa
    capacity: 4
  - host: worker2.example.com
    ssh_key: ~/.ssh/id_rsa
    capacity: 8
```

#### Benefits

- Scale horizontally
- Isolate untrusted code
- Heterogeneous environments (Linux, macOS, Windows)

**Estimate**: 14 days

---

### 2. Plugin System

**Goal**: Allow custom tools/adapters without modifying core.

#### Interface

```typescript
export interface OrchestraPlugin {
  name: string;
  version: string;
  tools: ToolAdapter[];
  hooks?: {
    beforePlan?: (intent: string) => string;
    afterPlan?: (plan: Task[]) => Task[];
    beforeExecute?: (task: Task) => Task;
    afterExecute?: (task: Task) => Task;
  };
}

export interface ToolAdapter {
  name: string;
  execute: (args: string[], env: Record<string, string>) => Promise<ExecutionResult>;
}
```

#### Usage

```typescript
// plugins/docker_adapter.ts
export const dockerPlugin: OrchestraPlugin = {
  name: 'docker',
  version: '1.0.0',
  tools: [
    {
      name: 'docker',
      execute: async (args, env) => {
        // Custom Docker execution logic
        return runDocker(args, env);
      },
    },
  ],
};

// Load in config
import { dockerPlugin } from './plugins/docker_adapter';

orchestrator.registerPlugin(dockerPlugin);
```

**Estimate**: 10 days

---

### 3. Advanced Security

#### Features

1. **SELinux/AppArmor Integration**
   - Mandatory Access Control (MAC)
   - Process confinement

2. **Container Sandboxes**
   - Run each L3 task in Docker/Podman
   - Isolated network namespaces

3. **Audit Compliance**
   - SOC 2 logging requirements
   - Tamper-proof audit trail (append-only logs)

#### Example

```yaml
security:
  sandbox_mode: "docker"
  docker_image: "node:20-alpine"
  docker_network: "none"
  docker_volumes:
    - "./runs:/runs:rw"
```

**Estimate**: 12 days

---

## Long-term Vision (Months 4+)

### 1. Autonomous Agent Mode

**Goal**: L2 selects tools and generates plans without predefined whitelist.

#### Challenges

- Tool discovery (how does L2 know what's available?)
- Security implications (unbounded tool access)
- Correctness verification

#### Approach

1. **Capability Negotiation**
   - L3 advertises available tools to L2
   - L2 selects from discovered capabilities

2. **Sandboxed Tool Exploration**
   - L3 runs in isolated container
   - Dry-run validation before real execution

3. **Human-in-the-Loop**
   - User approves auto-discovered tools
   - Builds personal whitelist over time

**Estimate**: 30+ days

---

### 2. Learning & Optimization

**Goal**: Improve plan quality over time using historical data.

#### Techniques

1. **Reinforcement Learning from Human Feedback (RLHF)**
   - User rates plan quality (thumbs up/down)
   - Fine-tune LLM on successful plans

2. **Performance Modeling**
   - Predict task duration from historical data
   - Optimize DAG for minimal total time

3. **Failure Pattern Recognition**
   - Detect common failure modes
   - Proactively avoid known pitfalls

#### Example

```
Historical Data:
- "Build TypeScript project" → [pnpm install, pnpm build] (95% success)
- "Build TypeScript project" → [npm install, npm build] (60% success)

New Task: "Build TypeScript project"
Preferred Plan: [pnpm install, pnpm build] (learned from history)
```

**Estimate**: 45+ days

---

### 3. Commercial Deployment

#### SaaS Version

- **Hosted Orchestrator**: Users submit tasks via API
- **Managed Workers**: Auto-scaling worker pool
- **Usage-based Pricing**: Per-task or per-minute billing
- **Team Collaboration**: Shared plans, run history

#### On-Premise Enterprise

- **Self-hosted**: Deploy in customer infrastructure
- **SSO Integration**: SAML, OAuth
- **Audit & Compliance**: Detailed logging, access controls
- **Support**: SLA, dedicated support engineer

**Estimate**: 60+ days + business development

---

## Immediate Action Items (Next Sprint)

### Week 3

| Day | Task | Owner |
|-----|------|-------|
| Mon | Implement checkpoint save/load | Dev |
| Tue | Add `orchestra resume` command | Dev |
| Wed | Write checkpoint integration tests | Dev |
| Thu | Start L2 replanning logic | Dev |
| Fri | Code review + documentation | Dev |

### Week 4

| Day | Task | Owner |
|-----|------|-------|
| Mon | Complete L2 replanning | Dev |
| Tue | Add multi-LLM backend support | Dev |
| Wed | Create CI/CD example workflows | Dev |
| Thu | Performance benchmarking | Dev |
| Fri | Blog post + demo video | Marketing |

---

## Feature Requests & Community Feedback

### Top Requested Features (GitHub Issues)

1. **VS Code Extension** (32 👍)
   - Run Orchestra tasks from editor
   - Inline plan visualization

2. **Terraform/Kubernetes Integration** (28 👍)
   - Infrastructure provisioning tasks
   - Helm chart deployment

3. **Interactive Mode** (24 👍)
   - Ask user for input mid-execution
   - Manual approval gates

4. **Plan Diffing** (19 👍)
   - Compare plans across runs
   - Detect drift in automation

5. **Metrics Dashboard** (15 👍)
   - Grafana/Prometheus integration
   - SLO tracking

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for:

- Code style guide
- PR process
- Issue triage
- Community guidelines

### Good First Issues

- [ ] Add new tool adapter (e.g., `make`, `gradle`)
- [ ] Improve error messages
- [ ] Write example scenarios
- [ ] Translate documentation to other languages

---

## Versioning & Releases

### Semantic Versioning

- **Major (1.0.0)**: Breaking API changes
- **Minor (1.1.0)**: New features, backward compatible
- **Patch (1.0.1)**: Bug fixes

### Release Schedule

- **MVP (1.0.0)**: Week 2
- **v1.1.0** (Checkpoint/Resume): Week 4
- **v1.2.0** (Enhanced Planning): Week 6
- **v2.0.0** (Distributed Execution): Month 3

---

## Support & Resources

- **Documentation**: https://orchestra-cli.dev/docs
- **GitHub**: https://github.com/example/orchestra-cli
- **Discord**: https://discord.gg/orchestra
- **Email**: support@orchestra-cli.dev

---

**Excited to build the future of agent orchestration? Let's get started! 🚀**
