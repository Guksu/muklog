# Sprint: 위시리스트 장소 지도 핀 표시 (map-wish-pins)

> roadmap-sprints 루프 2/6. "지도 고도화" 두 번째 슬라이스. 스프린트 1(map-nearby-wish)에서 담은 위시를 이제 지도에서 핀으로 본다.

## 1. 기능 한줄 정의

내 모든 로그의 **좌표 있는 위시 장소**(`wishlist_items` where lat/lng not null)를 지도에 **먹로그 핀·주변 핀과 구분되는 스타일**의 핀으로 표시하고, 탭하면 최소 정보 카드(이름·카테고리)를 보여준다.

## 2. 범위

### In-scope
- **크로스-로그 위시 핀 조회**: `wishlist_items` 일반 select(RLS `room_id IN 내 방`이 자동 스코프 → room 필터 없이 전 로그) + `lat/lng not null` 필터. 신규 RPC/Edge Function/DEFINER **없음**.
- **MapMarker 판별자 확장**: `saved: boolean` → `kind: 'saved' | 'nearby' | 'wish'`(3종). 회귀 net = TypeScript 컴파일러가 전 소비지점을 강제 노출(§7).
- **위시 핀 스타일**: 먹로그(primary)·주변(웜그레이)과 구분되는 3번째 보더/색(정확한 hex·zIndex는 ui-publisher가 킷 기준 확정).
- **3-way 머지 dedup**: `mergeMapMarkers({ saved, wish, nearby })` — 우선순위 saved > wish > nearby(좌표근접 epsilon dedup).
- **위시 핀 탭 → 최소 카드**(`WishSpotCard`): 이름 + 카테고리(+ area). 액션 없음.
- **갱신**: 지도 탭 포커스 시 재조회(useFocusEffect) + 스프린트 1 "위시에 담기" 성공 직후 즉시 refresh. 폴링·Realtime 없음.

### Out-of-scope (다음 스프린트 / 명시적 제외)
- **카테고리 필터 칩** → `map-category-filter`(루프 3/6). 위시 핀 on/off 토글·범례 확장도 이번엔 최소만.
- 위시 핀 카드에서 **"다녀왔어요" 전환·삭제·편집** 등 액션(최소 카드는 표시 전용).
- 위시 핀 **SWR 로컬 캐시**(map-pins-cache식) → 후속 `wish-pins-cache`. 이번은 진입 1회 조회 + 포커스/명시 refresh만.
- **정확 dedup(kakao_place_id 일치)** — 좌표근접(epsilon)만 사용(nearby↔saved 선례와 동일). 정확 dedup은 후속.
- 위시 핀 거리 표기(현재위치→위시 거리 계산), 클러스터링.
- `wishlist_items` 스키마·RLS·트리거 변경(0건).

## 3. 데이터 · API 계약

### 3.1 테이블/RLS 변경
- **없음.** 기존 `wishlist_items` + RLS select(`room_id IN 내 방`)로 크로스-로그 조회. 마이그레이션 0건.

### 3.2 크로스-로그 위시 핀 조회(일반 select)
```ts
supabase
  .from('wishlist_items')
  .select('id, room_id, place_name, category, area, lat, lng')
  .not('lat', 'is', null)
  .not('lng', 'is', null)
  .order('created_at', { ascending: false })
```
- **room 필터 없음** → RLS가 내가 멤버인 전 로그의 위시만 통과(크로스-로그). DEFINER 불필요.
- meId/added_by 표시 파생은 이번 카드에 불필요(최소 카드) → 미조회.

