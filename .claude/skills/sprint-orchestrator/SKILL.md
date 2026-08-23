---
name: sprint-orchestrator
description: "muklog 개발 스프린트를 조율하는 오케스트레이터. planner→ui-publisher→developer→qa 에이전트 팀으로 한 스프린트에 한 기능만 구현한다. '스프린트 시작', '○○ 기능 개발', '먹로그/초대코드/지도/프로필 등 기능 구현', 'UI 퍼블리싱/디자인 정합/킷 불일치 수정', 'UX 개선/UX 감사/백로그 진행'(토스·당근 레퍼 개선 루프), 다음 스프린트 진행 요청 시 사용. 후속 작업: 스프린트 재실행, 수정, 보완, 이전 스프린트 결과 개선, QA만 다시, UX 감사 다시·백로그 갱신, 특정 기능/화면만 다시 구현 요청 시에도 반드시 이 스킬을 사용."
---

# muklog Sprint Orchestrator

muklog 개발을 **스프린트 단위**로 조율하는 통합 스킬. 한 스프린트는 **하나의 기능만** 다루며, `sprint-planner → ui-publisher → developer → qa(qa-visual ∥ qa-logic)` 에이전트 팀이 협업한다.

## 실행 모드: 에이전트 팀 (기획→퍼블리싱→구현→검증 파이프라인)

설계→퍼블리싱→구현→검증의 피드백 루프가 핵심이므로 에이전트 팀으로 운영한다. **역할 경계가 핵심:** planner=무엇을(기획·계약), **ui-publisher=어떻게 보이는가(킷→RN 토큰·프리미티브·화면 골격)**, developer=어떻게 동작하는가(데이터·훅·배선), **qa-logic=로직·통합 정합성(퍼블리싱 제외)** / **qa-visual=킷 시안 대비 비주얼 충실도**. ui-publisher가 "비주얼이 맞는 껍데기"를 먼저 만들고 developer가 데이터·로직을 붙인다(둘은 일부 병렬 가능 — developer가 백엔드·훅을 준비하는 동안 ui-publisher가 토큰·프리미티브·골격을 만든다). **두 QA는 서로 독립이라 병렬 실행**하며(qa-visual은 ui-publisher 산출물↔킷, qa-logic은 developer 산출물↔계약), 모듈 완성 직후 점진적으로 개입한다(incremental QA).

## 절대 규칙
0. **TDD가 기본.** 모든 기능은 테스트 우선(Red→Green→Refactor). planner가 인수조건을 테스트 케이스로 정의 → developer가 실패 테스트 먼저 작성 후 구현 → qa가 테스트 존재·의미·통과를 검증. **스프린트 종료 기준에 `npm test` 전체 통과 + `tsc --noEmit` 포함.** 상세: `docs/testing-strategy.md`.
1. **1 스프린트 = 1 기능.** 여러 기능을 한 스프린트로 묶지 않는다. 사용자가 여러 기능을 요청하면 첫 기능만 진행하고 나머지는 다음 스프린트로 안내한다.
2. **git 작업 절대 금지.** commit·push·branch·merge 등 모든 git 명령을 수행하지 않는다. 커밋과 푸시는 **사용자가 직접** 한다. 스프린트 종료 시 "이제 커밋하셔도 됩니다"로 안내만 한다.
3. **모든 에이전트 호출에 `model: "opus"`.**
4. **설계 문서가 단일 출처.** `docs/design/architecture.md`와 어긋나면 먼저 사용자에게 확인한다.

## 에이전트 구성

| 팀원 | 에이전트 타입 | 역할 | 스킬 | 출력 |
|------|-------------|------|------|------|
| sprint-planner | sprint-planner | 단일 기능 스프린트 기획 | sprint-planning | `plan.md` |
| ui-publisher | ui-publisher | 킷→RN 비주얼 충실도(토큰·프리미티브·화면 골격) | ui-publishing | `ui-spec.md` + 토큰/컴포넌트/골격 소스 |
| developer | developer | RN+Supabase+Kakao 데이터·로직·배선 | rn-supabase-dev | 소스 + `dev-notes.md` |
| qa-logic | general-purpose | 로직·통합 정합성 교차검증(퍼블리싱 제외) | integration-qa | `qa-report-logic.md` |
| qa-visual | general-purpose | 킷 시안 대비 비주얼 충실도 교차검증 | visual-qa | `qa-report-visual.md` |

