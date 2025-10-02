# 리스크 및 완화 방안

## 리스크 평가 매트릭스

| # | 리스크 | 영향 | 확률 | 심각도 | 우선순위 |
|---|------|--------|-------------|----------|----------|
| 1 | 도구 비결정성 | Medium | High | **Medium** | P1 |
| 2 | 장시간 실행 태스크 타임아웃 | High | Medium | **High** | P0 |
| 3 | 부분 실패 복구 | Medium | High | **Medium** | P1 |
| 4 | LLM 응답 파싱 실패 | High | Medium | **High** | P0 |
| 5 | 화이트리스트 우회 (셸 인젝션) | Very High | Low | **Critical** | P0 |
| 6 | 설정 에러 | Medium | Medium | **Medium** | P2 |
| 7 | 디스크 공간 소진 | High | Low | **Medium** | P2 |
| 8 | 동시 태스크 충돌 | Medium | Medium | **Medium** | P2 |
| 9 | API 속도 제한 (Claude Code) | High | Medium | **High** | P1 |
| 10 | 의존성 버전 충돌 | Low | Medium | **Low** | P3 |

## 상세 리스크 분석

### 리스크 1: 도구 비결정성

**설명**: 동일한 입력이 실행마다 다른 출력을 생성하여 재현성이 깨짐.

**예시**:
- 생성된 파일의 타임스탬프
- 출력의 랜덤 UUID
- 네트워크 의존적 결과 (DNS, 외부 API)
- 파일시스템 경쟁 조건

**영향**:
- Golden 테스트 실패
- 문제 디버깅 어려움
- 예상 동작에 대한 사용자 혼란

**완화 방안**:

1. **`--dry-run` 사전 검증**
   ```typescript
   if (options.dryRun) {
     // 부작용 없이 시뮬레이션
     return simulateExecution(task);
   }
   ```

2. **Golden 테스트 픽스처**
   - `tests/fixtures/`에 예상 출력 캡처
   - `diff` 또는 구조 비교로 비교
   - 제외할 비결정적 필드 플래그 지정

3. **LLM 설정**
   ```yaml
   llm:
     temperature: 0      # 결정적 샘플링
     seed: 12345         # 고정 랜덤 시드 (지원되는 경우)
   ```

4. **테스트에서 시간 고정**
   ```typescript
   import { vi } from 'vitest';

   vi.setSystemTime(new Date('2025-10-02T14:30:00Z'));
   ```

### 리스크 2: 장시간 실행 태스크 타임아웃

**설명**: 태스크가 설정된 시간 제한을 초과하여 파이프라인을 차단하거나 리소스를 소비함.

**예시**:
- 도구의 무한 루프
- 중단되는 네트워크 요청
- 대용량 파일 작업
- 응답하지 않는 서브프로세스

**영향**:
- 실행이 완료되지 않음
- 리소스 소진 (CPU, 메모리)
- 사용자 불만

**완화 방안**:

1. **강제 타임아웃**
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

2. **체크포인트/재개 지원** (Post-MVP)
   - N초마다 중간 상태 저장
   - 타임아웃 시 마지막 체크포인트에서 재개

3. **진행 모니터링**
   - stdout/stderr 활동 추적
   - X초 동안 출력 없으면 종료 (워치독)

4. **설정**
   ```yaml
   policies:
     max_task_duration_sec: 300
     max_total_duration_sec: 1800
   ```

### 리스크 3: 부분 실패 복구

**설명**: 일부 태스크는 성공하고 다른 태스크는 실패하여 시스템이 일관성 없는 상태로 남음.

**예시**:
- 파일 생성되었지만 메타데이터 업데이트 안됨
- 데이터베이스 레코드 삽입되었지만 캐시 무효화 안됨
- 의존성 설치되었지만 lockfile 커밋 안됨

**영향**:
- 수동 정리 필요
- 재시도 어려움
- 데이터 손상

**완화 방안**:

1. **지수 백오프를 사용한 재시도 로직**
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

2. **멱등적 작업**
   - 실행 전 태스크가 이미 완료되었는지 확인
   - 체크섬을 사용하여 변경 감지
   - no-op 작업 건너뛰기

3. **트랜잭션과 같은 의미론**
   - 먼저 임시 파일에 쓰기
   - 성공 시 원자적 이름 변경
   - 실패 시 롤백

4. **명확한 실패 로그**
   ```jsonl
   {"level":"error","task_id":"task-003","message":"Failed after 3 retries","payload":{"error":"ENOENT"}}
   ```

