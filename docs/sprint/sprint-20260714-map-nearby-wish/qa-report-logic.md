# QA Report — Logic / 통합 정합성 (map-nearby-wish)

> qa-logic 담당. 검증 기준: plan.md(T1~T6·데이터 계약·§7 경계면·§8 가드레일) + dev-notes.md(생산자↔소비자 매핑) + ui-spec.md(props 계약).
> 비주얼 충실도는 qa-visual 담당(본 리포트 제외).
> **결론: 로직 통과(PASS). 이슈 0건. 170 스위트 / 1598 테스트 green, `tsc --noEmit` 0 에러.**

## 1. 요약

| 축 | 결과 |
|---|---|
| 통합 정합성(경계면 8종) | ✅ 통과 — 생산자↔소비자 shape·컬럼·스코프 전부 일치 |
| 기능 스펙(T1~T6) | ✅ 통과 — 인수조건마다 대응 테스트 존재, 의미성 표본 확인(mutation) |
| 보안·비용 가드레일 | ✅ 통과 — 마이그레이션·RLS·Edge·DEFINER·Realtime 신설 0, 담기당 select 1 + insert 1, Kakao 호출 0 |
| TDD·컨벤션 | ✅ 통과 — 전체 green, tsc 0, useCallback/useMemo 0, 화살표 const·named-object·enum-style 준수 |

## 2. 경계면 교차검증 (생산자 ↔ 소비자, 양쪽 동시 읽기)

| # | 경계 | 생산자 | 소비자 | 판정 |
|---|---|---|---|---|
| 1 | NearbyPlaceItem → 매핑 | `map/types` NearbyPlaceItem(kakaoPlaceId·placeName·categoryName·categoryGroupCode·lat·lng·distance) | `nearbyToWishlistInput` 필드 참조 | ✅ 필드명 일치, distance는 미사용(AddWishlistInput에 없음 — 정상) |
| 2 | AddWishlistInput → insert row | `nearbyToWishlistInput` 산출(camel) | `useAddWishlist`→`toWishlistRow`(snake) | ✅ camel→snake 전부 매핑(roomId→room_id, placeName→place_name, kakaoPlaceId→kakao_place_id …). added_by는 useAddWishlist가 auth.uid()로 주입(매퍼 무관, RLS with check 정합) |
| 3 | pre-check select ↔ RLS | `wishlistExists` `select('id').eq('room_id').eq('kakao_place_id').limit(1)` | `wishlist_items` RLS `select using room_id in 내 방` + 컬럼(room_id·kakao_place_id·id 실재) | ✅ 컬럼명·스코프 일치. RLS가 방 격리, 쿼리는 방+장소로 좁힘 |
| 4 | 로그 목록 ↔ 분기·시트 | `useMyLogsContext().state`(ready면 logs, 아니면 []) | `useAddNearbyWish` 길이 0/1/2 분기 + `choosing.logs` → MapTabScreen `pickerLogs`(LogPickerItem) | ✅ MyLog.roomId/name/memberCount → LogPickerItem.roomId/label/memberCount. label은 displayLogName |
| 5 | 카테고리 enum | `mapKakaoCategory` 8종 key\|null (직접 import `@/features/muklog/kakaoCategory`) | `wishlist_items.category`(앱 강제 8종, DB는 자유 text) | ✅ 단일 출처 재사용 — 자체 매핑 없음, enum 드리프트 차단(메모리 nearby-category-mapping 함정 회피) |
| 6 | 토스트 ↔ ToastProvider | `useAddNearbyWish` showToast(성공 positive/중복·로그없음·실패 neutral) | 전역 `useToastController` | ✅ tone·카피(NEARBY_WISH_COPY + mapWishlistError) 일치 |
| 7 | 선택 상태 ↔ 카드 | MapTabScreen `selected {id, saved}` | `NearbySpotCard`(saved:false=nearby일 때만 렌더, onAddWish) | ✅ saved 핀은 SelectedSpotCard(액션 없음), nearby만 담기 대상 |
| 8 | choosing ↔ LogPickerSheet | `nearbyWish.choosing`(≠null=시트 오픈) | `LogPickerSheet.visible/logs/onSelect`→`chooseLog({roomId})` | ✅ 행 roomId→chooseLog 되돌림, onClose→dismiss(담기 미발생) |

**pre-check ↔ insert 값 일관성:** addToLog가 `item.kakaoPlaceId`로 pre-check하고, insert도 `nearbyToWishlistInput({item,roomId}).kakaoPlaceId`(=`item.kakaoPlaceId`)를 사용 → **동일 값**. 중복 판정과 저장이 같은 kakao_place_id를 본다(정합).

