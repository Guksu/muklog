# QA Report — 로직·통합 정합성 (sprint-20260812-memo-max-height)

> 담당: qa-logic · 기준: `integration-qa` 스킬 + `plan.md` §6/§6-1/§7/§8 + `docs/code-convention.md` + `docs/testing-strategy.md`
> 비주얼 충실도(킷 시안 대조)는 qa-visual 담당 — 본 리포트 범위 밖.
> **판정: 통과 (중대 결함 0).** 상 0건 / 중 1건(디바이스 스모크 항목 보강 권고) / 하 2건(관찰·기록).

---

## 0. 소스 동결 검증 (착수 ↔ 종료)

dev가 "소스 동결" 상태로 인계했으므로, 검증 중 트리가 변하지 않았음을 체크섬으로 양단 확인했다.

| 파일 | 착수 시 sha1 | 종료 시 sha1 | 동일 |
|------|-------------|-------------|------|
| `src/features/muklog/MuklogEditor/MuklogEditor.tsx` | `68262df3…` | `68262df3…` | ✅ |
| `src/features/muklog/MuklogEditor/MuklogEditor.spec.tsx` | `cf2df15e…` | `cf2df15e…` | ✅ |
| `src/features/muklog/MuklogEditor/memoBoxHeight.ts` | `92aeabec…` | `92aeabec…` | ✅ |
| `src/features/muklog/MuklogEditor/memoBoxHeight.spec.ts` | `d9791125…` | `d9791125…` | ✅ |
| `src/theme/tokens/tokens.ts` | `289a5c4e…` | `289a5c4e…` | ✅ |
| `src/theme/tokens/tokens.spec.ts` | `c817643b…` | `c817643b…` | ✅ |
| `src/theme/tokens/index.ts` | `a49c02b5…` | `a49c02b5…` | ✅ |
| `src/features/muklog/MuklogEditor/index.ts` | `fd3107f6…` | `fd3107f6…` | ✅ |

`git status --porcelain`도 착수/종료 동일(수정 4 + 신규 2 + 스프린트 문서 디렉터리). **QA 중 실 소스 변형 0건.**

---

## 1. 검증 포인트 1 — 높이 계약 lockstep · 참조 단일출처

### 1-1. 계약 수치가 plan §4-2와 일치하는가 → ✅ 통과

`memoBoxHeight.ts:28`의 식이 plan §4-2 공식과 문자 그대로 일치한다.

```
박스 높이 = lineHeight × lines + paddingVertical × 2 + borderWidth × 2
```

킷 원본을 직접 열어 대조했다 — `.claude/skills/ui-design/templates/muklog/mk-log.jsx:452` `<textarea rows={4}>`, 같은 파일 `:644-645` `lk.textarea` = `padding: "14px 16px"`, `font: "500 15px/1.6"`, `resize: "none"`, `boxSizing: "border-box"`. 킷의 `rows={4}`는 **콘텐츠 박스 4행**을 뜻하고 여기에 padding·border가 더해지므로, RN 번역식이 `lineHeight×4 + padding×2 + border×2`인 것이 박스 모델상 옳다. 실값 `24×4 + 14×2 + 0.5×2 = 125`.

### 1-2. minHeight == maxHeight가 스타일에 실제 배선됐는가 → ✅ 통과

`MuklogEditor.tsx:386-396`에서 `memoBoxSize`를 한 번 계산해 `minHeight`·`maxHeight` **양쪽에 같은 변수**를 넣는다. `MuklogEditor.tsx:598`의 스타일 배열 `[styles.input, styles.memo, fieldInput, memoBox]`에서 `memoBox`가 **마지막**이라 flatten 시 우선 적용된다(RN 스타일 배열 later-wins). 하드코딩 `125`는 소스에 0건(grep 확인, `MuklogEditor.tsx`에서 매칭된 `296` 2건은 모두 킷 참조 주석).

`styles.memo`에서 `minHeight: 96`이 제거됐고 `textAlignVertical: 'top'`은 남았다(`MuklogEditor.tsx:652-653`).