### 리스크 4: LLM 응답 파싱 실패

**설명**: Claude Code가 잘못된 JSON 또는 예상치 못한 형식을 반환함.

**예시**:
- 후행 쉼표가 있는 JSON
- 마크다운 코드 블록으로 래핑됨
- JSON 전후의 설명 텍스트
- 잘린 응답

**영향**:
- 계획 생성 실패
- 즉시 실행 중단
- 유용한 에러 메시지 없음

**완화 방안**:

1. **프롬프트에 Few-shot 예제**
   ```
   Example valid response:
   [
     {"task_id": "001", "tools": ["echo"], ...}
   ]

   Now generate plan for: {intent}
   Output ONLY valid JSON array, no explanation.
   ```

2. **강건한 JSON 추출**
   ```typescript
   function extractJSON(text: string): any {
     // 직접 파싱 시도
     try {
       return JSON.parse(text);
     } catch {}

     // 코드 블록에서 추출
     const match = text.match(/```json\n([\s\S]*?)\n```/);
     if (match) {
       return JSON.parse(match[1]);
     }

     // 배열/객체 추출
     const arrayMatch = text.match(/\[[\s\S]*\]/);
     if (arrayMatch) {
       return JSON.parse(arrayMatch[0]);
     }

     throw new Error('No valid JSON found');
   }
   ```

3. **스키마 검증**
   ```typescript
   const plan = extractJSON(response);
   planSchema.parse(plan); // Zod 검증
   ```

4. **조정된 프롬프트로 재시도**
   - 실패 시 "Remember: output ONLY JSON" 추가
   - 막힌 패턴을 피하기 위해 temperature 약간 증가
   - 최대 3회 재시도

### 리스크 5: 화이트리스트 우회 (셸 인젝션)

**설명**: 공격자가 화이트리스트에 없는 명령을 실행하는 방법을 찾음.

**공격 벡터**:
- 인자를 통한 명령 인젝션: `echo "$(rm -rf /)"`
- 셸 확장: `echo *.txt`가 `echo file1.txt file2.txt`가 됨
- spawn에서 `shell: true` 사용

**영향**:
- **CRITICAL**: 임의 코드 실행
- 데이터 손실, 유출
- 시스템 침해

**완화 방안**:

1. **절대 `shell: true` 사용 금지**
   ```typescript
   // 금지됨
   spawn(tool, args, { shell: true }); // ❌

   // 필수
   spawn(tool, args); // ✅
   ```

2. **인자 화이트리스팅** (선택 사항)
   ```typescript
   const SAFE_ARG_PATTERN = /^[a-zA-Z0-9._\/-]+$/;

   function validateArg(arg: string) {
     if (!SAFE_ARG_PATTERN.test(arg)) {
       throw new SecurityError(`Unsafe argument: ${arg}`);
     }
   }
   ```

3. **정기 보안 감사**
   ```bash
   pnpm audit
   pnpm exec eslint --plugin security src/
   ```

4. **최소 권한 원칙**
   - 워커를 비루트 사용자로 실행
   - 컨테이너 샌드박스 사용 (향후)

### 리스크 6: 설정 에러

**설명**: 유효하지 않거나 누락된 설정으로 인해 예상치 못한 동작 발생.

**예시**:
- 빈 화이트리스트 (모든 도구 차단)
- 유효하지 않은 YAML 구문
- 필수 필드 누락
- 경로 오타

**영향**:
- 즉시 실행 실패
- 오해의 소지가 있는 에러 메시지
- 사용자 불만

**완화 방안**:

1. **스키마 검증**
   ```typescript
   import { configSchema } from './schema';

   try {
     const config = configSchema.parse(loadYAML(path));
   } catch (error) {
     console.error('Configuration error:', error.message);
     process.exit(1);
   }
   ```

2. **기본 설정 생성**
   ```bash
   orchestra init  # orchestra.config.yaml 생성
   ```

3. **검증 명령**
   ```bash
   orchestra config validate ./orchestra.config.yaml
   ```

4. **도움이 되는 에러 메시지**
   ```
   ❌ Configuration error in orchestra.config.yaml:
      Line 12: whitelist_tools must be non-empty array
      Got: []

   💡 Add at least one tool, e.g.:
      whitelist_tools: [echo, ls, node]
   ```

### 리스크 7: 디스크 공간 소진

**설명**: 로그/아티팩트가 디스크를 가득 채워 실행 실패 발생.

**영향**:
- ENOSPC로 실행 실패
- 시스템 불안정
- 데이터 손실

**완화 방안**:

