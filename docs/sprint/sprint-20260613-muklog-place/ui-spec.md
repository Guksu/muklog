# UI Spec — muklog-place 장소검색 UI (ui-publisher)

> **디자인 단일 출처:** 킷 `templates/muklog` = `.claude/skills/ui-design/templates/muklog/`.
> 본 스프린트 화면 근거: `mk-log.jsx` **MuklogEditor 장소 필드(300-317)** + **PlaceSearch(383-414)** + 스타일 `lk`(491-508).
> **역할 경계:** ui-publisher=프레젠테이션·토큰·레이아웃 / developer=데이터·훅·자동채움·payload. 본 문서는 *어떻게 보이는가* + developer 배선 계약.

---

## 0. 산출물 요약

| 산출물 | 경로 | 상태 |
|---|---|---|
| Search 아이콘 추가 | `assets/icons/icons.ts`(`search`) + `src/components/Icon.tsx`(`IconName.Search`) | ✅ 구현·테스트 |
| `PlaceResultRow` (결과 1행) | `src/features/muklog/PlaceResultRow.tsx` (+spec) | ✅ 구현·테스트 |
| `PlaceSearchField` (검색입력+상태) | `src/features/muklog/PlaceSearchField.tsx` (+spec) | ✅ 구현·테스트 |
| `PlaceSelectedSummary` (선택 요약) | `src/features/muklog/PlaceSelectedSummary.tsx` (+spec) | ✅ 구현·테스트 |
| barrel export | `src/features/muklog/index.ts` | ✅ |
| **시트 장소 섹션 골격(controlled)** | `src/features/muklog/MuklogEntrySheet.tsx` | ✅ **ui-publisher 골격 구현**(B 확정). state·자동채움·payload는 developer #3 |

- 신규 토큰 **불필요**(기존 `surface·hairline·fgMuted·fgWeak·primary·primaryWeak·accentLine·accentStrong·radius.full/control/xl·spacing` 로 충족).
- 테스트: 신규 3컴포넌트 + Icon **26** + 시트 골격 **4** = **30 케이스 통과**. 전체 회귀 **609/609** + `tsc --noEmit` 통과.
- **역할 경계 확정(team-lead, B)**: ui-publisher = 시트 장소 섹션 **controlled 비주얼 골격**(props 받는 껍데기)까지. developer = state·디바운스·자동채움·payload 배선(아래 §5).

---

## 1. 컴포넌트 분리 결정 (planner 제안 "PlaceSearchField / PlaceResultList" 대비)

planner/team-lead은 `PlaceSearchField` / `PlaceResultList` 후보를 제시. **ui-publisher 판단으로 다음 3분할** 채택:

| 컴포넌트 | 역할 | 근거 |
|---|---|---|
| `PlaceSearchField` | 검색 입력 pill + 상태 영역(loading/0건/error/결과리스트) | 킷 PlaceSearch = 입력+결과가 한 화면 → 한 컴포넌트가 상태 5종을 일관 관리 |
| `PlaceResultRow` | 결과 1행(커버+이름+카테고리·주소+plus) | 킷 `resultRow` = 재사용 단위. List 래퍼 대신 **Row 단위**가 테스트·재사용에 명확(List는 Field가 map으로 흡수) |
| `PlaceSelectedSummary` | 선택 후 요약 카드(+선택 해제) | 킷 `placeChosen`(별도 시각 상태) → 독립 컴포넌트 |

→ `PlaceResultList`를 만들지 않은 이유: 리스트는 상태(loading/empty/error)와 분리 불가하므로 `PlaceSearchField`가 상태와 함께 렌더하는 것이 응집도가 높다.

---

## 2. 킷 라인 ↔ RN 매핑

### 2.1 검색 입력 pill — `PlaceSearchField`
킷 `mk-log.jsx:390-394`(PlaceSearch 검색바) 인라인 번역.

