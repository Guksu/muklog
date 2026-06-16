# Sprint Plan — 방문일 캘린더 시트 (date-picker)

> **슬러그:** `sprint-20260616-date-picker` · **작성:** sprint-planner · **날짜:** 2026-06-16
> **SSOT:** `docs/design/architecture.md` · 킷 `.claude/skills/ui-design/templates/muklog/` (`mk-extra.jsx` DatePickerSheet 68-126, `mk-log.jsx` 방문일 행 415-421)
> **절대 규칙:** TDD 기본(Red→Green→Refactor) · git 작업 금지 · 1스프린트=1기능 · Supabase 무료티어

---

## 1. 기능 한줄 정의

먹로그 에디터의 방문일 입력을 **수동 TextInput(`YYYY-MM-DD` 타이핑)** 에서 **킷 `DatePickerSheet` 캘린더 시트 + 탭형 날짜 행**으로 교체한다. 사용자는 타이핑 없이 달력에서 날짜를 골라 기록한다.

**가치:** 오타·형식 오류(`2026-13-40` 등) 제거, 미래 날짜를 입력 단계에서 시각적으로 차단(disable), 모바일에서 키보드 없이 한 손 선택 → 작성 마찰 감소. 킷 디자인 충실도 확보.

---

## 2. 범위

### In-scope
- 공용 프리미티브 **`DatePickerSheet`** 신설 (`src/components/`) — 기존 `Sheet` 위에 캘린더(월 이동·요일 헤더·날짜 그리드·미래 disable·오늘 dot) 구성.
- 캘린더 순수 유틸 **`calendarGrid.ts`** 신설 (`src/components/`) — 월 그리드 생성·ISO 변환·미래/오늘 판정·월 이동. TDD 단위 대상.
- `MuklogEditor` 방문일 영역: 수동 `TextInput` **제거** → **탭형 날짜 행**(calendar 아이콘 + 포맷된 날짜 + chevron-down)으로 교체, 탭 시 `DatePickerSheet` 오픈.
- `formatVisitedDate`에 **`withDow` 옵션** 확장 — 날짜 행 표시용 `YYYY.MM.DD (요일)` 포맷(킷 `FMT2(visitedAt, true)` 정합). 기존 호출부(MuklogCard·MuklogDetailScreen)는 기본값으로 불변.
- 작성·편집(dual-mode) 양쪽 동일 적용 (`visitedAt` 상태는 단일 경로).
- 기존 테스트 마이그레이션(아래 §8 T-MIG) + 신규 TDD 케이스.

### Out-of-scope
- `DatePickerSheet`를 다른 화면(위시리스트·지도 필터·기간 필터 등)으로 확산 — **이번엔 방문일만**.
- `NotifSettingsScreen`(알림 설정), `MkSwitch`, `WishlistView` 등 `mk-extra.jsx` 동거 컴포넌트.
- DB 스키마·mutation 변경. `visitedAt`/`visited_at` 컬럼, `useCreateMuklog`/`useUpdateMuklog`, `normalizeMuklogInput` 저장 계약 전부 **불변**.
- 날짜 범위(시작~종료) 선택, 시간(시·분) 입력.

---

## 3. 확정 결정 표

| # | 결정 | 선택 | 사유 / 근거 |
|---|------|------|------------|
| D1 | 날짜 행 vs 시트 분담 | **날짜 행 = MuklogEditor 내부 / `DatePickerSheet` = 공용 프리미티브(`src/components/`)** | 킷도 `DatePickerSheet`(mk-extra)와 진입 행(mk-log)을 분리. 시트는 재사용 가능 표면이라 프리미티브, 행은 에디터 폼 맥락. 단 확산은 OUT(§2). |
| D2 | 수동 입력 폐기 | **TextInput 완전 제거, 시트 선택만 허용** | 킷 `mk-log:416`은 `button`(시트 오픈)만 제공, 텍스트 입력 없음. 오타·형식오류 제거가 본 기능 목적. 병행 시 두 입력 경로의 정합 부담. |
| D3 | 미래 날짜 | **시트에서 미래 disable(선택 불가, 킷 정합) + 저장 검증(`normalizeMuklogInput`) 이중 방어 유지** | 킷 `isFuture(d)` → `disabled`. 앱단 1차(`validate.ts:67`)·DB 트리거 최종 방어는 그대로. 오늘=기본·선택 가능. |
| D4 | 저장 포맷 / 표시 포맷 | **저장=`YYYY-MM-DD`(`visitedAt`) 불변** / **표시=`YYYY.MM.DD (요일)`** (`formatVisitedDate withDow:true`) | 저장 계약은 mutation·normalize·DB 전부 `YYYY-MM-DD` 유지(회귀 0). 행 표시만 킷 `fmtDate(iso, true)` 정합(예: `2026.06.16 (화)`). |
| D5 | 시트 prop 네이밍 | RN `Sheet`는 `visible`(킷 `open`) · `onSelect`는 **named-object 인자** `({ date }: { date: string })` | 코드 컨벤션(named-object 인자). 킷 positional `onSelect(iso)`을 RN 컨벤션으로 번역. |
| D6 | "오늘" 기준 | **로컬 날짜**(`new Date()` 로컬 컴포넌트, `todayLocalDate`와 동일 기준) | `validate.ts` 주석대로 앱 1차는 로컬 기준이 자연스럽다. UTC 시프트 금지(아래 §7). |

