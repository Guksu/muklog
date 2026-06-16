# UI Spec — 방문일 캘린더 시트 (date-picker)

> **작성:** ui-publisher · **날짜:** 2026-06-16 · **단일 출처(SSOT):** 킷 `.claude/skills/ui-design/templates/muklog/`
> **킷 대응:** `mk-extra.jsx` `DatePickerSheet`(68-126) · `mk-log.jsx` 방문일 진입 행(414-421 `lk.dateRow` 602)
> **입력:** plan.md(D1~D6, props 계약 §4) · **번역 규칙:** `ui-publishing` 스킬
> **상태:** ✅ 퍼블리싱 완료 — `npm test` 974 pass · `tsc --noEmit` 0 error

---

## 0. 산출물 요약

| 파일 | 종류 | 소유 | 비고 |
|------|------|------|------|
| `src/components/DatePickerSheet.tsx` | 신규 공용 프리미티브 | **ui-publisher** | 4-prop 계약(§3). 비주얼 + 콜백. |
| `src/components/DatePickerSheet.spec.tsx` | 프리젠테이션 테스트(T3) | ui-publisher | AC3.1~3.9. fake timer로 today 고정. |
| `src/components/calendarGrid.ts` | 순수 유틸 | **developer(최종)** / ui-publisher(초기본) | ⚠ §5 경계 메모 참조. |
| `src/components/calendarGrid.spec.ts` | 단위 테스트(T1) | developer(확장) / ui-publisher(기준) | AC1.1~1.7. |
| `src/theme/tokens.ts` | 토큰 추가 | ui-publisher | 색 2종 + 타이포 5종(§2). |
| `src/theme/tokens.spec.ts` | 토큰 정합 단언 | ui-publisher | 추가 토큰 검증. |
| `assets/icons/icons.ts` + `src/components/Icon.tsx` | 아이콘 추가 | ui-publisher | `chevron-down`(§2.3). |
| `src/components/index.ts` | export 배선(T5) | ui-publisher | `DatePickerSheet`(+타입). |
| `src/features/muklog/MuklogEditor.tsx` | **미수정 — §4 비주얼 골격 스펙만** | developer(T4) | 행 교체·배선·TextInput 제거는 developer. |

---

## 1. 킷 라인 ↔ RN 매핑 (DatePickerSheet)

킷 `mk-extra.jsx:88-124`를 RN `DatePickerSheet.tsx`로 1:1 번역. 좌=킷(웹), 우=RN.

| # | 킷(mk-extra.jsx) | RN 구현 | 토큰/근사 |
|---|------------------|---------|----------|
| 셸 | `<ESHEET open title="방문일 선택">`(89) | 기존 `Sheet`(`visible`/`title="방문일 선택"`) 재사용 | Sheet 상단 26 radius·핸들바·딤 0.32·title=`sheetTitle` 그대로 |
| 월 네비 행 | `padding "0 4px 12px"` space-between(91) | `styles.navRow` flexDirection row, justify space-between, padX 4, padBottom 12 | 킷 verbatim 수치(CAL_LAYOUT) |
| ‹ 버튼 | `ex.navArrow` 40×40 radius full `fill-alt` + chevron-left 22 `--mk-ink2`(92, 230) | `Pressable styles.navArrow`(40, fillAlt 배경) + `Icon ChevronLeft 22 fgWeak` | `--fill-alt`→`color.fillAlt`, `--mk-ink2`→`fgWeak` |
| 월 라벨 | `800 17px/1` `--mk-ink` "{vy}년 {vm+1}월"(93) | `Text variant="calendarMonth" color="fg"` `{view.year}년 {view.month+1}월` | 신규 `typography.calendarMonth`(17/Bold/1) |
| › 버튼 | move(1) + chevron-right 22(94) | `Pressable date-next` + `Icon ChevronRight 22 fgWeak` | 동일 |
| 요일 헤더 | grid 7열, `700 12px/1`, **padding "6px 0"**, 일=`#E5484D`·토=`#3B82F6`·평일 `--text-alternative`(97-101) | `styles.dowRow` row + `Text variant="calendarDow"` flex 1 textAlign center, **paddingVertical 6**(CAL_LAYOUT.dowPadV), color 분기 | `calendarDow`(12/Bold/1), 색 `calendarSun`/`calendarSat`/`fgMuted`. ※ V-1 수정(요일 행 수직 리듬) |
| 날짜 그리드 | grid 7열 gap 2(104) | `styles.grid` flexWrap row + `styles.cell` width 1/7 · aspectRatio 1 · padding(gap/2) | **gap 근사**: §5.2 |
| 선행 빈칸 | `cells.push(null)` → `<span/>`(79,106) | `cell===null` → `<View styles.cell/>`(빈 칸) | 동일 |
| 날짜 셀 | `aspectRatio 1/1`, radius full, bg sel?`--mk-accent`:transparent(108-116) | `Pressable styles.dayButton` flex 1, radius 9999, selected→`color.primary` 배경 | `--mk-accent`→`primary` |
| 셀 글자 | color fut?`--text-disable`:sel?`#fff`:`--mk-ink`, weight sel\|\|today?800:600 14.5(113-114) | `Text variant` strong?`calendarDayStrong`:`calendarDay`, color future?`fgDisabled`:sel?`primaryFg`:`fg` | `calendarDay/Strong`(14.5), `--text-disable`→`fgDisabled`, `#fff`→`primaryFg` |
| 미래 disable | `disabled={fut}`(109) | `disabled={future}` + `accessibilityState.disabled` | `isFutureDate`(calendarGrid) |
| 선택 동작 | `onClick={() => { onSelect(iso(d)); onClose(); }}`(109) | `onPress={() => selectDay({ day })}` → `onSelect({date})` then `onClose()` | named-object(D5) |
| 오늘 dot | today&&!sel → 4×4 radius full `--mk-accent` bottom 5 left 50%(118) | `todayCell && !selected` → `<View styles.todayDot color.primary>` absolute bottom 5 | center=alignItems center로 좌우 중앙(absolute 50%+translate 대체) |
| 하단 여백 | `<div style={{height:10}}/>`(123) | `<View styles.bottomSpacer height 10/>` | 동일 |

