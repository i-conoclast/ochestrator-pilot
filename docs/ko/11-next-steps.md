# 다음 단계 및 로드맵

## Post-MVP 우선순위 (주 3-4)

### 1. 체크포인트 및 재개 지원

**문제**: 중간에 타임아웃되거나 실패하는 장시간 실행 태스크는 전체 재실행이 필요함.

**해결책**: 체크포인트/재개 메커니즘 구현.

#### 구현

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

  // 대기 중인 태스크만 재실행
  return executeTasks(checkpoint.pending_tasks);
}
```

#### CLI

```bash
orchestra resume <run_id>
```

**예상 소요**: 3일

---

### 2. 향상된 L2 계획 기능

**문제**: L2가 부분 실패나 재계획 시나리오에 적응할 수 없음.

**해결책**: 실패 시 동적 재계획 추가.

#### 기능

1. **실패 분석**
   - L2가 실패한 태스크 로그 분석
   - 실패가 일시적인지 영구적인지 판단

2. **재계획**
   - 대체 태스크 분해 생성
   - 실패한 컴포넌트 우회
   - 수동 개입 제안

3. **멀티 LLM 지원**
   - Claude Code 사용 불가 시 GPT-4로 폴백
   - 여러 LLM의 계획 비교 (선택 사항)

#### 예시

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

**예상 소요**: 5일

---

### 3. CI/CD 통합

**문제**: 수동 실행은 자동화된 파이프라인에 적합하지 않음.

**해결책**: GitHub Actions 통합 및 종료 코드 규칙.

#### GitHub Actions 워크플로우

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

#### 종료 코드

- `0`: 모든 태스크 성공
- `1`: 설정 에러
- `2`: 하나 이상의 태스크 실패
- `3`: 타임아웃
- `4`: 보안 위반

**예상 소요**: 2일

---

### 4. 웹 대시보드 (선택 사항)

**문제**: 콘솔 출력은 장시간 실행이나 원격 모니터링에 적합하지 않음.

**해결책**: 실행 시각화를 위한 간단한 웹 UI.

#### 기능

- 실시간 로그 스트리밍 (WebSocket)
- 태스크 DAG 시각화 (Cytoscape.js 또는 D3)
- 아티팩트 브라우저
- 실행 비교

#### 스택

- **백엔드**: Express.js + WebSocket
- **프론트엔드**: React + TailwindCSS
- **데이터베이스**: SQLite (실행 메타데이터용)

#### 스크린샷

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

**예상 소요**: 7일 (선택 사항)

---

## 중기 기능 (월 2-3)

### 1. 분산 실행

**목표**: 확장성을 위해 원격 머신에서 L3 워커 실행.

#### 아키텍처

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

#### 설정

```yaml
workers:
  - host: worker1.example.com
    ssh_key: ~/.ssh/id_rsa
    capacity: 4
  - host: worker2.example.com
    ssh_key: ~/.ssh/id_rsa
    capacity: 8
```

#### 이점

- 수평 확장
- 신뢰할 수 없는 코드 격리
- 이기종 환경 (Linux, macOS, Windows)

**예상 소요**: 14일

---

### 2. 플러그인 시스템

**목표**: 핵심을 수정하지 않고 커스텀 도구/어댑터 허용.

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

#### 사용

```typescript
// plugins/docker_adapter.ts
export const dockerPlugin: OrchestraPlugin = {
  name: 'docker',
  version: '1.0.0',
  tools: [
    {
      name: 'docker',
      execute: async (args, env) => {
        // 커스텀 Docker 실행 로직
        return runDocker(args, env);
      },
    },
  ],
};

// 설정에서 로드
import { dockerPlugin } from './plugins/docker_adapter';

orchestrator.registerPlugin(dockerPlugin);
```

**예상 소요**: 10일

---

### 3. 고급 보안

#### 기능

1. **SELinux/AppArmor 통합**
   - Mandatory Access Control (MAC)
   - 프로세스 격리

2. **컨테이너 샌드박스**
   - 각 L3 태스크를 Docker/Podman에서 실행
   - 격리된 네트워크 네임스페이스

3. **감사 컴플라이언스**
   - SOC 2 로깅 요구사항
   - 변조 방지 감사 추적 (추가 전용 로그)

#### 예시

```yaml
security:
  sandbox_mode: "docker"
  docker_image: "node:20-alpine"
  docker_network: "none"
  docker_volumes:
    - "./runs:/runs:rw"