> **충돌/확인 필요:** 없음. 설계 문서·킷과 정합. DB·계약 불변이라 architecture.md 갱신 불요(필요 시 §4 화면 표현 메모만).

---

## 4. 데이터·API 계약

### 4.1 저장 계약 (불변 — 회귀 가드)
- `visitedAt: string` = `'YYYY-MM-DD'` (변경 없음). `MuklogEditSubmitInput.visitedAt`, `CreateMuklogInput.visitedAt` 그대로.
- `normalizeMuklogInput`·`toMuklogRow`·`visited_at` 컬럼 **수정 금지**. 미래 차단 로직(`validate.ts:66-69`) 유지.
- 기본값: `initial?.visitedAt ?? todayLocalDate()` (MuklogEditor:179) 불변.

### 4.2 `DatePickerSheet` props 계약 (ui-publisher ↔ developer 인계)
```ts
// src/components/DatePickerSheet.tsx
export type DatePickerSheetProps = {
  /** 시트 표시 여부(RN Sheet.visible). 킷 open. */
  visible: boolean;
  /** 현재 선택값 'YYYY-MM-DD'. 초기 표시 월·선택 하이라이트 기준. 빈/형식불일치 → 오늘 월. */
  value: string;
  /** 딤 탭/취소/요청 시 닫기(선택 없이). */
  onClose: () => void;
  /** 날짜 선택 → date='YYYY-MM-DD' 전달. 호출 후 시트가 onClose도 호출(킷 onSelect→onClose). */
  onSelect: ({ date }: { date: string }) => void;
};
```
- **렌더 규칙(킷 정합):** 월 네비(`‹ {vy}년 {vm+1}월 ›`), 요일 헤더(일~토, 일=빨강·토=파랑), 날짜 그리드(7열), 선택일=accent 배경/흰 글자, 오늘=accent dot(선택 시 dot 숨김), 미래일=disabled + `fgDisabled` 색.
- **상태:** 내부 `viewYear/viewMonth`만 보유(표시 중인 월). `visible`가 false→true 전환 시 `value`의 월로 리셋(킷 `useEffect([open])`).
- **선택 동작:** 날짜 탭 → `onSelect({ date })` → `onClose()` 연속 호출. 미래일 탭은 무반응(disabled).

### 4.3 `calendarGrid.ts` 순수 유틸 계약 (TDD 핵심 — 단위 필수)
```ts
// src/components/calendarGrid.ts  (month: 0-11 기준)
export type MonthCell = number | null; // null = 선행 빈칸(요일 정렬용)

/** 해당 월 그리드 셀 배열: 선행 빈칸(startDow개) + 1..말일. */
export const buildMonthGrid = ({ year, month }: { year: number; month: number }): MonthCell[];

/** 'YYYY-MM-DD' 생성(month 0-11 → +1, zero-pad). 로컬 기준, UTC 시프트 없음. */
export const toISODate = ({ year, month, day }: { year: number; month: number; day: number }): string;

/** 'YYYY-MM-DD' → {year, month(0-11), day} 또는 null(형식 불일치). */
export const parseISODate = ({ iso }: { iso: string }): { year: number; month: number; day: number } | null;

/** (year,month,day)가 today(로컬 자정 기준)보다 미래인가. today 주입(테스트 결정성). */
export const isFutureDate = ({ year, month, day, today }: { year: number; month: number; day: number; today: Date }): boolean;

/** (year,month,day)가 today와 같은 날인가. */
export const isToday = ({ year, month, day, today }: { year: number; month: number; day: number; today: Date }): boolean;

/** 월 이동(delta=±1) — 연 경계 래핑(0→11 전년, 11→0 익년). */
export const moveMonth = ({ year, month, delta }: { year: number; month: number; delta: number }): { year: number; month: number };
```
- `today`는 **주입형 파라미터** → 순수 함수로 결정적 테스트 가능. `DatePickerSheet`가 `new Date()`(로컬 자정 절삭)를 주입.

