# QA Report — Visual (map-category-filter)

> 검증자: qa-visual · 방법: visual-qa 스킬(킷 templates/muklog ↔ RN 3축 교차검증)
> 디자인 단일 출처: `.claude/skills/ui-design/templates/muklog/mk-*.jsx` (이 기능은 **킷 직접 시안 있음** — `mk-log.jsx:113-118`)
> 대상: `CategoryFilterBar`(신설, 기존 조합) · 공용 `Chip` 재사용 정합 · 오버레이 배치
> 결과 요약: **비주얼 충실도 통과(컴포넌트 + 최종 조립 재검 완료)** — 불일치 0(하드페일) / 근사 허용 2 / 미검증 0 / 디바이스 스모크 이월 2

---

## 1. 통과 (킷 ↔ RN 일치)

### 1.1 공용 Chip = 킷 MkChip (변형 없이 재사용)
`Chip.tsx` ↔ 킷 `mk-ui.jsx:125-139` MkChip. **CategoryFilterBar가 Chip을 변형/오버라이드 없이 그대로 사용**(label/selected/onPress/testID만 전달, 스타일 주입 0) 확인 — 팀리드 지적 "변형 없이 쓰였는지" 통과.

| 속성 | 킷 MkChip | RN Chip | 판정 |
|---|---|---|---|
| padding | 8×13(`:129`) | 8/13(`Chip.tsx:58-59`) | ✅ |
| radius | 999 | `radius.full`(`:32`) | ✅ |
| gap(이모지↔라벨) | 5(`:128`) | 5(`:57`) | ✅ |
| 선택 배경 | `--mk-accent`(`:131`) | `primary`(`:29`) | ✅ |
| 선택 텍스트 | `#fff`(`:132`) | `primaryFg`(`:44`) | ✅ |
| 선택 보더 | 1px transparent(없음)(`:130`) | `borderWidth 0`(`:31`) | ✅ |
| 비선택 배경 | `--mk-card`(`:131`) | `surface`(`:29`) | ✅ |
| 비선택 텍스트 | `--mk-ink2`(`:132`) | `fgWeak`(=warm.ink2=mk-ink2)(`:44`) | ✅ |
| 비선택 보더 | 1px `--line`(`:130`) | `hairlineWidth` + `hairline`(`:31`) | ✅ 헤어라인 규칙 |
| 폰트 | 600/13.5(`:133`) | `spotCount`(SUIT-SemiBold) + fontSize 13.5 오버라이드(`:44,63`) | ✅ |
| 라벨 | label-only(이모지 옵션) | label-only(emoji prop 미전달) | ✅ |

### 1.2 CategoryFilterBar = 킷 필터 칩 행 (mk-log:113-118)
킷 `<div flex gap:7 overflowX:auto padding:0 20 14>{ CHIP "전체" + cats.map }</div>` ↔ RN `CategoryFilterBar.tsx`.

| 속성 | 킷(mk-log:113-118) | RN | 판정 |
|---|---|---|---|
| 컨테이너 | flex + overflowX auto | 가로 `ScrollView`(`:33-36`) | ✅ |
| gap | 7 | `spacing[7]`(`:40`, 토큰 존재 확인) | ✅ |
| 좌우 패딩 | 20 | `paddingHorizontal spacing[20]`(`:40`) | ✅ |
| "전체" 칩 | `filter==='all'` | `selected === null`(`:46`) | ✅ |
| 카테고리 칩 | `cats.map(CHIP label)` | `MUKLOG_CATEGORY_KEYS.map`(`:49-57`) | ✅ |
| 라벨 | `CATM[c].label` | `categoryLabel({ key })`(`:53`) | ✅ label-only |
| 단일 선택 | 단일 `filter` | 단일 `selected`(key\|null) | ✅ |
| 스크롤바 | (웹 자동 숨김) | `showsHorizontalScrollIndicator={false}`(`:36`) | ✅ |

칩 집합은 하드코딩 아닌 `MUKLOG_CATEGORY_KEYS`(SSOT) 사용 → enum 드리프트 0(ui-spec §1.3 각주의 "8 vs 9종" 무관하게 상수 추종). ✅

### 1.3 리스트 필터와의 divergence (비주얼 이슈 아님 — 근거 확인)
- 지도=고정 `MUKLOG_CATEGORY_KEYS`(+전체) vs 리스트=present-only(`muklogCategoriesInUse`).
- 근거(ui-spec §1.3 / plan §3④): nearby가 viewport·accumulate로 churn → present-only면 칩 깜빡임 + saved/wish에 없는 카테고리로 nearby 못 거름. **고정이 예측가능·전 카테고리 필터가능.** 타당, 비주얼 결함 아님. label-only·가로 스크롤·gap·Chip idiom은 리스트와 동일(일관). ✅

