# Risks & Mitigations

## Risk Assessment Matrix

| # | Risk | Impact | Probability | Severity | Priority |
|---|------|--------|-------------|----------|----------|
| 1 | Tool Non-determinism | Medium | High | **Medium** | P1 |
| 2 | Long-running Task Timeout | High | Medium | **High** | P0 |
| 3 | Partial Failure Recovery | Medium | High | **Medium** | P1 |
| 4 | LLM Response Parsing Failure | High | Medium | **High** | P0 |
| 5 | Whitelist Bypass (Shell Injection) | Very High | Low | **Critical** | P0 |
| 6 | Configuration Error | Medium | Medium | **Medium** | P2 |
| 7 | Disk Space Exhaustion | High | Low | **Medium** | P2 |
| 8 | Concurrent Task Conflicts | Medium | Medium | **Medium** | P2 |
| 9 | API Rate Limiting (Claude Code) | High | Medium | **High** | P1 |
| 10 | Dependency Version Conflicts | Low | Medium | **Low** | P3 |

## Detailed Risk Analysis

### Risk 1: Tool Non-determinism

**Description**: Same input produces different outputs across runs, breaking reproducibility.

**Examples**:
- Timestamp in generated files
- Random UUIDs in output
- Network-dependent results (DNS, external APIs)
- Filesystem race conditions

**Impact**:
- Golden tests fail
- Difficult to debug issues
- User confusion about expected behavior

**Mitigations**:

1. **`--dry-run` Pre-validation**
   ```typescript
   if (options.dryRun) {
     // Simulate without side effects
     return simulateExecution(task);
   }
   ```

2. **Golden Test Fixtures**
   - Capture expected outputs in `tests/fixtures/`
   - Compare with `diff` or structural comparison
   - Flag non-deterministic fields for exclusion

3. **LLM Configuration**
   ```yaml
   llm:
     temperature: 0      # Deterministic sampling
     seed: 12345         # Fixed random seed (if supported)
   ```

4. **Freeze Time in Tests**
   ```typescript
   import { vi } from 'vitest';

   vi.setSystemTime(new Date('2025-10-02T14:30:00Z'));
   ```

### Risk 2: Long-running Task Timeout

**Description**: Tasks exceed configured time limits, blocking pipeline or consuming resources.

**Examples**:
- Infinite loops in tools
- Network requests that hang
- Large file operations
- Unresponsive subprocesses

**Impact**:
- Run never completes
- Resource exhaustion (CPU, memory)
- User frustration

**Mitigations**:

1. **Enforced Timeouts**
   ```typescript
   async function runToolWithTimeout(tool, args, timeoutMs) {
     const timeout = setTimeout(() => {
       proc.kill('SIGTERM');
       setTimeout(() => proc.kill('SIGKILL'), 5000);
     }, timeoutMs);

     try {
       return await executeTask();
     } finally {
       clearTimeout(timeout);
     }
   }
   ```

2. **Checkpoint/Resume Support** (Post-MVP)
   - Save intermediate state every N seconds
   - Resume from last checkpoint on timeout

3. **Progress Monitoring**
   - Track stdout/stderr activity
   - Kill if no output for X seconds (watchdog)

4. **Configuration**
   ```yaml
   policies:
     max_task_duration_sec: 300
     max_total_duration_sec: 1800
   ```

### Risk 3: Partial Failure Recovery

**Description**: Some tasks succeed, others fail, leaving system in inconsistent state.

**Examples**:
- File created but metadata not updated
- Database record inserted but cache not invalidated
- Dependency installed but lockfile not committed

**Impact**:
- Manual cleanup required
- Difficult to retry
- Data corruption

**Mitigations**:

1. **Retry Logic with Exponential Backoff**
   ```typescript
   async function executeWithRetry(fn, maxRetries) {
     for (let i = 0; i <= maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (i === maxRetries) throw error;
         const delay = Math.pow(2, i) * 1000;
         await sleep(delay);
       }
     }
   }
   ```

2. **Idempotent Operations**
   - Check if task already completed before execution
   - Use checksums to detect changes
   - Skip no-op operations

3. **Transaction-like Semantics**
   - Write to temp files first
   - Atomic rename on success
   - Rollback on failure

4. **Clear Failure Logs**
   ```jsonl
   {"level":"error","task_id":"task-003","message":"Failed after 3 retries","payload":{"error":"ENOENT"}}
   ```

### Risk 4: LLM Response Parsing Failure

**Description**: Claude Code returns malformed JSON or unexpected format.