| 킷(웹) | 킷 실값 | RN 매핑 |
|---|---|---|
| 컨테이너 `display:flex; gap:8; radius:999; padding:10×16; border:1px solid --line; bg:--mk-card` | radius 999 / pad 10·16 / 1px line | `flexDirection:row, alignItems:center, gap:spacing[8], borderRadius:radius.full, paddingV:spacing[10], paddingH:spacing[16], borderWidth:hairline, borderColor:color.hairline, backgroundColor:color.surface` |
| `<I2 name="search" size={18} color="--text-alternative">` | 돋보기 18 | `<Icon name={IconName.Search} size={18} color="fgMuted" />` (신규 `search.svg` 등록) |
| `<input ... font:"500 15px" color:--mk-ink placeholder:"장소, 음식점 검색">` | 500/15, 잉크 | `<TextInput style={{fontFamily:typography.body.fontFamily(Medium), fontSize:15, color:color.fg}} placeholderTextColor={color.fgMuted}>` accessibilityLabel="장소 검색" |

### 2.2 결과 1행 — `PlaceResultRow`
킷 `mk-log.jsx:402-409`(결과 항목) + `lk.resultRow:507`.

| 킷 요소 | 킷 실값 | RN 매핑 |
|---|---|---|
| `lk.resultRow` 행 | `gap:12; padding:11×12; radius:14; border:none; bg:transparent` | `flexDirection:row, alignItems:center, gap:12, paddingV:11, paddingH:12, borderRadius:radius.control(14)`; Pressable pressed opacity 0.6 |
| `<FC2 cat radius={12} emojiSize={22}` 44×44 | 커버 44/radius12/emoji22 | `<FoodCover category size={44} radius={12} emojiSize={22} />` (카테고리 그라데이션 = `categories.ts` SSOT) |
| place_name `700 15px --mk-ink` | 700/15 | `<Text variant="cardTitle"(Bold) style={{fontSize:15}} color="fg" numberOfLines={1}>` |
| `{CATLBL(cat)} · {road}` `500 12.5px --text-alternative` ellipsis | 500/12.5 | `<Text variant="meta"(Medium) style={{fontSize:12.5}} color="fgMuted" numberOfLines={1}>` = `[categoryLabel, road‖addr].filter(Boolean).join(' · ')` |
| `<I2 name="plus" size={20} color="--mk-accent">` | plus 20 accent | `<Icon name={IconName.Plus} size={20} color="primary" />` |

### 2.3 선택 요약 카드 — `PlaceSelectedSummary`
킷 `mk-log.jsx:302-310`(placeChosen) + `lk.placeChosen:499`.

| 킷 요소 | 킷 실값 | RN 매핑 |
|---|---|---|
| `lk.placeChosen` 카드 | `gap:12; padding:12; radius:16; border:1.5px solid --mk-accent-line; bg:--mk-accent-weak` | `flexDirection:row, alignItems:center, gap:12, padding:12, borderRadius:radius.xl(16), borderWidth:1.5, borderColor:color.accentLine, backgroundColor:color.primaryWeak` |
| `<FC2 cat radius={12} emojiSize={24}` 48×48 | 커버 48/radius12/emoji24 | `<FoodCover category size={48} radius={12} emojiSize={24} />` |
| place_name `700 16px --mk-ink` | 700/16 | `<Text variant="navTitle"(Bold/16) color="fg" numberOfLines={1}>` |
| `{road‖area}` `500 12.5px --text-alternative` | 500/12.5 | `<Text variant="meta" style={{fontSize:12.5}} color="fgMuted">` 텍스트=`📍 {road‖area}`(plan §4.1) |
| 우측 `"변경" 700 13px --mk-accent-strong` | 700/13 accentStrong | `<Pressable>`+`<Text variant="caption" style={{fontSize:13}} color="accentStrong">선택 해제</Text>` (라벨은 plan D2 의미로 "선택 해제") |

