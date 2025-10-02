# 보안 및 안전 가드

## 보안 원칙

1. **기본 거부**: 명시적으로 화이트리스트에 등록되지 않은 한 모든 도구/네트워크/파일시스템 접근 거부
2. **최소 권한**: 태스크 실행에 필요한 최소 권한만 부여
3. **심층 방어**: 다중 보안 제어 계층
4. **안전한 실패**: 에러가 보안 검사를 우회하지 않아야 함
5. **감사 가능성**: 모든 보안 관련 이벤트 로깅

## 도구 화이트리스팅

### 설정

```yaml
whitelist_tools:
  - echo
  - ls
  - cat
  - node
  - pnpm
  - git
  # 이 도구들만 실행 가능
```

### 구현

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

// L3 Worker에서 사용
const validator = new ToolValidator(config.whitelist_tools);

export async function runTool(tool: string, args: string[]) {
  validator.validate(tool); // 화이트리스트에 없으면 throw

  // 실행 진행
  return spawn(tool, args);
}
```

### 우회 방지

**사용하지 말 것**:
- `spawn()`에서 `shell: true` - 셸 인젝션 가능
- 명령어 문자열 연결 - 인젝션에 취약
- 사용자 입력으로부터의 동적 도구 해결

**사용할 것**:
- 명시적 도구 경로: `/usr/bin/echo` (선택 사항)
- 인자 배열: `spawn('echo', ['arg1', 'arg2'])`
- 화이트리스트에서 사전 검증된 도구 이름

### 예시: 취약한 코드 ❌

```typescript
// 취약 - 사용하지 말 것
const cmd = `${tool} ${args.join(' ')}`;
exec(cmd); // 셸 인젝션 가능
```

### 예시: 안전한 코드 ✅

```typescript
// 안전
validator.validate(tool);
spawn(tool, args); // 셸 해석 없음
```

## 파일시스템 샌드박싱

### 설정

```yaml
security:
  fs:
    allow_read: ["./", "/tmp"]      # 읽기 전용 접근
    allow_write: ["./runs", "/tmp"] # 쓰기 접근
```

### 경로 검증

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

### L3 Worker와 통합

```typescript
const fsGuard = new FilesystemGuard(
  config.security.fs.allow_read,
  config.security.fs.allow_write
);

export async function saveArtifact(path: string, content: string) {
  fsGuard.validateWrite(path); // 경로가 허용되지 않으면 throw
  await writeFile(path, content);
}
```

### 경로 순회 보호

```typescript
// ../../../etc/passwd 공격 방지
export function sanitizePath(userPath: string, baseDir: string): string {
  const normalized = normalize(resolve(baseDir, userPath));

  if (!normalized.startsWith(resolve(baseDir))) {
    throw new SecurityError('Path traversal detected');
  }

  return normalized;
}
```

## 네트워크 격리

### 설정

```yaml
security:
  net:
    allow_domains: []  # 비어있음 = 모두 거부
    # 또는 특정 도메인 화이트리스트:
    # allow_domains: ["api.github.com", "registry.npmjs.org"]
```

### 구현 전략

#### 전략 1: 환경 변수

```typescript
export function enforceNetworkPolicy(config: Config) {
  if (!config.policies.allow_network) {
    // 네트워크 차단을 위해 존재하지 않는 프록시로 지정
    process.env.HTTP_PROXY = 'http://localhost:9999';
    process.env.HTTPS_PROXY = 'http://localhost:9999';
    process.env.NO_PROXY = ''; // 프록시 우회 안함
  }
}
```

#### 전략 2: 도메인 화이트리스트 (네트워크 허용 시)

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

// 사용
const netGuard = new NetworkGuard(config.security.net.allow_domains);
netGuard.validateUrl('https://api.github.com/repos'); // 화이트리스트에 있으면 OK
```

#### 전략 3: DNS 차단 (Linux)

```bash
# /etc/hosts에 추가 (sudo 필요)
0.0.0.0 malicious-site.com
```

### 네트워크 활동 감지

```typescript
import { spawn } from 'child_process';

// 네트워크 syscall 모니터링 (Linux만)
export function monitorNetworkCalls(pid: number) {
  const strace = spawn('strace', ['-e', 'trace=network', '-p', pid.toString()]);

  strace.stderr.on('data', (data) => {
    log('warn', 'Network activity detected', { pid, syscall: data.toString() });
  });
}
```

## 비밀 정보 Redaction

### 감지할 패턴

```typescript
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{32,}/g,           // OpenAI API 키
  /ghp_[A-Za-z0-9]{36}/g,            // GitHub personal 토큰
  /AKIA[A-Z0-9]{16}/g,               // AWS access 키
  /AIza[A-Za-z0-9_-]{35}/g,          // Google API 키
  /[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}/g, // 신용카드 (기본)
  /"password"\s*:\s*"[^"]+"/g,       // JSON의 비밀번호
  /Bearer\s+[A-Za-z0-9\-._~+/]+/g,   // Bearer 토큰
];
```

