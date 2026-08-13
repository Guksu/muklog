# Sprint: 메모 입력 최대 높이 (sprint-20260812-memo-max-height)

## 1. 기능 한줄 정의

먹로그 에디터(작성·편집)의 **메모 입력창이 글이 길어져도 더 이상 세로로 늘어나지 않고**, 킷과 동일한 **고정 4줄 박스 안에서 내부 스크롤**로 전체 내용을 입력·확인할 수 있다.

---

## 2. 대상 지점 판별 (사용자 관측 = 어디인가)

사용자 관측: *"메모는 길이에 따라 무한정 늘어난다. 최대 높이를 가지도록"*.
메모가 등장하는 **3개 지점을 전수 정찰**해 현재 동작을 코드로 확정했다.

| # | 지점 | 파일:라인 | 현재 동작 | 무한 증가? | 킷 근거 |
|---|------|----------|----------|-----------|---------|
| ① | **에디터 메모 입력** | `src/features/muklog/MuklogEditor/MuklogEditor.tsx:574-584`, 스타일 `:637` | `multiline` + `numberOfLines={4}` + `minHeight: 96`, **`maxHeight` 없음·`height` 없음** → RN multiline TextInput은 콘텐츠 높이만큼 자동 증가(iOS: intrinsic content size / Android: wrap_content). 입력이 길어질수록 박스가 늘어나 아래 "방문일" 필드를 계속 밀어낸다 | ✅ **예** | ❌ **킷과 불일치** — 킷 `mk-log.jsx:452` `<textarea rows={4}>` + `lk.textarea`(`mk-log.jsx:644-645`) `resize: "none"` = **고정 4행 박스, 초과분은 textarea 내부 스크롤** |
| ② | 상세화면 메모 표시 | `src/navigation/screens/MuklogDetailScreen/MuklogDetailScreen.tsx:404-406` (`variant="memoBody"`, `styles.memoText = {}` `:628`) | `numberOfLines` 없음 → 메모 길이만큼 카드가 길어지고, 페이지 `ScrollView`(`:264`)가 스크롤을 흡수 | ⚠️ 카드는 길어지나 **페이지 스크롤로 정상 소비** | ✅ **킷과 일치** — 킷 `mk-log.jsx:271` `<p style={{ whiteSpace: "pre-wrap" }}>`, 클램프·더보기 **없음**(전문 표시) |
| ③ | 리스트 카드 메모 프리뷰 | `src/features/muklog/MuklogCard/MuklogCard.tsx:134-144` | `numberOfLines={2}` | ❌ 이미 클램프됨 | ✅ 킷과 일치 — 킷 `mk-log.jsx:205-207` `WebkitLineClamp: 2` |

**판별 결론 → 이번 스프린트 대상은 ① 에디터 메모 입력.**
근거: ③은 이미 2줄로 묶여 있어 관측 대상이 될 수 없고, ②는 "늘어남"이 페이지 스크롤로 소비되는 **킷 사양 그대로의 동작**이다. `maxHeight` 부재로 실제로 무한 증가하며 **킷(`rows=4` + `resize:none`)과 명확히 어긋나는 유일한 지점이 ①**이다.

> **FLAG-A (리더 확인 요청, 진행은 막지 않음).** 만약 사용자가 실제로 ②(상세 표시)를 의미했다면, 킷에는 **접기/더보기·내부 스크롤 어느 쪽도 근거가 없다**(킷은 전문 표시). 그 경우 킷에 없는 **신규 UI 패턴을 창작**해야 하므로 → ui-publisher 범위 + 별도 스프린트로 분리해야 한다. 본 스프린트는 킷 근거가 확실한 ①만 다루고, ②는 §2 Out-of-scope로 명시해 둔다. (메모리 *보안·git 외 포괄 승인* — 킷 기본값으로 진행하고 flag만 남긴다.)

---

## 3. 범위