### 1-3. 유틸 인자가 스타일 적용값과 같은 출처인가 → ✅ 통과 (단, 하-1 관찰 있음)

| 유틸 인자 (`MuklogEditor.tsx:386-391`) | 스타일에 실제 적용되는 값 | 일치 |
|---|---|---|
| `theme.typography.memoInput.lineHeight` | `memoBox`의 `...theme.typography.memoInput` 스프레드 → `lineHeight: 24` | ✅ 동일 객체 |
| `MEMO_INPUT_LINES` (=4) | (계약 상수, 스타일 대응 없음 — rows 번역) | ✅ |
| `theme.spacing[14]` | `fieldInput.paddingVertical = theme.spacing[14]` (`:404`) | ✅ 같은 토큰 |
| `StyleSheet.hairlineWidth` | `styles.input.borderWidth = StyleSheet.hairlineWidth` (`:651`) | ✅ 같은 표현 |

`spacing[14] === 14`(`tokens.ts:174`) 확인. `makeTypography`(`tokens.ts:207-211`)가 `{fontSize, lineHeight, fontFamily}` **3키만** 반환하므로 `...theme.typography.memoInput` 스프레드가 의도치 않은 스타일 키를 끌고 오지 않는다.

**하-1 (관찰, 수정 요구 아님).** `paddingVertical`·`borderWidth`는 "같은 **토큰/표현**"이지 "같은 **변수**"는 아니다. `fieldInput.paddingVertical`을 `spacing[16]`으로 바꾸면 `memoBoxSize`는 따라오지 않아 4줄이 아니게 된다(조용한 드리프트). 현재는 plan §4-2가 명시한 계약 그대로라 위반이 아니고, 인자 4개가 한 화면 안 20줄 이내에 모여 있어 실제 드리프트 위험은 낮다. 개선안(선택): `const memoPaddingVertical = theme.spacing[14]`를 뽑아 `fieldInput`과 유틸 인자가 같은 식별자를 참조하게 하면 이중화가 완전히 사라진다.

---

## 2. 검증 포인트 2 — 신규 토큰 `memoInput`

### 2-1. 킷 번역 정확성 → ✅ 통과

킷 `mk-log.jsx:645` `font: "500 15px/1.6"` → `tokens.ts:239` `makeTypography({ size: 15, ratio: 1.6, family: 'SUIT-Medium' })` → `{ fontSize: 15, lineHeight: Math.round(15×1.6)=24, fontFamily: 'SUIT-Medium' }`. weight 500 → `SUIT-Medium` 매핑은 기존 `memoBody`(동일 500)와 같은 관례라 일관적이다. `ratio 1.6 ≥ 1.15`라 typo-clipping 안전선 충족.

### 2-2. 기존 토큰 수정 0 → ✅ 통과

`git diff src/theme/tokens/tokens.ts`가 **+2 / −0**이며, 두 줄 모두 신규(`memoInput` 키 1줄 + 주석 1줄). 기존 키 값 변경·삭제 라인 0. `memoBody`(15/1.7 → lh 26)는 손대지 않았고, 소비처(`MuklogDetailScreen.tsx:404`, `MuklogEditor.tsx:507`)도 그대로다. `tokens.spec.ts`의 신규 describe가 `body`·`bodySm`·`fieldLabel`·`memoBody` 실값을 회귀 단언한다.

`typography.memoInput` 소비처는 `MuklogEditor.tsx`(387·393) + 스펙 2곳뿐 — 신규 키가 기존 소비처에 영향 0.

---

## 3. 검증 포인트 3 — 회귀 (저장 경로 · 계약 · 표시 지점)