### 3.3 신설 타입·유틸·훅 (먹로그 핀 트리오 미러)
- **`WishPin`**(camel, map/types): `{ id: string; roomId: string; placeName: string; category: string | null; area: string | null; lat: number; lng: number }`. lat/lng는 쿼리 필터로 non-null 보장(toWishPin이 finite 방어).
- **`toWishPin({ row })`** 순수 유틸: snake row → WishPin. 좌표 비유한이면 제외(호출측 필터). id=`wishlist_items.id`.
- **`useWishPins()`** 훅: 마운트 1회 select + `refresh()`. `useMuklogPins`의 "진입 1회 + 명시 refresh, 폴링 0" 정책 계승(단, 캐시는 이번 OUT). 상태 `{ status: 'loading' } | { status: 'ready'; pins: WishPin[] } | { status: 'error'; message }`.
- **`wishToMapMarkers({ pins })`** 순수 유틸: WishPin[] → MapMarker[](`kind: 'wish'`). emoji = `categoryEmoji({ key: category })`(먹로그 핀과 동일 CAT 매핑, 폴백 🍽️). 좌표 비유한 제외.

### 3.4 MapMarker 판별자 확장 (`saved: boolean` → `kind`)
- **enum-style 상수** `MapPinKind = { Saved: 'saved', Nearby: 'nearby', Wish: 'wish' } as const`(types 단일 출처).
- `MapMarker.saved: boolean` → **`MapMarker.kind: MapPinKind`**.
  - `pinsToMapMarkers` → `kind: 'saved'`
  - `nearbyToMapMarkers` → `kind: 'nearby'`
  - `wishToMapMarkers`(신설) → `kind: 'wish'`
- **MARKER_TAP 페이로드**: `{ type, id, saved }` → `{ type, id, kind }`. `MapInboundMessage`의 MarkerTap variant도 `kind`로 교체. `parseMapMessage`가 `kind` 검증(미지 값은 무시/null 흡수).
- **mapHtml**: `el.className`·`pinZIndex`를 kind 기반으로 분기 — saved→`.mk-pin`, nearby→`.mk-pin--nearby`, wish→**`.mk-pin--wish`**(신규 클래스, 색·zIndex는 ui-publisher). MARKER_TAP post에 `kind` 동봉.
- **MapTabScreen 선택 상태**: `selected: { id: string; saved: boolean }` → `{ id: string; kind: MapPinKind }`. 카드 분기: saved→SelectedSpotCard / nearby→NearbySpotCard / wish→WishSpotCard.

> ⚠️ **회귀 0 전략(선례: map-tab-nearby의 saved 폭확장)**: `saved` boolean을 `kind` enum으로 **교체**하면 TypeScript가 모든 생산자/소비자(pinsToMapMarkers·nearbyToMapMarkers·mergeMapMarkers·mapHtml·parseMapMessage·MapTabScreen + 각 spec)를 컴파일 에러로 강제 노출한다 → 누락 없이 lockstep 갱신. saved/nearby 핀의 **런타임 동작(보더·카드·탭·머지)은 불변**, 판별자 이름만 바뀐다. 이중 판별자(saved+kind 병존) 금지 — 단일 출처 `kind`.

### 3.5 3-way 머지 (`mergeMapMarkers` 확장)
```ts
mergeMapMarkers({ saved, wish, nearby }): MapMarker[]
```
- saved 전부 포함 → wish 중 saved와 좌표근접 아닌 것 → nearby 중 saved·wish 어느 쪽과도 근접 아닌 것.
- 우선순위 **saved > wish > nearby**(다녀온 곳=먹로그가 위시를 가림 / 내 위시가 일반 주변 핀을 가림). epsilon = 기존 `MERGE_DEDUP_EPSILON`(1e-4°≈11m) 재사용.

### 3.6 기존 재사용/불변 계약
- `categoryEmoji`(muklog/categories) — 위시 핀 이모지.
- `initialRegion`·`buildSetMarkersScript`·`buildInitScript`(mapMessages) — SET_MARKERS 채널 재사용(신규 outbound 메시지 불필요, wish 핀도 markers 배열에 합류).
- `useMyLogsContext`·`useMuklogPins`·`useNearbyPlaces` shape 불변.

## 4. 화면 · UX