**Examples**:
- JSON with trailing commas
- Wrapped in markdown code blocks
- Explanatory text before/after JSON
- Truncated response

**Impact**:
- Plan generation fails
- Run aborts immediately
- No useful error message

**Mitigations**:

1. **Few-shot Examples in Prompt**
   ```
   Example valid response:
   [
     {"task_id": "001", "tools": ["echo"], ...}
   ]

   Now generate plan for: {intent}
   Output ONLY valid JSON array, no explanation.
   ```

2. **Robust JSON Extraction**
   ```typescript
   function extractJSON(text: string): any {
     // Try direct parse
     try {
       return JSON.parse(text);
     } catch {}

     // Extract from code blocks
     const match = text.match(/```json\n([\s\S]*?)\n```/);
     if (match) {
       return JSON.parse(match[1]);
     }

     // Extract array/object
     const arrayMatch = text.match(/\[[\s\S]*\]/);
     if (arrayMatch) {
       return JSON.parse(arrayMatch[0]);
     }

     throw new Error('No valid JSON found');
   }
   ```

3. **Schema Validation**
   ```typescript
   const plan = extractJSON(response);
   planSchema.parse(plan); // Zod validation
   ```

4. **Retry with Adjusted Prompt**
   - On failure, add "Remember: output ONLY JSON"
   - Increase temperature slightly to avoid stuck patterns
   - Max 3 retries

### Risk 5: Whitelist Bypass (Shell Injection)

**Description**: Attacker finds way to execute non-whitelisted commands.

**Attack Vectors**:
- Command injection via arguments: `echo "$(rm -rf /)"`
- Shell expansion: `echo *.txt` becomes `echo file1.txt file2.txt`
- Using `shell: true` in spawn

**Impact**:
- **CRITICAL**: Arbitrary code execution
- Data loss, exfiltration
- System compromise

**Mitigations**:

1. **NEVER Use `shell: true`**
   ```typescript
   // FORBIDDEN
   spawn(tool, args, { shell: true }); // ❌

   // REQUIRED
   spawn(tool, args); // ✅
   ```

2. **Argument Whitelisting** (Optional)
   ```typescript
   const SAFE_ARG_PATTERN = /^[a-zA-Z0-9._\/-]+$/;

   function validateArg(arg: string) {
     if (!SAFE_ARG_PATTERN.test(arg)) {
       throw new SecurityError(`Unsafe argument: ${arg}`);
     }
   }
   ```

3. **Regular Security Audits**
   ```bash
   pnpm audit
   pnpm exec eslint --plugin security src/
   ```

4. **Principle of Least Privilege**
   - Run workers as non-root user
   - Use container sandboxes (future)

### Risk 6: Configuration Error

**Description**: Invalid or missing configuration causes unexpected behavior.

**Examples**:
- Empty whitelist (blocks all tools)
- Invalid YAML syntax
- Missing required fields
- Path typos

**Impact**:
- Run fails immediately
- Misleading error messages
- User frustration

**Mitigations**:

1. **Schema Validation**
   ```typescript
   import { configSchema } from './schema';

   try {
     const config = configSchema.parse(loadYAML(path));
   } catch (error) {
     console.error('Configuration error:', error.message);
     process.exit(1);
   }
   ```

2. **Default Config Generation**
   ```bash
   orchestra init  # Creates orchestra.config.yaml
   ```

3. **Validation Command**
   ```bash
   orchestra config validate ./orchestra.config.yaml
   ```

4. **Helpful Error Messages**
   ```
   ❌ Configuration error in orchestra.config.yaml:
      Line 12: whitelist_tools must be non-empty array
      Got: []

   💡 Add at least one tool, e.g.:
      whitelist_tools: [echo, ls, node]
   ```

### Risk 7: Disk Space Exhaustion

**Description**: Logs/artifacts fill up disk, causing run failures.

**Impact**:
- Runs fail with ENOSPC
- System instability
- Data loss

**Mitigations**:

1. **Log Rotation**
   ```typescript
   const MAX_LOG_SIZE = 100 * 1024 * 1024; // 100MB

   if (statSync(logPath).size > MAX_LOG_SIZE) {
     renameSync(logPath, `${logPath}.1`);
   }
   ```

2. **Artifact Cleanup**
   ```bash
   # Keep only last 10 runs
   orchestra clean --keep 10
   ```