### Redaction 함수

```typescript
export function redactSecrets(text: string): string {
  let redacted = text;

  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, '***REDACTED***');
  }

  return redacted;
}

// 로거에서 사용
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

### 환경 변수 Redaction

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

## 리소스 제한

### 타임아웃

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
          proc.kill('SIGKILL'); // SIGTERM 실패 시 강제 종료
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

### 메모리 제한 (Linux)

```typescript
import { spawn } from 'child_process';

export function spawnWithMemoryLimit(
  tool: string,
  args: string[],
  maxMemoryMB: number
) {
  // cgroups v2 사용 (Linux만)
  const cgroupPath = `/sys/fs/cgroup/orchestra/${uuid()}`;

  // cgroup 생성 및 메모리 제한 설정
  mkdirSync(cgroupPath, { recursive: true });
  writeFileSync(`${cgroupPath}/memory.max`, `${maxMemoryMB * 1024 * 1024}`);

  const proc = spawn(tool, args);

  // cgroup에 프로세스 추가
  writeFileSync(`${cgroupPath}/cgroup.procs`, proc.pid.toString());

  return proc;
}
```

### 동시 태스크 제한

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

// 사용
const pool = new WorkerPool(config.concurrency.max_workers);

for (const task of tasks) {
  await pool.execute(() => worker.execute(task));
}
```

## 입력 검증

### 태스크 스키마 검증

```typescript
import { z } from 'zod';

const taskInputSchema = z.object({
  args: z.array(z.string().max(1000)), // 인자 길이 제한
  env: z.record(z.string(), z.string().max(10000)),
  files: z.array(z.object({
    path: z.string().max(255),
    content: z.string().max(1024 * 1024), // 1MB 제한
  })).max(100), // 최대 100개 파일
});

export function validateTaskInputs(inputs: unknown) {
  return taskInputSchema.parse(inputs); // 유효하지 않으면 throw
}
```

### 명령 인젝션 방지

```typescript
// 절대 이렇게 하지 말 것
const badCmd = `rm -rf ${userInput}`;

// 항상 이렇게 할 것
const args = ['-rf', userInput];
spawn('rm', args); // 인자가 올바르게 이스케이프됨
```

## 감사 로깅

### 보안 이벤트

```typescript
export function auditLog(event: string, details: any) {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    event,
    severity: 'SECURITY',
    trace_id: getTraceId(),
    details: redactSecrets(JSON.stringify(details)),
  };

  // 별도 감사 파일에 로깅
  appendFileSync('./audit.log', JSON.stringify(auditEntry) + '\n');

  // 표준 로거를 통해서도 로깅
  log('warn', `[AUDIT] ${event}`, details);
}

// 예시
auditLog('TOOL_WHITELIST_VIOLATION', { tool: 'curl', user_intent: intent });
auditLog('PATH_TRAVERSAL_ATTEMPT', { path: '../../../../etc/passwd' });
auditLog('NETWORK_ACCESS_DENIED', { url: 'https://malicious.com' });
```

## 보안 체크리스트

### 실행 전
- [ ] 스키마에 대해 설정 검증됨
- [ ] 화이트리스트 로드 및 비어있지 않음
- [ ] 파일시스템 경로 해결 및 검증됨
- [ ] 네트워크 정책 적용됨
- [ ] 리소스 제한 설정됨

### 실행 중
- [ ] 모든 도구가 화이트리스트에 대해 검증됨
- [ ] 모든 파일 쓰기가 허용된 경로에 대해 확인됨
- [ ] 모든 네트워크 요청이 차단되거나 도메인 확인됨
- [ ] 로그에서 비밀 정보 redact됨
- [ ] 타임아웃 적용됨

### 실행 후
- [ ] 위반에 대한 감사 로그 검토됨
- [ ] 임시 파일 정리됨
- [ ] 리소스 제한 초과 안됨
- [ ] 로그에 보안 에러 없음

## 인시던트 대응

### 보안 위반 감지

```typescript
export function handleSecurityViolation(violation: SecurityError) {
  // 1. 감사 추적에 로깅
  auditLog('SECURITY_VIOLATION', {
    error: violation.message,
    stack: violation.stack,
  });

  // 2. 현재 태스크 종료
  process.exit(1);

  // 3. (선택 사항) 알림 전송
  // sendAlert({ type: 'security', severity: 'critical', details: violation });
}
```

### 정기 보안 감사

```bash
# 의존성의 취약점 확인
pnpm audit

# 정적 분석
pnpm exec eslint --plugin security

# 의존성 업데이트
pnpm update --latest
```