**진입 행 (킷 `mk-log.jsx:416-420` `lk.dateRow`) → §4(MuklogEditor, developer 구현).**

---

## 2. 토큰 변경 목록 (킷 근거 추가)

### 2.1 신규 컬러 토큰 (`tokens.ts` light + dark 미러)
| 토큰 | 값 | 킷 근거 | 비고 |
|------|----|---------|------|
| `color.calendarSun` | `#E5484D` | mk-extra:100 일요일 헤더 | 값은 `negative`와 같으나 의미(요일 강조) 분리 — 전용 토큰 |
| `color.calendarSat` | `#3B82F6` | mk-extra:100 토요일 헤더 | 값은 `mapLocate`와 같으나 의미 분리 — 전용 토큰 |

> 라이트/다크 공통(웜·다크 배경 모두 가독). `palette.calendarSun/Sat` 추가, `darkColor` 스프레드로 미러(키 누락 0, tokens.spec 다크 미러 통과).

### 2.2 신규 타이포 역할 토큰 (`typography`)
| 토큰 | size/ratio/family | 킷 | weight |
|------|-------------------|----|--------|
| `calendarMonth` | 17 / 1 / Bold | mk-extra:93 | 800 |
| `calendarDow` | 12 / 1 / Bold | mk-extra:99 | 700 (badge와 값 동일, 의미 분리) |
| `calendarDay` | 14.5 / 1 / SemiBold | mk-extra:114 | 600 |
| `calendarDayStrong` | 14.5 / 1 / Bold | mk-extra:114 | 800 |
| `dateRowValue` | 15 / 1 / SemiBold | mk-log:418 | 600 (§4 진입 행용) |

### 2.3 신규 아이콘 `chevron-down`
- 킷 `mk-log:419` `I name="chevron-down"` — 기존 아이콘셋에 **부재**. ui-design 원본 SVG도 없어 `chevron-right` 글리프를 `<g transform="rotate(90 12 12)">`로 90° 회전해 생성(아래 방향 ⌄). `IconName.ChevronDown='chevron-down'` 등록.
- **사유 기록:** 회전 근사 — 시각적으로 표준 chevron-down과 동일(좌우 대칭 글리프라 왜곡 없음). qa-visual은 18px 렌더 시 ⌄ 방향만 확인.

---

## 3. props 계약 (ui-publisher → developer 인계)

```ts
// src/components/DatePickerSheet.tsx  (from '@/components')
export type DatePickerSheetProps = {
  visible: boolean;                              // 시트 표시(킷 open). 배선=developer.
  value: string;                                 // 현재 선택 'YYYY-MM-DD'. 빈/형식불일치 → 오늘 월 폴백.
  onClose: () => void;                           // 딤/취소/선택 직후 닫기.
  onSelect: ({ date }: { date: string }) => void; // 선택 → date='YYYY-MM-DD'(named-object, D5). 호출 후 onClose 자동.
};
```