> qa-logic·qa-visual은 검증 스크립트 실행·Grep이 필요하므로 `general-purpose` 타입으로 스폰한다(각 에이전트 정의 `.claude/agents/qa-logic.md`·`.claude/agents/qa-visual.md`를 프롬프트에 포함). 둘은 **병렬 실행**하고 리포트 파일도 분리한다(로직↔비주얼 독립). 비주얼 이슈→ui-publisher, 로직·경계면 이슈→developer로 라우팅.
> **디자인 단일 출처는 킷 `templates/muklog`**(`.claude/skills/ui-design/templates/muklog/`). ui-publisher가 이를 RN으로 번역한다. developer는 ui-publisher의 컴포넌트/골격 위에 데이터를 바인딩하고, 비주얼을 임의로 바꾸지 않는다(누락 토큰/프리미티브는 ui-publisher에 요청).

## 워크플로우

### Phase 0: 컨텍스트 확인
1. `docs/sprint/` 존재 및 기존 스프린트 폴더 목록 확인.
2. 실행 모드 결정:
   - **신규 스프린트** → Phase 1로.
   - **기존 스프린트 폴더 존재 + 사용자가 수정/보완/QA만 다시 요청** → 부분 재실행. 해당 스프린트 폴더의 plan/dev-notes/qa-report를 읽고, 필요한 에이전트만 재호출.
   - **이전 스프린트 결과 개선 요청** → 대상 스프린트 폴더 경로를 에이전트 프롬프트에 포함하여 기존 산출물을 읽고 반영하도록 지시.
   - **UX 개선/감사 요청** → 아래 "UX 개선 플로우"로.
3. `docs/design/architecture.md`를 읽어 데이터 모델·화면·결정을 로드.

### UX 개선 플로우 (토스·당근 레퍼)

UX 판단 기준은 `ux-principles` 스킬(킷은 비주얼 단일 출처로 유지, 원칙은 킷이 침묵하는 플로우·피드백·모션·카피·빈 상태 영역에만 적용).

1. **백로그 확인** — `docs/ux/ux-backlog.md`가 있으면 감사를 건너뛰고 3으로. 없거나 사용자가 재감사를 요청하면 2로.
2. **UX 감사** (팀 아님 — 서브 에이전트 팬아웃): 탭 영역 단위 1~3개 병렬, 각자 ux-principles 스킬(SKILL.md와 그 안내를 따라 감사 체크리스트 audit-checklist.md까지) + 담당 화면 소스 + 킷 시안을 읽고 7축 채점을 반환 → 리더가 병합해 `docs/ux/ux-backlog.md` 작성. **감사는 읽기 전용**(코드 수정 금지).
3. **우선순위 확인** — 백로그를 사용자에게 보고하고 착수 항목을 확정받는다. `킷 충돌 ⚠️` 항목은 킷 변경 승인 없이는 착수하지 않는다.
4. **개선 스프린트** — 항목별로 기존 파이프라인(Phase 1~5)을 그대로 실행하되 **1 스프린트 = 백로그 1~3개 항목(같은 화면·같은 성격만 묶음)**. planner·ui-publisher 프롬프트에 "ux-principles 스킬을 따르고 백로그 항목 #n의 위반 원칙을 인수조건에 인용하라"를 추가한다. 완료 시 백로그 항목 상태를 갱신한다.

### Phase 1: 스프린트 정의
1. 이번 스프린트의 **단일 기능**을 확정한다 (백로그: architecture.md §5).
2. 스프린트 슬러그 생성: `sprint-{YYYYMMDD}-{name}` (예: `sprint-20260609-invite-room`). 날짜는 사용자에게 확인하거나 시스템 컨텍스트의 현재 날짜를 사용.
3. 스프린트 폴더 생성: `docs/sprint/sprint-{YYYYMMDD}-{name}/`.
4. 기능이 한 스프린트보다 크면 분할을 제안하고 첫 조각만 진행.

