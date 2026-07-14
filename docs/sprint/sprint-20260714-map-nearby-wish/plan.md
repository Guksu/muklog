# Sprint: 지도 주변 음식점 위시 담기 (map-nearby-wish)

> roadmap-sprints 루프 1/6. README 로드맵 "지도 고도화" 첫 슬라이스이자 architecture.md §5 `map-tab-nearby`의 OUT 이월 항목("주변핀→먹로그추가"를 **위시 담기**로 구체화).

## 1. 기능 한줄 정의

지도 탭에서 주변 음식점 핀을 탭해 뜬 `NearbySpotCard`에서 **"위시에 담기"** 를 누르면, 그 카카오 장소(이름·좌표·카테고리)가 내가 고른 로그의 위시리스트(`wishlist_items`)에 추가된다. 로그가 여러 개면 어느 로그에 담을지 고른다.

## 2. 범위

### In-scope
- `NearbySpotCard`에 **"위시에 담기" 액션** 추가(카드가 액션을 갖는 것까지가 이번 범위 — 비주얼 상세는 ui-publisher).
- 카카오 주변 장소(`NearbyPlaceItem`) → 위시 입력(`AddWishlistInput`) **매핑 순수 유틸 신설**(기존 `mapKakaoCategory` 재사용).
- **대상 로그 선택 흐름**: 로그 1개 → 바로 담기 / 로그 2+개 → 로그 선택 시트 → 담기 / 로그 0개 → 안내 토스트(담기 불가).
- 기존 `useAddWishlist` **재사용** insert(테이블·RLS 무변경). 성공/실패 토스트(전역 `useToastController`).
- **중복 담기 가드**(best-effort): 같은 `kakao_place_id`가 그 로그 위시에 이미 있으면 insert 대신 "이미 담은 곳이에요" 토스트.

### Out-of-scope (다음 스프린트 / 명시적 제외)
- **위시 핀 지도 표시**(담은 위시가 지도에 핀으로 뜨는 것) → `map-wish-pins`(루프 2/6).
- **카테고리 필터 칩** → `map-category-filter`(루프 3/6).
- `wishlist_items` **스키마·RLS·트리거 변경**, DB unique 제약 추가(중복은 클라 pre-check로만 — 스키마 무변경 유지).
- 담기 성공 후 지도에서 해당 nearby 핀 제거/색 변경(핀은 일반 음식점 핀이므로 유지).
- 위시 메모 입력, 담은 뒤 편집/취소(undo).
- `SelectedSpotCard`(내 맛집=saved 핀) 위시 담기 — 이미 먹로그로 기록된 곳이므로 대상 아님(§6 참조).
- 새 Edge Function / DEFINER RPC / Realtime(비용 가드레일 §8).

## 3. 데이터 · API 계약

### 3.1 테이블/RLS 변경
- **없음.** `wishlist_items`(architecture §3)와 기존 RLS(`insert = added_by=auth.uid() and room_id ∈ 내 방`, `select = room_id ∈ 내 방`)를 그대로 사용한다. 마이그레이션 0건.

### 3.2 신설 순수 유틸 — `nearbyToWishlistInput`
`src/features/wishlist/nearbyToWishlistInput/` (또는 map feature 하위 — developer 판단, 단 wishlist 도메인 타입 소비).

입력 → 반환:
```ts
nearbyToWishlistInput({ item, roomId }: { item: NearbyPlaceItem; roomId: string }): AddWishlistInput
```
매핑 규칙:
| AddWishlistInput 필드 | 값 |
|---|---|
| `roomId` | 인자 `roomId` |
| `placeName` | `item.placeName` |
| `category` | `mapKakaoCategory({ categoryName: item.categoryName, categoryGroupCode: item.categoryGroupCode })` → 8종 key \| null |
| `area` | **`null`** (NearbyPlaceItem엔 `address_name` 없음 → deriveArea 불가) |
| `roadAddress` | **`null`** (도로명 없음) |
| `lat` / `lng` | `item.lat`/`item.lng` — **둘 다 유한(Number.isFinite)일 때만 채우고, 하나라도 비유한이면 둘 다 null**(쌍 무결성, placeFieldsFromItem 선례) |
| `kakaoPlaceId` | `item.kakaoPlaceId` |
| `note` | `null` |

