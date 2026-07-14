# Dev Notes: map-nearby-wish

> developer 구현 노트. Phase 1(데이터 계층 선행) 완료, Phase 2(NearbySpotCard 액션·로그 선택 시트 배선)는 ui-spec.md 확정 후 착수.

## 진행 상태

- **Phase 1 (ui-spec 불필요한 데이터 계층):** ✅ 완료 — 순수 유틸 + 중복 pre-check + 오케스트레이션 훅. TDD(Red→Green).
- **Phase 2 (배선):** ✅ 완료 — MapTabScreen에 NearbySpotCard 액션·LogPickerSheet 배선(TDD). ui-spec.md §4 조립 가이드 준수.

## 검증 (최종)

- 전체 **170 스위트 / 1598 테스트 green**, `npx tsc --noEmit` **0 에러**. (프로젝트 lint는 typecheck 스크립트만 — eslint config 없음.)
- 마이그레이션·RLS·Edge Function·DEFINER·Realtime **신설 0건**. 비용 가드레일 준수(Kakao 호출 0, 폴링 없음, 담기당 select 1 + insert 1).

## Phase 1 산출물 (파일)

| 파일 | 역할 |
|---|---|
| `src/features/wishlist/nearbyToWishlistInput/nearbyToWishlistInput.ts` | T1. `NearbyPlaceItem` + `roomId` → `AddWishlistInput` 순수 매핑 유틸 |
| `src/features/wishlist/nearbyToWishlistInput/nearbyToWishlistInput.spec.ts` | T1 테스트 6건 |
| `src/features/wishlist/wishlistExists/wishlistExists.ts` | T2. 중복 pre-check 헬퍼(`{roomId, kakaoPlaceId}` → boolean) |
| `src/features/wishlist/wishlistExists/wishlistExists.spec.ts` | T2 테스트 4건 |
| `src/features/wishlist/useAddNearbyWish/useAddNearbyWish.ts` | T3·T4·T5. 로그 0/1/2+ 분기·중복 가드·loading 가드·토스트 오케스트레이션 훅 |
| `src/features/wishlist/useAddNearbyWish/useAddNearbyWish.spec.tsx` | T3·T4·T5 테스트 8건 |
| `src/features/wishlist/index.ts` | 배럴에 3개 신규 export 추가(`nearbyToWishlistInput`·`wishlistExists`·`useAddNearbyWish`·`NEARBY_WISH_COPY`·`NearbyWishChoosing`) |

각 모듈에 `index.ts` 동봉(프로젝트 배럴 컨벤션).

## 계약 shape

### `nearbyToWishlistInput({ item: NearbyPlaceItem; roomId: string }): AddWishlistInput`
매핑 규칙(plan §3.2 준수):
- `roomId`←인자, `placeName`←`item.placeName`, `kakaoPlaceId`←`item.kakaoPlaceId`
- `category`←`mapKakaoCategory({ categoryName, categoryGroupCode })` (8종 key|null, **단일 출처 재사용** — 자체 매핑 금지, 메모리 nearby-category-mapping)
- `area`=`null`, `roadAddress`=`null`, `note`=`null` (NearbyPlaceItem엔 주소·메모 필드 없음)
- `lat`/`lng`: **둘 다 `Number.isFinite`일 때만 채우고 하나라도 비유한이면 둘 다 `null`** (쌍 무결성, placeFieldsFromItem 선례)
- ⚠️ `mapKakaoCategory`는 배럴(`@/features/muklog`) 아닌 **`@/features/muklog/kakaoCategory` 직접 import** — 배럴이 useMuklogs→supabase→AsyncStorage를 끌어와 테스트 환경에서 깨지기 때문.

### `wishlistExists({ roomId: string; kakaoPlaceId: string }): Promise<boolean>`
- 쿼리: `from('wishlist_items').select('id').eq('room_id', roomId).eq('kakao_place_id', kakaoPlaceId).limit(1)` → 1건 이상이면 `true`.
- RLS select(내 방)로 허용되는 일반 조회 — **DEFINER/Realtime/RPC 미사용**(비용 가드 §8).
- 에러는 **throw** → 호출측(useAddNearbyWish)이 담기 중단 + 에러 토스트.
- best-effort: 커플 동시 담기 레이스로 중복이 슬쩍 들어와도 무해(DB 제약 무변경).