### 2.4 상태 영역(plan §4.2) — `PlaceSearchField` 내부

| 상태 | RN 표시 | 근거 |
|---|---|---|
| `idle` | 미표시(입력 pill만) | plan §4.2 "기존 수동 입력 그대로" |
| `loading` | `<ActivityIndicator color=primary>` + `검색 중…`(bodySm/fgMuted) | plan "스피너". **스켈레톤은 스피너로 근사**(§4 사유) |
| `ready` & ≥1 | `PlaceResultRow[]`(testID `place-search-results`) | plan |
| `ready` & 0건 | `검색 결과가 없어요. 직접 입력해도 돼요.`(bodySm/fgMuted) | plan §4.2 문구 그대로 |
| `error` | `errorMessage`(bodySm/fgMuted) | plan §4.2·§3.6. **색은 error(빨강) 아닌 `fgMuted`** — 폴백 안내 톤(§4 사유) |

---

## 3. 토큰 매핑 (킷 `--mk-*` → RN, 본 스프린트 사용분)

| 킷 변수 | 실값 | RN 토큰 | 사용처 |
|---|---|---|---|
| `--mk-card` | 카드면 | `color.surface` | 검색 pill 배경 |
| `--line` | 헤어라인 | `color.hairline` | 검색 pill 보더 |
| `--text-alternative` | 보조 | `color.fgMuted` | 돋보기·보조행·상태 안내 |
| `--mk-ink` | 잉크 | `color.fg` | 입력·장소명 |
| `--mk-accent` | #3366FF | `color.primary` | plus 아이콘·스피너 |
| `--mk-accent-weak` | #EAF0FF | `color.primaryWeak` | 선택카드 배경 |
| `--mk-accent-line` | #BFD0FF | `color.accentLine` | 선택카드 보더 |
| `--mk-accent-strong` | #1F4FE0 | `color.accentStrong` | "선택 해제" |
| radius 999 / 14 / 16 | full / control / xl | `radius.full` / `radius.control` / `radius.xl` | pill / 결과행 / 선택카드 |

**raw hex/숫자 색 0** — 전부 토큰 경유. 음식 이모지(FoodCover·📍)는 킷 기준 허용.

---

## 4. RN 근사·divergence (킷 100% 재현 불가 항목)

1. **킷 PlaceSearch = 전체화면 push → RN = 시트 내 인라인.** RN 진입점이 `MuklogEntrySheet`(하단 시트)라 별도 전체화면 push 대신 입력 pill+결과를 시트 내부 인라인으로 옮김. 시각 어휘(pill·결과행·선택카드)는 킷 그대로 유지. **킷 vs plan 충돌 아님** — plan §4.1이 "장소명 필드 근처 인라인 검색 영역"을 명시. ✅
2. **로딩: 킷에 명시 비주얼 없음 → ActivityIndicator 스피너.** plan "스피너/스켈레톤" 중 스피너 채택(스켈레톤은 차기).
3. **error 색: `fgMuted`(빨강 아님).** §3.6 메시지는 "직접 입력해 주세요" 폴백 안내라 경고색(error) 대신 보조톤. 기존 시트의 저장 실패(error/빨강)와 의미 구분.
4. **"변경"→"선택 해제" 라벨 변경.** 킷 placeChosen 우측 액션은 "변경"(재검색)이나, plan D2가 "선택 해제 시 좌표 NULL 리셋·장소명 유지"를 정의 → 의미를 좇아 "선택 해제"로 라벨. 해제 후 검색 pill 재노출 = 재검색("변경") 가능하므로 킷 기능 포함. **planner/qa 확인 요청 항목(아래 §6).**
5. **radius 16 = `radius.xl`.** 킷 에디터 컨트롤(searchBtn·placeChosen·textarea·dateRow)의 16px은 토큰 `radius.xl`(16)에 정확 매핑. (버튼 14=control, 카드 22=card와 구분)
6. **fontSize 오버라이드 시 variant lineHeight 잔존(QA nit, 현행 유지).** resultRow name(cardTitle→15)·summary sub(meta→12.5)·action(caption→13)에서 variant의 lineHeight가 남아 킷 비율 대비 최대 ~2.5px 느슨. **단일 행 + 세로 중앙정렬이라 시각차 무시 가능** → qa-inspector 확인·승인(비차단). 별도 lineHeight 토큰 신설 없이 유지.