> ⚠️ `placeFieldsFromItem`은 `PlaceSearchItem`(addressName/roadAddressName 보유)을 받으므로 **직접 재사용 불가** — NearbyPlaceItem은 주소 필드가 없다. 그래서 별도 매퍼를 둔다. 카테고리 매핑만 `mapKakaoCategory` 공유(함정 방지 단일 출처, 메모리 [[nearby-category-mapping]]).

### 3.3 중복 담기 pre-check (일반 select 쿼리)
insert 직전 클라 조회:
```sql
select id from wishlist_items
where room_id = :roomId and kakao_place_id = :kakaoPlaceId
limit 1
```
- RLS select(내 방)로 허용 — DEFINER/Realtime 미사용(비용 가드).
- 1건 이상이면 insert 스킵 → "이미 담은 곳이에요" 토스트, 목록 불변.
- **best-effort**: 커플 동시 담기 레이스로 중복이 슬쩍 들어와도 무해(위시는 중복 허용, DB 제약 무변경). §6 참조.
- 훅 형태 제안: `useAddWishlist`에 pre-check 로직을 얹기보다 배선 레벨(핸들러) 또는 얇은 `wishlistExists({ roomId, kakaoPlaceId })` 헬퍼로 분리 — developer 판단. **인수조건은 "중복이면 insert 미발생 + 안내 토스트"로 관찰**.

### 3.4 기존 재사용 계약(변경 금지)
- `useAddWishlist().addWishlist({ input: AddWishlistInput }) → Promise<{ id }>` — added_by는 훅이 auth.uid()로 채움.
- `AddWishlistInput`(wishlist/types) shape 그대로.
- `useMyLogsContext() → { state: MyLogsState, refresh }` — MapTabScreen이 HomeTabs 하위라 Provider 안. 로그 목록은 `state.status==='ready' ? state.logs : []`.
- `MyLog`: `{ roomId, name, memberCount, ... }` — 로그 선택 시트 표시는 `name ?? 폴백`(displayLogName 재사용 검토).
- `NearbyPlaceItem`(map/types): `{ kakaoPlaceId, placeName, categoryName, categoryGroupCode, lat, lng, distance }`.

## 4. 화면 · UX

### 4.1 컴포넌트/역할
- **`NearbySpotCard`**: 기존 표시(이름·카테고리·거리)에 **"위시에 담기" 액션** 추가. 비주얼(버튼 위치·토큰·아이콘)은 ui-publisher가 킷 `templates/muklog` 기준 정의. plan은 "액션이 존재하고 탭 시 담기 흐름을 트리거한다"만 못박음.
- **로그 선택 시트**(로그 2+개일 때만): 내 로그 목록을 행으로 표시 → 탭 시 그 로그에 담기. 기존 `Sheet` 프리미티브 재사용(ui-publisher). 로그 1개면 시트 없이 즉시 담기.
- **토스트**: 전역 `useToastController().showToast` — 성공/중복/실패/로그없음.

### 4.2 상태
- **로딩**(담는 중): 액션 버튼 비활성 또는 스피너(중복 탭 방지 — `addWishlist.loading`).
- **빈 상태(로그 0개)**: 액션 탭 시 "먼저 로그를 만들어 주세요" 토스트, insert 미발생.
- **성공**: "위시에 담았어요"(tone positive) 토스트. 카드는 유지(자동 닫힘 여부는 ui-publisher/배선 — 기본 유지).
- **중복**: "이미 담은 곳이에요"(tone neutral) 토스트, insert 미발생.
- **에러**(네트워크/RLS 실패): `mapWishlistError` 한국어 메시지 토스트(tone neutral), 목록 불변.

### 4.3 카피(권고값 — 해요체, ui-publisher가 킷 대조 확정)
| 상황 | 카피 |
|---|---|
| 성공 | 위시에 담았어요 |
| 중복 | 이미 담은 곳이에요 |
| 로그 없음 | 먼저 로그를 만들어 주세요 |
| 실패 | (mapWishlistError 반환값) |

## 5. 작업 목록 (각 인수조건 포함)