### 4.4 `formatVisitedDate` 확장 계약
```ts
// 기존 시그니처 확장(하위호환): withDow 기본 false
export const formatVisitedDate = (
  { visitedAt, withDow }: { visitedAt: string | null; withDow?: boolean }
): string;
// withDow:false → 'YYYY.MM.DD' (기존 호출부 불변)
// withDow:true  → 'YYYY.MM.DD (요일)'  예: '2026.06.16 (화)'  (킷 fmtDate(iso,true))
// null/형식 불일치 → VISITED_DATE_FALLBACK('날짜 미정') 불변
```
- 요일은 `new Date(iso + 'T00:00:00')` 로컬 기준 `['일'..'토'][getDay()]`. 기존 정규식 fallback 유지.

### 4.5 경계면 매핑 (날짜 행 ↔ visitedAt)
- MuklogEditor 날짜 행 표시 = `formatVisitedDate({ visitedAt, withDow: true })`.
- 시트 선택 = `onSelect={({ date }) => setVisitedAt(date)}` (positional state setter로 번역).
- 시트 `value` = 현재 `visitedAt` state.

---

## 5. 화면·UX (킷 충실도)

**진입 행 (킷 `mk-log.jsx:416-420` `lk.dateRow`):**
- 전폭 `Pressable`(button), radius 16(xl 근사)·border 1.5 hairline·`surface` 배경·padding 14/16·gap 10.
- 좌: `calendar` 아이콘 19, `accent`(`#3366FF`) 색. 중: 포맷 날짜 `600 15px` `fg`, 좌측 정렬, flex 1. 우: `chevron-down` 18 `fgMuted`(킷 text-assistive).
- 접근성: `accessibilityRole="button"`, `accessibilityLabel`은 현재 날짜 포함(예: `"방문일 2026.02.14 (토), 선택"`) — 테스트 쿼리 앵커.

**시트 (킷 `mk-extra.jsx:88-124`):**
- `Sheet`(title="방문일 선택", 핸들바). 월 네비 행(좌右 chevron 원형 `fill-alt` 버튼 40, 가운데 `800 17px` "YYYY년 M월").
- 요일 헤더 7열(`700 12px`, 일=`#E5484D`·토=`#3B82F6`·평일 muted) — raw hex는 토큰 매핑(ui-publisher 판단; 토큰 부재 시 근사값 명시).
- 날짜 그리드 7열 gap 2, 각 셀 정사각(aspectRatio 1), radius full. 선택=accent 배경·흰 글자·800, 오늘(미선택)=하단 accent dot 4px, 미래=disabled·`fgDisabled`.

**상태 흐름:**
1. 행 탭 → `dateOpen=true` → 시트 오픈(현재 `visitedAt` 월 표시).
2. ‹/› → 표시 월 이동(연 경계 래핑). **선택값은 불변**(표시만 이동).
3. 날짜 탭(미래 아님) → `setVisitedAt(date)` → 시트 닫힘 → 행 표시 갱신.
4. 미래일 탭 → 무반응. 딤/취소 → 닫힘(선택 변화 없음).

**컴포넌트 목록:**
- 신규: `src/components/DatePickerSheet.tsx`, `src/components/calendarGrid.ts` + `index.ts` export.
- 수정: `src/features/muklog/MuklogEditor.tsx`(방문일 영역), `src/features/muklog/formatVisitedDate.ts`(withDow).

---

## 6. 작업 목록 (각 인수조건 = 테스트 케이스 / Red→Green)

### ☐ T1 — `calendarGrid.ts` 순수 유틸 (단위 필수, ROI 최고)
- ☐ AC1.1 `buildMonthGrid({2026,5})`(6월=June, 0-idx 5) → 선행 빈칸 수 = 6/1의 요일(월=1) → `[null, 1..30]` 길이=1+30. **정상**
- ☐ AC1.2 `toISODate({2026,5,3})` → `'2026-06-03'` (zero-pad, month+1). **경계**(한 자리 월/일)
- ☐ AC1.3 `parseISODate({'2026-06-16'})` → `{2026,5,16}`; `parseISODate({'bad'})` → `null`. **실패**
- ☐ AC1.4 `moveMonth({2026,0,-1})` → `{2025,11}`(전년 12월); `moveMonth({2026,11,1})` → `{2027,0}`(익년 1월). **경계**
- ☐ AC1.5 `isFutureDate` — today=2026-06-16일 때 6/17=true, 6/16=false, 6/15=false. **경계**
- ☐ AC1.6 `buildMonthGrid({2024,1})`(2월) 말일=29(윤년), `{2026,1}` 말일=28. **경계(윤년)**
- ☐ AC1.7 `isToday` today=2026-06-16 → (2026,5,16)=true, (2026,5,15)=false.

