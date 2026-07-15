# Sprint: 지도 카테고리 필터 (map-category-filter)

> roadmap-sprints 루프 3/6. "지도 고도화" 세 번째 슬라이스. 지도에 핀 3종(kind: saved/wish/nearby)이 모두 표시되는 상태에서, 카테고리 칩으로 표시 핀을 좁힌다.

## 1. 기능 한줄 정의

지도 상단 카테고리 칩(전체 + 8종)에서 하나를 고르면, 그 카테고리에 해당하는 핀(먹로그·위시·주변 3종 모두)만 지도에 남고 나머지는 숨는다. "전체"로 리셋한다. **조회 재실행 없이 순수 클라 필터**(비용 0).

## 2. 범위

### In-scope
- **카테고리 필터 칩 바**: "전체"(리셋) + 앱 카테고리 **8종 고정**(단일 선택). 지도 상단 오버레이.
- **3종 핀 전부에 적용**: saved(MuklogPin.category)·wish(WishPin.category)는 앱 카테고리 필드 직접 비교, nearby(NearbyPlaceItem)는 **기존 `mapKakaoCategory`로 파생한 앱 카테고리**로 비교(재매핑 금지 — 단일 출처 재사용).
- **소스 레벨 순수 필터**: 마커 변환 **전에** 3개 소스 배열(MuklogPin[]·WishPin[]·NearbyPlaceItem[])을 필터 → `MapMarker`·SET_MARKERS·WebView 브리지 계약 **불변**(브리지 변경 0).
- **필터 상태 = 클라 전용 useState**(MapTabScreen). 백엔드·조회 재실행 0.
- **활성 핀 정리**: 선택된 핀(카드 열림)이 필터로 사라지면 selection 해제(카드 닫힘 + SET_SELECTED(null)) — map-pin-select 선례 확장.

### Out-of-scope (다음 스프린트 / 명시적 제외)
- **필터 영속**(AsyncStorage) — 세션/진입마다 "전체"로 시작.
- **리스트 화면(LogScreen) 필터와 상태 공유** — 별개 로컬 상태.
- **kind 필터**(위시/먹로그/주변 종류 토글) — 이번은 카테고리만.
- **다중 선택**(여러 카테고리 동시) — 단일 선택(리스트 필터 패턴 일관).
- 카테고리별 개수 배지, 필터 결과 빈 상태 전용 안내 배너.
- `MapMarker`에 category 필드 추가/브리지 페이로드 변경(소스 필터로 회피).

## 3. 설계 결정 (planner 판단)

| # | 결정 | 근거 |
|---|------|------|
| ① 적용 범위 | 3종 핀 전부 | saved/wish는 category 보유, nearby는 mapKakaoCategory 파생. 필터의 주요 가치가 "주변에서 카페만" 등이라 nearby 포함 필수. |
| ② 단일 vs 다중 | **단일 선택**(category: key \| null) | 기존 LogScreen 리스트 필터(`filterMuklogsByCategory`, single, null=전체)와 일관(리더 지시). |
| ③ 필터 상태 | **클라 전용 useState**, 백엔드·재조회 0 | 비용 가드레일. 필터는 이미 받은 데이터의 표시 필터일 뿐. |
| ④ 칩 집합 | **고정 8종 + 전체**(present-only 아님) | ⚠️ 리스트는 `muklogCategoriesInUse`(존재 카테고리만)지만, **지도 nearby 집합은 viewport·accumulate로 churn**한다 → present-only면 칩이 깜빡이고, saved/wish에 없는 카테고리로 nearby를 못 거른다. 고정 8종이 예측가능·전 카테고리 필터가능. (리스트 패턴과 의도적 divergence, 근거 명시.) |
| ⑤ 칩 위치 | 지도 상단 오버레이(가로 스크롤 행) | 범례(top-left)·locate FAB(bottom-right)와 충돌 회피는 ui-publisher가 킷 기준 배치(§4.4). |
| ⑥ 리셋 | "전체" 칩(category=null) | null="전체" → 필터 미적용, 전 핀 표시. |

## 4. 데이터 · API 계약

### 4.1 백엔드
- **변경 0.** 마이그레이션·RPC·Edge Function·Realtime·신규 Kakao 호출 없음. 순수 클라 필터.

### 4.2 신설 순수 필터 유틸 (map feature)
- **`filterByAppCategory<T extends { category: string | null }>({ items, category })`**: category=null → items(동일 참조) / else `items.filter(i => i.category === category)`. **MuklogPin[]·WishPin[] 공용**.
- **`filterNearbyByCategory({ items, category })`**: category=null → items / else `items.filter(i => mapKakaoCategory({ categoryName: i.categoryName, categoryGroupCode: i.categoryGroupCode }) === category)`. **`mapKakaoCategory` 재사용**(자체 매핑 금지 — 메모리 [[nearby-category-mapping]] 함정).

> 성능: 필터는 매 렌더 파생(메모이제이션 없음 — 컨벤션상 useMemo 지양, 핀 수 소량이라 무해). category 미변경 시 동일 결과.