- [ ] **T1. `nearbyToWishlistInput` 순수 유틸** — 인수조건: `NearbyPlaceItem`+`roomId` 입력 시 category는 `mapKakaoCategory` 결과, area·roadAddress·note는 null, kakaoPlaceId·placeName 통과, 좌표는 쌍 유한일 때만 채움 — 테스트: 정상 항목 매핑 결과 필드별 단언 + 비유한 좌표 시 lat/lng 둘 다 null.
- [ ] **T2. 중복 pre-check 헬퍼/배선** — 인수조건: 같은 (roomId, kakaoPlaceId)가 이미 있으면 `addWishlist` 미호출 + "이미 담은 곳이에요" 토스트, 없으면 insert 진행 — 테스트: supabase select 모킹 — 1건 반환 시 addWishlist 미호출, 0건 시 호출.
- [ ] **T3. NearbySpotCard 액션 배선(MapTabScreen)** — 인수조건: nearby 핀 탭 → 카드의 "위시에 담기" 탭 → (로그 1개면) 그 로그에 `nearbyToWishlistInput` 결과로 insert → 성공 토스트 — 테스트: MapTabScreen(또는 카드 배선) 렌더 후 액션 press → addWishlist가 매핑된 input으로 호출됨(모킹).
- [ ] **T4. 로그 선택 흐름** — 인수조건: 로그 2+개면 액션 탭 시 로그 선택 시트 노출 → 로그 선택 시 그 roomId로 담기 / 로그 1개면 시트 없이 즉시 담기 / 로그 0개면 시트·insert 없이 "먼저 로그를 만들어 주세요" 토스트 — 테스트: logs 길이 0·1·2 각각에 대해 분기(시트 표시/직접 담기/안내) 단언.
- [ ] **T5. 로딩·실패 처리** — 인수조건: 담는 중 액션 재탭이 중복 insert를 만들지 않음(loading 가드) / insert 실패 시 목록·상태 불변 + 에러 토스트 — 테스트: addWishlist reject 시 성공 토스트 미발생·에러 토스트 발생, loading 중 재호출 차단.
- [ ] **T6. 회귀** — 인수조건: 기존 nearby/saved 핀 선택·카드·머지·map 메시지 계약 불변, `npm test` 전체 green + `npm run typecheck` 0 에러 — 테스트: 기존 map/wishlist 스위트 무회귀.

## 5-1. 테스트 케이스 (TDD)

**단위(순수 유틸/훅 — jest-expo + RTL):**
- `nearbyToWishlistInput`
  - 정상: FD6 "음식점 > 한식 > 칼국수" → category `noodle`, area/roadAddress/note null, lat/lng 통과.
  - 경계: category_group_code `CE7` → category `cafe`(mapKakaoCategory 규칙). categoryName 빈 문자열 → category null.
  - 실패/경계: lat=NaN 또는 lng=Infinity → lat·lng 둘 다 null(쌍 무결성). kakaoPlaceId 통과.
- 중복 pre-check 헬퍼(supabase 모킹)
  - 정상(신규): select 0건 → insert 진행.
  - 중복: select 1건 → insert 미발생.
  - 실패: select 에러 → 에러 처리(insert 미발생 또는 에러 토스트 — developer 확정, 기본은 담기 중단).
- 로그 선택 분기(배선 훅/화면)
  - logs.length===0 → 안내 토스트, addWishlist 미호출.
  - length===1 → 시트 없이 그 roomId로 addWishlist 호출.
  - length>=2 → 시트 노출, 선택 후 해당 roomId로 호출.
- 담기 결과
  - 성공 → 성공 토스트(positive), showToast 1회.
  - 실패(addWishlist reject) → 에러 토스트, 성공 토스트 없음.
  - loading 가드 → 연속 탭 시 addWishlist 1회만.

**모킹/스모크 대상(단위 아님):**
- 실제 `wishlist_items` insert/RLS·select 필터 → supabase 클라 모킹(SQL은 라이브 스모크로만 확인, architecture §5 wishlist "db push 후 스모크 이월"과 동일).
- 실제 지도 WebView 핀 탭 렌더 → 디바이스 스모크(메모리 [[qa-layout-blind-spot]]: 레이아웃 무거운 화면).

## 6. 엣지케이스