## 3. 기능 스펙(T1~T6) — 인수조건↔테스트 대응

| T | 인수조건 | 대응 테스트 | 판정 |
|---|---|---|---|
| T1 | 필드별 매핑·category=mapKakaoCategory·area/roadAddress/note=null·좌표 쌍 유한 | nearbyToWishlistInput.spec 6건(정상 noodle / CE7 cafe / 빈 categoryName null / lat=NaN 둘다 null / lng=Infinity 둘다 null / roomId 통과) | ✅ |
| T2 | 중복이면 insert 미발생 + 안내, 없으면 진행 | wishlistExists.spec 4건(1건 true / 0건 false / null 안전 / 에러 throw) + useAddNearbyWish "중복 1건" | ✅ |
| T3 | 액션→로그1개면 매핑 input insert→성공 토스트 | useAddNearbyWish "로그 1개" + MapTabScreen "위시에 담기 탭→requestAdd" | ✅ |
| T4 | 0개 안내/1개 즉시/2+개 시트→선택 | useAddNearbyWish 4건(0/1/2+/dismiss) + MapTabScreen 4건(시트 노출·폴백·행탭 chooseLog·미렌더) | ✅ |
| T5 | loading 가드·실패 시 목록 불변+에러 토스트 | useAddNearbyWish 3건(insert reject / pre-check reject / loading 가드 1회) + MapTabScreen "submitting 시 재탭 차단" | ✅ |
| T6 | 회귀 0, 전체 green + tsc 0 | 170 스위트/1598 green, tsc 0 | ✅ |

**테스트 의미성(mutation 표본):** 두 지점을 일부러 깨서 red 확인 후 원복.
- `useAddNearbyWish` 중복 분기 `if (duplicate)` → `if (false && duplicate)`: 중복 토스트 테스트 red ✅
- `nearbyToWishlistInput` `lng: hasCoordPair ? item.lng : null` → `lng: item.lng`: 좌표 쌍 무결성 테스트 2건 red ✅
→ 핵심 단언이 구현에 실제로 결속돼 있음(스모크가 아님).

## 4. 엣지케이스 커버리지 (plan §6)

- 로그 0개 → 안내 토스트·insert 미발생 ✅ / 다수 → 선택 시트·취소 시 미발생 ✅
- 중복(roomId 스코프) → pre-check 스킵 ✅ / 서로 다른 로그엔 각각 담김(방 스코프 판정) ✅
- 커플 동시성 → best-effort(레이스 2행 무해) plan §6·dev-notes에 명시 ✅
- 좌표 비유한 → lat/lng 둘 다 null(쌍 무결성) ✅ / category 매핑 실패 → null ✅
- 네트워크 실패(insert/select reject) → 에러 토스트·상태 불변 ✅
- 인증 만료 → useAddWishlist가 throw → mapWishlistError 토스트 경로 ✅
- loading 재진입 → submittingRef(동기 잠금)로 addWishlist 1회 ✅ (requestAdd·addToLog 이중 가드 — 방어적, 무해)

## 5. 가드레일 (plan §8)

- 신규 마이그레이션·RLS·Edge Function·DEFINER·Realtime **0건**(git status supabase/ 무변경, grep channel/subscribe/.rpc 0). ✅
- 담기당 **select 1(wishlistExists) + insert 1(useAddWishlist)**, 폴링 없음. ✅
- Kakao Local 호출 0 — 캐시된 NearbyPlaceItem(useNearbyPlaces)만 사용. ✅
- AWS 미사용. ✅

## 6. 컨벤션

- useCallback/useMemo 실제 호출 **0** (신규 로직·MapTabScreen·NearbySpotCard·LogPickerSheet). ✅
- 컴포넌트·훅·유틸 화살표 const, named-object 인자, useEffect 명명 함수(requestLocationOnEnter 등), enum-style 상수(NEARBY_WISH_COPY `as const`). ✅
- 배럴 우회 import(`@/features/muklog/kakaoCategory`·`@/features/room/logName`)로 테스트 환경 supabase/AsyncStorage 끌어오기 회피 — dev-notes 문서화. ✅
- LogPickerSheet raw hex 0(토큰 경유). ✅

## 7. 미검증(스모크 이월 — plan §5-1과 동일, 실패 아님)

- 실제 `wishlist_items` insert/RLS·select 필터 적용 → 라이브 스모크(단위는 supabase 모킹으로 대체).
- 지도 WebView 핀 탭 → 카드 렌더 → 시트 → 담기 실기기 스모크(메모리 qa-layout-blind-spot: 레이아웃 무거운 화면).

## 8. 이슈

없음. developer 수정 요청 0건.