### 4.3 파이프라인 배선(MapTabScreen)
```
category(state) ─┐
 pins(MuklogPin[]) → filterByAppCategory → pinsToMapMarkers ─┐
 wishPins(WishPin[]) → filterByAppCategory → wishToMapMarkers ─┼→ mergeMapMarkers({saved,wish,nearby}) → SET_MARKERS
 nearby.items(NearbyPlaceItem[]) → filterNearbyByCategory → nearbyToMapMarkers ─┘
```
- ⚠️ 배선 변경점: nearby 마커를 `nearby.markers`(hook 사전생성) 대신 **`nearby.items` 필터 후 `nearbyToMapMarkers`로 MapTabScreen에서 생성**(필터 적용 지점 확보). `useNearbyPlaces`·accumulate 로직 불변(items는 여전히 누적 결과).
- `MapMarker` 타입·`mapHtml`·`parseMapMessage`·SET_MARKERS **불변**(브리지 회귀 0).

### 4.4 칩 컴포넌트(ui-publisher)
- **`CategoryFilterBar`**(신설): props `{ selected: MuklogCategoryKey | null; onSelect: ({ category }) => void }`. 칩 = 전체 + `MUKLOG_CATEGORY_KEYS`(8종, 킷 순서). 기존 `Chip`/`MkChip` 프리미티브·`categoryLabel`·`categoryEmoji` 재사용. 활성/비활성 비주얼·상단 배치·범례 공존은 ui-publisher가 킷 `templates/muklog` 기준 확정.

## 5. 화면 · UX

### 5.1 컴포넌트/역할
- **MapTabScreen**: category state + 3소스 필터 배선 + 활성 핀 정리 effect. `CategoryFilterBar` 렌더.
- **CategoryFilterBar**(ui-publisher): 상단 가로 스크롤 칩 행.

### 5.2 상태
- **초기**: "전체" 선택(category=null) → 전 핀 표시.
- **필터 선택**: 해당 카테고리 핀만. 지도·me 마커·범례·locate 불변.
- **빈 결과**(필터 후 핀 0): 지도만 표시(에러/배너 없음 — 기존 "핀 0개여도 깔끔히" 정책 일관).
- **필터 중 데이터 갱신**(포커스 refresh·스프린트1 add·nearby accumulate): 새 데이터에 현재 필터가 자동 재적용(파생) — 재조회 아님.

### 5.3 카피
- 칩 라벨 = `categoryLabel`(8종) + "전체". 별도 카피 없음.

## 6. 작업 목록 (각 인수조건 포함)

- [ ] **T1. `filterByAppCategory` 순수 유틸** — 인수조건: category=null이면 원본, 지정 시 category 일치 항목만 — 테스트: MuklogPin/WishPin 배열에 대해 null→전체, key→일치만, 미존재 key→빈 배열.
- [ ] **T2. `filterNearbyByCategory` 순수 유틸** — 인수조건: nearby 항목을 mapKakaoCategory 파생 카테고리로 필터(재매핑 없음), null→전체 — 테스트: "음식점>카페" 항목이 category='cafe' 필터 통과·'noodle' 필터 탈락, CE7 그룹코드→cafe 통과, 매핑 null 항목은 어떤 특정 카테고리에도 불통과.
- [ ] **T3. MapTabScreen 필터 배선** — 인수조건: 칩 선택 시 3종 핀이 해당 카테고리로 좁혀지고 SET_MARKERS 재주입, "전체"로 리셋 시 전 핀 복귀, 조회 재실행 없음 — 테스트: category 변경 시 mergeMapMarkers 입력이 필터된 마커, 재조회 호출(RPC/select/invoke) 0.
- [ ] **T4. 활성 핀 정리** — 인수조건: 선택된 핀이 현재 필터에서 빠지면 selection 해제(카드 닫힘 + SET_SELECTED null), 남아있으면 유지 — 테스트: selected 핀이 필터 결과에 없으면 setSelected(null) 호출, 있으면 유지.
- [ ] **T5. `CategoryFilterBar` 컴포넌트(ui-publisher)** — 인수조건: 전체+8종 칩 렌더, 단일 선택 강조, onSelect 발화, 범례·FAB와 비충돌 — 테스트: 칩 개수/라벨 렌더·선택 콜백(비주얼 충실도는 qa-visual).
- [ ] **T6. 회귀·게이트** — 인수조건: 브리지(MapMarker/mapHtml/SET_MARKERS) 불변, 기존 map/nearby/wishlist 스위트 무회귀, `npm test` green + `npm run typecheck` 0.

## 6-1. 테스트 케이스 (TDD)

**단위(순수 유틸/훅/화면):**
- `filterByAppCategory`: null→동일 참조 / 'cafe'→cafe만 / 존재하지 않는 key→[] / 빈 입력→[].
- `filterNearbyByCategory`: null→전체 / categoryName "음식점 > 카페 > 스페셜티커피"→'cafe' 통과 / 같은 항목 'noodle' 필터 탈락 / categoryGroupCode 'CE7'→cafe / 매핑 불가(빈 categoryName)→특정 카테고리 전부 탈락 / 재매핑 아님(mapKakaoCategory 호출로 검증).
- MapTabScreen(RTL): 칩 선택→필터된 markers로 SET_MARKERS inject / "전체"→전 핀 / 필터 변경 시 useNearbyPlaces·useMuklogPins·useWishPins refresh/재조회 미호출(비용 0) / 선택 핀 필터아웃→setSelected(null).