- **로그 0개**: 담기 불가 — 안내 토스트, insert 미발생(크래시·무한로딩 없음).
- **로그 다수(멀티 로그)**: 선택 시트로 명시 선택. 시트 취소 시 담기 미발생.
- **중복(같은 kakao_place_id 이미 그 로그 위시에)**: pre-check로 insert 스킵 + 안내. 서로 다른 로그엔 각각 담을 수 있음(중복 판정은 roomId 스코프).
- **커플 동시성**: 두 멤버가 같은 장소를 동시에 담으면 pre-check 레이스로 2행 생길 수 있음 — **무해**(위시 중복 허용, DB 제약 무변경). best-effort임을 명시.
- **이미 먹로그로 기록된 장소**: 그 좌표엔 saved 핀이 있고, `mergeMapMarkers` 좌표근접 dedup으로 nearby 핀이 제외됨 → `NearbySpotCard` 대상이 아님(액션 노출 안 됨). 추가 처리 불필요.
- **좌표/카테고리 결측**: 좌표 비유한 → lat/lng null로 저장(위시는 좌표 nullable). category 매핑 실패 → null 저장(표시단 폴백 cafe, 기존 wishlist 동작).
- **네트워크 실패**: insert/select reject → 에러 토스트, 목록·상태 불변.
- **인증 만료**: `addWishlist`가 NotAuthenticated throw → 에러 토스트(기존 경로).
- **RLS 위반(내 방 아님)**: 정상 흐름에선 내 로그만 선택하므로 발생 불가. 방어적으로 insert 실패 시 에러 토스트.
- **입력 한계**: nearby 핀은 항상 kakaoPlaceId 보유(Kakao id) — placeName 공백은 트리거(enforce_wishlist_fields) 최종 방어.

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

1. `NearbyPlaceItem`(nearby-search Edge/useNearbyPlaces) ↔ `nearbyToWishlistInput` — 필드명/좌표 유한 가드.
2. `nearbyToWishlistInput` 산출 `AddWishlistInput` ↔ `useAddWishlist`/`toWishlistRow` insert row — snake/camel, added_by 주입 위치.
3. 중복 pre-check select 쿼리(room_id, kakao_place_id) ↔ `wishlist_items` RLS select(내 방) — 컬럼명·스코프.
4. `useMyLogsContext` 로그 목록 ↔ 로그 선택 시트/분기 — logs 길이 0/1/2 분기, roomId 전달.
5. `mapKakaoCategory` 결과 8종 key ↔ `wishlist_items.category`(앱 강제 8종) — enum 드리프트 차단.
6. MapTabScreen 선택 상태(`{id, saved}`) ↔ NearbySpotCard 액션 트리거 — saved:false만 담기 대상.
7. 토스트 트리거(성공/중복/실패/로그없음) ↔ 전역 `ToastProvider` — tone·중복 방지.

## 8. 비용 가드레일 체크

- **Kakao 호출 0**: 담기는 이미 받은 `NearbyPlaceItem`(useNearbyPlaces 캐시)만 사용 — 신규 Local API 호출 없음. nearby 조회 자체의 디바운스/캐시/임계는 기존 `useNearbyPlaces` 불변.
- **DB**: insert 1회 + 중복 pre-check select 1회(액션당). 폴링·Realtime·DEFINER RPC 없음.
- **AWS 미사용**, Edge Function 신설 없음, 마이그레이션 0건 — Supabase 무료 티어 내.
- 이미지 압축·viewport 조회: 이번 기능 무관(사진 업로드·지도 조회 변경 없음).

---

### 착수 메모(developer)
- 새 마이그레이션·RLS·Edge Function 없음. 순수 유틸 1개(`nearbyToWishlistInput`) + 중복 pre-check + 배선(MapTabScreen/NearbySpotCard) + 로그 선택 시트가 전부.
- 카테고리 매핑은 반드시 `mapKakaoCategory` 재사용(자체 매핑 금지 — [[nearby-category-mapping]] 함정).
- UI 비주얼(액션 버튼·시트 모양·카피 최종)은 ui-publisher가 킷 `templates/muklog` 기준으로 정의 — developer는 배선만, 임의 비주얼 변경 금지.
