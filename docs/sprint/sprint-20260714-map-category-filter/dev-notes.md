# Dev Notes: map-category-filter

> developer 구현 노트. Phase 1(순수 필터 2종 + MapTabScreen 배선 준비) 완료. Phase 2(CategoryFilterBar + category state + 필터 적용)는 ui-spec 확정 후.

## 진행 상태

- **Phase 1 (ui-spec 불필요):** ✅ 완료 — 순수 필터 2종(TDD) + nearby 마커 items 기반 생성 + 활성 핀 정리 마커 기반 일반화(둘 다 동작 보존).
- **Phase 2 (배선):** ✅ 완료 — MapTabScreen category useState + 3소스 필터 적용 + `CategoryFilterBar` 렌더(legend 하강) + 활성 핀 정리(markers 기반이라 필터아웃 자동).

## 검증 (T6 게이트)

- 전체 **177 스위트 / 1658 테스트 green**, `npx tsc --noEmit` **0 에러**. 백엔드·브리지 변경 0(MapMarker·mapHtml·SET_MARKERS 불변), 조회 재실행 0(순수 클라 필터).

## Phase 1 산출물

| 파일 | 역할 |
|---|---|
| `src/features/map/filterByAppCategory/` | T1. 제네릭 `<T extends {category}>` 순수 필터(MuklogPin[]/WishPin[] 공용). null→원본 동일 참조, key→일치만 |
| `src/features/map/filterNearbyByCategory/` | T2. NearbyPlaceItem[] 필터 — `mapKakaoCategory` 재사용(재매핑 금지)로 파생 카테고리 비교 |
| `src/navigation/screens/MapTabScreen/MapTabScreen.tsx` | 배선 준비(동작 보존): ① nearby 마커를 `nearby.markers`→`nearbyToMapMarkers({ items: nearby.items })`로 생성(필터 삽입 지점 확보) ② 활성 핀 정리를 표시 `markers` 기반으로 일반화(T4 기반 — 필터아웃 시 selection 해제까지 한 곳에서) |

### 계약 shape
- `filterByAppCategory<T extends { category: string | null }>({ items, category }): T[]` — category=null이면 `items` 동일 참조.
- `filterNearbyByCategory({ items: NearbyPlaceItem[], category }): NearbyPlaceItem[]` — category=null이면 원본. 매핑 null(불명확) 항목은 특정 카테고리 필터에서 항상 제외(§7 의도).
- ⚠️ `mapKakaoCategory`는 배럴 아닌 `@/features/muklog/kakaoCategory` 직접 import(배럴 supabase 유입 회피 — 스프린트1 선례).

### MapTabScreen 배선 준비 상세(동작 보존)
- `useNearbyPlaces`가 `markers = nearbyToMapMarkers({ items })`로 파생하므로, MapTabScreen에서 `nearby.items`로 직접 생성해도 결과 동일(회귀 0). Phase 2에서 이 지점에 `filterNearbyByCategory`만 끼우면 됨.
- 활성 핀 정리 effect를 `markers.some(id 일치)` 기반으로 교체 → nearby viewport 이탈·wish 삭제·(Phase 2)카테고리 필터아웃을 단일 로직으로 처리. saved도 필터아웃 시 정리. deps=`[selected, markersKey]`(본문 setSelected(null) 가드로 루프 없음).
- 관련 spec 2건(nearby 머지·T6 채널 독립)을 `markers` 목업 → `items` 목업으로 갱신(실제 useNearbyPlaces 동작과 일치).

## Phase 2 산출물 (배선)
| 파일 | 역할 |
|---|---|
| `src/navigation/screens/MapTabScreen/MapTabScreen.tsx` | `category` useState + 3소스 필터 적용(pipeline) + `CategoryFilterBar` 렌더(top:12 full-width) + `MapLegend` 하강(top:56, ui-spec §2) |
| `src/navigation/screens/MapTabScreen/MapTabScreen.spec.tsx` | T3(칩 선택→필터 SET_MARKERS·전체 리셋·재조회 0) + T4(필터아웃 카드 닫힘·잔존 유지) 신규 5건 |

- 파이프라인: `pinsToMapMarkers({ pins: filterByAppCategory({ items: pins, category }) })` / `wishToMapMarkers({ pins: filterByAppCategory({ items: wishPinsList, category }) })` / `nearbyToMapMarkers({ items: filterNearbyByCategory({ items: nearby.items, category }) })` → `mergeMapMarkers`.
- `CategoryFilterBar`(ui-publisher): `selected={category}`, `onSelect={({ category: next }) => setCategory(next)}`. 위치는 MapTabScreen이 absolute 배치(top:12 / left·right:0), legend는 top:56로 하강해 비충돌.
- 활성 핀 정리는 이미 markers 기반이라 필터아웃 자동 처리(추가 배선 없음 — Phase 1에서 일반화).
- **브리지(MapMarker/mapHtml/SET_MARKERS) 불변** — 소스 필터로 회피(category 필드 추가 없음).

## 생산자 ↔ 소비자 매핑 (QA 교차검증용)
| # | 생산자 | 소비자 | 경계 |
|---|---|---|---|
| 1 | `MuklogPin.category`·`WishPin.category`(앱 8종) | `filterByAppCategory` | 동일 enum 비교 |
| 2 | `NearbyPlaceItem`(categoryName/groupCode) | `filterNearbyByCategory`의 `mapKakaoCategory` | 재매핑 없이 단일 출처 파생 |
| 3 | 필터된 3소스 | `mergeMapMarkers`(dedup) → SET_MARKERS | 마커·브리지 불변 |
| 4 | category state(Phase 2) | 활성 핀 정리 effect → SET_SELECTED(null) | 필터아웃 시 selection 해제(이미 markers 기반) |
| 5 | 필터 변경 | useNearbyPlaces/useMuklogPins/useWishPins | 재조회 미발생(파생만, 비용 0) |

## 절대 규칙 준수
- TDD(Red→Green): 순수 필터 2종 실패 테스트 선작성. 백엔드·조회 재실행·Kakao 호출 0(클라 필터), 마이그레이션 0, git 미수행, 컨벤션 100%(useMemo 지양 — 매 렌더 파생).