| 항목 | 검증 방법 | 결과 |
|---|---|---|
| `MEMO_MAX = 500` | `MuklogEditor.tsx:67` 정의·`:594` `maxLength` — diff에 미등장(불변) | ✅ |
| `MEMO_MIN_LENGTH = 5` | `validate/validate.ts:10`·`:78` — 파일 자체 미변경 | ✅ |
| `memoLongEnough` → `canSave` 게이팅 | `MuklogEditor.tsx:320` — diff에 미등장 | ✅ |
| `memo-hint` 문구·톤 | `MuklogEditor.tsx:607` — diff에 미등장 | ✅ |
| `MuklogEditorProps` · `MuklogEditorSubmitInput` | diff에 타입/인터페이스/`onSubmit` 라인 0건 | ✅ |
| 상세화면 ②(`MuklogDetailScreen`) | `git status` 미등장 → diff 0 | ✅ |
| 카드 프리뷰 ③(`MuklogCard`) | `git status` 미등장 → diff 0 | ✅ |
| `types.ts`·`useCreateMuklog`·`useUpdateMuklog`·`useMuklog` | `git status` 미등장 → diff 0 | ✅ |
| `supabase/` 전체 (DDL·RLS·Edge Function·마이그레이션) | `git status` 미등장 → **변경 0건** | ✅ |

`MuklogEditor.tsx` 실제 변경은 **+19 / −3**, hunk 3개(import 1줄 / `memoBoxSize`·`memoBox` 블록 신설 / TextInput props·style + `styles.memo`)뿐이다. 저장 payload 경로(`handleSave` → `createMuklog({ input })` / `onSubmit({ input })`)에 손댄 라인 0.

**비용 가드레일**: 네트워크·DB·Storage 호출 증분 0, 마이그레이션 0건, Kakao 호출 0, AWS 미사용. 순수 클라이언트 스타일·상수 변경이라 §9 계획대로 **런타임 비용 증분 0**. ✅

---

## 4. 검증 포인트 4 — multiline 내부 스크롤 props 플랫폼 처리

**plan §4-2 결정**: `scrollEnabled`를 명시하지 않고 RN 기본값(`true`)에 의존, 주석으로만 기록. `numberOfLines` prop 제거. `textAlignVertical: 'top'` 유지.

**구현 일치 → ✅ 통과.** `MuklogEditor.tsx:590-599`에 `scrollEnabled` 없음, `numberOfLines` 삭제됨(diff `-numberOfLines={4}`), `multiline` 유지. 근거 주석이 `:384`에 남아 있다.

**플랫폼 해석(검증자 판단)**: `scrollEnabled`는 RN에서 **iOS multiline 전용** prop이고 기본 `true`다. Android는 이 prop을 쓰지 않고, 높이가 제한된 `EditText`가 네이티브로 내부 스크롤한다. 따라서 "명시하지 않는다"는 결정이 iOS에서는 기본값 그대로 동작하고 Android에서는 무관하게 네이티브 동작에 위임되므로, **양 플랫폼에서 plan 의도(고정 박스 + 내부 스크롤)와 모순되지 않는다.** 다만 Android의 내부 스크롤 제스처가 부모 `ScrollView`에 가로채질 수 있다는 plan R1/E9는 정적 검증으로 판정 불가 → **디바이스 스모크로 이월**(dev-notes §5에 항목 존재 확인).

### 중-1 (권고) — Android `includeFontPadding` 이 스모크 체크리스트에 명시돼 있지 않다

Android `Text`/`TextInput`은 `includeFontPadding` 기본값이 `true`라 텍스트 레이아웃 위/아래에 폰트 메트릭 기반 여분 패딩이 붙는다. 이 여분은 `lineHeight × lines` 식에 **계산돼 있지 않으므로**, 하드 `maxHeight`와 결합하면 Android에서 4번째 줄 하단이 잘려 보일 수 있다(plan R2/R3가 가리키는 현상의 구체적 기전).

이 프로젝트는 이미 같은 문제를 두 곳에서 `includeFontPadding: false`로 처리한 전례가 있다 — `MuklogDetailScreen.tsx:620`(`ratingText`), `components/AppMark/AppMark.tsx:117`. 메모 입력에는 적용돼 있지 않다.

