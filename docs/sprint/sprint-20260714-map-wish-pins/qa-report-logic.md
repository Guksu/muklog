# QA Report — Logic / 통합 정합성 (map-wish-pins)

> qa-logic 담당. 기준: plan.md(T1~T9·데이터 계약·§7 경계면·§8 가드레일) + dev-notes.md(생산자↔소비자 매핑) + ui-spec.md.
> 비주얼 충실도는 qa-visual 담당(본 리포트 제외).
> **결론: 로직 통과(PASS). 블로킹 이슈 0건, 비블로킹 코멘트 nit 1건. 174 스위트 / 1635 테스트 green, `tsc --noEmit` 0 에러.**

## 1. 요약

| 축 | 결과 |
|---|---|
| 통합 정합성(경계면 8종) | ✅ 통과 — saved→kind 판별자 lockstep 교체, 3-way 머지·왕복 계약 전부 일치 |
| 기능 스펙(T1~T9) | ✅ 통과 — 인수조건마다 대응 테스트 존재, mutation 표본 2곳 red 확인 |
| 보안·비용 가드레일 | ✅ 통과 — 마이그레이션·RPC·Edge·DEFINER·Realtime 신설 0, 폴링 0, 위시 select = 마운트1+포커스+add-후 |
| TDD·컨벤션 | ✅ 통과 — 전체 green, tsc 0, useCallback은 useFocusEffect 선례 예외만(LogScreen/LogListScreen/MuklogDetailRoute와 동일 패턴) |

## 2. 경계면 교차검증 (생산자 ↔ 소비자, 양쪽 동시 읽기)

| # | 경계 | 생산자 | 소비자 | 판정 |
|---|---|---|---|---|
| 1 | RLS ↔ 크로스-로그 쿼리 | `wishlist_items` RLS select `room_id in (내 방)` (migration 20260616120000) | `useWishPins` select(id·room_id·place_name·category·area·lat·lng), **room 필터 없음** | ✅ `.eq('room_id')` 미포함을 spec이 명시 단언(eqMock not called) → RLS가 크로스-로그 스코프. 컬럼명 스키마 일치 |
| 2 | snake→camel | `toWishPin`(WishPinRow) | `wishToMapMarkers`(WishPin) | ✅ 좌표 null/비유한 시 null 반환 → 호출측 제외. 필드 매핑 일치 |
| 3 | `MapPinKind` 판별자 | pins/nearby/wishToMapMarkers(kind:saved/nearby/wish) | mapHtml className·pinZIndex / parseMapMessage / MapTabScreen 카드 3분기 | ✅ `MapMarker.saved:boolean` **완전 교체**(field residue 0 — grep 확인, 남은 `saved:`는 merge 인자명·주석뿐). 단일 출처 |
| 4 | MARKER_TAP 왕복 | mapHtml `post({type,id,kind})` | parseMapMessage(asPinKind 3값 검증, 미지/누락 null 흡수) → MapTabScreen `selected.kind` | ✅ 3-way 왕복. 미지 kind('bogus')·kind 누락 시 null 흡수(카드 오분기 방어) 테스트됨 |
| 5 | 3-way 머지·epsilon | `mergeMapMarkers({saved,wish,nearby})` 우선순위 saved>wish>nearby, MERGE_DEDUP_EPSILON 재사용 | 지도뷰 SET_MARKERS(중복 핀 0) | ✅ 우선순위 순서·모든 dedup 방향(wish∩saved, nearby∩wish, nearby∩saved)·epsilon 경계 테스트됨 |
| 6 | 카드↔핀 이모지 단일 출처 | `wishPinEmoji`(categoryEmoji CAT +🍽️ 폴백) | wishToMapMarkers.emoji ↔ WishSpotCard.coverEmoji(MapTabScreen L353) | ✅ 동일 함수 공유 → 글리프 드리프트 차단(plan §7-6) |
| 7 | 갱신 트리거 | useFocusEffect(포커스) / useAddNearbyWish onAdded(add-후) | `useWishPins.refresh`(loadWishPins) | ✅ 폴링 아님(포커스·add 유한 트리거). refresh는 loading 리셋 안 함(지도 유지) |
| 8 | 스프린트1 배선 | `useAddNearbyWish({ onAdded })` 성공 콜백(중복 시 early-return으로 미호출 — 불필요 refresh 없음) | MapTabScreen `onAdded: wishPins.refresh` | ✅ 담기 성공 직후에만 위시 핀 refresh. onAdded 기본 `= {}`라 스프린트1 회귀 0 |

## 3. 기능 스펙(T1~T9) — 인수조건↔테스트 대응

| T | 인수조건 | 대응 테스트 | 판정 |
|---|---|---|---|
| T1 | MapMarker/MARKER_TAP이 kind 사용, saved 필드 소멸 | pinsToMapMarkers→kind:saved / nearbyToMapMarkers→kind:nearby / parseMapMessage kind 파싱·미지 흡수 | ✅ |
| T2 | toWishPin snake→WishPin, 좌표 비유한 제외 | toWishPin.spec(정상 매핑 + lat=NaN 제외 + category null 통과) | ✅ |
| T3 | wishToMapMarkers kind:wish·categoryEmoji·폴백·좌표 가드 | wishToMapMarkers.spec | ✅ |
| T4 | 마운트 1회 크로스-로그 select(room 필터 없음, lat/lng not null), refresh, 에러 전이 | useWishPins.spec 5건(room 필터 미포함 단언·not null·refresh 재호출·error·폴링 0) | ✅ |
| T5 | 3-way 머지 우선순위·dedup | mergeMapMarkers.spec 8건 | ✅ |
| T6 | mapHtml `.mk-pin--wish`·kind 분기·MARKER_TAP kind | mapHtml.spec(클래스 정의·kind 분기 문자열 단언) + T7 SET_MARKERS join | ✅ (렌더 픽셀은 디바이스 스모크 이월) |
| T7 | 위시 핀 합류·wish 탭→WishSpotCard·포커스/add-후 refresh·회귀 없음 | MapTabScreen.spec(SET_MARKERS kind:wish 합류 / MARKER_TAP wish→WishSpotCard / 소실 시 카드 닫힘 / 포커스 refresh / onAdded refresh) | ✅ |
| T8 | WishSpotCard 표시·액션 없음 | 렌더 단언(비주얼은 qa-visual) | ✅ |
| T9 | 회귀·게이트 | 174 스위트/1635 green, tsc 0 | ✅ |

