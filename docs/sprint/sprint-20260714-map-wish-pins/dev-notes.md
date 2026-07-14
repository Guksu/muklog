# Dev Notes: map-wish-pins

> developer 구현 노트. Phase 1(saved→kind 리팩터 + 위시 핀 트리오 + 3-way 머지 + mapHtml JS)과 Phase 2(MapTabScreen 배선 + WishSpotCard/범례 소비)를 TDD로 완료.

## 진행 상태

- **Phase 1 (데이터·리팩터):** ✅ 완료 — `saved`→`kind` 판별자 lockstep, 위시 핀 트리오, `mergeMapMarkers` 3-way, `mapHtml` kind JS 배선.
- **Phase 2 (배선):** ✅ 완료 — MapTabScreen에 `useWishPins`·3-way 머지·`WishSpotCard`·포커스/add-후 refresh 배선.

## 검증 (T9 게이트)

- 전체 **174 스위트 / 1635 테스트 green**, `npx tsc --noEmit` **0 에러**.
- 마이그레이션·RLS·RPC·Edge Function·Realtime **신설 0건**. 비용 가드(Kakao 0, 폴링 없음, 위시 select = 마운트 1 + 포커스 refresh + add-후 1).

## 핵심 결정: `saved: boolean` → `kind` enum 교체

`MapMarker.saved`(2-state)를 `MapMarker.kind: MapPinKind`('saved'|'nearby'|'wish')로 **교체**(병존 금지). TypeScript가 전 생산자/소비자를 컴파일 에러로 강제 노출 → lockstep 갱신(누락 0). saved/nearby 런타임 동작 불변.

## 산출물 (파일)

### 신규 (위시 핀 트리오 — 먹로그 핀 트리오 미러)
| 파일 | 역할 |
|---|---|
| `src/features/map/toWishPin/` | T2. wishlist_items snake row → `WishPin`(좌표 null/비유한 시 null 반환) |
| `src/features/map/wishToMapMarkers/` | T3. `WishPin[]` → `MapMarker[]`(kind:wish). `wishPinEmoji`(카드↔핀 이모지 단일 출처) export |
| `src/features/map/useWishPins/` | T4. 크로스-로그 select(room 필터 없음, lat/lng not null), 마운트 1회 + refresh |

### 변경 (saved→kind lockstep + 3-way)
| 파일 | 변경 |
|---|---|
| `src/features/map/types/types.ts` | `MapPinKind` const/type 신설, `MapMarker.saved`→`kind`, MarkerTap `saved`→`kind`, `WishPin`/`WishPinsState` 신설 |
| `src/features/map/pinsToMapMarkers/` | `saved:true` → `kind:MapPinKind.Saved` |
| `src/features/map/nearbyToMapMarkers/` | `saved:false` → `kind:MapPinKind.Nearby` |
| `src/features/map/parseMapMessage/` | MarkerTap `saved` boolean 검증 → `kind` 3값 검증(미지 값 null 흡수) |
| `src/features/map/mergeMapMarkers/` | `{saved,nearby}` → `{saved,wish,nearby}` 3-way(우선순위 saved>wish>nearby, epsilon dedup) |
| `src/features/map/mapHtml/` | JS: className kind 분기(mk-pin--wish), `pinZIndex(kind,active)`(saved3/wish2/nearby1), MARKER_TAP kind, mkPins.kind, setSelected pin.kind. **CSS `.mk-pin--wish{#FFB23E}`는 ui-publisher 소유(동시편집 조율 후 그들 규칙 유지)** |
| `src/navigation/screens/MapTabScreen/` | `useWishPins`+3-way 머지+kind 3분기 카드(WishSpotCard)+포커스/add-후 refresh 배선 |
| `src/features/wishlist/useAddNearbyWish/` | 옵션 `onAdded?` 콜백 추가(담기 성공 후 위시 핀 즉시 refresh 지점). 기본 `= {}`라 스프린트1 회귀 0 |

각 스펙 lockstep 갱신(pins/nearby/parse/merge/mapHtml/mapMessages/useNearbyPlaces + MapTabScreen). 신규 트리오 spec은 TDD Red→Green.

## 소비: ui-publisher 산출물(비주얼)
`WishSpotCard`(props `{ placeName, category, coverEmoji, area }`)·`MapLegend`(위시 항목 추가)·`.mk-pin--wish` CSS(#FFB23E)는 ui-publisher 소유. developer는 데이터·콜백만 배선, 비주얼 임의 변경 0.

## 생산자 ↔ 소비자 매핑 (QA 교차검증용)

| # | 생산자 | 소비자 | 경계 |
|---|---|---|---|
| 1 | `wishlist_items` RLS select(room_id IN 내 방) | `useWishPins`(room 필터 없음) | RLS로만 크로스-로그 스코프, 컬럼명(id/room_id/place_name/category/area/lat/lng) |
| 2 | `toWishPin`(snake→camel) | `wishToMapMarkers` | 좌표 null/비유한 시 null 제외, 필드 |
| 3 | `MapPinKind` 판별자(pins/nearby/wishToMapMarkers) | mapHtml className/pinZIndex, parseMapMessage, MapTabScreen 카드 3분기 | saved 잔재 0(단일 출처) |
| 4 | mapHtml MARKER_TAP `{id,kind}` | parseMapMessage → MapTabScreen selection.kind | 3-way 왕복, 미지 kind 무시 |
| 5 | `mergeMapMarkers({saved,wish,nearby})` 우선순위·epsilon | 지도뷰 SET_MARKERS | saved>wish>nearby, 중복 핀 0 |
| 6 | `wishPinEmoji`(categoryEmoji CAT +🍽️) | wishToMapMarkers.emoji ↔ WishSpotCard.coverEmoji | 카드↔핀 동일 글리프(단일 출처, 함정 §7-6 해소) |
| 7 | 포커스 refresh(useFocusEffect) / add-후 onAdded | `useWishPins.refresh` | 폴링 아님(포커스·add 트리거 유한) |
| 8 | 스프린트1 `useAddNearbyWish` 성공 | `onAdded`→`wishPins.refresh` | 담기 직후 같은 화면 위시 핀 반영 |

## 엣지케이스 처리

- 좌표 없는 위시: 쿼리 `.not(lat/lng,is,null)` + toWishPin null 가드로 제외.
- 위시↔먹로그 근접: saved 우선 → 위시 핀 숨김. 위시↔주변 근접: wish 우선 → 주변 숨김(mergeMapMarkers).
- id 네임스페이스 충돌(wishId/muklogId/kakaoId): kind 판별자로 탭 시 올바른 컬렉션 lookup(카드 오분기 방지).
- 위시 조회 실패: `wishPins.state`가 error여도 `wishPinsList=[]`로 흡수 → 지도·먹로그·주변 불변(배너 없음, best-effort).
- 선택된 위시 소실(삭제/refresh): `clearSelectionWhenPinGone` 효과가 wish도 감지해 카드 닫힘 + SET_SELECTED(null).

## 절대 규칙 준수

- TDD(Red→Green): 신규 트리오·3-way·onAdded 실패 테스트 선작성. 백엔드 변경 0, 폴링 0, git 미수행, 컨벤션 100%(useFocusEffect의 useCallback은 LogScreen 선례 허용 예외).