### In-scope
- 에디터 메모 `TextInput`을 **고정 4줄 높이 박스**로 만든다(`minHeight == maxHeight`, 킷 `rows={4}` + `resize:none` 번역).
- 초과 입력 시 **TextInput 내부 스크롤**로 접근 가능(잘림·소실 0).
- 높이 계약을 결정론적으로 만들기 위한 **전제 수정**: 현재 메모 입력에는 `fontSize`/`lineHeight`/`fontFamily`가 **하나도 지정돼 있지 않아**(스타일 체인 `styles.input`+`styles.memo`+`fieldInput` 어디에도 없음) RN 플랫폼 기본 폰트로 렌더된다 → "줄 수 × lineHeight" 계약이 성립하지 않는다. 킷 실수치(`500 15px/1.6`)를 담은 **신규 타이포 토큰 `memoInput`** 을 추가해 적용한다.
- 높이 계산을 **순수 유틸로 분리**해 단위 테스트 대상으로 만든다.

### Out-of-scope (일부러 안 함)
- ② 상세화면 메모 표시 변경(클램프·더보기·내부 스크롤) — 킷 근거 없음, FLAG-A.
- ③ 카드 프리뷰 `numberOfLines={2}` 변경 — 이미 킷 정합.
- **저장 글자수 제한 변경** — 현행 유지·기록만: `MEMO_MAX = 500`(`MuklogEditor.tsx:66`, `maxLength` prop `:578`), `MEMO_MIN_LENGTH = 5`(`src/features/muklog/validate/validate.ts:10`). **둘 다 불변.**
- **데이터 계약 불변**: `muklogs.memo text`(architecture.md:84) 및 모든 훅/타입(`types.ts`, `useMuklog`, `useUpdateMuklog`, `useCreateMuklog`) **diff 0**. DB·마이그레이션·Edge Function **변경 0**.
- 메모 외 다른 입력(장소명 `PLACE_NAME_MAX`, PlaceSearchView 검색창)의 타이포·치수 정합 — 킷 대비 `border 1.5`/`radius 16` 차이는 **전 입력 공통 이슈**라 별도 퍼블리싱 스프린트 대상.
- 자동 증가(auto-grow) 애니메이션, 글자 수 카운터(`n/500`) 표시 — 킷에 없음.

---

## 4. 데이터 · API 계약

- **테이블/컬럼 변경: 없음.** `muklogs.memo text` 그대로 사용. DDL 0, RLS 변경 0, 마이그레이션 파일 0.
- **Edge Function / RPC: 변경 0.**
- **훅 시그니처: 변경 0.** `useCreateMuklog` / `useUpdateMuklog` / `useMuklog` 입출력 불변. `MuklogEditorProps`·`MuklogEditorSubmitInput`(`MuklogEditor.tsx:76-86`) **불변**.
- 본 스프린트의 계약은 전부 **프론트 스타일·상수 계약**이다(아래 §4-1, §4-2).

### 4-1. 신규 타이포 토큰 (`src/theme/tokens/tokens.ts`)

킷 `lk.textarea`(`mk-log.jsx:645`)의 `font: "500 15px/1.6 var(--font-sans)"` 를 그대로 번역.

```ts
// typography 객체에 추가 (기존 토큰 수정 0 — 신규 키만 추가)
memoInput: makeTypography({ size: 15, ratio: 1.6, family: 'SUIT-Medium' }),
// → { fontSize: 15, lineHeight: 24, fontFamily: 'SUIT-Medium' }   (24 = round(15 × 1.6))
```

- `makeTypography`(`tokens.ts:207-211`)는 `lineHeight: Math.round(size * ratio)` → **lineHeight = 24 (확정)**.
- 기존 `memoBody`(15/1.7=lh 26, 상세 표시용)와 **별개 토큰**이다. 상세 표시는 이번에 건드리지 않으므로 `memoBody` 불변.
- ratio 1.6은 typo-clipping 스프린트 안전선(`lineHeight ≥ fontSize × 1.15`)을 충족 → 한글 상단 클리핑 위험 없음(`docs/sprint/sprint-20260625-typo-clipping/plan.md` AC1).

### 4-2. 높이 계약 (순수 유틸 + 상수)

**공식 (RN box model: `height`는 padding·border를 포함한다).**

```
박스 높이 = lineHeight × lines + paddingVertical × 2 + borderWidth × 2
```

| 항목 | 값 | 근거 |
|------|----|------|
| `lineHeight` | **24** | §4-1 `typography.memoInput.lineHeight` (킷 15px/1.6) |
| `lines` | **4** | 킷 `<textarea rows={4}>` (`mk-log.jsx:452`) |
| `paddingVertical` | **14** | 현행 `fieldInput.paddingVertical = theme.spacing[14]`(`MuklogEditor.tsx:388`) = 킷 `lk.textarea` `padding: "14px 16px"` |
| `borderWidth` | `StyleSheet.hairlineWidth` (iOS 0.5 / Android ≈0.5~1) | 현행 `styles.input.borderWidth`(`:636`) |

