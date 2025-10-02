# Security & Safety Guards

## Security Principles

1. **Deny by Default**: All tools/network/filesystem access denied unless explicitly whitelisted
2. **Least Privilege**: Grant minimum permissions necessary for task execution
3. **Defense in Depth**: Multiple layers of security controls
4. **Fail Secure**: Errors should not bypass security checks
5. **Auditability**: All security-relevant events logged

## Tool Whitelisting

### Configuration

```yaml
whitelist_tools:
  - echo
  - ls
  - cat
  - node
  - pnpm
  - git
  # Only these tools can be executed
```

### Implementation

```typescript
export class ToolValidator {
  constructor(private whitelist: string[]) {}

  validate(tool: string): void {
    if (!this.whitelist.includes(tool)) {
      throw new SecurityError(
        `Tool '${tool}' not in whitelist. Allowed: ${this.whitelist.join(', ')}`
      );
    }
  }
}

// Usage in L3 Worker
const validator = new ToolValidator(config.whitelist_tools);

export async function runTool(tool: string, args: string[]) {
  validator.validate(tool); // Throws if not whitelisted

  // Proceed with execution
  return spawn(tool, args);
}
```

### Bypass Prevention

**DO NOT** use:
- `shell: true` in `spawn()` - enables shell injection
- String concatenation of commands - vulnerable to injection
- Dynamic tool resolution from user input

**DO** use:
- Explicit tool paths: `/usr/bin/echo` (optional)
- Argument arrays: `spawn('echo', ['arg1', 'arg2'])`
- Pre-validated tool names from whitelist

### Example: Vulnerable Code ❌

```typescript
// VULNERABLE - DO NOT USE
const cmd = `${tool} ${args.join(' ')}`;
exec(cmd); // Shell injection possible
```

### Example: Secure Code ✅

```typescript
// SECURE
validator.validate(tool);
spawn(tool, args); // No shell interpolation
```

## Filesystem Sandboxing

### Configuration

```yaml
security:
  fs:
    allow_read: ["./", "/tmp"]      # Read-only access
    allow_write: ["./runs", "/tmp"] # Write access
```

### Path Validation

```typescript
import { resolve, normalize } from 'path';

export class FilesystemGuard {
  constructor(
    private allowRead: string[],
    private allowWrite: string[]
  ) {}

  canRead(path: string): boolean {
    const normalized = normalize(resolve(path));
    return this.allowRead.some(allowed =>
      normalized.startsWith(resolve(allowed))
    );
  }

  canWrite(path: string): boolean {
    const normalized = normalize(resolve(path));
    return this.allowWrite.some(allowed =>
      normalized.startsWith(resolve(allowed))
    );
  }

  validateWrite(path: string): void {
    if (!this.canWrite(path)) {
      throw new SecurityError(
        `Write access denied: ${path}. Allowed: ${this.allowWrite.join(', ')}`
      );
    }
  }
}
```

### Integration with L3 Worker

```typescript
const fsGuard = new FilesystemGuard(
  config.security.fs.allow_read,
  config.security.fs.allow_write
);

export async function saveArtifact(path: string, content: string) {
  fsGuard.validateWrite(path); // Throws if path not allowed
  await writeFile(path, content);
}
```

### Path Traversal Protection

```typescript
// Prevent ../../../etc/passwd attacks
export function sanitizePath(userPath: string, baseDir: string): string {
  const normalized = normalize(resolve(baseDir, userPath));

  if (!normalized.startsWith(resolve(baseDir))) {
    throw new SecurityError('Path traversal detected');
  }

  return normalized;
}
```

## Network Isolation

### Configuration

```yaml
security:
  net:
    allow_domains: []  # Empty = deny all
    # Or whitelist specific domains:
    # allow_domains: ["api.github.com", "registry.npmjs.org"]
```

### Implementation Strategies

#### Strategy 1: Environment Variables

