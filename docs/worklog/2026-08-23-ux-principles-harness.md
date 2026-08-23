# 토스·당근 UX 원칙 레이어 하네스 확장

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-08-23 |
| 작성 | 리더 세션 (guksu-harness:harness 기존 확장 분기) |
| 관련 경로 | .claude/skills/ux-principles/, .claude/skills/sprint-orchestrator/, .claude/agents/, .claude/hooks/, CLAUDE.md |

## 1. 개요

사용자가 토스·당근을 레퍼런스로 앱 UI/UX 개선을 요청했다. 사용자 결정 2건 확정: ① 토스·당근은 **UX 원칙 레이어**로 추가하고 킷 `templates/muklog`는 비주얼 단일 출처로 유지(대공사인 비주얼 방향 전환은 기각), ② 진입은 **전 화면 UX 감사 → 백로그 → 항목별 개선 스프린트**. 기존 풀 티어 하네스의 확장이므로 새 에이전트·오케스트레이터는 만들지 않고 기존 파이프라인에 배선했다.

## 2. 작업내용

- `.claude/skills/ux-principles/`(신설) — SKILL.md: 토스 원칙 6(한 화면 한 일·마찰 제거·즉각 피드백·목적 있는 모션·말하듯 카피·타이포 위계) + 당근 원칙 4(관계 친밀감·리스트 스캔성·기록 신뢰 신호·빈 상태 CTA)를 muklog 맥락으로 번역. **위상 절이 핵심**: 킷이 침묵하는 영역에만 적용, 충돌 시 킷 우선+사용자 확인. `references/audit-checklist.md`: 7축 채점(마찰/부하/피드백/모션/카피/스캔/빈·에러) + `docs/ux/ux-backlog.md` 형식 + 감사는 읽기 전용·서브 에이전트 팬아웃 규칙.
- `sprint-orchestrator` 스킬 — Phase 0에 "UX 개선 플로우" 신설(백로그 확인 → 감사 팬아웃 → 사용자 우선순위 확정 → 항목별 기존 파이프라인, 1 스프린트 = 백로그 1~3개 동질 항목). description에 UX 개선/감사/백로그 트리거 추가.
- `sprint-planning` 스킬·`sprint-planner` 에이전트 — UX 개선 스프린트 시 백로그 항목의 위반 원칙 번호를 인수조건에 인용(개선의 관찰 가능화). description 후속 키워드 보강.
- `ui-publishing` 스킬·`ui-publisher` 에이전트 — 킷이 침묵하는 마이크로 결정(로딩·pressed·모션·카피·빈 상태)은 ux-principles 기준 + 적용 원칙 번호를 ui-spec.md에 기록.
- 동반 정비(감사에서 발견): ui-publisher.md 구 경로 `ui_kits/muklog` 2곳 → `templates/muklog`(2026-06-12 마이그레이션 누락분), ui-design SKILL.md frontmatter name `wanted-design` → `ui-design`(validate error), integration-qa·rn-supabase-dev description 후속 키워드 추가, **blockSecretAccess.mjs 훅 신설·등록**(기존 deny는 Read 도구만 막아 `cat .env` Bash 우회가 열려 있었음 — 등록 직후 실제 차단 동작 라이브 확인).
- CLAUDE.md — UX 레퍼런스 포인터 + 트리거 갱신 + 변경 이력 1행.
- 검증 — validateHarness error 0건(잔여 warn 1건은 외부 배포 스킬 ui-design 영문 description의 후속 키워드 부재 — 자산형 스킬이라 수용).

## 3. 주의사항

- **킷 충돌 항목은 게이트가 있다**: 백로그의 `킷 충돌 ⚠️` 항목은 사용자 승인 없이 스프린트에 넣지 않는다. 승인된 킷 변경은 킷 파일 먼저 → RN 번역 순서.
- UX 감사는 아직 실행 전 — `docs/ux/ux-backlog.md`는 존재하지 않는다. 다음 단계는 "UX 감사" 요청으로 오케스트레이터의 UX 개선 플로우를 태우는 것.
- ui-design 스킬은 외부 배포판이라 재배포 시 frontmatter name 수정(`ui-design`)이 되돌아갈 수 있다 — 재배포 후 validateHarness 재실행 권장.
- 작업 브랜치: `feat/ux-principles-harness`(main에서 분기, 사용자 승인). 커밋·PR은 사용자 요청 시 pr 스킬로.
