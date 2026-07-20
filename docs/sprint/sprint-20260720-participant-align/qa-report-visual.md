# qa-report-visual — participant-align (참여자 블록 ↔ "우리 맛집" 라인 정합)

> 작성: qa-visual. 디자인 단일 출처: 킷 `.claude/skills/ui-design/templates/muklog/mk-log.jsx`.
> 방법: 킷 JSX ↔ RN 컴포넌트 동시 열람 3축 교차검증(레이아웃·토큰·카피) + 좌표/리듬 산술 검산.
> 검증 대상 RN: `MuklogList.tsx`, `ParticipantBlock.tsx`, `LogScreen.tsx`.
> **판정: 통과(PASS).** 불일치 0 · 근사 허용 0 · 미검증 1(렌더 픽셀 최종 확인=디바이스 스모크 영역).

## 결과 요약

| 항목 | 판정 |
|---|---|
| ① 레이아웃·구조(수평 20px 그리드 정합) | 통과 |
| ① 레이아웃·구조(수직 리듬 14/18) | 통과 |
| ② 비주얼·토큰(raw 수치 0, 패딩 소유권) | 통과 |
| ③ 텍스트·카피 | 범위 외 불변(이번 스프린트는 순수 레이아웃 정합) |
| 회귀(헤더 미주입·칩 edge-bleed·FAB·빈 상태) | 통과 |
| 테스트(정렬 계약 실값 단언) | 통과 (80 passed) |
| tsc --noEmit | 통과 (0 error) |
| 코드 컨벤션 | 통과 |

## 1. 수평 정렬 좌표 검산 (화면 기준 좌 x)

토큰은 identity 매핑(`tokens.ts:174` `spacing = {…20:20,16:16,12:12,2:2…}`)이라 px 실값 = 토큰 키.

| 요소 | 좌 x 산술 | 킷 근거 | RN 근거 | 결과 |
|---|---|---|---|---|
| "참여자 N" | 컨테이너 padding 20 + 헤더슬롯 marginHorizontal −20 + 블록 paddingH +20 = **20** | mk-log:81 `padding "12px 20px 2px"` (무패딩 scroll:633 안 자체 20 소유) | `MuklogList.tsx:62,74` + `ParticipantBlock.tsx:48` | ✓ 20px |
| "우리 맛집 N" | 컨테이너 padding 20 (섹션 헤더 자체 H패딩 0) = **20** | mk-log:108 `padding "16px 20px 10px"` | `MuklogList.tsx:62,83` (headerRow H패딩 없음) | ✓ 20px |

두 요소 동일 20px 그리드 라인 정렬. **상쇄 부호·값 정확**: 헤더슬롯 `marginHorizontal: -contentPadding`(−20)이 컨테이너 `padding: contentPadding`(+20)을 정확히 상쇄, 블록 자체 `paddingHorizontal: spacing[20]`이 화면 20px에 안착. AC1 충족.

## 2. 수직 리듬 검산 (킷 실값 대조)

킷 실값(패딩 스택):
- 세그먼트→참여자 = 세그 섹션 bottom 2(mk-log:60) + 참여자 top 12(mk-log:81) = **14px**
- 참여자→"우리 맛집" = 참여자 bottom 2(mk-log:81) + 섹션 헤더 top 16(mk-log:108) = **18px**

ui-spec의 14/18 주장은 **킷 실값과 합치**(적정). RN 재현 검산:

| 구간 | RN 산술 | 결과 |
|---|---|---|
| 세그먼트→참여자 | segWrap paddingBottom 2(`LogScreen.tsx:575`) + [ScrollView content top 20 − 헤더슬롯 marginTop 20 = 0] + 블록 paddingTop 12 = **14** | ✓ 킷 14 |
| 참여자→"우리 맛집" | 블록 paddingBottom 2 + 헤더슬롯 marginBottom 16(`MuklogList.tsx:75`) = **18** | ✓ 킷 18 |