**모킹/스모크 대상:**
- 실제 WebView 핀 표시/숨김 렌더 → 디바이스 스모크(메모리 [[qa-layout-blind-spot]]).
- nearby-accumulate·focus refresh와의 상호작용 → 통합(모킹) + 스모크.

## 7. 엣지케이스

- **필터 중 빈 결과**: 핀 0 → 지도만(에러/배너 없음).
- **활성 카드 + 필터**: 선택 핀이 필터로 사라지면 카드 자동 닫힘 + SET_SELECTED(null)(map-pin-select 선례 일반화 — 3 kind 공통).
- **필터 중 신규 위시 담기(스프린트1)**: add→refresh로 위시 데이터 갱신 → 현재 필터가 자동 재적용(담은 카테고리가 필터와 다르면 즉시 안 보일 수 있음 — 정상, 필터 우선).
- **필터 중 포커스 refresh**: 위시/먹로그 데이터 갱신 시 필터 자동 재적용(재조회 아님, category state 보존).
- **nearby accumulate와 정합**: accumulate는 필터와 독립(항상 전량 누적). 필터는 누적된 items를 표시단에서 거를 뿐 → 필터 해제 시 누적분 전부 복귀(재조회 0). 팬 이동으로 새 nearby 유입돼도 현재 필터 자동 적용.
- **nearby 매핑 null**: mapKakaoCategory가 null 반환하는 주변 항목은 **특정 카테고리 필터 시 항상 숨김**("전체"에서만 표시). 의도된 동작(불명확 카테고리는 특정 필터에 안 걸림).
- **saved↔wish↔nearby dedup + 필터 순서**: 필터를 **머지 전 소스에** 적용 → dedup(mergeMapMarkers 우선순위 saved>wish>nearby)은 필터된 집합에 대해 동작(일관).
- **me 마커·지도·범례**: 필터 무관 항상 표시(카테고리 핀만 필터).
- **커플 동시성**: 짝꿍이 담은 위시도 내 필터에 함께 걸림(크로스-로그 위시). 필터는 로컬이라 상대와 독립.
- **연속 칩 탭**: 빠른 재선택은 파생 재계산만(재조회 0), 상태 최종값으로 수렴.

## 8. QA 교차검증 경계면 (생산자 ↔ 소비자)

1. `MuklogPin.category`·`WishPin.category`(앱 8종 key) ↔ `filterByAppCategory` — 동일 enum 비교.
2. `NearbyPlaceItem`(categoryName/groupCode) ↔ `filterNearbyByCategory`의 `mapKakaoCategory` — 재매핑 없이 단일 출처 사용.
3. 필터된 3소스 ↔ `mergeMapMarkers`(dedup 우선순위) ↔ SET_MARKERS — 마커·브리지 계약 불변(회귀).
4. `CategoryFilterBar`(전체+8종, `MUKLOG_CATEGORY_KEYS`·`categoryLabel`) ↔ MapTabScreen category state — 단일 선택·null 리셋.
5. category state ↔ 활성 핀 정리 effect ↔ `SET_SELECTED`(null) — 필터아웃 시 selection 해제.
6. 필터 변경 ↔ useNearbyPlaces/useMuklogPins/useWishPins — **재조회 미발생**(비용 가드, 파생만).
7. nearby-accumulate(누적 items) ↔ 필터(표시단) — 누적/필터 레이어 독립, 해제 시 복귀.

## 9. 비용 가드레일 체크

- **필터 = 순수 클라 파생.** 조회 재실행·Kakao 호출·DB·Realtime·DEFINER·Edge Function **전부 0**. 마이그레이션 0건.
- 칩 선택은 useState 변경 → 마커 재계산·SET_MARKERS inject만(네트워크 0).
- nearby 조회/누적 정책 불변(디바운스·양자화 캐시·임계·cap 그대로). 필터가 조회 빈도에 영향 없음.
- AWS 미사용. Supabase 무료 티어 내(신규 부하 0).

---

### 착수 메모(developer)
- **백엔드·브리지 변경 0.** 핵심 = ① 순수 필터 2종(`filterByAppCategory` 공용 + `filterNearbyByCategory` = mapKakaoCategory 재사용) ② MapTabScreen 배선(3소스 필터→마커→머지, nearby는 items에서 생성) ③ 활성 핀 정리 effect ④ `CategoryFilterBar`(ui-publisher).
- nearby 필터는 반드시 `mapKakaoCategory` 재사용(자체 키워드 매핑 신설 금지).
- `MapMarker`에 category 넣지 말 것 — 소스(pin/item)에서 필터해 브리지 계약 유지.
- 칩 집합은 고정 8종(present-only 아님) — churn 회피 결정(§3 ④).
- 칩 비주얼·상단 배치·범례 공존은 ui-publisher가 킷 기준 확정 — developer는 상태·필터·onSelect 배선만.
