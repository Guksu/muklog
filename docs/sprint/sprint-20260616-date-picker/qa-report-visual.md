# QA Report — Visual (방문일 캘린더 시트 / date-picker)

> **검증자:** qa-visual · **날짜:** 2026-06-16 · **방법:** visual-qa 스킬 · 킷↔RN 양쪽 동시 개봉 3축 교차검증
> **SSOT(킷):** `.claude/skills/ui-design/templates/muklog/mk-extra.jsx` `DatePickerSheet`(68-126) · `mk-log.jsx` 진입 행(415-421)
> **출발점:** `docs/sprint/sprint-20260616-date-picker/ui-spec.md`
> **대상 RN:** `src/components/DatePickerSheet.tsx` · `src/theme/tokens.ts` · `assets/icons/icons.ts` · `src/components/Icon.tsx`

---

## 0. 요약 — ✅ 비주얼 완료 (2026-06-16 재검증)

| 구분 | 결과 |
|------|------|
| **DatePickerSheet 컴포넌트** | ✅ PASS |
| **신규 토큰(컬러·타이포) 킷 실값 정합** | ✅ PASS |
| **raw hex 0 / 토큰 경유** | ✅ PASS |
| **chevron-down 회전 근사** | ✅ PASS |
| **근사 허용(dot 중앙·grid gap)** | ✅ 사유 대조 통과 |
| **V-1 요일 헤더 셀 수직 패딩** | ✅ 수정 확인 (ui-publisher-3) |
| **§4 진입 행(MuklogEditor 방문일)** | ✅ PASS — 배선 완료 후 재검증 |
| **통합(시트 오픈·선택 반영·TextInput 제거)** | ✅ PASS |
| **빌드** | ✅ 988 green / 121 suites / tsc 0 / 방문일 TextInput 잔차 0 |

**판정:** 1차 불일치(V-1)·PENDING(진입 행·통합) 모두 재검증 통과. **date-picker 비주얼 완료.**

---

## 1. PASS — DatePickerSheet 컴포넌트 (킷 mk-extra:88-124 ↔ RN DatePickerSheet.tsx)

### ① 레이아웃·구조
| 항목 | 킷 | RN | 판정 |
|------|----|----|------|
| 시트 셸 | `<ESHEET open title="방문일 선택">`(89) | `Sheet visible onClose title="방문일 선택"`(94) — 재사용, 핸들바·딤 0.32·radius 26 | ✅ |
| 월 네비 행 | space-between, `padding "0 4px 12px"`(91) | `navRow` row, alignItems center, justify space-between, padX 4 padBottom 12(177-183) | ✅ |
| ‹ › 버튼 | 40×40 radius full, fill-alt, chevron 22(92,94,230) | `navArrow` 40, radius 20(=40/2), fillAlt bg, Icon 22(96-117,184-190) | ✅ |
| 월 라벨 | `{vy}년 {vm+1}월`(93) | `${view.year}년 ${view.month+1}월`(83,106) | ✅ |
| 요일 행 | grid 7열, marginBottom 4(97) | `dowRow` row flex 1, marginBottom 4(121,191-192) | ✅(패딩 1건 §3) |
| 날짜 그리드 | grid 7열 gap 2(104) | `grid` flexWrap + cell width 1/7·aspectRatio 1·padding 1(134,193-194) | ✅(근사 §2.2) |
| 선행 빈칸 | `cells.push(null)`→span(79,106) | `cell===null`→`<View styles.cell/>`(136) | ✅ |
| 날짜 셀 | aspectRatio 1, radius full, sel→accent bg(108-116) | `dayButton` flex 1 radius 9999, selected→primary bg(146-154,195) | ✅ |
| 미래 disable | `disabled={fut}`(109) | `disabled={future}` + accessibilityState.disabled(140,150-151) | ✅ |
| 오늘 dot | 4×4 radius full accent, bottom 5, 중앙(118) | `todayDot` primary, absolute bottom 5(158-163,196-202) | ✅(근사 §2.1) |
| 하단 여백 | `<div height 10/>`(123) | `bottomSpacer` height 10(171,203) | ✅ |