### 동작 계약 (developer 배선 기준)
- **내부 상태는 표시 월(`view`)뿐.** `value`/`onSelect`/`visible`은 부모(MuklogEditor) 소유.
- `visible` false→true 전환 시 표시 월을 `value` 월로 **리셋**(킷 `useEffect([open])`). 월 이동 잔상 없음.
- 날짜 탭(미래 아님) → `onSelect({ date })` **그다음** `onClose()` 연속 호출. 미래일은 `disabled`(무반응).
- `today` = `new Date()` 로컬 자정 절삭(내부 계산). 외부 주입 없음(테스트는 fake timer로 고정).

### MuklogEditor 배선 예시 (developer)
```tsx
<DatePickerSheet
  visible={dateOpen}
  value={visitedAt}
  onClose={() => setDateOpen(false)}
  onSelect={({ date }) => setVisitedAt(date)}   // 킷 positional setVisitedAt → named-object 어댑트
/>
```
> `onSelect`가 내부에서 `onClose`도 부르므로 `setDateOpen(false)`는 onClose 한 경로로 충분(중복 토글 불요).

---

## 4. MuklogEditor 방문일 진입 행 — 비주얼 골격 스펙 (developer 구현, T4)

킷 `mk-log.jsx:416-420` + `lk.dateRow`(602)를 그대로 재현. **TextInput(현 :606-608) 완전 제거** → 탭형 `Pressable` 행.

```tsx
// MuklogEditor 방문일 Field 내부 (developer 구현)
<Pressable
  accessibilityRole="button"
  accessibilityLabel={`방문일 ${formatVisitedDate({ visitedAt, withDow: true })}, 선택`}
  onPress={() => setDateOpen(true)}
  style={[styles.dateRow, { borderColor: theme.color.hairline, backgroundColor: theme.color.surface }]}
>
  <Icon name={IconName.Calendar} size={19} color="primary" />
  <Text variant="dateRowValue" color="fg" style={{ flex: 1 }}>
    {formatVisitedDate({ visitedAt, withDow: true })}
  </Text>
  <Icon name={IconName.ChevronDown} size={18} color="fgAssistive" />
</Pressable>
```

| 요소 | 킷 값(lk.dateRow 602 / 416-420) | RN |
|------|-------------------------------|-----|
| 컨테이너 | gap 10, padding `14px 16px`, radius 16, **border 1.5 `--line`**, bg `--mk-card`, width 100% | `flexDirection row alignItems center gap 10`, `paddingVertical 14 paddingHorizontal 16`, `borderRadius theme.radius.xl`(16), `borderWidth 1.5 borderColor hairline`, `backgroundColor surface` |
| 좌 아이콘 | `calendar` 19 `--mk-accent` | `Icon Calendar 19 color="primary"` |
| 날짜 텍스트 | `600 15px/1` `--mk-ink`, 좌측 정렬, flex 1 | `Text variant="dateRowValue" color="fg" flex 1` |
| 우 아이콘 | `chevron-down` 18 `--text-assistive` | `Icon ChevronDown 18 color="fgAssistive"` |

> **border는 `--line`(hairline)이지 accent 아님.** 표시 텍스트는 `formatVisitedDate({withDow:true})` = `YYYY.MM.DD (요일)`(D4, developer T2). 접근성 라벨에 현재 날짜 포함(테스트 앵커).

---

## 5. 웹→RN 근사 & 경계 사유 (기록 의무)

### 5.1 그리드 셀 중앙 dot 위치
- 킷: `position absolute; left 50%; transform translateX(-50%)`. RN: dot을 `dayButton`(alignItems/justifyContent center) 안에 두고 `absolute bottom 5`만 지정 → 가로 중앙은 부모 center 정렬로 달성(translateX 불요). 시각 동일.

### 5.2 CSS grid gap 2 → flexWrap 근사
- 킷: `display grid; gridTemplateColumns repeat(7,1fr); gap 2`. RN은 그리드 미지원 → `flexWrap` 행 + 셀 `width: ${100/7}%`(=14.2857%) + `padding: 1`(gap/2). 셀 사이 간격 ≈ 2px로 근사. 7×14.2857%=99.999%<100%라 줄바꿈 안정. **시각 차이 무시 가능.**