```typescript
export function enforceNetworkPolicy(config: Config) {
  if (!config.policies.allow_network) {
    // Point to non-existent proxy to block network
    process.env.HTTP_PROXY = 'http://localhost:9999';
    process.env.HTTPS_PROXY = 'http://localhost:9999';
    process.env.NO_PROXY = ''; // Don't bypass proxy
  }
}
```

#### Strategy 2: Domain Whitelist (if network allowed)

```typescript
import { URL } from 'url';

export class NetworkGuard {
  constructor(private allowedDomains: string[]) {}

  validateUrl(url: string): void {
    const parsed = new URL(url);

    if (!this.allowedDomains.includes(parsed.hostname)) {
      throw new SecurityError(
        `Domain '${parsed.hostname}' not in whitelist. Allowed: ${this.allowedDomains.join(', ')}`
      );
    }
  }
}

// Usage
const netGuard = new NetworkGuard(config.security.net.allow_domains);
netGuard.validateUrl('https://api.github.com/repos'); // OK if whitelisted
```

#### Strategy 3: DNS Blocking (Linux)

```bash
# Add to /etc/hosts (requires sudo)
0.0.0.0 malicious-site.com
```

### Detecting Network Activity

```typescript
import { spawn } from 'child_process';

// Monitor for network syscalls (Linux only)
export function monitorNetworkCalls(pid: number) {
  const strace = spawn('strace', ['-e', 'trace=network', '-p', pid.toString()]);

  strace.stderr.on('data', (data) => {
    log('warn', 'Network activity detected', { pid, syscall: data.toString() });
  });
}
```

## Secret Redaction

### Patterns to Detect

```typescript
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{32,}/g,           // OpenAI API keys
  /ghp_[A-Za-z0-9]{36}/g,            // GitHub personal tokens
  /AKIA[A-Z0-9]{16}/g,               // AWS access keys
  /AIza[A-Za-z0-9_-]{35}/g,          // Google API keys
  /[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}/g, // Credit cards (basic)
  /"password"\s*:\s*"[^"]+"/g,       // Password in JSON
  /Bearer\s+[A-Za-z0-9\-._~+/]+/g,   // Bearer tokens
];
```

### Redaction Function

```typescript
export function redactSecrets(text: string): string {
  let redacted = text;

  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, '***REDACTED***');
  }

  return redacted;
}

// Usage in logger
export function log(level: string, message: string, payload: any = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    trace_id: getTraceId(),
    level,
    message: redactSecrets(message),
    payload: JSON.parse(redactSecrets(JSON.stringify(payload))),
  };

  console.error(JSON.stringify(entry));
}
```

### Environment Variable Redaction

```typescript
export function sanitizeEnv(env: Record<string, string>): Record<string, string> {
  const sensitive = ['API_KEY', 'TOKEN', 'SECRET', 'PASSWORD', 'PRIVATE'];
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (sensitive.some(s => key.toUpperCase().includes(s))) {
      sanitized[key] = '***REDACTED***';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
```

## Resource Limits

### Timeouts

```typescript
import { spawn } from 'child_process';

export async function runToolWithTimeout(
  tool: string,
  args: string[],
  timeoutMs: number
): Promise<ExecutionResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(tool, args);
    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');

      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL'); // Force kill if SIGTERM fails
        }
      }, 5000);

      reject(new TimeoutError(`Task exceeded ${timeoutMs}ms timeout`));
    }, timeoutMs);

    proc.stdout?.on('data', (data) => (stdout += data));
    proc.stderr?.on('data', (data) => (stderr += data));

    proc.on('close', (code) => {
      clearTimeout(timer);

      if (!killed) {
        resolve({ exit_code: code || 0, stdout, stderr });
      }
    });
  });
}
```

### Memory Limits (Linux)