### 4.1 컴포넌트/역할
- **MapTabScreen**: `useWishPins` 추가 배선 → `wishToMapMarkers` → `mergeMapMarkers({ saved, wish, nearby })` → SET_MARKERS. 포커스/add-후 refresh 배선. 선택 상태 kind 3분기.
- **`WishSpotCard`**(신설, ui-publisher): NearbySpotCard 셸 재사용 계열. 표시 = FoodCover(카테고리 이모지) + placeName + 카테고리 라벨(+ area). **거리·별점·heart·액션 없음.** props: `{ placeName, category, area }`(또는 이모지/라벨 가공값 주입 — ui-publisher 확정).
- **MapLegend**: 위시 핀 범례 항목 추가 여부는 ui-publisher 판단(최소; 범례 확장 자체는 얇은 비주얼).

### 4.2 상태
- **로딩**: 위시 조회 중이어도 지도·먹로그·주변 핀은 정상 표시(위시 핀만 나중에 합류 — 차단 아님).
- **빈 상태**: 좌표 있는 위시 0건 → 위시 핀 없음(에러 아님, 지도 그대로).
- **에러**: 위시 조회 실패 → 위시 핀만 생략(먹로그/주변/지도 불변, 배너 없음 — best-effort. 먹로그 핀 에러 배너와 독립).
- **성공**: 위시 핀 렌더 + 탭 시 WishSpotCard.

### 4.3 갱신 시점
- 마운트 1회(useWishPins).
- **탭 포커스**(useFocusEffect): LogScreen에서 위시 추가/삭제 후 지도로 돌아오면 반영(첫 포커스=마운트와 중복이나 refresh는 loading 리셋 안 하므로 무해).
- **스프린트 1 add-후**: "위시에 담기" 성공 콜백에서 `wishPins.refresh()`(같은 화면, 즉시 반영).
- 폴링·Realtime·주기 조회 **금지**(비용 가드레일 §8).

## 5. 작업 목록 (각 인수조건 포함)

- [ ] **T1. `MapPinKind` + MapMarker/MARKER_TAP 판별자 교체** — 인수조건: MapMarker·MarkerTap 메시지가 `kind`('saved'|'nearby'|'wish')를 쓰고 `saved` 필드가 사라짐, 기존 saved/nearby 생산자·파서가 kind로 동작 — 테스트: pinsToMapMarkers→kind:'saved', nearbyToMapMarkers→kind:'nearby', parseMapMessage가 MARKER_TAP kind 파싱/미지 kind 무시.
- [ ] **T2. `toWishPin` 순수 유틸** — 인수조건: snake row → WishPin(id/roomId/placeName/category/area/lat/lng), 좌표 비유한 제외 — 테스트: 정상 매핑 필드 단언 + lat=NaN 제외.
- [ ] **T3. `wishToMapMarkers` 순수 유틸** — 인수조건: WishPin[]→MapMarker[](kind:'wish', emoji=categoryEmoji, 폴백 🍽️), 비유한 좌표 제외 — 테스트: category 매핑 이모지 + null category 폴백 + 좌표 가드.
- [ ] **T4. `useWishPins` 훅** — 인수조건: 마운트 1회 크로스-로그 select(room 필터 없음, lat/lng not null), refresh 제공, 폴링 없음, 실패 시 error 상태 — 테스트: supabase 모킹 — 마운트 1회 호출·room 필터 미포함·not null 필터 포함·refresh 재호출·에러 전이.
- [ ] **T5. `mergeMapMarkers` 3-way 확장** — 인수조건: `{saved,wish,nearby}` 입력 시 saved 전부 + wish(saved 비근접) + nearby(saved·wish 비근접), 우선순위 saved>wish>nearby — 테스트: wish가 saved와 근접 시 제외, nearby가 wish와 근접 시 제외, 비근접은 전부 포함.
- [ ] **T6. mapHtml 위시 핀 스타일 분기** — 인수조건: kind='wish' 마커가 `.mk-pin--wish` 클래스로 렌더되고 탭 시 MARKER_TAP kind:'wish' 발신, saved/nearby 클래스·탭 불변 — 테스트: HTML 문자열에 `.mk-pin--wish` 정의 존재 + kind 분기 로직 스냅샷/문자열 단언(렌더는 디바이스 스모크).
- [ ] **T7. MapTabScreen 배선(조회·머지·카드·refresh)** — 인수조건: 위시 핀이 지도에 합류하고 탭 시 WishSpotCard 표시, 포커스·add-후 refresh 동작, saved/nearby 카드 회귀 없음 — 테스트: kind 3분기 선택→해당 카드 렌더, wish 선택 시 WishSpotCard, refresh 트리거 호출(모킹).
- [ ] **T8. `WishSpotCard` 컴포넌트(ui-publisher)** — 인수조건: 이름·카테고리(+area) 표시, 액션 없음, 킷 셸 정합 — 테스트: props 렌더 단언(비주얼 충실도는 qa-visual).
- [ ] **T9. 회귀·게이트** — 인수조건: 기존 map/nearby/wishlist 스위트 무회귀, `npm test` 전체 green + `npm run typecheck` 0 에러.