---

## 5. developer 배선 계약 (시트 골격은 구현됨 — `MuklogEntrySheet`)

> **확정(B):** ui-publisher가 **controlled 비주얼 골격**을 구현 완료. developer는 아래 props에 `usePlaceSearch`·자동채움·payload를 **연결만** 하면 됨(시트 JSX/레이아웃 무수정).

### 5.1 구현된 장소 섹션 골격 (`MuklogEntrySheet.tsx`, 기존 장소명 자리)

```
[Field label] 어디서 먹었나요? *
─ selectedPlace == null (검색/수동 모드) ────────────
  {placeSearch && <PlaceSearchField .../>}   // 검색 pill + 상태(loading/0건/error/결과). 미주입 시 생략
  <TextInput accessibilityLabel="장소 이름" .../> // 수동 입력(폴백) — placeName state 그대로
─ selectedPlace != null (선택 모드) ────────────────
  <PlaceSelectedSummary .../>                // 검색·수동 입력을 대체(킷 place?placeChosen:searchBtn 토글)
```
- 카테고리/별점/사진/메모/방문일 등 **나머지 필드 무변경**. 장소 섹션만 골격화.
- `placeSearch`·`selectedPlace` 미주입 = 기존 수동 입력만(회귀 안전, 신규 props 전부 optional).

### 5.2 시트 신규 props (developer가 연결 — 모두 optional)

| prop | 타입 | developer 연결 |
|---|---|---|
| `placeSearch` | `MuklogPlaceSearchControl` | `usePlaceSearch()` 출력을 객체로 묶어 주입(아래 5.2.1) |
| `onSelectPlace` | `({item}:{item:PlaceSearchItem})=>void` | 결과 선택 → 자동채움(5.3) |
| `selectedPlace` | `MuklogSelectedPlace \| null` | 선택 상태(있으면 요약카드 모드) |
| `onClearPlace` | `()=>void` | 선택 해제(D2 좌표 NULL 리셋, 장소명 유지) |

**5.2.1 `MuklogPlaceSearchControl`** (= PlaceSearchField로 전달되는 컨트롤):
```ts
{
  query: string;                  // usePlaceSearch().query
  onChangeQuery: (t:string)=>void;// usePlaceSearch().setQuery (디바운스 트리거)
  status: PlaceSearchStatus;      // usePlaceSearch().status ('idle'|'loading'|'ready'|'error')
  results: PlaceSearchItem[];     // usePlaceSearch().results
  errorMessage?: string|null;     // usePlaceSearch().errorMessage
  resolveCategory?: ({item})=>MuklogCategoryKey|string|null;
    // = ({item})=>mapKakaoCategory({categoryName:item.categoryName, categoryGroupCode:item.categoryGroupCode})
}
```
**5.2.2 `MuklogSelectedPlace`** (= PlaceSelectedSummary로 전달):
```ts
{ placeName: string; category?: MuklogCategoryKey|string|null; roadAddress?: string|null; area?: string|null }
```

### 5.3 자동채움 매핑 (plan §4.1·D1·D2 — developer 로직, 시트 골격 외부)

