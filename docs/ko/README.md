# Orchestra CLI 문서 (한국어)

Orchestra CLI 문서에 오신 것을 환영합니다! 이 포괄적인 가이드는 Claude Code로 구동되는 3단계 에이전트 오케스트레이션 시스템의 설계, 아키텍처 및 구현을 다룹니다.

## 📚 목차

### 핵심 문서

1. **[요약](./01-executive-summary.md)**
   - Orchestra CLI 개요
   - 주요 기능 및 이점
   - 대상 사용 사례
   - 프로젝트 일정

2. **[아키텍처](./02-architecture.md)**
   - 시스템 개요 및 설계 원칙
   - 3계층 아키텍처 (L1/L2/L3)
   - 데이터 흐름 및 통신 프로토콜
   - 실행 모델 및 안전 메커니즘

3. **[인터페이스 명세](./03-interface-specs.md)**
   - 역할 및 책임 표
   - Task 메시지 JSON 스키마
   - 설정 파일 구조
   - 상태 머신 및 전환

4. **[CLI 사용자 경험](./04-cli-ux.md)**
   - 명령어 및 플래그 참조
   - 콘솔 출력 예시
   - 인터랙티브 기능
   - 오류 처리

### 계획 및 구현

5. **[계획 및 백로그](./05-planning-backlog.md)**
   - Epic 및 마일스톤
   - 작업 분해 구조 (WBS)
   - 2주 MVP 계획
   - MoSCoW 우선순위 지정

6. **[코드 스캐폴딩](./06-code-scaffolding.md)**
   - 프로젝트 구조 (TypeScript + pnpm)
   - 패키지 설정
   - 핵심 구현 스텁
   - 최소 실행 가능 예제

### 품질 및 운영

7. **[평가 및 품질](./07-evaluation-quality.md)**
   - 테스트 전략 및 테스트 매트릭스
   - 유닛 및 통합 테스트
   - Golden 테스트 픽스처
   - CI/CD 통합

8. **[관찰 가능성 및 Telemetry](./08-observability.md)**
   - JSONL 로깅 아키텍처
   - Trace ID 전파
   - 메트릭 수집
   - 런 디렉토리 구조

### 보안 및 리스크 관리

9. **[보안 및 안전 가드](./09-security.md)**
   - 도구 화이트리스팅
   - 파일시스템 및 네트워크 샌드박싱
   - 비밀 정보 마스킹
   - 리소스 제한 및 타임아웃

10. **[리스크 및 완화 방안](./10-risks-mitigations.md)**
    - 리스크 평가 매트릭스
    - 상세 분석이 포함된 상위 10개 리스크
    - 완화 전략
    - 인시던트 플레이북

### 향후 개발

11. **[다음 단계 및 로드맵](./11-next-steps.md)**
    - Post-MVP 우선순위 (3-4주차)
    - 중기 기능 (2-3개월)
    - 장기 비전 (4개월 이상)
    - 기능 요청 및 커뮤니티 피드백

## 🚀 빠른 시작

**Orchestra CLI가 처음이신가요?** 여기서 시작하세요:

1. 고수준 개요를 위해 [요약](./01-executive-summary.md) 읽기
2. 시스템 설계를 이해하기 위해 [아키텍처](./02-architecture.md) 검토
3. 사용 예제를 위해 [CLI UX](./04-cli-ux.md) 확인
4. 프로젝트 설정을 위해 [코드 스캐폴딩](./06-code-scaffolding.md) 따라하기

## 📖 문서 규칙

### 코드 예제

모든 코드 예제는 TypeScript + pnpm을 구현 스택으로 사용합니다:

```typescript
// 코드 블록 예시
import { orchestrate } from './l1/orchestrator';

await orchestrate('Create README', { planOnly: true });
```

### 설정 예제

설정 파일은 YAML 포맷을 사용합니다:

```yaml
# orchestra.config.yaml
version: "1.0"
policies:
  allow_network: false
```

### 명령어 예제

CLI 명령어는 bash 구문으로 표시됩니다:

```bash
orchestra run "Build project" --plan-only
```

## 🌍 언어 버전

- **English**: [docs/en/](../en/README.md)
- **한국어 (Korean)**: 현재 위치입니다! ([docs/ko/](./))

## 📝 문서 상태

| 문서 | 상태 | 최종 업데이트 |
|------|------|---------------|
| 01-executive-summary.md | ✅ 완료 | 2025-10-02 |
| 02-architecture.md | ✅ 완료 | 2025-10-02 |
| 03-interface-specs.md | ✅ 완료 | 2025-10-02 |
| 04-cli-ux.md | ✅ 완료 | 2025-10-02 |
| 05-planning-backlog.md | ✅ 완료 | 2025-10-02 |
| 06-code-scaffolding.md | ✅ 완료 | 2025-10-02 |
| 07-evaluation-quality.md | ✅ 완료 | 2025-10-02 |
| 08-observability.md | ✅ 완료 | 2025-10-02 |
| 09-security.md | ✅ 완료 | 2025-10-02 |
| 10-risks-mitigations.md | ✅ 완료 | 2025-10-02 |
| 11-next-steps.md | ✅ 완료 | 2025-10-02 |

## 🤝 기여하기

오류를 발견했거나 문서를 개선하고 싶으신가요?

1. 문제를 설명하는 이슈 열기
2. 변경 사항이 포함된 Pull Request 제출
3. 스타일 가이드 따르기 (메인 README.md 참조)

## 📧 지원

- **GitHub Issues**: 버그 보고 또는 기능 요청
- **Email**: support@orchestra-cli.dev
- **Discord**: 커뮤니티 채팅에 참여

## 📜 라이선스

이 문서는 MIT 라이선스에 따라 라이선스가 부여됩니다. 자세한 내용은 [LICENSE](../../LICENSE)를 참조하세요.

---

**에이전트 오케스트레이션 시스템을 구축할 준비가 되셨나요?** [아키텍처](./02-architecture.md)로 시작하세요! 🚀