→ **결과 ≈ 125px** (hairline 0.5 기준: `24×4 + 28 + 1 = 125`).

**구현 계약 (developer가 추측하지 않도록 확정):**

```ts
// src/features/muklog/MuklogEditor/ 하위에 순수 유틸로 신설 (테스트 대상)
export const MEMO_INPUT_LINES = 4;

export const memoBoxHeight = ({
  lineHeight,
  lines,
  paddingVertical,
  borderWidth,
}: {
  lineHeight: number;
  lines: number;
  paddingVertical: number;
  borderWidth: number;
}): number => lineHeight * lines + paddingVertical * 2 + borderWidth * 2;
```

- 인자는 **named-object**(코드 컨벤션 준수), 화살표 함수, 반환은 숫자.
- 화면에서는 이 값을 **`minHeight`와 `maxHeight`에 동일하게** 적용한다(킷 `rows=4` + `resize:none` = 고정 박스).
- **현행 `minHeight: 96` 는 이 값으로 대체된다**(96 → ≈125). 96은 킷 근거 없는 임의값이었고, 4줄 계약과 모순(96은 padding 28 제외 시 content 68px ≈ 2.8줄)이므로 **의도된 치수 변경**이다.
- `numberOfLines={4}` **prop은 제거**한다. Android 전용 높이 힌트라 명시적 min/maxHeight와 중복이며, 고정 높이와 병존 시 플랫폼별 동작이 불명확해진다. 높이 계약의 단일 출처는 `memoBoxHeight`.
- `textAlignVertical: 'top'`(`:637`) **유지**(Android 상단 정렬 필수).
- `multiline` 유지, `scrollEnabled`는 RN 기본 `true` — **명시 지정하지 않는다**(기본값 의존 명시만 주석으로).

---

## 5. 화면 · UX

- **대상 화면 1개**: `MuklogEditor`(작성/편집 공용, 풀스크린 라우트). 다른 화면 diff 0.
- **상태별 동작**
  - **빈 상태(placeholder)**: `"무엇을 먹었고 어땠는지 그날의 기록을 남겨보세요"` — 고정 4줄 박스 안에 표시(길어도 박스 밖으로 넘치지 않음). 카피 불변.
  - **입력 중(4줄 이하)**: 박스 높이 불변, 아래 필드(방문일) 위치 고정.
  - **입력 중(4줄 초과)**: 박스 높이 **불변**, 캐럿이 있는 줄이 보이도록 내부 스크롤.
  - **편집 진입(긴 메모 프리필)**: 박스는 4줄, 내부 스크롤 최상단부터 표시.
  - **500자 도달**: `maxLength={MEMO_MAX}` 로 입력 차단(현행 유지). 500자 전체는 내부 스크롤로 접근 가능.
  - **최소 5자 미달 힌트**(`testID="memo-hint"`, `:586-593`): 문구·톤·위치 **불변**. 박스 높이가 고정되므로 힌트 위치도 이제 고정된다(부수 개선).
- **원티드 토큰 사용 지점**: `theme.typography.memoInput`(신규), `theme.spacing[14]`(padding, 기존 `fieldInput`), `theme.radius.control`·`theme.color.surface`·`theme.color.hairline`·`theme.color.fg`·`theme.color.fgMuted`(placeholder) — 전부 기존 값 재사용, 신규는 타이포 토큰 1개뿐.

### 5-1. ui-publisher 필요 여부 — **불필요 (developer 단독)** ✅

**판정 근거:**
1. **신규 비주얼 패턴이 없다.** "더보기" 버튼·접기/펼치기·글자수 카운터 등 킷에 없는 UI를 **하나도 만들지 않는다**. 이번 변경은 킷에 **이미 존재하는 `lk.textarea` 표현**(고정 4행 + 내부 스크롤)의 수치 번역이다.
2. **실수치가 킷에서 그대로 읽힌다.** `rows=4`, `font 500 15px/1.6`, `padding 14px 16px` — 디자인 해석·창작 여지가 없어 §4에서 계약으로 확정했다.
3. 컴포넌트 구조·레이아웃·safe-area·카피 변경이 **0**이다(TextInput 스타일 3필드 + 토큰 1줄).