### Phase 2: 팀 구성
1. 팀 생성:
   ```
   TeamCreate(
     team_name: "muklog-sprint",
     members: [
       { name: "sprint-planner", agent_type: "sprint-planner", model: "opus",
         prompt: "이번 스프린트 기능: {기능명}. docs/design/architecture.md와 sprint-planning 스킬을 따라 docs/sprint/{slug}/plan.md를 작성하라." },
       { name: "ui-publisher", agent_type: "ui-publisher", model: "opus",
         prompt: "docs/sprint/{slug}/plan.md의 화면·컴포넌트를 디자인 킷 templates/muklog(.claude/skills/ui-design/templates/muklog/)을 단일 출처로 RN에 정합시켜라. ui-publishing 스킬을 따라 docs/sprint/{slug}/ui-spec.md(킷 라인↔RN 매핑·props 계약)를 쓰고, src/theme 토큰·src/components 프리미티브·화면 비주얼 골격을 킷대로 만들되 데이터 바인딩은 props로 노출하라. TDD. git 작업 금지." },
       { name: "developer", agent_type: "developer", model: "opus",
         prompt: "docs/sprint/{slug}/plan.md + ui-spec.md를 따라 데이터·훅·쿼리·Edge Function·네비게이션을 ui-publisher의 컴포넌트/골격에 배선하라(비주얼 임의 변경 금지, 누락 토큰/프리미티브는 ui-publisher에 요청). rn-supabase-dev 스킬. git 작업 금지. dev-notes.md에 생산자↔소비자 매핑을 남겨라." },
       { name: "qa-logic", agent_type: "general-purpose", model: "opus",
         prompt: "{.claude/agents/qa-logic.md 전문 + integration-qa 스킬}. 각 모듈 완성 직후 경계면 통합 정합성·기능 스펙·보안/비용 가드레일·TDD·컨벤션을 생산자↔소비자 양쪽을 같이 읽어 교차검증하고 docs/sprint/{slug}/qa-report-logic.md를 작성하라. 비주얼 충실도는 qa-visual 담당이니 다루지 말 것. git 작업 금지." },
       { name: "qa-visual", agent_type: "general-purpose", model: "opus",
         prompt: "{.claude/agents/qa-visual.md 전문 + visual-qa 스킬}. 각 화면/컴포넌트 완성 직후 킷 templates/muklog 시안 대비 비주얼 충실도(레이아웃·safe-area / 토큰·radius·폰트·간격 / 카피)를 ui-spec.md 매핑 기준 킷 라인↔RN 파일:라인으로 교차검증하고 docs/sprint/{slug}/qa-report-visual.md를 작성하라. 로직/경계면은 qa-logic 담당. git 작업 금지." }
     ]
   )
   ```
2. 작업 등록 (의존성 명시):
   ```
   TaskCreate(tasks: [
     { title: "기획: {기능} plan.md", assignee: "sprint-planner" },
     { title: "퍼블리싱: {기능} ui-spec + 토큰/프리미티브/골격", assignee: "ui-publisher", depends_on: ["기획: {기능} plan.md"] },
     { title: "구현: {기능} 데이터·로직 배선", assignee: "developer", depends_on: ["퍼블리싱: {기능} ui-spec + 토큰/프리미티브/골격"] },
     { title: "비주얼검증: {기능} 킷 시안 충실도", assignee: "qa-visual", depends_on: ["퍼블리싱: {기능} ui-spec + 토큰/프리미티브/골격"] },
     { title: "로직검증: {기능} 정합성·TDD·가드레일", assignee: "qa-logic", depends_on: ["구현: {기능} 데이터·로직 배선"] }
   ])
   ```
   > 퍼블리싱·구현 모두 모듈(프리미티브·화면) 단위로 쪼개고, 각 모듈 완성 시 **비주얼은 qa-visual(ui-publisher↔킷), 로직·경계면은 qa-logic(developer↔계약)** 에게 교차검증을 요청하도록 지시(incremental). 두 QA는 의존 대상이 달라(qa-visual=퍼블리싱, qa-logic=구현) **병렬**로 돈다. developer는 백엔드·훅을 ui-publisher의 골격 완성과 일부 병렬로 준비할 수 있으나, **배선 단계는 ui-spec.md 확정 후** 진행한다.

### Phase 3: 협업 실행
**실행 방식:** 팀원 자체 조율.
- planner가 plan.md 완료 → ui-publisher에게 화면·UX 전달(SendMessage).
- ui-publisher가 ui-spec.md(킷↔RN 매핑·props 계약) 완료 → developer에게 컴포넌트 목록·props 계약 전달.
- developer가 모듈 완성마다 qa-logic에게 교차검증 요청(생산자/소비자 경로 명시). ui-publisher가 컴포넌트/토큰 완성마다 qa-visual에게 킷 대조 요청. developer가 누락 토큰/프리미티브를 만나면 ui-publisher에게 보강 요청.
- qa-logic이 발견 즉시 담당자에게 수정 요청(파일:라인 + 방법): 경계면/데이터/로직 이슈는 developer. qa-visual은 비주얼/토큰/프리미티브/킷 불일치를 ui-publisher에게(킷 라인↔RN 파일:라인). 양쪽 걸친 건 둘 다.
- 리더는 TaskGet으로 진행률 모니터링, 막힌 팀원은 SendMessage로 지원.