### ② 비주얼·토큰
- 색 전부 토큰 경유, **raw hex 0건**(grep 확인 — `DatePickerSheet.tsx`의 `#E5484D/#3B82F6`는 근사 사유 **주석**, 코드 아님).
- 일=`calendarSun`(#E5484D)·토=`calendarSat`(#3B82F6) — 킷 mk-extra:100 verbatim 정합. `tokens.spec.ts:274-283` 라이트/다크 미러 단언.
- 선택=`primary`(#3366FF=`--mk-accent`)+`primaryFg`(흰) / 미래=`fgDisabled`(`--text-disable`) / 평일=`fgMuted`(`--text-alternative`) / nav=`fillAlt`+`fgWeak`(`--mk-ink2`). ui-spec §1 매핑 일치.
- 타이포: `calendarMonth`(17/Bold), `calendarDow`(12/Bold), `calendarDay`(14.5/SemiBold), `calendarDayStrong`(14.5/Bold) — `tokens.spec.ts:289-302` 전수 단언, 킷 실값 정합.
- radius: 셀 9999(full), nav 20(full), 시트 26(Sheet 재사용). 그림자 0(시트만 shadow.lg — 떠있는 레이어, 킷 동일).

### ③ 텍스트·카피
- 시트 타이틀 "방문일 선택"(킷 89) ✅ · 월 라벨 "{year}년 {month+1}월" ✅ · 요일 일~토(WEEKDAYS) ✅.

---

## 2. 근사 허용 (RN 한계 — ui-spec 사유 대조 통과)

| 항목 | 킷 | RN 근사 | 사유 출처 | 판정 |
|------|----|---------|----------|------|
| **2.1 오늘 dot 중앙** | `left 50% translateX(-50%)`(118) | absolute `bottom 5` + 부모 `alignItems center`로 가로 중앙 | ui-spec §5.1 | ✅ 근사 허용 (Yoga 절대요소 alignItems 중앙 — 디바이스 스모크 권장) |
| **2.2 grid gap 2** | CSS grid `gap 2`(104) | flexWrap + cell `padding 1`(gap/2)로 셀간 2px | ui-spec §5.2 | ✅ 근사 허용 |
| **2.3 chevron-down** | `I name="chevron-down"` 18(mk-log:419) | chevron-right 글리프 `rotate(90 12 12)`(icons.ts:11) | ui-spec §2.3 | ✅ — 90° 시계방향 회전 → ⌄(아래) 방향 정확, 좌우대칭 글리프라 왜곡 0 |

---

## 3. V-1 — 요일 헤더 셀 수직 패딩 (✅ 수정 확인)

- **1차 발견:** 킷 `mk-extra.jsx:99` 요일 span `padding: "6px 0"` ↔ RN `dowCell` 수직 패딩 0 → 요일 행 ~12px 압축.
- **수정(ui-publisher-3):** `DatePickerSheet.tsx:41` `CAL_LAYOUT.dowPadV: 6` 추가, `:194` `dowCell: { flex: 1, textAlign: 'center', paddingVertical: CAL_LAYOUT.dowPadV }`.
- **재검증:** 킷 `padding "6px 0"`(상·하 6) 정합. 요일 행 수직 리듬 복원. ✅ PASS.

---

## 4. §4 진입 행 + 통합 (✅ 재검증 PASS — team-lead 배선 완료)

배선 완료(`MuklogEditor.tsx`) 후 킷 `mk-log.jsx:416-420` + `lk.dateRow`(602) ↔ RN 재대조.

### ① 진입 행 (RN MuklogEditor.tsx:609-620 / styles.dateRow 654-662)
| 요소 | 킷 | RN | 판정 |
|------|----|----|------|
| 컨테이너 | gap 10, padding 14/16, radius 16, **border 1.5 `--line`**, bg `--mk-card` | `dateRow` row·alignItems center·gap 10·padV 14·padH 16·radius 16·**borderWidth 1.5 borderColor hairline**·bg surface | ✅ |
| 좌 아이콘 | `calendar` 19 `--mk-accent`(417) | `Icon Calendar 19 color="primary"`(615) | ✅ |
| 날짜 텍스트 | `600 15px/1` `--mk-ink` 좌측·flex 1(418) | `Text variant="dateRowValue" color="fg" flex 1`(616-618) | ✅ |
| 우 아이콘 | `chevron-down` 18 `--text-assistive`(419) | `Icon ChevronDown 18 color="fgAssistive"`(619) | ✅ |
| 표시 포맷 | `fmtDate(iso,true)` = `YYYY.MM.DD (요일)`(418) | `formatVisitedDate({visitedAt, withDow:true})` → `YYYY.MM.DD (요일)`(formatVisitedDate.ts:33-37, 킷 요일 라벨 일~토 정합) | ✅ |
| 접근성 | — | `accessibilityRole="button"` + 라벨에 현재 날짜 포함(610-611) | ✅ |

> **border 색 = hairline(`--line`)** — accent 아님(ui-spec §4 경고 정합). ✅

### ② 통합 동작
- 행 탭 `onPress={() => setDateOpen(true)}`(612) → `DatePickerSheet visible={dateOpen}`(621-622) 오픈, 타이틀 "방문일 선택"(Sheet). ✅
- 날짜 선택 `onSelect={({date}) => { setVisitedAt(date); setDateOpen(false); }}`(625-628) → 행 표시(`formatVisitedDate(visitedAt)`) 갱신 + 시트 닫힘. ✅
- 구 방문일 `TextInput` **제거 완료** — 잔여 TextInput 2개(장소 이름 524 / 메모 594)뿐, 방문일 바인딩 0건(grep 확인). `value={visitedAt}`(623)은 DatePickerSheet prop. ✅

---

## 5. 빌드 게이트
- `npm test` → **988 passed / 121 suites** (formatVisitedDate.spec 포함). ✅
- `tsc --noEmit` → **0 error**. ✅
- 방문일 TextInput grep → **0건**. ✅

---

## 6. 최종 판정
date-picker 전 비주얼 항목(DatePickerSheet 컴포넌트 + 진입 행 + 통합) 킷 충실도 통과. V-1·PENDING 모두 재검증 통과. **date-picker 비주얼 완료.**