`onSelectPlace({item})` 핸들러에서 developer가 수행(`placeFieldsFromItem`·`PlaceSelection` 이미 구현):
- **placeName**: 시트 placeName state를 `item.placeName`으로 세팅해야 함 → 시트는 placeName을 내부 state로 보유. developer는 (a) 시트의 `selectedPlace` 모드로 전환해 요약카드가 `selectedPlace.placeName`을 표시하게 하고, (b) **payload용 placeName/category/coords는 자신의 selection state에서 handleSave에 합류**시킨다(시트 handleSave 확장 = T9/T10, developer 영역). ※ 시트 골격은 placeName을 자동 세팅하지 않음(자동채움=developer).
- **category**: `mapKakaoCategory(item)` 성공 시 칩 자동선택(D1 덮어쓰기), `null`이면 기존 선택 보존.
- **coords**: `placeFieldsFromItem(item)` → `kakaoPlaceId/address/roadAddress/lat/lng` → create/update payload 합류(좌표 nullable).
- **선택 해제(`onClearPlace`)**: coords 5필드 NULL(D2), placeName 유지, `selectedPlace=null` → 검색+수동 복귀.

> **주의(경계 결과):** 시트 골격은 `selectedPlace` prop으로만 모드를 토글하고 placeName/category/coords를 자동 세팅하지 않는다(자동채움=developer). 따라서 developer는 `onSelectPlace`에서 **자신의 selection state**(placeName 포함)를 관리하고, **handleSave payload 합류**를 직접 처리해야 한다. 시트 내부 placeName(수동 input)은 검색/수동 모드에서만 노출되며 폴백 경로다.

### 5.4 회귀 가드(검증됨)
- 기존 `MuklogEntrySheet.spec.tsx` 16케이스(작성/편집) + 신규 골격 4케이스 = **20 통과**. `placeSearch`/`selectedPlace` 미주입 → 무변경.
- `getByLabelText('장소 이름')`은 선택 전 항상 존재, 선택 모드(`selectedPlace`)엔 숨김.

---

## 6. planner/qa 확인 요청

- **(§4-4) "선택 해제" 라벨**: 킷 "변경" → plan D2 의미로 "선택 해제" 채택. 동의 여부 확인(반대 시 "변경"으로 즉시 환원 가능).
- **D1 비주얼**: 자동채움이 카테고리 칩을 덮어쓰되 매핑 `null`이면 보존 — 칩 토글 비주얼 영향 없음(기존 칩 컴포넌트 재사용). 동의.
- **D2 비주얼**: 선택 해제 = 요약카드 사라지고 검색 pill+수동 input 복귀, 장소명 유지. 동의.

---

## 7. 비주얼 충실도 self-check

- [x] 킷 구조요소 누락 0: 검색 pill·돋보기·결과행(커버+이름+카테고리·주소+plus)·선택카드(커버+이름+주소+해제)·상태 5종.
- [x] 색 전부 토큰 경유(raw hex/숫자 0), 킷 `--mk-*` 실값 일치.
- [x] radius(pill full·결과 14·선택 16=xl), 폰트(700/15·700/16·500/12.5 → family+size), 간격(킷 gap 12·8·pad 11×12·12) 일치.
- [x] 헤어라인 vs 그림자: 검색 pill·결과행=헤어라인/무그림자(킷 동일), 떠있는 레이어 없음.
- [x] 카테고리 그라데이션 커버(FoodCover) 카테고리별 상이(`categories.ts` SSOT).
- [x] 프리미티브 추출(화면 인라인 중복 0) — 3컴포넌트.
- [x] RN 미재현(전체화면→인라인·스켈레톤→스피너·error 톤·라벨) 근사+사유 기록(§4).
- [x] `npm test`(신규 30 = 컴포넌트 26 + 시트 골격 4) + 전체 회귀 609 + `tsc --noEmit` 통과.
- [x] 시트 장소 섹션 controlled 골격 구현(검색/수동/요약 토글) + 회귀 가드.
- [ ] developer 배선 후 통합 동작(자동채움/0건/에러/편집 프리필) — developer T10·T11, qa §7-8 검증.