### ☐ T2 — `formatVisitedDate` withDow 확장
- ☐ AC2.1 `withDow` 미지정 → `'2026.06.16'` (기존 호출부 회귀: MkCard/Detail 불변). **회귀**
- ☐ AC2.2 `withDow:true` → `'2026.06.16 (화)'` (2026-06-16=화요일). **정상**
- ☐ AC2.3 `visitedAt:null, withDow:true` → `'날짜 미정'` (fallback 불변). **실패**

### ☐ T3 — `DatePickerSheet` 컴포넌트 (render + 상호작용)
- ☐ AC3.1 `visible=true, value='2026-02-14'` → "2026년 2월" 헤더 + 14일 셀 선택 강조 렌더. **정상**
- ☐ AC3.2 ‹ 탭 → "2026년 1월"로 헤더 변경, value 불변(onSelect 미호출). **월 이동**
- ☐ AC3.3 › 탭(12월에서) → 연도 +1 "...년 1월". **월 경계**
- ☐ AC3.4 미래 아닌 날짜(예: 10일) 탭 → `onSelect({date:'2026-02-10'})` 1회 + `onClose` 호출. **선택**
- ☐ AC3.5 미래일(현재 월·미래) 탭 → `onSelect` **미호출**(disabled). **미래 disable**
- ☐ AC3.6 오늘 셀(미선택 상태) → today dot 표식 존재. **오늘 dot**
- ☐ AC3.7 `onClose`(딤/취소) → `onSelect` 미호출. **취소**
- ☐ AC3.8 `value=''`(빈값)/형식불일치 → 오늘 월로 초기화 렌더(크래시 없음). **방어**
- ☐ AC3.9 `visible` false→true 재오픈 시 표시 월이 `value` 월로 리셋(이전 월 이동 잔상 없음). **리셋**

### ☐ T4 — `MuklogEditor` 방문일 행 교체 + 배선
- ☐ AC4.1 방문일 영역에 `TextInput`(label "방문일") **부재** → 탭형 행(button) 존재. **TextInput 제거**
- ☐ AC4.2 행에 현재 `visitedAt` 포맷 표시(`withDow:true`, 예: 편집 `2026-02-14`→`2026.02.14 (토)`). **표시**
- ☐ AC4.3 행 탭 → `DatePickerSheet` `visible=true`. **시트 오픈**
- ☐ AC4.4 시트에서 날짜 선택 → 행 표시 갱신 + 내부 `visitedAt` 갱신. **반영**
- ☐ AC4.5 선택 후 저장(작성) → `createMuklog` payload `visitedAt='YYYY-MM-DD'`(시트가 고른 ISO 그대로). **저장 계약 불변**
- ☐ AC4.6 작성 기본 진입 시 행이 `todayLocalDate()` 포맷 표시(미선택 빈값 아님). **기본값 today**
- ☐ AC4.7 편집 모드 `initial.visitedAt='2026-02-14'` 프리필 표시 + 미변경 저장 시 `onSubmit.visitedAt='2026-02-14'` 불변. **편집 회귀**

### ☐ T-MIG — 기존 테스트 마이그레이션 (Red 유발 → 갱신)
- ☐ `MuklogEditor.spec.tsx:430` `getByLabelText('방문일').props.value` 단언 → 날짜 행 표시/포맷 단언으로 교체(TextInput 제거로 깨짐).
- ☐ 기타 방문일 TextInput 의존 단언이 있으면 동일 마이그레이션. 저장 payload `visitedAt` 단언(:498)은 **유지**(계약 불변 회귀 가드).

### ☐ T5 — export 배선
- ☐ `src/components/index.ts`에 `DatePickerSheet`(+`DatePickerSheetProps`) export. `calendarGrid`는 컴포넌트 내부 의존(필요 시 named export).

---

## 7. 엣지케이스 (다각도)