**단, 비주얼 치수·토큰이 바뀌므로 qa-visual이 킷 대비 검증한다**(§7). ui-spec.md는 생성하지 않는다.

---

## 6. 작업 목록 (각 인수조건 포함)

- [ ] **T1 (dev)** `typography.memoInput` 토큰 추가 — 인수조건: `theme.typography.memoInput`이 `{ fontSize: 15, lineHeight: 24, fontFamily: 'SUIT-Medium' }`이고, **기존 토큰 값은 하나도 변하지 않는다**(특히 `memoBody` 15/26 불변). — 테스트: `tokens.spec.ts`에 `memoInput` 실값 단언 + 기존 토큰 회귀 단언 통과.
- [ ] **T2 (dev)** `memoBoxHeight` 순수 유틸 + `MEMO_INPUT_LINES` 상수 신설(§4-2 시그니처 그대로) — 인수조건: `memoBoxHeight({ lineHeight: 24, lines: 4, paddingVertical: 14, borderWidth: 0.5 }) === 125`. — 테스트: 신규 `memoBoxHeight.spec.ts`(정상·경계·0값).
- [ ] **T3 (dev)** 메모 `TextInput`에 타이포 토큰 적용 — 인수조건: 렌더된 `accessibilityLabel="메모"` TextInput의 flatten 스타일에 `fontSize: 15`, `lineHeight: 24`, `fontFamily: 'SUIT-Medium'`이 있다. — 테스트: `MuklogEditor.spec.tsx` 스타일 단언.
- [ ] **T4 (dev)** 고정 높이 적용 — 인수조건: 같은 TextInput의 flatten 스타일에서 **`minHeight === maxHeight === memoBoxHeight(...)`(≈125)** 이고, `minHeight: 96`은 사라졌으며 `textAlignVertical: 'top'`은 남아 있다. — 테스트: `MuklogEditor.spec.tsx` 스타일 단언(하드코딩 숫자가 아니라 유틸 호출 결과와 비교).
- [ ] **T5 (dev)** `numberOfLines={4}` prop 제거 — 인수조건: TextInput props에 `numberOfLines`가 없고 `multiline`은 `true`다. — 테스트: props 단언.
- [ ] **T6 (dev)** 회귀 방어 — 인수조건: 메모 입력→저장 payload(`memo`)·최소 5자 힌트(`memo-hint`) 톤 전환·`maxLength=500`·편집 프리필이 **기존과 동일**하게 동작한다. `MuklogEditor.spec.tsx`의 **기존 케이스는 한 줄도 수정하지 않는다**(수정이 필요하다면 계약 위반이므로 planner에 회신). — 테스트: 기존 스펙 무수정 통과 + 500자 입력 시 `onSubmit`/`onCreate` payload `memo.length === 500`.
- [ ] **T7 (dev)** `npm test` 전체 green + `npx tsc --noEmit` 오류 0 — 인수조건: 실패 0, 신규 경고 0.
- [ ] **T8 (dev)** dev-notes.md 작성 — 인수조건: 변경 파일 표(라인 증감 포함), 고정 높이 실측값, Android lineHeight 리스크(§8 R2) 관측 결과, 디바이스 스모크 이월 항목이 기록돼 있다.
- [ ] **T9 (qa-logic ∥ qa-visual)** §7 경계면 교차검증 — 인수조건: `qa-report-logic.md`·`qa-report-visual.md` 각각 생성, 상(중대) 결함 0.

> **작업 규범 승계.** 테스트 견고성 확인을 위해 구현 코드를 일부러 깨뜨려 보는 **뮤테이션 표본 확인은 격리 사본에서만** 한다 — jest가 수집하지 않는 경로(`.spec`/`.test` 확장자 아닌 임시 파일)에 사본을 만들고 확인 즉시 삭제한다. 원본 파일을 깨뜨린 채로 두지 않는다.
> **git 작업 없음** — 커밋·푸시·브랜치는 전부 사용자 몫.

---

## 6-1. 테스트 케이스 (TDD, Red→Green→Refactor)

**단위 테스트 대상** (`jest-expo` + `@testing-library/react-native`, `docs/testing-strategy.md`)