**테스트 의미성(mutation 표본 2곳 — 우선순위·kind 판별자 최고위험):**
- `mergeMapMarkers`: `dedupedWish = wish.filter(!near saved)` → `dedupedWish = wish`(saved>wish dedup 제거): "saved와 좌표 근접한 wish 제외" 테스트 red ✅
- `wishToMapMarkers`: `kind: MapPinKind.Wish` → `MapPinKind.Nearby`: wishToMapMarkers spec + MapTabScreen "SET_MARKERS kind:wish 합류" red ✅
→ 핀 우선순위·kind 분기가 테스트에 실제 결속(회귀 가드 유효).

## 4. saved→kind 판별자 교체 검증 (핵심 리팩터)

- `MapMarker.kind`·`MarkerTap.kind` 단일 판별자, `saved: boolean` 필드 **완전 소멸**(이중 판별자 병존 0). grep 확인: 남은 `saved:`는 mergeMapMarkers 인자명(`saved: MapMarker[]`)·MapTabScreen 머지 인자·주석뿐 — 판별자 잔재 아님.
- saved/nearby 런타임 동작 불변: pinsToMapMarkers·nearbyToMapMarkers·parseMapMessage·mapHtml 기존 테스트가 kind 값으로 회귀 단언(T1). tsc 0 = 전 소비지점 lockstep 갱신 완료(컴파일러 강제 노출 net 작동).

## 5. 엣지케이스 (plan §6)

- 좌표 없는 위시 → `.not(lat/lng,is,null)` + toWishPin null 가드 제외 ✅
- 위시↔먹로그 근접 → saved 우선(위시 숨김) / 위시↔주변 근접 → wish 우선(주변 숨김) ✅
- id 네임스페이스 충돌(wishId/muklogId/kakaoId) → kind 판별자로 탭 시 올바른 컬렉션 lookup(카드 오분기 방지) ✅
- 위시 조회 실패 → `wishPinsList=[]`로 흡수, 지도·먹로그·주변 불변(배너 없음 best-effort) ✅
- 선택된 위시 소실(삭제/refresh) → `clearSelectionWhenPinGone`이 wish도 감지해 카드 닫힘 + SET_SELECTED(null) ✅ (T7 테스트)
- 커플 동시성 → 크로스-로그 RLS로 짝꿍 위시도 보임, 포커스 refresh 반영(Realtime 없음) ✅

## 6. 가드레일 (plan §8)

- 마이그레이션·RLS·RPC·Edge Function·DEFINER·Realtime **신설 0건**(git status supabase/ 무변경, grep channel/subscribe/setInterval 0). ✅
- 위시 select = 마운트 1회 + 포커스 refresh(내비 단위 유한) + add-후 1회. 폴링 없음(useWishPins effect 빈 deps). ✅
- Kakao Local 호출 0(위시 핀은 DB 조회만). AWS 미사용. ✅

## 7. 컨벤션

- useCallback/useMemo: 신규 트리오·유틸은 0. MapTabScreen `React.useCallback(refreshWishOnFocus, [])`는 **useFocusEffect 콜백 참조 안정성 예외**(ref+빈 deps 패턴) — LogScreen·LogListScreen·MuklogDetailRoute와 **동일 확립 선례**. 컨벤션 허용 예외에 부합. ✅
- 화살표 const·named-object 인자·useEffect 명명 함수(loadWishPinsOnMount 등)·enum-style 상수(MapPinKind `as const`). ✅
- 이모지/카테고리 `categoryEmoji` 재사용(자체 매핑 0), `.mk-pin--wish` hex는 ui-publisher 소유(developer는 클래스 계약만). ✅

## 8. 비블로킹 nit (선택 정리 — 로직 무관)

- `src/features/map/nearbyToMapMarkers/nearbyToMapMarkers.ts:11,14` 주석이 "saved:false 마커"로 남아있으나 코드는 `kind: MapPinKind.Nearby` 생산. **순수 문서 staleness**(런타임·타입 영향 0). 다음 터치 시 주석만 kind 표기로 정리 권고. 블로킹 아님.
- `NEARBY_WISH_COPY.success`가 스프린트1 '위시에 담았어요' → '위시에 담았어요 📍'로 변경됨(킷 mk-log:40 톤). **카피/비주얼 영역(qa-visual 소관)** — 로직 회귀 없음(테스트는 상수 참조라 green). 본 리포트 판정 대상 아님.

## 9. 미검증(스모크 이월 — plan §5-1, 실패 아님)

- 실제 RLS 크로스-로그 필터·인덱스 적용 → 라이브 `db push` 후 스모크(단위는 supabase 체이닝 모킹).
- 실제 WebView 위시 핀 렌더·색(#FFB23E) 구분·탭 → 디바이스 스모크(메모리 qa-layout-blind-spot: WebView 렌더 픽셀은 단위 사각지대).

## 10. 이슈

블로킹 이슈 없음. developer 수정 요청 0건(§8 nit은 비블로킹 선택 정리).