| 분류 | 케이스 | 기대 동작 |
|------|--------|----------|
| 월 경계 | 1월에서 ‹ | 전년 12월로(연도 -1) |
| 월 경계 | 12월에서 › | 익년 1월로(연도 +1) |
| 윤년 | 2024-02 | 말일 29, 2026-02 말일 28 |
| 타임존/로컬 | 자정 직전 KST | `toISODate`가 로컬 컴포넌트로 ISO 생성 → **UTC 시프트 금지**(`toISOString()` 사용 금지). today도 로컬 자정 절삭 |
| 매우 과거 | 1990-01-05 선택 | 하한 없음 → 선택 가능(킷 정합) |
| 빈/잘못된 value | `value=''`·`'2026-13-99'` | 시트 init 시 오늘 월로 폴백, 크래시 없음 |
| 미래 차단 이중 | 시트 disable 우회 불가 + 저장 시 `normalizeMuklogInput` future throw 유지 | UI·앱·DB 3중 방어 |
| 재오픈 잔상 | 월 이동 후 닫고 다시 열기 | `value` 월로 리셋(이전 표시 월 안 남음) |
| 빠른 연타 | 날짜 더블탭 | onSelect 후 즉시 onClose → 두 번째 탭은 닫힌 시트라 무반응 |
| 오늘 선택 | 오늘 탭 | 선택 가능(미래 아님), 선택 시 dot 숨고 accent 강조 |
| 접근성 | 행 label | 현재 날짜 포함 label로 스크린리더 가독 |

---

## 8. QA 교차검증 경계면 목록 (qa-logic 지정)

1. **`DatePickerSheet` props ↔ MuklogEditor 배선**: `visible`(open 토글)·`value`(=visitedAt)·`onSelect({date})`→`setVisitedAt(date)`·`onClose`. 인자 형태(named-object) 정합.
2. **`calendarGrid` 유틸 ↔ `DatePickerSheet` 렌더**: 그리드 셀·미래 판정·월 이동·ISO 생성이 시트 동작과 1:1.
3. **날짜 행 표시 ↔ 저장 `visitedAt`**: 표시는 `YYYY.MM.DD (요일)`, 저장은 `YYYY-MM-DD` — 두 포맷 혼선 없이 ISO만 payload 합류.
4. **저장 계약 불변(회귀)**: `createMuklog`/`onSubmit` payload `visitedAt` = 시트 ISO. `normalizeMuklogInput`·`toMuklogRow`·DB 컬럼 무변경.
5. **미래 차단 이중 방어**: 시트 disable ↔ `validate.ts:66-69` future throw 둘 다 존재.
6. **TextInput 제거 잔차**: 방문일 `TextInput`/`placeholder "YYYY-MM-DD"`/`maxLength=10` 코드·테스트 잔존 0.
7. **`formatVisitedDate` 하위호환**: 기존 호출부(MuklogCard·MuklogDetailScreen) `withDow` 미지정 → 출력 불변.
8. **타임존**: ISO 생성/오늘 판정에 `toISOString()`/UTC 미사용(로컬 기준).
9. **dual-mode**: 작성·편집 양쪽 동일 행/시트 경로, 편집 프리필 회귀 0.

> **qa-visual 경계(참고):** 행 레이아웃(아이콘/날짜/chevron)·시트(월네비·요일색·선택 강조·오늘 dot·미래 disable 색)·radius/border/토큰이 킷 `mk-extra`·`mk-log` 시안과 일치. (상세는 ui-publisher ui-spec 후 qa-visual 담당.)

---

## 9. 비용 가드레일 체크

| 항목 | 해당 | 비고 |
|------|------|------|
| Kakao 호출 | ❌ 무관 | 날짜 선택은 외부 API 미사용 |
| 이미지 압축 | ❌ 무관 | — |
| viewport 조회 | ❌ 무관 | — |
| 추가 네트워크 | ❌ 없음 | 순수 클라이언트 로직(달력 계산). DB 호출 불변 |

→ 본 기능은 **비용 영향 없음**(클라 측 UI/유틸 교체). Supabase 무료티어·AWS 미사용 유지.

---

## 10. 완료 기준 (Definition of Done)

- ☐ §6 전 작업 체크 + 각 AC가 테스트로 존재(Red→Green).
- ☐ `npm test` 전체 통과(신규 + 기존 회귀, T-MIG 갱신 포함).
- ☐ `npx tsc --noEmit` 타입 통과.
- ☐ 코드 컨벤션 100%(화살표 함수·named-object 인자·useCallback/useMemo 지양·useEffect 명명 함수·원티드 토큰·raw hex 0).
- ☐ 저장 계약(`visitedAt`=`YYYY-MM-DD`) 회귀 0 — payload·normalize·DB 무변경 확인.
- ☐ 킷 비주얼 충실도(qa-visual) + 로직 정합(qa-logic) 리포트 green.