## 5-1. 테스트 케이스 (TDD)

**단위(순수 유틸/훅 — jest-expo + RTL):**
- `toWishPin`: 정상 매핑 / lat=NaN·lng=Infinity 시 호출측 제외(유틸은 finite 방어) / category null 통과.
- `wishToMapMarkers`: category 'noodle'→해당 이모지·kind:'wish' / null→🍽️ / 좌표 비유한 항목 제외 / 빈 배열→빈 배열.
- `useWishPins`(supabase 모킹): 마운트 1회 select, `.not('lat','is',null)`·`.not('lng','is',null)` 포함·**room 필터 미포함**(크로스-로그), refresh 재호출, error 전이, 폴링 없음(추가 호출 0).
- `mergeMapMarkers`: saved+wish+nearby 전부 비근접→전부 / wish∩saved 근접→wish 제외 / nearby∩wish 근접→nearby 제외 / nearby∩saved 근접→nearby 제외 / 우선순위 순서(saved 먼저, wish, nearby).
- `pinsToMapMarkers`·`nearbyToMapMarkers`: kind 값 회귀(saved/nearby).
- `parseMapMessage`: MARKER_TAP `{id,kind}` 파싱, 미지 kind/누락 시 흡수.
- MapTabScreen(RTL): kind별 선택→SelectedSpotCard/NearbySpotCard/WishSpotCard 분기, wish refresh 콜백 호출.

**모킹/스모크 대상(단위 아님):**
- 실제 RLS 크로스-로그 필터·인덱스 → supabase 클라 모킹(라이브 `db push` 후 스모크 — wishlist 마이그레이션 이월과 함께).
- 실제 WebView 위시 핀 렌더·색 구분·탭 → **디바이스 스모크**(메모리 [[qa-layout-blind-spot]]: WebView 렌더 픽셀은 단위테스트 사각지대).

## 6. 엣지케이스

- **좌표 없는 위시**(수동 입력, lat/lng null): 쿼리 필터로 제외 → 핀 없음(정상).
- **위시 ↔ 먹로그 같은 장소**(좌표 근접): saved 우선 → 위시 핀 숨김(다녀온 곳은 먹로그 핀으로 표시). 위시 행은 리스트에 잔존(삭제 아님).
- **위시 ↔ 주변 같은 장소**(좌표 근접): wish 우선 → 주변 핀 숨김(내 위시가 일반 핀을 가림).
- **id 네임스페이스 충돌**(wishId vs muklogId vs kakaoPlaceId): kind 판별자로 탭 시 올바른 컬렉션 조회 → 카드 오분기 방지.
- **커플 동시성**: 짝꿍이 담은 위시도 크로스-로그 RLS로 내 지도에 보임(내 로그 범위). 포커스 refresh로 반영(Realtime 없음 — 즉시성은 포커스 단위, 비용 가드).
- **지도 진입 후 추가/삭제**: 스프린트 1 add→즉시 refresh / LogScreen 삭제→탭 복귀 포커스 refresh로 핀 사라짐.
- **위시 조회 실패/네트워크**: 위시 핀만 생략, 지도·먹로그·주변 불변(배너 없음, best-effort).
- **위시 0건 / 좌표 있는 위시 0건**: 위시 핀 없음(에러 아님).
- **선택 전이**: 위시 핀 탭 후 먹로그 핀 탭 → 카드가 WishSpotCard→SelectedSpotCard로 정확히 교체(selection.kind 갱신). 지도 빈 곳 탭(MAP_TAP)→해제.
- **map 미준비(READY 전)**: 위시 마커도 SET_MARKERS 재주입 경로로 READY 후 합류(기존 패턴).
- **대량 위시**: 크로스-로그라도 개인 위시 수는 소량 — viewport 무관 전량 조회 허용(먹로그 핀과 동일 정책). 대량화 시 viewport 조회는 후속.

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

