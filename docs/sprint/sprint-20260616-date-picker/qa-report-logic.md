# QA Report — Logic / 통합 정합성 (방문일 캘린더 시트, date-picker)

> 작성: qa-logic-3 · 날짜: 2026-06-16 · 방식: integration-qa(생산자↔소비자 양쪽 동시 읽기)
> 입력: plan.md(AC·D1~D6) · dev-notes.md(경계면 표) · 소스(calendarGrid·DatePickerSheet·formatVisitedDate·MuklogEditor) + 신규 스펙 4종
> **결과: 전체 PASS.** 988 tests green · `tsc --noEmit` exit 0 · DB 변경 0 · 컨벤션 위반 0. 미해결 0.

---

## 0. 빌드/테스트 게이트

| 게이트 | 결과 | 근거 |
|--------|------|------|
| `npx jest`(전체) | ✅ PASS | **121 suites / 988 tests 전체 green** (회귀 0) |
| date-picker 4스위트 | ✅ PASS | calendarGrid·DatePickerSheet·formatVisitedDate·MuklogEditor = 69 tests green |
| `npx tsc --noEmit` | ✅ PASS | exit 0 |
| DB·마이그레이션 변경 | ✅ 0건 | git status에 supabase 변경 없음, plan §2/dev-notes §DB 정합 |

---

## 1. 경계면 교차검증 (생산자 ↔ 소비자)

### B1. DatePickerSheet `onSelect({date})` ↔ MuklogEditor `setVisitedAt` — ✅ PASS
- **생산자** `DatePickerSheet.tsx:90-93` `selectDay`: `onSelect({ date: toISODate({...}) })` → 직후 `onClose()`. named-object 인자(D5 정합).
- **소비자** `MuklogEditor.tsx:621-629`: `onSelect={({ date }) => { setVisitedAt(date); setDateOpen(false); }}`, `visible={dateOpen}`, `value={visitedAt}`, `onClose={() => setDateOpen(false)}`.
- ISO `'YYYY-MM-DD'`(toISODate 생성) 전달 → state로 합류. 시트 자동 닫힘은 생산자 onClose + 소비자 핸들러 양쪽에서 발생(중복 닫힘, 무해). 계약 일치.
- 검증 테스트: `MuklogEditor.spec.tsx:652-660`(선택→행 갱신+닫힘), `DatePickerSheet.spec.tsx:68-78`(`onSelect({date:'2026-02-10'})` 1회 + onClose). **load-bearing**(특정 date 값·호출횟수 단언).

### B2. calendarGrid 유틸 ↔ DatePickerSheet 렌더 — ✅ PASS
- `buildMonthGrid`(선행 빈칸+1..말일) → `DatePickerSheet.tsx:86,136-138` 셀 매핑. null→blank View.
- `isFutureDate`/`isToday`/`toISODate`/`moveMonth`/`parseISODate` 모두 시트가 1:1 소비(`:140-143`, `:88-91`).
- **로컬 today 일관성:** `localMidnightToday()`(`:60-63`, `new Date(y,m,d)` 자정 절삭)를 주입 → `isFutureDate`/`isToday` 내부도 `new Date(year,month,day)`만 사용. **`toISOString()`/UTC 시프트 0**(calendarGrid 전체 grep 확인). plan §6/§7 충족.
- 엣지(월경계·윤년·12월→1월·1일=일요일 빈칸0)는 `calendarGrid.spec.ts:24-94`로 커버, **load-bearing**(말일 29/28, 연도 래핑 {2025,11}/{2027,0} 단언).

### B3. formatVisitedDate(withDow) ↔ 날짜 행 표시 — ✅ PASS
- **생산자** `formatVisitedDate.ts:22-38`: `withDow:true`→`'YYYY.MM.DD (요일)'`, `withDow` 기본 false→`'YYYY.MM.DD'`, null/형식불일치→`'날짜 미정'`. 요일은 `new Date(y,m-1,d).getDay()` 로컬 기준.
- **소비자** `MuklogEditor.tsx:611,616-617`: 행 Text·accessibilityLabel 모두 `formatVisitedDate({ visitedAt, withDow: true })`.
- **하위호환:** 기존 호출부 `MuklogCard.tsx:39`·`MuklogDetailScreen.tsx:223` `withDow` 미지정 → 출력 불변(회귀 가드 `formatVisitedDate.spec.ts:19-22`).

### B4. 저장 계약 불변 (회귀) — ✅ PASS
- `MuklogEditor.tsx` visitedAt → `createMuklog`(`:365`)·`onSubmit`(`:339`) payload에 `'YYYY-MM-DD'` 그대로 합류(표시 포맷 `YYYY.MM.DD (요일)`와 혼선 없음 — ISO만 payload).
- 회귀 가드 단언 존재: 편집 `onSubmit.visitedAt:'2026-02-14'`(`MuklogEditor.spec.tsx:501`), 작성 시트선택 `createMuklog.visitedAt=firstOfMonth`(`:676`). **load-bearing**.
- `normalizeMuklogInput`·`toMuklogRow`·`visited_at` 컬럼 무변경 확인(validate.ts 수정 없음).