- **지금 고칠 것은 아니다.** plan R2/R3가 "스모크 관측 전 추측 구현 금지"를 명시했고 dev는 그 지시를 정확히 지켰다(dev-notes §6).
- **요청**: dev-notes §5 Android 항목에 *"4번째 줄 하단이 잘리면 1순위 후보는 `includeFontPadding: false`(선례: `MuklogDetailScreen.tsx:620`), 2순위가 R3의 여유 2px"* 를 **관측 시 대응 후보로 덧붙여** 두면, 스모크에서 문제가 나왔을 때 재조사 없이 바로 처리된다. 현재 체크리스트는 "첫 줄 상단 위치가 어긋나지 않는지"(R2)만 적혀 있어 **하단 잘림의 기전·해법이 비어 있다**.

---

## 5. 검증 포인트 5 — TDD · 테스트 품질

### 5-1. 인수조건 ↔ 테스트 대응 → ✅ 전건 대응

| plan §6 작업 | 대응 테스트 | 확인 |
|---|---|---|
| T1 토큰 | U6(`tokens.spec.ts:467`) + U7·회귀(`:473`·`:479`) | ✅ |
| T2 유틸·상수 | U1~U5(`memoBoxHeight.spec.ts:7-26`) | ✅ |
| T3 타이포 적용 | S2(`MuklogEditor.spec.tsx:804`) | ✅ |
| T4 고정 높이 | S1(`:796`) + S4(`:822`) | ✅ |
| T5 `numberOfLines` 제거 | S3(`:814`) | ✅ |
| T6 회귀 방어 | S5(500자 payload)·S6(힌트·게이팅)·S7(프리필)·S8(누출) | ✅ |
| T7 전체 green | 아래 5-3 | ✅ |
| T8 dev-notes | 존재·스모크 체크리스트 포함 | ✅ |

`plan.md` §6-1의 U1~U7·S1~S8 **15건 전부 구현**됐다. 기존 `MuklogEditor.spec.tsx` 케이스는 diff상 **한 줄도 수정되지 않았고**(추가는 import 2줄 + 말미 describe 1개), 이는 "기존 케이스 수정이 필요하면 계약 위반"이라는 T6 조건을 만족한다.

### 5-2. 뮤테이션 표본 (격리 사본) → ✅ 5/5 전부 검출

**방법(규범 준수)**: 프로젝트 밖 스크래치패드(`/private/tmp/.../scratchpad/mut`)에 `memoBoxHeight.ts`·`memoBoxHeight.spec.ts` 사본을 만들고 `npx jest --roots <scratchpad>`로 격리 실행했다. jest `roots`가 프로젝트 밖을 가리키므로 실 소스는 수집 대상에 들어가지 않고, **실 소스 파일은 한 번도 변형하지 않았다**(§0 체크섬이 이를 증명). 측정 직후 사본 디렉터리 삭제 완료.

| 뮤턴트 | 결과 |
|---|---|
| 기준(무변형) | 5 passed |
| M1 `lineHeight * lines` → `+` | **4 failed** ✅ 검출 |
| M2 `paddingVertical * 2` → `paddingVertical` | **3 failed** ✅ 검출 |
| M3 `+ borderWidth * 2` 항 삭제 | **3 failed** ✅ 검출 |
| M4 `MEMO_INPUT_LINES = 4` → `3` | **1 failed**(U5) ✅ 검출 |
| M5 `borderWidth * 2` → `borderWidth` | **3 failed** ✅ 검출 |
| 복원 후 | 5 passed |

껍데기 단언이 아니라 **계약 수치를 실제로 붙잡고 있음**을 확인했다.

### 5-3. 전체 실행 → ✅ 통과

- `npm test` → **196 suites / 1929 tests, 전부 통과** (5.9s). dev-notes 보고 수치와 일치.
- `npm run typecheck` (`tsc --noEmit`) → **exit 0, 에러 0**.

### 하-2 (테스트 설계 관찰) — S1/S2는 "배선" 테스트이고 "수치 앵커"는 U1/U5/U6에 있다