```typescript
import { spawn } from 'child_process';

export function spawnWithMemoryLimit(
  tool: string,
  args: string[],
  maxMemoryMB: number
) {
  // Use cgroups v2 (Linux only)
  const cgroupPath = `/sys/fs/cgroup/orchestra/${uuid()}`;

  // Create cgroup and set memory limit
  mkdirSync(cgroupPath, { recursive: true });
  writeFileSync(`${cgroupPath}/memory.max`, `${maxMemoryMB * 1024 * 1024}`);

  const proc = spawn(tool, args);

  // Add process to cgroup
  writeFileSync(`${cgroupPath}/cgroup.procs`, proc.pid.toString());

  return proc;
}
```

### Concurrent Task Limits

```typescript
export class WorkerPool {
  private activeWorkers = 0;

  constructor(private maxWorkers: number) {}

  async execute<T>(task: () => Promise<T>): Promise<T> {
    while (this.activeWorkers >= this.maxWorkers) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.activeWorkers++;

    try {
      return await task();
    } finally {
      this.activeWorkers--;
    }
  }
}

// Usage
const pool = new WorkerPool(config.concurrency.max_workers);

for (const task of tasks) {
  await pool.execute(() => worker.execute(task));
}
```

## Input Validation

### Task Schema Validation

```typescript
import { z } from 'zod';

const taskInputSchema = z.object({
  args: z.array(z.string().max(1000)), // Limit arg length
  env: z.record(z.string(), z.string().max(10000)),
  files: z.array(z.object({
    path: z.string().max(255),
    content: z.string().max(1024 * 1024), // 1MB limit
  })).max(100), // Max 100 files
});

export function validateTaskInputs(inputs: unknown) {
  return taskInputSchema.parse(inputs); // Throws on invalid
}
```

### Command Injection Prevention

```typescript
// NEVER do this
const badCmd = `rm -rf ${userInput}`;

// ALWAYS do this
const args = ['-rf', userInput];
spawn('rm', args); // Arguments properly escaped
```

## Audit Logging

### Security Events

```typescript
export function auditLog(event: string, details: any) {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    event,
    severity: 'SECURITY',
    trace_id: getTraceId(),
    details: redactSecrets(JSON.stringify(details)),
  };

  // Log to separate audit file
  appendFileSync('./audit.log', JSON.stringify(auditEntry) + '\n');

  // Also log via standard logger
  log('warn', `[AUDIT] ${event}`, details);
}

// Examples
auditLog('TOOL_WHITELIST_VIOLATION', { tool: 'curl', user_intent: intent });
auditLog('PATH_TRAVERSAL_ATTEMPT', { path: '../../../../etc/passwd' });
auditLog('NETWORK_ACCESS_DENIED', { url: 'https://malicious.com' });
```

## Security Checklist

### Pre-execution
- [ ] Configuration validated against schema
- [ ] Whitelist loaded and non-empty
- [ ] Filesystem paths resolved and validated
- [ ] Network policy applied
- [ ] Resource limits configured

### During execution
- [ ] All tools validated against whitelist
- [ ] All file writes checked against allowed paths
- [ ] All network requests blocked or domain-checked
- [ ] Secrets redacted from logs
- [ ] Timeouts enforced

### Post-execution
- [ ] Audit log reviewed for violations
- [ ] Temporary files cleaned up
- [ ] Resource limits not exceeded
- [ ] No security errors in logs

## Incident Response

### Detected Security Violation

```typescript
export function handleSecurityViolation(violation: SecurityError) {
  // 1. Log to audit trail
  auditLog('SECURITY_VIOLATION', {
    error: violation.message,
    stack: violation.stack,
  });

  // 2. Terminate current task
  process.exit(1);

  // 3. (Optional) Send alert
  // sendAlert({ type: 'security', severity: 'critical', details: violation });
}
```

### Regular Security Audits

```bash
# Check for vulnerabilities in dependencies
pnpm audit

# Static analysis
pnpm exec eslint --plugin security

# Dependency updates
pnpm update --latest
```