경계면 주의: 세그먼트는 LogScreen `segWrap`(body 바깥), 참여자는 body 내부 ScrollView contentContainer. body(`LogScreen.tsx:576` flex:1, 무패딩)와 ScrollView 요소 자체에 top gap이 없고 contentContainer top 20은 슬롯 marginTop −20으로 상쇄되므로, 컴포넌트 경계를 넘어도 2+12=14 성립. 이중 상단 패딩(구 32px) 제거 확인. AC2 충족.

> 참고(불일치 아님): plan.md §3 AC2 문면은 "킷 12px"로 블록 자체 top만 지칭하나, 킷 실 총간격은 14px이고 RN도 14px. ui-spec §2가 14로 정확히 계산 — 문서 표현 차이일 뿐 재현값은 킷 1:1.

## 3. 토큰·패딩 소유권 (②축)

- raw hex 스캔: 3개 대상 파일 `#[0-9a-fA-F]{6}` = **0건**. 색은 전부 토큰 경유.
- 정렬 관련 수치 전부 `theme.spacing[*]` 토큰(raw 20/16/12/2 하드코딩 없음). AC4 충족.
- `ParticipantBlock`이 킷 mk-log:81 padding 12/20/2를 **자체 소유** 유지(`ParticipantBlock.tsx:48`) — 정합의 기준점. 소비처(LogScreen:515) 단 1곳, 블록 무변경.

## 4. 회귀 (③ 동일 파일 내 다른 요소 불변)

| 케이스 | 확인 | 결과 |
|---|---|---|
| wish 세그 | seg==='wish'면 MuklogList 미렌더(WishlistBody로 스위치, `LogScreen.tsx:494`) → 헤더슬롯 자체 부재 | 간섭 0 |
| 멤버 미로드/error | `header={membersState.ready ? <ParticipantBlock/> : null}`(:514) → `{header ? … : null}`(:69)로 슬롯 미렌더, 섹션 헤더가 컨테이너 top 20에 직접 안착(orphan margin 없음) | 회귀 0 |
| 카테고리 칩 edge-bleed | 칩 행 `marginHorizontal −20 + paddingHorizontal 20`(:139,136) = 헤더슬롯과 동일 상쇄 패턴, 형제 노드로 독립 상쇄(스택 간섭 없음) | 간섭 0 |
| FAB / 빈 상태 | 헤더슬롯은 주입 헤더 래퍼만 감쌈 — FAB(:174 absolute)·빈 상태(:114) 불변 | 불변 |

## 5. 테스트 (정렬 계약 실값 단언)

`npx jest MuklogList ParticipantBlock LogScreen` = **3 suites / 80 passed**, `tsc --noEmit` = **0 error**.

정렬 계약을 실값으로 단언함을 확인:
- `MuklogList.spec.tsx:114-137` — 헤더슬롯 `marginHorizontal === -containerPad`(실 style에서 20 읽어 −20 대조, AC1), `marginTop === -containerPad`(AC2 이중 패딩 제거), `marginBottom === spacing[16]`(AC2 리듬), header 없으면 슬롯 미렌더(회귀).
- `ParticipantBlock.spec.tsx:111-120` — 블록 자체 padding `paddingHorizontal===20`·`paddingTop===12`·`paddingBottom===2` 리터럴 단언(정합 기준점 고정).

## 6. 미검증 (디바이스 스모크 영역)

산술 좌표·리듬은 통과했으나 **실제 렌더 픽셀의 최종 눈 확인은 디바이스 스모크 영역**이다(테스트는 style 객체 단언까지만 커버). 특히 flexWrap 멤버 행 래핑·긴 닉네임 ellipsis·safe-area(top inset) 합산 시의 실측 정렬은 [[qa-layout-blind-spot]] 교훈대로 실기기/시뮬 1회 눈 확인을 권장. 이번 변경은 순수 마진/패딩 상쇄라 레이아웃 리스크는 낮음.