| ID | 케이스 | 유형 | 대상 | 기대 |
|----|--------|------|------|------|
| U1 | `memoBoxHeight({ lineHeight: 24, lines: 4, paddingVertical: 14, borderWidth: 0.5 })` | 정상 | 유틸 | `125` |
| U2 | `memoBoxHeight({ lineHeight: 24, lines: 4, paddingVertical: 14, borderWidth: 1 })` (Android hairline=1) | 경계 | 유틸 | `126` |
| U3 | `memoBoxHeight({ lineHeight: 24, lines: 1, paddingVertical: 0, borderWidth: 0 })` | 경계(최소) | 유틸 | `24` |
| U4 | `lines: 0` / `lineHeight: 0` | 경계(퇴화) | 유틸 | padding·border만 남은 값 반환(예외 던지지 않음) |
| U5 | `MEMO_INPUT_LINES === 4` | 계약 | 상수 | 킷 `rows={4}` 고정 |
| U6 | `typography.memoInput` 실값 | 계약 | 토큰 | `{ fontSize: 15, lineHeight: 24, fontFamily: 'SUIT-Medium' }` |
| U7 | `typography.memoBody` 불변 | 회귀 | 토큰 | `{ fontSize: 15, lineHeight: 26, ... }` 그대로(상세 표시 무영향 증명) |
| S1 | 메모 TextInput 스타일 flatten | 정상 | 화면 | `minHeight === maxHeight === memoBoxHeight(...)` |
| S2 | 메모 TextInput 스타일 flatten | 정상 | 화면 | `fontSize 15` · `lineHeight 24` · `fontFamily 'SUIT-Medium'` · `textAlignVertical 'top'` |
| S3 | 메모 TextInput props | 정상 | 화면 | `multiline === true`, `numberOfLines === undefined`, `maxLength === 500` |
| S4 | 4줄 초과(예: 300자) 입력 후 | 경계 | 화면 | 스타일의 `maxHeight`가 **변하지 않는다**(고정 증명) |
| S5 | 500자 입력 → 저장 | 경계 | 화면 | `onSubmit`/`onCreate` payload `memo.length === 500` (저장 제한 회귀 0) |
| S6 | 빈 메모 → 힌트 | 실패경로 | 화면 | `memo-hint` 존재, `canSave` 비활성(기존 동작 유지) |
| S7 | 편집 모드 긴 메모 프리필 | 정상 | 화면 | TextInput `value`가 프리필 전문과 동일(잘림 0) |
| S8 | 장소명 입력(`PLACE_NAME_MAX`) 스타일 | 회귀 | 화면 | 메모 전용 스타일이 **다른 입력에 새지 않음**(높이 제약 없음) |

**모킹/스모크 대상 (단위 대상 아님)**

- 실제 렌더 픽셀 높이, TextInput **내부 스크롤 제스처**, Android `lineHeight` 첫 줄 위치, 키보드 열림 시 스크롤 위치 — **디바이스 스모크**(§8-1). RNTL은 레이아웃을 계산하지 않으므로 "정말 4줄이 보이는가"를 단언할 수 없다. 메모리 *qa-layout-blind-spot*(캘린더 토요일 열 wrap 선례) 교훈 — **레이아웃 무거운 변경은 디바이스 스모크 필수.**
- Supabase 쿼리·저장 경로는 기존 모킹 그대로(변경 0).

---

## 7. 엣지케이스