### B5. 미래 차단 이중 방어 — ✅ PASS
- **UI** 시트 disable: `DatePickerSheet.tsx:142,152-154` `future`→`disabled` + `accessibilityState.disabled` + onPress 무반응. 테스트 `DatePickerSheet.spec.tsx:81-90`.
- **저장 검증** `validate.ts:66-69`: `visitedAt > todayLocalDate()` → `VisitedAtInFuture` throw(불변 유지). DB 트리거가 최종 방어(plan D3).

### B6. TextInput 제거 잔차 — ✅ PASS
- `grep accessibilityLabel="방문일"` → **0건**. `placeholder "YYYY-MM-DD"`/`maxLength={10}` 방문일 잔차 → **0건**.
- 구 onChangeText/setVisitedAt 텍스트 입력 경로 제거. (`MuklogDetailScreen.tsx:375`의 `label="방문일"`는 별개 컴포넌트의 읽기전용 InfoRow — 에디터 잔차 아님.)

---

## 2. 기능 인수조건 ↔ 테스트 대응 (load-bearing)

| AC | 내용 | 테스트 | 결과 |
|----|------|--------|------|
| T1.1~1.7 | 그리드/ISO/parse/move/future/today/윤년 | calendarGrid.spec.ts(11 it) | ✅ |
| T2.1~2.3 | withDow off/on/fallback | formatVisitedDate.spec.ts(6 it) | ✅ |
| T3.1~3.9 | 헤더·요일·선택강조·월이동·연경계·선택콜백·미래disable·오늘dot·취소·빈value폴백·재오픈리셋 | DatePickerSheet.spec.tsx(13 it) | ✅ |
| T4.1 | 방문일 TextInput 부재→탭형 button | MuklogEditor.spec.tsx:623-630 | ✅ |
| T4.2 | withDow 행 표시 | :633-638 | ✅ |
| T4.3 | 행 탭→시트 오픈 | :641-649 | ✅ |
| T4.4 | 선택→행 갱신+닫힘 | :652-660 | ✅ |
| T4.5 | 저장 payload visitedAt=ISO | :663-678 | ✅ |
| T4.6 | 기본 today 표시 | :681-685 | ✅ |
| T4.7 | 편집 프리필+미변경 저장 회귀 | :419-436, :508-532 | ✅ |
| T-MIG | 방문일 TextInput 단언→날짜 행 단언, payload 단언 유지 | :433, :501 | ✅ |
| T5 | index.ts export | components/index.ts:11 | ✅ |

- 빈/잘못된 value 방어(`value=''`·`'2026-13-99'`→오늘 월 폴백, 크래시 없음): DatePickerSheet.spec.tsx:120-129. parseISODate round-trip으로 비실재 날짜(2026-02-30) 거부(calendarGrid.spec.ts:77-82). **실패 경로 커버됨**.
- `calendarGrid`는 index.ts 미export이나 plan T5 명시(컴포넌트 내부 의존, DatePickerSheet 상대 import) — 의도된 것, 결함 아님.

---

## 3. 코드 컨벤션 (docs/code-convention.md) — ✅ PASS

| 항목 | 결과 | 근거 |
|------|------|------|
| useCallback/useMemo 0 | ✅ | 신규 4파일 grep 0건 |
| 컴포넌트·훅 화살표 const | ✅ | DatePickerSheet/유틸 모두 `export const = () =>`, `export function` 0건 |
| named-object 인자 | ✅ | `onSelect({date})`·`selectDay({day})`·`monthFromValue({value,today})`·calendarGrid 전 함수. (setState/배열 map 콜백만 예외) |
| useEffect 명명 함수 | ✅ | `resetMonthOnOpen`(:79-83)·`syncFromSelectedPlace` 명명, 인라인 `useEffect(() =>` 0건 |
| enum-style 상수 | ✅ | `ISO_DATE_PATTERN`·`WEEKDAYS`·`CAL_LAYOUT as const`·`IconName` |
| 토큰 스타일링(raw hex 0) | ✅ | DatePickerSheet/MuklogEditor 스타일 raw hex 0건. 요일색은 `calendarSun`/`calendarSat` 토큰 경유(tokens.ts:62,111), 색은 ColorToken만 |
| 파일명=심볼명 | ✅ | DatePickerSheet/calendarGrid/formatVisitedDate 일치 |

---

## 4. 비용 가드레일 — ✅ PASS
- 순수 클라이언트 로직(달력 계산). 신규 외부 호출 0(Kakao·Realtime·폴링 없음). 이미지/viewport 무관. AWS 미사용. DB 호출 불변.

---

## 5. 미검증 / 미해결
- **없음.** 모든 로직 인수조건·경계면 PASS. 디바이스 스모크(시트 제스처·요일색 시각)는 qa-visual 경계.

---

## 종합
**로직·통합 정합성 전체 PASS — 스프린트 "로직 완료" 가능.** FAIL/미해결 0건이라 team-lead 처리 항목 없음.
- 게이트: 988 tests green · tsc 0 · DB 0 · 컨벤션 0위반.
- 경계면 B1~B6 양쪽 코드 일치, 회귀 가드(저장 ISO·하위호환) load-bearing 확인.