`MuklogEditor.spec.tsx:789-794`의 `expectedHeight`는 소스(`MuklogEditor.tsx:386-391`)와 **같은 네 표현**(`typography.memoInput.lineHeight` / `MEMO_INPUT_LINES` / `spacing[14]` / `hairlineWidth`)으로 계산된다. 따라서 토큰이나 상수가 바뀌면 양변이 함께 움직여 **S1은 그 변화를 잡지 못한다** — M4(4→3)에서 util 스펙 5건 중 U5 하나만 빨개진 것이 같은 구조를 보여준다.

이건 결함이 아니라 **의도된 역할 분담**이다. 절대 수치는 U1(125)·U2(126)·U5(4)·U6(15/24/Medium)이 앵커로 고정하고, S1/S2는 "그 값이 실제로 TextInput 스타일까지 도달했는가"(하드코딩·누락·스타일 순서 뒤집힘)를 잡는다. 실제로 S1은 `maxHeight` 누락이나 `memoBox` 미적용을 즉시 검출한다. 다만 **U1/U5/U6가 삭제되면 S1/S2는 공허해진다**는 의존 관계가 있으므로, 이후 토큰 리팩터링 시 U1/U5/U6를 함께 지우지 않도록 기록해 둔다. `expectedHeight`의 하드코딩 금지(plan T4 명시)와 앵커 유지가 상충하지 않는 이유가 이 분담이다.

---

## 6. 검증 포인트 6 — 코드 컨벤션 (`docs/code-convention.md`)

| 규칙 | 검증 | 결과 |
|---|---|---|
| `useCallback`/`useMemo` 미사용 | 변경 파일 3종에 0건 | ✅ (전역 1건은 §8 참고) |
| 컴포넌트·훅 화살표 const | `grep "export function" src/` → **0건**(전역) | ✅ |
| named-object 인자 | `memoBoxHeight({ lineHeight, lines, paddingVertical, borderWidth })` — 객체 1개 | ✅ |
| `useEffect` 명명 함수 | `MuklogEditor.tsx`에 `useEffect(() =>` 0건 | ✅ |
| enum-style `as const` 상수 | `MEMO_INPUT_LINES` 는 숫자 계약 상수(문자열 도메인 식별자 아님) → 해당 없음 | ✅ |
| 파일명 = 대표 export 심볼 | `memoBoxHeight.ts` ↔ `export const memoBoxHeight` | ✅ |
| 토큰 경유(raw hex/숫자 하드코딩) | 높이·타이포 전부 토큰/유틸 경유, 리터럴 `125`·`96` 0건 | ✅ |
| 미사용 코드 | 신규 export 2개 모두 소비됨(`MuklogEditor.tsx:24`) | ✅ |

`memoBoxHeight.ts`는 JSDoc으로 각 인자의 의미·단위를 적어 두어 순수 유틸 문서화 기준도 만족한다.

---

## 7. 엣지케이스 판정 (plan §7)

| # | 정적 검증 가능 | 판정 |
|---|---|---|
| E1 빈 메모 placeholder | ✅ | 통과 — placeholder 카피 불변(`:596`), 박스 높이는 콘텐츠 무관 고정 |
| E2 정확히 4줄 하단 잘림 | ❌ 레이아웃 | **미검증 → 디바이스 스모크**(중-1 참조) |
| E3 5줄째 내부 스크롤 | ❌ 제스처 | **미검증 → 스모크** |
| E4 500자 도달 | ✅ | 통과 — S5가 payload 500자 전문 단언 |
| E5 줄바꿈 20번 | ✅(구조) | 통과 — 높이가 콘텐츠 비의존 |
| E6 >500자 붙여넣기 | ✅ | 통과 — `maxLength` 불변 |
| E7 편집 프리필 | ✅ | 통과 — S7이 400자 전문 보존 + `maxHeight` 유지 단언 |
| E8 키보드 가림 | ❌ 런타임 | **미검증 → 스모크**(dev-notes §5 존재) |
| E9 Android 제스처 경합 | ❌ | **미검증 → 스모크**(R1) |
| E10 폰트 스케일 확대 | ❌ | **미검증 → 스모크**. `allowFontScaling` 미지정=기본 true 확인, plan이 "잘림만 없으면 허용"으로 기준을 정해 둠 |
| E11 커플 동시편집 | ✅ | 통과 — 메모는 로컬 컴포넌트 상태(`memo` useState), Realtime·서버 상태 미접촉이라 새 충돌 경로 0 |
| E12 저장 실패 | ✅ | 통과 — `submitError` 인라인 경로 diff 0, 박스 높이는 에러 표시와 독립 |
| E13 RLS·권한 | ✅ | 해당 없음 — 쿼리·정책 미접촉(`supabase/` diff 0) |
| E14 사진 5장·인원 2명 | ✅ | 해당 없음 — 무관 영역 diff 0 |

