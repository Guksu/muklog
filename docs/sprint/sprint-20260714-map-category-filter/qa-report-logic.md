# QA Report — Logic / 통합 정합성 (map-category-filter)

> qa-logic 담당. 기준: plan.md(T1~T6·§8 경계면 7쌍·§9 가드레일) + dev-notes.md(생산자↔소비자 매핑) + ui-spec.md.
> 비주얼 충실도는 qa-visual 담당(본 리포트 제외).
> **결론: 로직 통과(PASS). 이슈 0건. 177 스위트 / 1658 테스트 green, `tsc --noEmit` 0 에러.**

## 1. 요약

| 축 | 결과 |
|---|---|
| 통합 정합성(경계면 7쌍) | ✅ 통과 — 필터 삽입 지점·mapKakaoCategory 재사용·브리지 불변·활성 핀 정리 전부 일치 |
| 기능 스펙(T1~T6) | ✅ 통과 — 인수조건마다 대응 테스트, mutation 표본 2곳(필터 함수·활성 핀 정리) red 확인 |
| 보안·비용 가드레일 | ✅ 통과 — 백엔드·브리지 변경 0, 필터 변경 시 재조회 0(setBounds/refresh 미호출 단언 실재), Kakao·DB·Realtime·마이그레이션 0 |
| TDD·컨벤션 | ✅ 통과 — 전체 green, tsc 0, useMemo/useCallback 신규 0(매 렌더 파생), 화살표 const·named-object·제네릭 준수 |

## 2. 경계면 교차검증 (생산자 ↔ 소비자, 양쪽 동시 읽기)

| # | 경계 | 생산자 | 소비자 | 판정 |
|---|---|---|---|---|
| 1 | 앱 카테고리 필터 | `MuklogPin.category`·`WishPin.category`(앱 8종 key) | `filterByAppCategory<T extends {category}>` | ✅ 동일 enum `===` 비교. null="전체"→동일 참조 반환. 제네릭이 추가 필드 보존(변환 전 소스 필터) |
| 2 | nearby 파생 필터 | `NearbyPlaceItem`(categoryName·categoryGroupCode) | `filterNearbyByCategory` → `mapKakaoCategory` **재사용**(직접 import `@/features/muklog/kakaoCategory`) | ✅ **재매핑 금지 준수** — 자체 키워드 매핑 신설 0, 단일 출처. 매핑 null 항목은 특정 필터 항상 제외(§7 의도) |
| 3 | 필터된 3소스 → 브리지 | filter*→pins/wish/nearbyToMapMarkers(마커 변환 전 필터) | `mergeMapMarkers` → SET_MARKERS | ✅ **브리지 완전 불변**: MapMarker에 category 필드 없음(grep 확인), mapHtml·parseMapMessage·SET_MARKERS 미변경. dedup은 필터된 집합에 동작(일관) |
| 4 | 칩 ↔ state | `CategoryFilterBar`(전체+`MUKLOG_CATEGORY_KEYS` 8종 고정, `categoryLabel`) props `{selected, onSelect}` | MapTabScreen `category` state, `onSelect={({category:next})=>setCategory(next)}` | ✅ 단일 선택·null 리셋. 전체→`{category:null}`, key→`{category:key}`. 고정 8종(present-only 아님, churn 회피 §3④) |
| 5 | 필터 ↔ 활성 핀 정리 | category state → 표시 `markers`(필터·머지·dedup 최종 집합) | `clearSelectionWhenPinGone` effect → SET_SELECTED(null) | ✅ `markers.some(id)` 기반 일반화 — 필터아웃 시 3 kind(saved 포함) 공통 selection 해제. map-pin-select 선례 회귀 없음(전체 필터 시 saved 항상 present→미해제) |
| 6 | 필터 변경 ↔ 조회 훅 | category setState | useNearbyPlaces/useMuklogPins/useWishPins | ✅ **재조회 미발생** — 순수 파생만. 테스트가 setBounds·muklogRefresh·wishRefresh 미호출 명시 단언 |
| 7 | accumulate ↔ 필터 | useNearbyPlaces 누적 `items`(불변) | `nearbyToMapMarkers({items: filterNearbyByCategory({items})})` | ✅ 누적/필터 레이어 독립. `nearby.markers`(=`nearbyToMapMarkers({items})`)와 category=null 시 동일 → 동작 보존(회귀 0). accumulate 로직 불변 |

## 3. 기능 스펙(T1~T6) — 인수조건↔테스트 대응