### 1.4 토큰 경유
`CategoryFilterBar` raw hex 0(grep 무매치). gap·padding `theme.spacing`, 색·radius는 Chip 내부 토큰 경유. ✅

---

## 2. 최종 조립 재검 (완료 — 통과)

developer 배선 완료 후 `MapTabScreen.tsx`를 ui-spec §2와 재대조:

- **CategoryFilterBar 배치**: `styles.filterBar` = `position:absolute, left:0, right:0`(full-width edge-bleed) + `top: spacing[12]`(`:304,388`) → ui-spec §2 "최상단 full-width strip" 정합. ✅
- **props 배선**: `selected={category}` / `onSelect={({category:next}) => setCategory(next)}`(`:305-308`) — §1.4 계약대로. ✅
- **MapLegend 하강**: `top: spacing[56]`, `left: spacing[16]`(`:312`) → 필터바(top 12, 높이 ~34로 ~46 종료)와 겹침 없음(gap ~10). ui-spec §2 정합. ✅
- **locate FAB 불변**: `right/bottom spacing[16]`(`:331`). ✅
- **회귀 0**: 핀 3종·3 카드(Selected/Nearby/Wish, `:338/349/365`)·me 마커 불변. 필터는 마커 변환 전 순수 파생(`:105-108`)이라 비주얼 셸 미변경. ✅
- 배선이 CategoryFilterBar 비주얼을 임의 변경하지 않음(컴포넌트로만). ✅

→ 이전 "미검증"(오버레이 배치·겹침) 항목 해소. 통과.

---

## 3. 근사 허용 (사유 기록 확인됨)

| 항목 | 킷 | RN 근사 | 사유(기록 위치) |
|---|---|---|---|
| 3.1 바 스크림 없음 | 킷 필터는 흰 페이지(바 배경 없음) | 지도 위에 칩만 띄움(각 Chip 불투명 surface + 헤어라인으로 개별 가독) | ui-spec §4 근사1 / `CategoryFilterBar.tsx:9-10`. 복잡 타일 위 대비는 디바이스 스모크(§4) |
| 3.2 킷 바 하단 패딩 14 미적용 | `padding: 0 20 14`(하단 14) | 좌우 20만, 하단 패딩 없음 | 킷 하단 14는 LogScreen 리스트와의 간격용. 지도는 오버레이 strip이라 필터바↔범례 간격을 부모의 legend 하강 오프셋(`spacing[56]`)이 담당 → 바 자체 하단 패딩 불필요(맥락 적응) |

---

## 4. 디바이스 스모크 이월 (렌더 픽셀 확인 — [[qa-layout-blind-spot]])

1. **지도 위 칩 가독성** — 스크림 없이 칩(불투명 surface)이 복잡/위성/컬러 타일 위에서 충분히 대비되는지(ui-spec §4 근사1). 약하면 부모가 additive 스크림 추가(칩 컴포넌트 불변).
2. **오버레이 비충돌** — 배선 후 필터바(최상단)↔범례(하강)↔locate FAB(하단)가 실기기(노치·소형 화면)에서 겹치지 않는지. legend 하강 오프셋 `spacing[56]`은 근사값이라 실측 겹침 확인 필요(ui-spec §4 근사2).

→ 코드/토큰 정합은 확인, 렌더 픽셀은 실기기 스모크로 이관. qa-logic/디바이스 QA와 공유.

---

## 5. 결론
- 이번 스프린트 신설 **`CategoryFilterBar` + 최종 조립(오버레이 배치·범례 하강)의 비주얼 충실도 통과**(하드페일 0, 미검증 0). 공용 `Chip`·`categoryLabel` 변형 없이 재사용, 킷 필터 행(mk-log:113-118)·MkChip(mk-ui:125-139) 정밀 정합. 리스트 divergence는 근거 타당(비주얼 결함 아님).
- 배치: 필터바 최상단 full-width(top12) / 범례 하강(top56, 겹침 없음) / locate FAB 불변 / 핀·카드 회귀 0.
- 디바이스 스모크 2건(스크림 없는 칩의 복잡 타일 위 가독성·실기기 노치/소형 화면 오버레이 비충돌)은 렌더 픽셀 확인 이월 — 코드/토큰 정합은 확인. qa-logic/디바이스 QA와 공유.
- **비주얼 완료.** (디바이스 스모크 2건은 실기기 확인 잔여로 명시)