```

**예상 소요**: 12일

---

## 장기 비전 (월 4+)

### 1. 자율 에이전트 모드

**목표**: L2가 사전 정의된 화이트리스트 없이 도구를 선택하고 계획을 생성.

#### 과제

- 도구 발견 (L2가 무엇을 사용할 수 있는지 어떻게 아는가?)
- 보안 영향 (무제한 도구 접근)
- 정확성 검증

#### 접근 방식

1. **기능 협상**
   - L3가 사용 가능한 도구를 L2에 광고
   - L2가 발견된 기능에서 선택

2. **샌드박스 도구 탐색**
   - L3가 격리된 컨테이너에서 실행
   - 실제 실행 전 드라이런 검증

3. **인간 개입**
   - 사용자가 자동 발견된 도구 승인
   - 시간이 지남에 따라 개인 화이트리스트 구축

**예상 소요**: 30일 이상

---

### 2. 학습 및 최적화

**목표**: 과거 데이터를 사용하여 시간이 지남에 따라 계획 품질 향상.

#### 기법

1. **인간 피드백을 통한 강화 학습 (RLHF)**
   - 사용자가 계획 품질 평가 (좋아요/싫어요)
   - 성공한 계획으로 LLM 미세 조정

2. **성능 모델링**
   - 과거 데이터에서 태스크 지속 시간 예측
   - 최소 총 시간을 위한 DAG 최적화

3. **실패 패턴 인식**
   - 일반적인 실패 모드 감지
   - 알려진 함정 사전 회피

#### 예시

```
Historical Data:
- "Build TypeScript project" → [pnpm install, pnpm build] (95% 성공)
- "Build TypeScript project" → [npm install, npm build] (60% 성공)

New Task: "Build TypeScript project"
Preferred Plan: [pnpm install, pnpm build] (히스토리에서 학습)
```

**예상 소요**: 45일 이상

---

### 3. 상용 배포

#### SaaS 버전

- **호스팅 Orchestrator**: 사용자가 API를 통해 태스크 제출
- **관리형 워커**: 자동 확장 워커 풀
- **사용량 기반 가격**: 태스크당 또는 분당 청구
- **팀 협업**: 공유 계획, 실행 히스토리

#### 온프레미스 엔터프라이즈

- **자체 호스팅**: 고객 인프라에 배포
- **SSO 통합**: SAML, OAuth
- **감사 및 컴플라이언스**: 상세 로깅, 접근 제어
- **지원**: SLA, 전담 지원 엔지니어

**예상 소요**: 60일 이상 + 비즈니스 개발

---

## 즉시 실행 항목 (다음 스프린트)

### 주 3

| Day | 태스크 | 담당자 |
|-----|------|-------|
| Mon | 체크포인트 save/load 구현 | Dev |
| Tue | `orchestra resume` 명령 추가 | Dev |
| Wed | 체크포인트 통합 테스트 작성 | Dev |
| Thu | L2 재계획 로직 시작 | Dev |
| Fri | 코드 리뷰 + 문서화 | Dev |

### 주 4

| Day | 태스크 | 담당자 |
|-----|------|-------|
| Mon | L2 재계획 완료 | Dev |
| Tue | 멀티 LLM 백엔드 지원 추가 | Dev |
| Wed | CI/CD 예제 워크플로우 생성 | Dev |
| Thu | 성능 벤치마킹 | Dev |
| Fri | 블로그 포스트 + 데모 비디오 | 마케팅 |

---

## 기능 요청 및 커뮤니티 피드백

### 상위 요청 기능 (GitHub Issues)

1. **VS Code Extension** (32 👍)
   - 에디터에서 Orchestra 태스크 실행
   - 인라인 계획 시각화

2. **Terraform/Kubernetes Integration** (28 👍)
   - 인프라 프로비저닝 태스크
   - Helm 차트 배포

3. **Interactive Mode** (24 👍)
   - 실행 중 사용자 입력 요청
   - 수동 승인 게이트

4. **Plan Diffing** (19 👍)
   - 실행 간 계획 비교
   - 자동화의 드리프트 감지

5. **Metrics Dashboard** (15 👍)
   - Grafana/Prometheus 통합
   - SLO 추적

---

## 기여하기

기여를 환영합니다! 다음을 위해 [CONTRIBUTING.md](../../CONTRIBUTING.md)를 참조하세요:

- 코드 스타일 가이드
- PR 프로세스
- 이슈 트리아지
- 커뮤니티 가이드라인

### Good First Issues

- [ ] 새 도구 어댑터 추가 (예: `make`, `gradle`)
- [ ] 에러 메시지 개선
- [ ] 예제 시나리오 작성
- [ ] 다른 언어로 문서 번역

---

## 버전 관리 및 릴리스

### Semantic Versioning

- **Major (1.0.0)**: API 변경 사항
- **Minor (1.1.0)**: 새 기능, 하위 호환
- **Patch (1.0.1)**: 버그 수정

### 릴리스 일정

- **MVP (1.0.0)**: 주 2
- **v1.1.0** (체크포인트/재개): 주 4
- **v1.2.0** (향상된 계획): 주 6
- **v2.0.0** (분산 실행): 월 3

---

## 지원 및 리소스

- **문서**: https://orchestra-cli.dev/docs
- **GitHub**: https://github.com/example/orchestra-cli
- **Discord**: https://discord.gg/orchestra
- **이메일**: support@orchestra-cli.dev

---

**에이전트 오케스트레이션의 미래를 구축하고 싶으신가요? 시작해봅시다! 🚀**
