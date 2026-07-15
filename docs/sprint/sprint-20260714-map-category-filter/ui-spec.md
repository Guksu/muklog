# UI Spec: 지도 카테고리 필터 (map-category-filter)

> 디자인 단일 출처: 킷 `.claude/skills/ui-design/templates/muklog/`. 이 기능은 **킷에 직접 시안이 있다** — `mk-log.jsx:113-118`의 카테고리 필터 칩 행(리스트 화면). 이를 **지도 상단 오버레이로 이식**한다. 칩 프리미티브·필터 idiom은 이미 RN에 있어(`Chip`, `MuklogList` 필터 행) **재사용 최우선**, 신규 프리미티브·토큰 0.

---

## 0. 요약 — 무엇을 만들었나

| 산출물 | 유형 | 파일 | 킷 근거 |
|---|---|---|---|
| `CategoryFilterBar` | 신규 컴포넌트(기존 조합) | `src/features/map/components/CategoryFilterBar/` | mk-log.jsx:113-118 카테고리 필터 칩 행 + 공용 `Chip`(=MkChip mk-ui:120-136) |

**토큰 변경 0 · 신규 프리미티브 0.** 공용 `Chip`(selected=primary / unselected=surface+hairline)·`categoryLabel`·`MUKLOG_CATEGORY_KEYS`만 조합.

---

## 1. CategoryFilterBar — 킷 필터 칩 행 이식

### 1.1 킷 대조

킷 `mk-log.jsx:113-118`(LogScreen 리스트 필터):
```jsx
<div style={{ display: "flex", gap: 7, overflowX: "auto", padding: "0 20px 14px" }}>
  <CHIP2 selected={filter === "all"} onClick={() => setFilter("all")}>전체</CHIP2>
  {cats.map((c) => <CHIP2 key={c} selected={filter === c} onClick={() => setFilter(c)}>{CATM[c].label}</CHIP2>)}
</div>
```
→ **가로 스크롤 행 + "전체" + 카테고리 칩(label-only, MkChip)**. 이미 RN `MuklogList`(MuklogList.tsx:110-136)가 이 패턴을 재현(가로 ScrollView + `Chip` + gap 7 + paddingHorizontal 20)했고 qa-visual 검증 완료 — 그 idiom을 그대로 map 오버레이용으로 재사용.

### 1.2 킷 → RN 매핑

| 속성 | 킷(mk-log:113-118 / MkChip) | RN(`CategoryFilterBar` + `Chip`) | 토큰 |
|---|---|---|---|
| 컨테이너 | `flex; overflowX:auto; gap:7; padding:0 20 14` | 가로 `ScrollView`, `contentContainerStyle` gap `spacing[7]` + paddingHorizontal `spacing[20]` | ✅ |
| 칩(선택) | MkChip selected: accent bg + #fff | `Chip selected`: `primary` bg + `primaryFg` | ✅ |
| 칩(비선택) | MkChip: surface + hairline + fgWeak | `Chip`: `surface` + `hairline` + `fgWeak` | ✅ |
| 라벨 | `{CATM[c].label}` label-only(이모지 없음) | `categoryLabel({ key })` label-only | ✅ |
| "전체" | `filter==='all'` | `selected === null` | ✅ |
| radius/pad/폰트 | full / 8×13 / 600·13.5 | `Chip` 그대로(mk-ui:120-136 재현) | ✅ |

### 1.3 리스트 필터와의 의도적 divergence (근거)

| 항목 | 리스트(MuklogList) | 지도(CategoryFilterBar) | 근거 |
|---|---|---|---|
| 칩 집합 | present-only(`muklogCategoriesInUse`) | **고정 `MUKLOG_CATEGORY_KEYS`(+전체)** | plan §3④: 지도 nearby가 viewport·accumulate로 churn → present-only면 칩 깜빡임 + saved/wish에 없는 카테고리로 nearby 못 거름. 고정이 예측가능·전 카테고리 필터가능 |
| 라벨 | label-only | label-only(동일) | 킷 filter·리스트 일관(이모지 없음) |

> ⚠️ plan 텍스트 "8종"은 `MUKLOG_CATEGORY_KEYS`(SSOT, 현재 **9종** — 고기 포함, categories `#6 고기 추가`)를 가리킨다. 칩 집합은 하드코딩 8이 아니라 **상수를 따른다**(enum 드리프트 0). "전체" + 상수 전체.

### 1.4 props 계약 (developer가 채움)

```ts
type CategoryFilterBarProps = {
  selected: MuklogCategoryKey | null;                       // null="전체"(필터 미적용). 상태 소유=MapTabScreen
  onSelect: (args: { category: MuklogCategoryKey | null }) => void; // "전체"→{category:null} / 카테고리→{category:key}
};
```

- **프리젠테이션 + onSelect만.** 3소스 필터(`filterByAppCategory`/`filterNearbyByCategory`)·활성 핀 정리·재조회 0은 전부 MapTabScreen(developer).
- 단일 선택은 `selected` 단일 값으로 표현(다중 없음). 리셋="전체" 칩 → `{category:null}`.