---

## 8. 범위 밖 관찰 (이번 스프린트 유발 아님 — 기록만)

1. **`useCallback` 잔존 1건.** `src/navigation/useRefreshOnFocus/useRefreshOnFocus.ts:26`에 실제 `React.useCallback` 호출이 있다. 컨벤션(useCallback 지양) 위반이지만 **이번 스프린트가 건드린 파일이 아니고**(최근 커밋 `15967a0`, 2026-07-19) 메모 높이와 무관하다. 별도 정리 대상으로 team-lead에 보고한다.

2. **QA 중 병렬 에이전트의 `src/` 임시파일 관측(자체 정리됨).** 검증 도중 `src/features/muklog/MuklogEditor/`에 `__qaBefore.tsx`(30KB, MuklogEditor 사본)와 `__qaVisualRegression.spec.tsx`가 잠시 존재했다가 사라졌다. 내 소스 동결 체크섬(§0)과 최종 `git status`는 착수 시점과 동일하고, 잔존물 0건이며, 내 `npm test` 결과(196 suites)도 dev-notes 수치와 일치해 **오염 없이 종료**됐다. 다만 `__qaVisualRegression.spec.tsx`는 `.spec.tsx`라 **jest testMatch에 걸리는 이름**이었고 `src/` 안에 있었다 — 이는 "격리 사본은 `src/` 밖 + testMatch 미매치 파일명" 규범과 어긋난다. 타이밍이 겹쳤다면 다른 에이전트의 테스트 집계를 오염시킬 수 있었다. **team-lead에 프로세스 이슈로 보고**하며, 본 스프린트 산출물 판정에는 영향 없다.

3. **입력 보더/라운드 킷 불일치(기록만).** 메모 입력이 킷 `border 1.5` / `radius 16` 대신 `hairlineWidth` / `radius.control(14)`로 남아 있다. plan §3이 "전 입력 공통 이슈"로 별도 퍼블리싱 스프린트에 분리했고 dev-notes §6에도 기록돼 있다. 판정은 qa-visual 소관.

---

## 9. 최종 판정

**로직·통합 정합성: 통과.** plan §8 qa-logic 경계면 6건 전부 확인했고 생산자↔소비자 불일치 **0건**, 회귀 **0건**, 계약 변경 **0건**, 보안·비용 영향 **0**.

- 상(중대) 결함: **0건** → plan §10 완료 기준 3 충족.
- 중: 1건 — **중-1** dev-notes §5 Android 스모크 항목에 `includeFontPadding` 대응 후보 1줄 보강 권고(코드 수정 아님, 문서 보강).
- 하: 2건 — **하-1** padding/border 인자의 표현 이중화(선택적 개선), **하-2** S1/S2↔U1/U5/U6 앵커 의존 관계(기록).

**단, 스프린트 "완료"는 디바이스 스모크 이후로 남는다.** E2(4번째 줄 하단 잘림)·E3(내부 스크롤)·E8·E9·E10은 RNTL이 레이아웃을 계산하지 않아 **정적 검증으로 판정 불가**이며, 이 스프린트의 핵심 사용자 가치("4줄이 온전히 보이고 넘치면 스크롤된다")가 바로 그 영역에 있다. 메모리 *qa-layout-blind-spot*(캘린더 토요일 열 wrap) 선례대로, dev-notes §5 체크리스트를 사용자가 실기기에서 소화하기 전까지는 **미검증 항목이 남아 있는 조건부 통과**로 다룬다.