1. `wishlist_items` RLS select(room_id IN 내 방) ↔ `useWishPins` 크로스-로그 쿼리(room 필터 없음) — 스코프가 RLS로만 걸리는지, 컬럼명 일치.
2. `toWishPin`(snake→camel) ↔ WishPin 소비(wishToMapMarkers) — 필드/좌표 가드.
3. **`MapPinKind` 판별자** — 전 생산자(pins/nearby/wish ToMapMarkers) ↔ 전 소비자(mapHtml 클래스·pinZIndex / parseMapMessage / MapTabScreen 카드 분기). saved 잔재 0 확인(단일 출처).
4. mapHtml MARKER_TAP `{id,kind}` ↔ parseMapMessage ↔ MapTabScreen selection.kind — 3-way 왕복.
5. `mergeMapMarkers({saved,wish,nearby})` 우선순위·epsilon ↔ 지도뷰 SET_MARKERS(중복 핀 0) — dedup 규칙.
6. `wishToMapMarkers` 이모지(categoryEmoji CAT) ↔ WishSpotCard 표시 이모지 — 동일 매핑 단일 출처(드리프트 방지).
7. 갱신 트리거(포커스 refresh / 스프린트1 add-후 refresh) ↔ useWishPins.refresh — 폴링 아님(호출 경로 유한).
8. 스프린트 1 자산 재확인: add-후 refresh 배선이 map-nearby-wish 성공 콜백과 연결되는 지점.

## 8. 비용 가드레일 체크

- **Kakao 호출 0**: 위시 핀은 DB 조회만(Local API 무관).
- **DB**: 위시 select = 마운트 1회 + 포커스 refresh(내비 단위, 유한) + add-후 1회. 폴링·Realtime·DEFINER·Edge Function **0**. 인덱스 `(room_id, created_at desc)` 활용, lat/lng not null 필터로 결과 축소.
- **AWS 미사용**, 마이그레이션 0건 — Supabase 무료 티어 내.
- SWR 로컬 캐시는 이번 OUT(후속) — 조회 횟수는 위 세 트리거로 상한.
- 이미지 압축·viewport 조회: 이번 무관(위시 수 소량, 전량 조회 허용).

---

### 착수 메모(developer)
- 새 마이그레이션·RLS·RPC·Edge Function **0**. 핵심 = ① `saved`→`kind` 판별자 교체(컴파일러가 blast radius 강제) ② 위시 핀 트리오 신설(`toWishPin`·`useWishPins`·`wishToMapMarkers`, 먹로그 핀 트리오 미러) ③ `mergeMapMarkers` 3-way ④ mapHtml `.mk-pin--wish` 분기 ⑤ MapTabScreen 배선·refresh ⑥ `WishSpotCard`(ui-publisher).
- 크로스-로그는 **room 필터를 넣지 않는 것**으로 달성(RLS가 스코프) — `.eq('room_id')` 넣지 말 것.
- 이모지·카테고리는 `categoryEmoji`(CAT) 재사용(자체 매핑 금지).
- 위시 핀 색·zIndex·범례·WishSpotCard 비주얼은 ui-publisher가 킷 `templates/muklog` 기준 확정 — developer는 클래스명 계약(`.mk-pin--wish`)·배선만, hex 임의 지정 금지.