### 5.3 날짜 계산 위임 (calendarGrid) — ⚠ 경계 메모
- plan §2/§4.3은 `calendarGrid.ts`의 **계산 로직·T1 단위 스위트를 developer 소유**로 둔다(월 그리드·미래·로컬 today).
- 그러나 공용 프리미티브 `DatePickerSheet`가 이를 **직접 의존**해야 렌더·테스트·`tsc`가 성립한다. 팀리드 지시("없으면 props로 받는 형태로 골격만")의 취지에 따라, ui-publisher가 **킷 mk-extra:69-85에 1:1 충실한 초기 구현 + 기준 스위트(T1)** 를 제공해 비주얼 셸을 언블록했다.
- **developer 인계:** 시그니처(plan §4.3)는 **계약이므로 유지**. developer는 (a) T1 인수조건을 자기 소유로 검토·확장, (b) 필요 시 정제(예: 추가 방어), (c) **새로 from-scratch 작성하지 말고 기존 `calendarGrid.ts`를 인계받아 진행**(중복/충돌 방지). 현재 구현이 AC1.1~1.7을 모두 통과한다.

### 5.4 today 테스트 결정성
- 킷·RN 모두 `new Date()` 내부 사용(외부 주입 prop 없음 — 계약 4-prop 유지). 테스트는 `jest.useFakeTimers({ now })`로 2026-06-16 고정해 미래·오늘 판정을 결정적으로 검증.

---

## 6. 비주얼 충실도 체크리스트 (self-check → qa-visual 인계)

- [x] 킷 구조 요소 누락 0: 월 네비(‹ 라벨 ›)·요일 헤더(일~토)·6주 그리드·선행 빈칸·미래 disable·오늘 dot·선택 하이라이트·하단 여백.
- [x] 색 전부 토큰 경유(raw hex 0). 일/토 = 신규 `calendarSun/Sat`(킷 #E5484D/#3B82F6), 선택 `primary`+`primaryFg`, 미래 `fgDisabled`, 평일 `fgMuted`, nav `fillAlt`/`fgWeak`.
- [x] 타이포 size/weight(family): 월 17/Bold, 요일 12/Bold, 날짜 14.5(SemiBold/Bold) — 신규 토큰 정합.
- [x] radius: 셀 full(9999), nav full(20), 시트 26(Sheet 재사용). 진입 행 16(§4, developer).
- [x] 그림자 vs 헤어라인: 시트=기존 Sheet(shadow.lg, 떠있는 레이어). 캘린더 내부 요소는 보더/배경만(그림자 0). 진입 행=헤어라인 보더(§4).
- [x] 프리미티브 추출: DatePickerSheet 공용 컴포넌트, `@/components` export. 화면 인라인 중복 0.
- [x] RN 미재현/근사 항목 ui-spec 기록(§5: dot 중앙·grid gap·chevron-down 회전).
- [x] `npm test`(974) + `tsc --noEmit`(0) 통과.

### qa-visual 대조 포인트 (킷 라인)
1. **월 네비**(mk-extra:91-95): 40원형 fill-alt 화살표 · 800/17 라벨 · space-between.
2. **요일 색**(mk-extra:100): 일=빨강(#E5484D)·토=파랑(#3B82F6)·평일 muted — `calendarSun/Sat` 토큰 실값.
3. **선택/오늘/미래 셀**(mk-extra:108-118): 선택=accent 배경+흰 800 / 오늘(미선택)=dot+800 / 미래=disabled fgDisabled.
4. **진입 행**(mk-log:416-420): calendar 19 primary + 600/15 fg + chevron-down 18 assistive, border 1.5 hairline radius 16(§4).
5. **chevron-down**(§2.3): 18px ⌄ 방향(회전 근사) 확인.

---

## 7. 후속 (developer 인계 작업, plan §6)
- **T1**: `calendarGrid` 인계(§5.3) — 검토·확장. (초기본 제공됨)
- **T2**: `formatVisitedDate` `withDow` 확장(§4 표시 포맷). **로직·data → developer.**
- **T4**: MuklogEditor 행 교체·`setVisitedAt` 배선·`TextInput` 제거(§4 골격 스펙대로).
- **T-MIG**: `MuklogEditor.spec.tsx:430` 등 방문일 TextInput 의존 단언 마이그레이션.
- 저장 계약(`visitedAt='YYYY-MM-DD'`)·`normalizeMuklogInput`·DB **불변**(회귀 가드).