### `useAddNearbyWish() → { requestAdd, chooseLog, dismiss, choosing, submitting }`
- `requestAdd({ item: NearbyPlaceItem })` — 액션 진입점. 분기:
  - 로그 0개 → `NEARBY_WISH_COPY.noLog`("먼저 로그를 만들어 주세요") 토스트(neutral), insert 미발생.
  - 로그 1개 → 시트 없이 `logs[0].roomId`로 즉시 담기.
  - 로그 2+개 → `choosing = { item, logs }` 세팅(시트 노출), insert는 선택 후.
- `chooseLog({ roomId })` — 시트에서 로그 선택 → 그 roomId로 담기, `choosing`=null로 시트 닫힘.
- `dismiss()` — 시트 취소(`choosing`=null), 담기 미발생.
- `choosing: { item, logs } | null` — Phase 2 로그 선택 시트가 소비(로그 목록 렌더·item 컨텍스트).
- `submitting: boolean` — 담는 중 표시(액션 비활성용). 실제 중복 insert 차단은 내부 `submittingRef`가 동기 담당.
- 담기(addToLog) 결과 토스트:
  - 성공 → `NEARBY_WISH_COPY.success`("위시에 담았어요 📍") tone **positive**.
  - 중복 → `NEARBY_WISH_COPY.duplicate`("이미 담은 곳이에요") tone **neutral**.
  - 실패(pre-check/insert reject) → `mapWishlistError({ error })` tone **neutral**, 목록·상태 불변.
- **loading 가드:** `submittingRef`(useRef)로 동기 재진입 차단 — 연속 탭에도 addWishlist 1회만(state 비동기 갱신 레이스 회피).

## 생산자 ↔ 소비자 매핑 (QA 교차검증용)

| # | 생산자 | 소비자 | 경계 |
|---|---|---|---|
| 1 | `NearbyPlaceItem`(useNearbyPlaces/nearby-search) | `nearbyToWishlistInput` | 필드명(kakaoPlaceId·placeName·categoryName·categoryGroupCode·lat·lng), 좌표 유한 가드 |
| 2 | `nearbyToWishlistInput` 산출 `AddWishlistInput` | `useAddWishlist().addWishlist({ input })` → `toWishlistRow` insert row | camel→snake, added_by는 useAddWishlist가 auth uid로 주입(매퍼 무관) |
| 3 | `wishlistExists` select(room_id, kakao_place_id) | `wishlist_items` RLS select(내 방) | 컬럼명·스코프, 1건 이상=중복 |
| 4 | `useMyLogsContext().state`(ready면 logs) | `useAddNearbyWish` 분기 + `choosing.logs` | logs 길이 0/1/2 분기, `MyLog.roomId`/`name`/`memberCount` |
| 5 | `mapKakaoCategory` 결과 8종 key | `wishlist_items.category`(앱 강제 8종) | enum 드리프트 차단(단일 출처 재사용) |
| 6 | `useAddNearbyWish` 토스트(성공/중복/실패/로그없음) | 전역 `ToastProvider`(useToastController) | tone(positive/neutral), 카피=NEARBY_WISH_COPY + mapWishlistError |

## Phase 2 산출물 (파일)

| 파일 | 역할 |
|---|---|
| `src/navigation/screens/MapTabScreen/MapTabScreen.tsx` | T3·T4·T5 배선. `useAddNearbyWish` 훅 소비 + `NearbySpotCard` 액션(onAddWish/adding) + `LogPickerSheet` 렌더·매핑 |
| `src/navigation/screens/MapTabScreen/MapTabScreen.spec.tsx` | 배선 테스트 신규 5건(기존 29 + 신규 5 = 34 green) |

> `NearbySpotCard` 액션(onAddWish/adding)·`LogPickerSheet` 컴포넌트 자체는 ui-publisher 산출(비주얼). developer는 그 props 계약에 데이터·콜백만 배선.

### MapTabScreen 배선 상세