| T | 인수조건 | 대응 테스트 | 판정 |
|---|---|---|---|
| T1 | filterByAppCategory: null→원본, key→일치만, 미존재→[] | spec 6건(null 동일참조·일치만·null항목 제외·미존재 []·빈입력 []·제네릭 필드보존) | ✅ |
| T2 | filterNearbyByCategory: mapKakaoCategory 파생 필터(재매핑 없음), null→전체 | spec 6건(null·카페 통과·noodle 탈락·CE7 cafe·매핑불가 전부 탈락·한식>칼국수 noodle) | ✅ |
| T3 | 칩 선택→3종 좁힘·SET_MARKERS 재주입·전체 리셋·재조회 0 | MapTabScreen 3건(3종 좁힘·전체 복귀·**재조회 0 단언**) | ✅ |
| T4 | 필터아웃 시 selection 해제·잔존 시 유지 | MapTabScreen 2건(saved 필터아웃→카드닫힘+SET_SELECTED null / wish 잔존→유지) | ✅ |
| T5 | CategoryFilterBar 전체+8종·단일선택·onSelect | 렌더/선택 테스트(비주얼은 qa-visual) | ✅ |
| T6 | 브리지 불변·회귀·게이트 | 177 스위트/1658 green, tsc 0 | ✅ |

**테스트 의미성(mutation 표본 2곳 — 필터 함수·활성 핀 정리):**
- `filterNearbyByCategory`: `mapKakaoCategory(...) === category` → `!== category`(필터 판정 반전): 카페 통과·noodle 탈락·CE7 등 red ✅
- MapTabScreen `clearSelectionWhenPinGone`: `if (!present) setSelected(null)` → `if (false && !present)`(정리 무력화): T4 "필터아웃 시 카드 닫힘" red ✅
- (합계 8건 red 확인 후 원복) → 필터 판정·활성 정리가 테스트에 실제 결속.

## 4. 브리지 불변 검증 (핵심 — 회귀 0 전략)

- `MapMarker` 타입에 category 필드 **미추가**(grep 확인: MapMarker는 id/lat/lng/emoji/kind만). 필터는 **마커 변환 전 소스(MuklogPin/WishPin/NearbyPlaceItem)** 에 적용 → SET_MARKERS 페이로드·mapHtml JS·parseMapMessage 전부 무변경.
- nearby 배선 변경점(`nearby.markers`→`nearbyToMapMarkers({items: filter(...)})`)은 category=null 시 기존과 동일 산출(useNearbyPlaces가 markers를 `nearbyToMapMarkers({items})`로 파생 — 동일 함수). accumulate·양자화 캐시·임계 불변.

## 5. 엣지케이스 (plan §7)

- 필터 중 빈 결과 → 지도만(에러/배너 없음, 기존 정책 일관) ✅
- 활성 카드 + 필터아웃 → 카드 닫힘 + SET_SELECTED(null), 3 kind 공통 ✅ (T4 테스트)
- 필터 중 add-후/포커스 refresh → 새 데이터에 현재 category 자동 재적용(재조회 아님, state 보존) ✅
- nearby accumulate 정합 → 누적은 필터와 독립, 해제 시 전부 복귀(재조회 0) ✅ (T3 전체 리셋 테스트)
- nearby 매핑 null → 특정 카테고리 필터 항상 숨김, "전체"에서만 표시 ✅ (T2 매핑불가 테스트)
- dedup + 필터 순서 → 필터를 머지 전 소스에 적용, dedup은 필터된 집합에 동작 ✅

## 6. 가드레일 (plan §9)

- 백엔드 변경 0: 마이그레이션·RPC·Edge·Realtime·DEFINER 신설 0(git status supabase/ 무변경). ✅
- 필터 = 순수 클라 파생: 필터 유틸에 supabase/rpc/invoke/fetch/setBounds/refresh 0(grep 확인). 칩 선택은 useState → 마커 재계산·SET_MARKERS inject만(네트워크 0). ✅ 재조회 0 테스트 단언 실재.
- Kakao 호출 0, nearby 조회/누적 정책 불변, AWS 미사용. ✅

## 7. 컨벤션

- useMemo/useCallback: 신규 필터 유틸·CategoryFilterBar 0(매 렌더 파생 — 컨벤션 useMemo 지양). MapTabScreen 기존 useFocusEffect 예외만 유지. ✅
- 화살표 const·named-object 인자·제네릭(`<T extends {category}>`)·enum-style. ✅
- 칩 집합 `MUKLOG_CATEGORY_KEYS`·`categoryLabel` 단일 출처 재사용, mapKakaoCategory 재사용(자체 매핑 0). ✅

## 8. 미검증(스모크 이월 — plan §6-1, 실패 아님)

- 실제 WebView 핀 표시/숨김 렌더 → 디바이스 스모크(메모리 qa-layout-blind-spot).
- nearby-accumulate·focus refresh와 필터 상호작용 실기기 → 통합 스모크.

## 9. 이슈

없음. developer 수정 요청 0건.