1. **로그 로테이션**
   ```typescript
   const MAX_LOG_SIZE = 100 * 1024 * 1024; // 100MB

   if (statSync(logPath).size > MAX_LOG_SIZE) {
     renameSync(logPath, `${logPath}.1`);
   }
   ```

2. **아티팩트 정리**
   ```bash
   # 최근 10개 run만 유지
   orchestra clean --keep 10
   ```

3. **디스크 공간 확인**
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

### 리스크 8: 동시 태스크 충돌

**설명**: 병렬 태스크가 동일한 리소스를 수정하여 손상 발생.

**예시**:
- 여러 태스크가 동일한 파일에 쓰기
- 파일시스템의 경쟁 조건
- 잠금 파일 경합 (패키지 매니저)

**영향**:
- 손상된 아티팩트
- 비결정적 실패
- 디버깅 어려움

**완화 방안**:

1. **태스크 의존성 그래프**
   - DAG가 공유 리소스를 가진 태스크를 순차적으로 실행하도록 보장
   - 태스크 스키마에 명시적 `depends_on` 필드

2. **파일 잠금**
   ```typescript
   import { open, close } from 'fs/promises';

   async function withLock(path: string, fn: () => Promise<void>) {
     const lockPath = `${path}.lock`;
     const fd = await open(lockPath, 'wx'); // 존재하면 실패

     try {
       await fn();
     } finally {
       await close(fd);
       await unlink(lockPath);
     }
   }
   ```

3. **고유 아티팩트 경로**
   ```typescript
   const artifactPath = `./runs/${runId}/artifacts/${taskId}/${filename}`;
   ```

### 리스크 9: API 속도 제한 (Claude Code)

**설명**: 너무 많은 LLM 호출이 속도 제한을 유발하여 실행 차단.

**영향**:
- 429 에러로 실행 실패
- 서비스에서 사용자 차단
- 비용 급증

**완화 방안**:

1. **캐싱**
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

2. **백오프를 사용한 재시도**
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

3. **토큰 예산**
   ```yaml
   llm:
     max_tokens_per_request: 4000
     max_tokens_per_day: 100000
   ```

### 리스크 10: 의존성 버전 충돌

**설명**: 호환되지 않는 패키지 버전으로 빌드 중단.

**영향**:
- 설치 실패
- 런타임 에러
- 보안 취약점

**완화 방안**:

1. **Lock 파일**
   ```bash
   # pnpm-lock.yaml을 git에 커밋
   git add pnpm-lock.yaml
   ```

2. **Renovate/Dependabot**
   - 자동화된 의존성 업데이트
   - 테스트 결과가 포함된 PR

3. **Peer Dependency 체크**
   ```bash
   pnpm install --strict-peer-dependencies
   ```

## 리스크 모니터링

### 추적할 메트릭

```typescript
interface RiskMetrics {
  timeout_rate: number;       // 타임아웃되는 태스크 비율
  retry_rate: number;         // 재시도가 필요한 태스크 비율
  parse_failure_rate: number; // 파싱 실패하는 LLM 응답 비율
  security_violations: number; // 보안 이벤트 수
  disk_usage_gb: number;      // 현재 디스크 사용량
}
```

### 알림 임계값

```yaml
alerts:
  timeout_rate_threshold: 0.10      # >10% 타임아웃 시 알림
  retry_rate_threshold: 0.30        # >30% 재시도 시 알림
  parse_failure_threshold: 0.05     # >5% 파싱 실패 시 알림
  disk_usage_threshold_gb: 10       # <10GB 여유 공간 시 알림
```

## 인시던트 플레이북

### 플레이북: 모든 태스크 타임아웃

1. 시스템 로드 확인: `top`, `htop`
2. 계획의 태스크 복잡도 검토
3. 정당한 경우 `max_task_duration_sec` 증가
4. 폭주 프로세스 종료: `orchestra kill <run_id>`

### 플레이북: 보안 위반 감지

1. 모든 실행 중지: `orchestra stop --all`
2. 감사 로그 검토: `cat audit.log | jq 'select(.severity == "SECURITY")'`
3. 공격 벡터 식별
4. 화이트리스트/정책 업데이트
5. 더 엄격한 설정으로 재시작

### 플레이북: 디스크 가득 참

1. 디스크 사용량 확인: `df -h`
2. 오래된 run 정리: `orchestra clean --keep 5`
3. 로그 로테이션: `logrotate /etc/logrotate.d/orchestra`
4. 필요한 경우 외부 스토리지에 아카이브