| # | 상황 | 기대 동작 |
|---|------|----------|
| E1 | **빈 메모** (placeholder만) | 박스는 4줄 높이 그대로. placeholder가 2줄로 wrap돼도 박스 밖으로 넘치지 않음 |
| E2 | **정확히 4줄** | 스크롤 없이 전부 보임. 4번째 줄 하단(받침·디센더)이 **잘리지 않음** ← 스모크 필수 검증점 |
| E3 | **5줄째 입력 순간** | 박스 높이 불변, 캐럿 줄이 보이도록 내부 스크롤 발생 |
| E4 | **500자 도달** | `maxLength`로 추가 입력 차단(기존 동작). 500자 전체가 스크롤로 접근 가능 |
| E5 | **줄바꿈만 20번** | 빈 줄들도 4줄 박스 안에서 스크롤. 높이 불변 |
| E6 | **대량 붙여넣기(>500자)** | `maxLength`가 500자에서 절단(기존 동작 유지). 박스 높이 불변 |
| E7 | **편집 모드 진입, 저장된 긴 메모** | 프리필 전문 보존, 박스 4줄 + 상단부터 표시. 저장 시 전문 유지(잘림 0) |
| E8 | **키보드 열림** | 메모 포커스 시 입력 영역이 키보드에 가리지 않음(기존 `ScrollView` + `keyboardShouldPersistTaps="handled"` 동작 유지). 고정 높이가 되면서 화면이 덜 밀리는 **개선** 방향이어야 하고, 악화되면 안 됨 |
| E9 | **Android 부모 ScrollView와 제스처 경합** | 손가락으로 메모 내부를 드래그할 때 부모 `ScrollView`가 스크롤을 가로챌 수 있음(Android 알려진 동작). **최소 보장 = 타이핑 중 캐럿 자동 추적**(양 플랫폼 동작). 손가락 내부 스크롤이 Android에서 실패하면 스모크 결과를 근거로 후속 처리(§8 R1) |
| E10 | **접근성 큰 글씨(시스템 폰트 스케일 확대)** | `allowFontScaling` 기본 true라 글자가 커져 **보이는 줄 수가 4줄 미만**이 될 수 있음. **허용**한다 — 잘림 없이 내부 스크롤로 전부 접근 가능하면 통과. 텍스트가 박스 밖으로 넘치거나 잘려 보이면 실패 |
| E11 | **동시성(커플 2명)** | 메모 입력은 **로컬 컴포넌트 상태**라 상대방 동작과 무관. 두 명이 같은 먹로그를 동시에 편집해도 이번 변경으로 새 충돌 없음(기존 last-write-wins 동작 그대로) |
| E12 | **네트워크 실패 / 저장 에러** | 실패 시 화면 유지·입력 보존(기존 `submitError` 인라인). 박스 높이는 에러 표시와 무관하게 고정 |
| E13 | **RLS·권한** | 해당 없음(클라이언트 스타일 변경, 쿼리·정책 미접촉) |
| E14 | **사진 5장 / 인원 2명 한계** | 해당 없음(무관 영역, 회귀만 확인) |

---

## 8. QA 교차검증 경계면 (생산자 ↔ 소비자)

**qa-visual** (킷 ↔ RN, 병렬)
1. 킷 `lk.textarea` (`.claude/skills/ui-design/templates/muklog/mk-log.jsx:644-645` + `:452` `rows={4}`) ↔ RN 메모 TextInput 스타일 — **rows 4 = 고정 높이**, `font 500 15px/1.6` = `memoInput` 토큰, `padding 14/16` 일치 여부.
2. 킷 메모 필드 주변(라벨 "메모", placeholder 카피, 아래 방문일 필드와의 간격 `gap 22`) ↔ RN — **카피·간격 회귀 0**.
3. 96 → ≈125 높이 변경이 에디터 전체 세로 리듬(장소·사진·별점·메모·방문일)을 킷 대비 **개선**했는지(킷 시안과 나란히 비교).

**qa-logic** (생산자 ↔ 소비자, 병렬)
1. `typography.memoInput`(신규 토큰) ↔ 사용처 — 신규 키 추가가 **기존 토큰 소비처 전부에 영향 0**임을 확인(`memoBody`·`body`·`bodySm` 실값 불변).
2. `memoBoxHeight` 유틸 ↔ 화면 적용 — 화면이 유틸을 실제로 호출하는지(하드코딩 125 금지), 인자(`theme.typography.memoInput.lineHeight`, `MEMO_INPUT_LINES`, `theme.spacing[14]`, `StyleSheet.hairlineWidth`)가 **스타일에 실제 적용된 값과 같은 출처**인지.
3. `MEMO_MAX(500)`·`MEMO_MIN_LENGTH(5)` ↔ 고정 높이 — **저장 제한 변경 0** 증명(payload 500자 통과, 힌트 5자 기준 유지).
4. `MuklogEditorSubmitInput.memo` ↔ `useUpdateMuklog`/`useCreateMuklog` ↔ `muklogs.memo` — **계약 diff 0** 증명.
5. 표시 지점 회귀 — `MuklogDetailScreen`(memoBody) · `MuklogCard`(numberOfLines 2) **diff 0** 확인(이번 변경이 표시 쪽으로 새지 않았는지).
6. 코드 컨벤션(`docs/code-convention.md`) — 화살표 함수, named-object 인자, `useCallback`/`useMemo` 미사용, enum-style 상수.