3. **Disk Space Check**
   ```typescript
   import { statfsSync } from 'fs';

   function checkDiskSpace(path: string) {
     const stats = statfsSync(path);
     const availableGB = (stats.bavail * stats.bsize) / 1e9;

     if (availableGB < 1) {
       throw new Error(`Low disk space: ${availableGB.toFixed(2)}GB available`);
     }
   }
   ```

### Risk 8: Concurrent Task Conflicts

**Description**: Parallel tasks modify same resource, causing corruption.

**Examples**:
- Multiple tasks writing to same file
- Race conditions in filesystem
- Lock file contention (package managers)

**Impact**:
- Corrupted artifacts
- Non-deterministic failures
- Difficult to debug

**Mitigations**:

1. **Task Dependency Graph**
   - DAG ensures tasks with shared resources run sequentially
   - Explicit `depends_on` field in task schema

2. **File Locking**
   ```typescript
   import { open, close } from 'fs/promises';

   async function withLock(path: string, fn: () => Promise<void>) {
     const lockPath = `${path}.lock`;
     const fd = await open(lockPath, 'wx'); // Fail if exists

     try {
       await fn();
     } finally {
       await close(fd);
       await unlink(lockPath);
     }
   }
   ```

3. **Unique Artifact Paths**
   ```typescript
   const artifactPath = `./runs/${runId}/artifacts/${taskId}/${filename}`;
   ```

### Risk 9: API Rate Limiting (Claude Code)

**Description**: Too many LLM calls trigger rate limits, blocking runs.

**Impact**:
- Runs fail with 429 errors
- User blocked from service
- Costs spike

**Mitigations**:

1. **Caching**
   ```typescript
   const planCache = new Map<string, Task[]>();

   async function getCachedPlan(intent: string) {
     if (planCache.has(intent)) {
       log('info', 'Using cached plan');
       return planCache.get(intent);
     }

     const plan = await coordinator.createPlan(intent);
     planCache.set(intent, plan);
     return plan;
   }
   ```

2. **Retry with Backoff**
   ```typescript
   async function callLLMWithBackoff(prompt: string) {
     for (let i = 0; i < 5; i++) {
       try {
         return await callClaudeCode(prompt);
       } catch (error) {
         if (error.status === 429) {
           const delay = Math.pow(2, i) * 1000;
           log('warn', `Rate limited, retrying in ${delay}ms`);
           await sleep(delay);
         } else {
           throw error;
         }
       }
     }
   }
   ```

3. **Token Budgeting**
   ```yaml
   llm:
     max_tokens_per_request: 4000
     max_tokens_per_day: 100000
   ```

### Risk 10: Dependency Version Conflicts

**Description**: Incompatible package versions break builds.

**Impact**:
- Installation failures
- Runtime errors
- Security vulnerabilities

**Mitigations**:

1. **Lock Files**
   ```bash
   # Commit pnpm-lock.yaml to git
   git add pnpm-lock.yaml
   ```

2. **Renovate/Dependabot**
   - Automated dependency updates
   - PRs with test results

3. **Peer Dependency Checks**
   ```bash
   pnpm install --strict-peer-dependencies
   ```

## Risk Monitoring

### Metrics to Track

```typescript
interface RiskMetrics {
  timeout_rate: number;       // % tasks timing out
  retry_rate: number;         // % tasks requiring retries
  parse_failure_rate: number; // % LLM responses failing parse
  security_violations: number; // Count of security events
  disk_usage_gb: number;      // Current disk usage
}
```

### Alerting Thresholds

```yaml
alerts:
  timeout_rate_threshold: 0.10      # Alert if >10% timeout
  retry_rate_threshold: 0.30        # Alert if >30% retries
  parse_failure_threshold: 0.05     # Alert if >5% parse failures
  disk_usage_threshold_gb: 10       # Alert if <10GB free
```

## Incident Playbooks

### Playbook: All Tasks Timing Out

1. Check system load: `top`, `htop`
2. Review task complexity in plan
3. Increase `max_task_duration_sec` if legitimate
4. Kill runaway processes: `orchestra kill <run_id>`

### Playbook: Security Violation Detected

1. Stop all runs: `orchestra stop --all`
2. Review audit log: `cat audit.log | jq 'select(.severity == "SECURITY")'`
3. Identify attack vector
4. Update whitelist/policies
5. Restart with stricter config

### Playbook: Disk Full

1. Check disk usage: `df -h`
2. Clean old runs: `orchestra clean --keep 5`
3. Rotate logs: `logrotate /etc/logrotate.d/orchestra`
4. Archive to external storage if needed