**산출물 저장:**

| 팀원 | 출력 경로 |
|------|----------|
| sprint-planner | `docs/sprint/{slug}/plan.md` |
| ui-publisher | `docs/sprint/{slug}/ui-spec.md` + 토큰/컴포넌트/화면 골격 소스 |
| developer | 소스 코드 + `docs/sprint/{slug}/dev-notes.md` |
| qa-logic | `docs/sprint/{slug}/qa-report-logic.md` |
| qa-visual | `docs/sprint/{slug}/qa-report-visual.md` |

### Phase 4: 종료 판정
1. **qa-report-logic.md**(인수조건·정합성·TDD·가드레일)와 **qa-report-visual.md**(킷 비주얼 충실도, 체크리스트: visual-qa 스킬 / ui-publishing §5)가 **모두 통과**인지 + **`npm test` 전체 통과 + `tsc --noEmit`** 확인(TDD 종료 기준). 미통과면 담당자(비주얼→ui-publisher / 데이터·로직→developer) 재작업 → 해당 qa 재검증(최대 2~3회).
2. 잔여 이슈는 `docs/sprint/{slug}/qa-report.md`에 "미해결"로 명시.
3. 스프린트 요약을 사용자에게 보고.

### Phase 5: 정리
1. 팀원 종료(SendMessage) 후 `TeamDelete`.
2. 스프린트 폴더 산출물 보존.
3. 사용자에게: 변경 파일 요약 + 통과/미해결 + **"git 커밋/푸시는 직접 진행하세요"** 안내 + 다음 스프린트 후보 제시.

## 데이터 흐름
```
[리더] → TeamCreate
   planner → plan.md ──SendMessage(화면·UX)──► ui-publisher
       ui-spec.md + 토큰/프리미티브/골격 ──┬─SendMessage(props 계약)─► developer
                                           └─SendMessage(킷 대조)────► qa-visual ──수정요청(킷 라인↔RN)──► ui-publisher
   developer ──모듈 완성마다 SendMessage(생산자/소비자)──► qa-logic ──수정요청(파일:라인)──► developer
   (qa-visual ∥ qa-logic 병렬 — 의존 대상이 달라 동시 진행)
   plan.md / ui-spec.md / dev-notes.md / qa-report-logic.md / qa-report-visual.md ──Read──► [리더: 종료 판정] → 사용자 보고
```

## 에러 핸들링
| 상황 | 전략 |
|------|------|
| 팀원 1명 실패/중지 | 리더가 감지 → 상태 확인 → 재시작 또는 대체 |
| QA 무한 루프 | 재검증 2~3회 초과 시 잔여 이슈를 "미해결"로 기록하고 사용자에게 판단 요청 |
| 계약 충돌(planner↔ui-publisher↔developer) | 삭제하지 않고 plan.md/ui-spec.md에 출처 병기, 리더가 사용자에게 확인 |
| 킷과 plan.md 디자인 충돌 | ui-publisher가 킷 라인을 근거로 확정 제안 → 리더가 사용자 확인. 킷이 디자인 단일 출처. |
| RN이 킷을 100% 재현 불가(컬러 그림자·blur 등) | ui-publisher가 근사+사유를 ui-spec.md에 기록, qa는 "근사 허용"으로 통과 처리 |
| 기능이 스프린트보다 큼 | 분할 제안, 첫 조각만 진행 |
| 누군가 git 명령 시도 | 즉시 차단, 사용자 전담임을 재고지 |

## 테스트 시나리오
### 정상 흐름
1. 사용자가 "초대코드 방 기능 스프린트 시작" 요청.
2. Phase 1에서 `sprint-20260609-invite-room` 폴더 생성.
3. Phase 2에서 팀 5명(planner·ui-publisher·developer·qa-logic·qa-visual) + 작업 5개 등록.
4. planner→ui-publisher→developer→qa(qa-logic ∥ qa-visual)가 자체 조율하며 모듈별 incremental 검증.
5. 두 qa-report(logic·visual) 전 항목 통과 → 요약 보고 + "커밋은 직접" 안내.

### 에러 흐름
1. developer가 Edge Function 응답 shape을 훅과 다르게 구현.
2. qa-logic이 경계면 불일치 발견 → developer에게 파일:라인 수정 요청.
3. developer 수정 → qa-logic 재검증 통과.
4. 2회 내 미해결이면 qa-report-logic에 "미해결" 명시 후 사용자 보고.