- `const nearbyWish = useAddNearbyWish();` — 훅이 로그 0/1/2+ 분기·중복 pre-check·insert·토스트 전부 소유.
- `NearbySpotCard`(selectedNearby일 때): `onAddWish={() => nearbyWish.requestAdd({ item: selectedNearby })}`, `adding={nearbyWish.submitting}`.
- `LogPickerSheet`(항상 렌더, `visible={nearbyWish.choosing !== null}`): `onClose={nearbyWish.dismiss}`, `onSelect={nearbyWish.chooseLog}`, `logs={pickerLogs}`.
- `pickerLogs`: `nearbyWish.choosing?.logs`(MyLog[]) → `LogPickerItem[]`. label은 `displayLogName({ name, memberCount, selfNickname: null })`.
  - ⚠️ **결정(플래그):** `selfNickname`을 주입하지 않았다(null). 같은 사용자의 여러 로그는 닉네임이 모두 동일해 구분에 무의미하고(이름으로 구분), NotifSettings/LogList가 쓰는 profile 컨텍스트를 지도 화면에 새로 끌어오는 결합을 피했다. 결과: 이름 없는 로그는 커플 "우리 로그"/솔로 "내 로그" 폴백. 대부분 로그는 name이 있어 name 우선 표시.
  - `displayLogName`은 배럴(`@/features/room`) 아닌 **`@/features/room/logName` 직접 import** — 배럴이 useMyLogs→supabase를 끌어와 테스트 환경 부담을 주기 때문.

## 생산자 ↔ 소비자 매핑 (QA 교차검증용) — Phase 1+2 통합

| # | 생산자 | 소비자 | 경계 |
|---|---|---|---|
| 1 | `NearbyPlaceItem`(useNearbyPlaces) | `nearbyToWishlistInput` | 필드명·좌표 유한 가드 |
| 2 | `nearbyToWishlistInput` 산출 `AddWishlistInput` | `useAddWishlist` → `toWishlistRow` insert row | camel→snake, added_by는 useAddWishlist가 auth uid로 주입 |
| 3 | `wishlistExists` select(room_id, kakao_place_id) | `wishlist_items` RLS select(내 방) | 컬럼명·스코프, 1건 이상=중복 |
| 4 | `useMyLogsContext().state.logs` | `useAddNearbyWish` 분기 + `choosing.logs` → `pickerLogs`(MapTabScreen) | logs 길이 0/1/2 분기, `MyLog.roomId/name/memberCount` → `LogPickerItem` |
| 5 | `mapKakaoCategory` 8종 key | `wishlist_items.category` | enum 드리프트 차단(단일 출처 재사용) |
| 6 | `useAddNearbyWish` 토스트(성공/중복/실패/로그없음) | 전역 `ToastProvider` | tone(positive/neutral), NEARBY_WISH_COPY + mapWishlistError |
| 7 | MapTabScreen `selected {id, saved}` | NearbySpotCard `onAddWish` | saved:false(nearby)만 담기 대상(카드가 nearby일 때만 렌더) |
| 8 | `nearbyWish.choosing` | `LogPickerSheet.visible/logs` + `onSelect` → `chooseLog` | choosing≠null=시트 오픈, 행 roomId→chooseLog |

## 카피 확정 (NEARBY_WISH_COPY)

| 상황 | 카피 | tone |
|---|---|---|
| 성공 | 위시에 담았어요 📍 | positive |
| 중복 | 이미 담은 곳이에요 | neutral |
| 로그 없음 | 먼저 로그를 만들어 주세요 | neutral |
| 실패 | mapWishlistError 반환값 | neutral |

> 성공 카피 `📍` **최종 확정**(ui-publisher·qa-visual 합의) — 킷 mk-log:40("위시리스트에 담았어요 📍") 웜 톤 정합. muklog 웜 변형은 킷 음식/플레이풀 이모지를 명시 허용(CLAUDE.md). 단일 출처는 `NEARBY_WISH_COPY.success`. 스펙 단언은 상수를 참조하므로 자동 정합(하드코딩 없음).

## 절대 규칙 준수

- TDD(Red→Green): 각 T별 실패 테스트 선작성 후 최소 구현. 전체 `npm test` **170 스위트 / 1598 테스트 green**, `npx tsc --noEmit` **0 에러**.
- 마이그레이션·RLS·Edge Function·DEFINER·Realtime **신설 0건**. 코드 컨벤션(named-object 인자·화살표 const·enum-style 상수·useCallback/useMemo 미사용) 준수.
- 비용 가드레일: Kakao 호출 0(캐시된 NearbyPlaceItem만), 폴링 없음, 담기당 select 1 + insert 1.