---

## 2. 배치 — 범례·locate FAB·SubBar 비충돌 (§4.4)

CategoryFilterBar 자체는 **위치를 갖지 않는다**(칩 행만). 부모(MapTabScreen)가 오버레이로 absolute 배치 — `MapLegend` 선례("위치는 부모가 absolute로 배치"). 충돌 회피 규칙(developer가 적용):

| 요소 | 현재 위치 | 필터 바 도입 후 |
|---|---|---|
| **CategoryFilterBar** | (신규) | **최상단 full-width strip.** `top: spacing[12]`(맵이 상태바 아래 시작 — 현 legend가 plain spacing 사용하는 전제와 동일. 맵이 노치까지 풀블리드면 `insets.top + spacing[8]`), `left:0 / right:0`(edge-bleed 가로 스크롤). |
| **MapLegend**(핀 3종 dot) | `top: spacing[14]`, `left: spacing[16]` | **필터 바 아래로 내림** → `top: spacing[56]`(= 12 + 필터바 높이 ~34 + gap ~10). left 불변. |
| **locate FAB** | `right/bottom: spacing[16]` | 불변(하단 — 비충돌). |
| **SubBar/헤더** | 지도 탭은 헤더 없음(풀블리드 맵) | 해당 없음. |

**가독성(지도 위)**: 각 `Chip`이 `surface`(불투명 흰) 배경 + 헤어라인이라 맵 타일 위에서 **개별적으로 가독**(킷 범례 칩과 동일 접근). → **바 배경 스크림 없이 칩만 띄운다**(경량·킷 정합).

### 근사/제약

1. **바 스크림 없음** — 킷 필터(흰 페이지)엔 바 배경이 없고, 칩이 자체 불투명 배경이라 맵 위 가독. 다만 매우 복잡한 위성/컬러 타일 위에선 대비가 약할 수 있음 → **디바이스 스모크에서 확인**(메모리 [[qa-layout-blind-spot]]). 필요 시 부모가 상단 얇은 그라데이션 스크림 추가(additive, 칩 컴포넌트 불변).
2. **legend 하강 오프셋(spacing[56])은 근사값** — 필터바 실측 높이(Chip pad 8+8 + 라벨 lineHeight)에 따라 developer가 미세조정 가능. 겹침만 없으면 됨.
3. **safe-area** — 현 legend가 plain `spacing[14]`(inset 미사용)이라 맵이 헤더/상태바 아래에서 시작한다고 보고 필터바도 plain `spacing[12]`. 실제로 맵이 노치까지 올라가면 developer가 양쪽에 `insets.top` 가산.

---

## 3. TDD 현황

| 스위트 | 내용 | 결과 |
|---|---|---|
| `CategoryFilterBar.spec.tsx` | "전체"+상수 전체 칩 렌더 / null→"전체" 선택 / key→해당 칩만 선택(단일) / 카테고리 탭→onSelect({category:key}) / "전체" 탭→onSelect({category:null}) / 라벨(categoryLabel·"전체") | green(6) |

내 산출물(CategoryFilterBar)은 **test green + 전체 tsc 0 에러**.

---

## 4. developer 배선 가이드 (요약)

- **MapTabScreen**: `const [category, setCategory] = useState<MuklogCategoryKey | null>(null)`.
- **필터 파이프라인**(plan §4.3): pins/wishPins→`filterByAppCategory`, nearby.items→`filterNearbyByCategory`(둘 다 category 주입)→각 ToMapMarkers→`mergeMapMarkers`→SET_MARKERS. 마커/브리지 계약 불변.
- **렌더**: 최상단 오버레이에 `<CategoryFilterBar selected={category} onSelect={({ category }) => setCategory(category)} />` + legend를 §2 오프셋으로 하강.
- **활성 핀 정리(T4)**: 선택 핀이 필터 결과에서 빠지면 `setSelected(null)`(map-pin-select 일반화, 3 kind 공통).
- **재조회 0**: category 변경은 useState만 — useNearbyPlaces/useMuklogPins/useWishPins refresh 호출 금지(비용 가드 §6-6).

---

## 5. QA(qa-visual) 대조 포인트

1. **칩 행** — RN `CategoryFilterBar` ↔ 킷 mk-log:113-118(가로 스크롤·gap 7·"전체"+카테고리·label-only·MkChip 선택/비선택 스킨).
2. **선택 스킨** — 선택 칩 primary bg+흰 텍스트 / 비선택 surface+hairline+fgWeak(공용 Chip = mk-ui:120-136).
3. **배치·비충돌** — 필터바(최상단 full-width) ↔ legend(아래로 하강) ↔ locate FAB(하단) 겹침 없음. 디바이스에서 맵 위 칩 가독성.
4. **리스트 필터와 일관성** — MuklogList 필터 칩과 동일 idiom(가로 스크롤·gap·Chip), 단 지도는 고정 8(9)종 divergence(§1.3).
5. **회귀** — 지도 me 마커·핀 3종·범례 dot 색·WishSpotCard/NearbySpotCard/SelectedSpotCard 불변.