**동시 진행 스프린트와의 파일 충돌 점검(사전 확인 완료)**
`sprint-20260812-rating-drag`는 `src/components/Stars/*`만(그 스프린트 dev-notes 기준 `MuklogEditor.tsx` diff 0), `sprint-20260812-sheet-drag-dismiss`는 `src/components/Sheet/*`만 변경했다 → **본 스프린트의 `MuklogEditor.tsx`·`tokens.ts`와 충돌 없음.** 단 `tokens.ts`는 전역 파일이므로 developer는 착수 시 최신 상태를 다시 확인한다.

### 8-1. 디바이스 스모크 (사용자 환경, 단위 대상 아님)

- [ ] iOS: 메모에 10줄 입력 → **박스 높이 불변**, 아래 방문일 필드가 밀리지 않음, 캐럿이 항상 보임.
- [ ] iOS: 4줄 정확히 입력 → 4번째 줄이 **온전히** 보임(디센더·받침 잘림 0) ← E2.
- [ ] Android: 동일 2건 + **첫 줄 상단 위치가 어긋나지 않는지**(multiline + `lineHeight` 알려진 이슈, R2).
- [ ] Android: 메모 내부를 손가락으로 드래그 → 내부 스크롤 되는지 / 부모 ScrollView가 가로채는지 관측(E9).
- [ ] 양 플랫폼: 편집 모드로 500자 메모 진입 → 전문 접근 가능·저장 후 전문 보존(E7).
- [ ] 양 플랫폼: 시스템 폰트 크게 설정 → 잘림 없이 스크롤 접근 가능(E10).

### 리스크

- **R1 (중)** Android에서 부모 `ScrollView`가 TextInput 내부 스크롤 제스처를 가로챌 수 있음 → **타이핑 중 캐럿 추적이 최소 보장선**. 손가락 스크롤이 안 되면 스모크 결과를 근거로 후속 조치(예: 부모 스크롤 양보)를 별도 판단하고, 이번 스프린트에서 추측 구현하지 않는다.
- **R2 (중)** Android multiline TextInput + 명시 `lineHeight`는 첫 줄 수직 위치가 어긋난다는 보고가 있음. 문제 발생 시 **fallback**: `lineHeight`를 스타일에서 빼고 높이 계약은 `memoBoxHeight` 그대로 유지(줄 수가 정확히 4가 아닐 수 있음을 dev-notes에 기록). 임의 판단 금지 — 스모크 관측 후 결정.
- **R3 (하)** hairline·서브픽셀 반올림으로 4번째 줄이 1px 잘릴 수 있음 → E2 스모크에서 확인, 실패 시 `lines: 4` 계약은 유지한 채 **여유 2px 추가**를 허용하고 dev-notes에 근거 기록.
- **R4 (하)** `minHeight` 96 → ≈125 는 **의도된 비주얼 변경**(킷 정합)이라 qa-visual이 회귀가 아닌 개선으로 판정해야 함 — 본 문서 §4-2를 근거로 제시.

---

## 9. 비용 가드레일 체크

| 항목 | 해당 여부 |
|------|----------|
| Kakao Local API 호출(디바운스·캐싱) | ❌ 무관 — 이번 변경에 네트워크 호출 0 |
| 이미지 압축 / Storage | ❌ 무관 — 사진 경로 미접촉 |
| viewport 기반 조회 | ❌ 무관 |
| Supabase 쿼리·Realtime·Edge Function | ❌ **추가 0** — DB 왕복 증가 없음 |
| AWS 리소스 | ❌ 미사용 |
| 마이그레이션 / DDL | ❌ **0건** |

**결론: 런타임 비용 증분 0.** 순수 클라이언트 스타일·상수 변경.

---

## 10. 완료 기준 (Definition of Done)

1. §6 T1~T8 전부 체크.
2. `npm test` green(신규 케이스 U1~U7·S1~S8 포함, **기존 케이스 무수정**), `npx tsc --noEmit` 0.
3. `qa-report-logic.md`·`qa-report-visual.md` 생성, 상(중대) 결함 0.
4. §8-1 디바이스 스모크 항목이 사용자 확인 대기 목록으로 dev-notes에 남음.
5. DB·Edge·마이그레이션 변경 0, 데이터 계약 diff 0.
