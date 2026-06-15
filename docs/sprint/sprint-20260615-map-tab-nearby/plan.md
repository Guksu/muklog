# Sprint: map-tab-nearby (지도 탭) — 슬라이스 2: 일반 음식점 viewport 핀

> 백로그 `map-tab-nearby`(architecture.md §5, 요구 #6). `map-tab` 슬라이스 1(✅ 완료) **위에 증분**한다.
> **이번 스프린트 = 슬라이스 2만**. 슬라이스 1의 `initialRegion`/마커/메시지 계약을 **보존**하며, 그 위에 일반 음식점(Kakao Local FD6) viewport 핀을 얹는다.
> 본 plan은 **계약·작업·테스트만** 정의한다. 비주얼 정합(주변 핀 색·카드)은 ui-publisher 몫.
>
> ✅ **게이팅 결정 확정(오케스트레이터/사용자, 2026-06-15)**: ① Edge Function = **신규 `nearby-search`**. ② viewport 가드레일 = **WebView `idle`→`BOUNDS_CHANGED` + RN `useNearbyPlaces` 단일 지점**(디바운스 500ms·양자화 캐시·최소이동 임계·페이지네이션 금지). ③ MapMarker `saved` **boolean 폭확장** + dedup **좌표 근접(epsilon)** + `MARKER_TAP.saved` 동봉. ④ 주변 핀 탭 = **정보 표시만**(먹로그 추가 OUT). 근거·대안 비교는 §9(감사 추적용 보존).

---

## 1. 기능 한줄 정의

지도를 움직이면(드래그/줌 종료 시) **보이는 영역(bbox)의 일반 음식점**을 Kakao Local(category FD6)로 **디바운스 조회**해 **웜그레이 핀**으로 띄우고, 내 먹로그(saved) 핀과 **구분 색**으로 함께 표시한다. 주변 핀을 탭하면 하단에 그 음식점 요약 카드(이름·카테고리·거리)가 뜬다.

---

## 2. 범위

### In-scope (슬라이스 2)
- WebView 지도 **idle/dragend → `BOUNDS_CHANGED{ sw, ne }`** inbound 메시지 신설(현재 bbox를 RN에 통지).
- RN에서 bbox를 받아 **디바운스 500ms + 동일 bbox 캐시 + 최소 이동 임계**로 Kakao Local(FD6) 조회 — **`useNearbyPlaces` 훅 신설**(usePlaceSearch 패턴 재사용).
- 조회 결과(주변 음식점) → `MapMarker[]`(saved:false) 변환 **`nearbyToMapMarkers` 유틸 신설**.
- saved 핀 + nearby 핀 **머지 + 중복 제거(같은 kakaoPlaceId)** **`mergeMapMarkers` 유틸 신설**.
- 지도뷰 마커 **색 분기**: saved=primary(`#3366FF`) / nearby=웜그레이(`mapNearbyPin` `#B6ABA0`). HTML `renderMarkers` `m.saved` 분기.
- 주변 핀 탭 → 하단 **주변 스팟 카드**(이름·카테고리·거리) — saved 카드(별점/area)와 다른 데이터 형태.
- **신규 `nearby-search` Edge Function**: rect(bbox) + FD6 카테고리 조회(§9.1 확정).
- 비용 가드레일을 **테스트로 강제**(동일 bbox 재호출 0 · 디바운스 내 다중 이동 1회 · 최소 이동 임계 · 페이지네이션 금지).

### Out-of-scope (의도적 — 후속)
- ❌ **"이 곳을 먹로그로 추가"** — nearby 핀은 **표시·카드까지만**(§9.4 확정). 카드에서 작성 흐름(MuklogEditor 프리필) 진입은 **후속 슬라이스**(`map-tab-add-from-pin` 가칭). 이번엔 진입 버튼/네비게이션 없음.
- ❌ 핀 클러스터링, 마커 수 상한 초과 시 군집화. (45건/페이지 상한·중복 제거로 1차 보호. 클러스터링은 후속.)
- ❌ 카테고리 필터 칩(한식/카페만 보기 등) — 전체 FD6만. UI 필터는 후속.
- ❌ nearby 핀 → 음식점 상세/길찾기/전화. 카드는 정보 표시만.
- ❌ Realtime·폴링. 조회는 **viewport 변경 이벤트에만** 반응(자동 갱신 없음).
- ❌ 슬라이스 1 동작 변경(현재위치·내 먹로그 핀·선택 카드·권한 흐름). 회귀 0 유지.
- ❌ 영구 캐시(디스크/AsyncStorage). 캐시는 **세션 인메모리**만(usePlaceSearch 동일).

---

## 3. 데이터 · API 계약

### 3.1 테이블/컬럼 변경
- **없음.** nearby 음식점은 DB에 저장하지 않는다(표시 전용). `muklogs`/`muklog_photos` 불변.

### 3.2 Edge Function — **신규 `nearby-search`** (§9.1 확정)
> bbox 기반 카테고리(FD6) 조회. 기존 `place-search`(keyword.json `{query}`)와 **요청·응답 shape가 달라** 한 함수에 합치면 분기 복잡도가 커진다 → 신규 함수. `place-search`는 **무변경**. REST 키 시크릿 `KAKAO_REST_API_KEY`는 **재사용**(클라 노출 0 유지).

- **엔드포인트**: `supabase.functions.invoke('nearby-search', { body: {...} })`
- **요청 본문**(camelCase):
  ```ts
  {
    sw: { lat: number; lng: number },   // 남서(min) 코너
    ne: { lat: number; lng: number }    // 북동(max) 코너
  }
  ```
- **Kakao 호출**: `category.json?category_group_code=FD6&rect=minX,minY,maxX,maxY&size=15`
  - **rect 순서 = `lng_min,lat_min,lng_max,lat_max`**(Kakao: x=lng, y=lat). `sw.lng,sw.lat,ne.lng,ne.lat`.
  - `size=15`(1페이지). **페이지네이션 금지**(`page` 파라미터 미사용). Kakao rect 카테고리 검색 최대 45건이나 1페이지 15건으로 캡(비용 가드레일).
- **응답 본문**(camelCase, 성공 200):
  ```ts
  { results: NearbyPlaceItem[] }   // 0건이면 results:[]
  ```
  ```ts
  type NearbyPlaceItem = {
    kakaoPlaceId: string;     // Kakao documents[].id
    placeName: string;        // place_name
    categoryName: string;     // category_name (브레드크럼)
    categoryGroupCode: string;// 항상 'FD6'(요청 제약) — 정규화에 보존
    lat: number;              // y → number
    lng: number;              // x → number
    distance: number | null;  // documents[].distance(문자열 m) → number. rect 검색은 center 없으면 빈 문자열 → null
  }
  ```
  > `place-search`의 `PlaceSearchItem`과 **별도 타입**(주변은 address/road/phone 불필요, distance 추가). 정규화 함수 `normalizeNearbyDocuments` 신설(place-search의 `normalizeKakaoDocuments` 미러, 필드 축소 + distance).
- **에러 계약**(place-search와 동일 토큰 체계):
  | status | error 토큰 | 트리거 |
  |--------|-----------|--------|
  | 400 | `BOUNDS_REQUIRED` | sw/ne 누락·NaN·min>max(역전 bbox) |
  | 500 | `KAKAO_KEY_MISSING` | `KAKAO_REST_API_KEY` 미설정 |
  | 502 | `KAKAO_REQUEST_FAILED` | Kakao 네트워크 실패/!ok/비정상 본문 |
  - 클라(`searchNearby`)가 토큰을 식별 → 실패 시 **핀만 비우고 지도는 유지**(차단 아님). `errors.ts`에 `BoundsRequired` 토큰 추가.
- **인증**: place-search와 동일 정책(인증 사용자만 호출 — 쿼터 보호). config.toml 부재이므로 배포 기본값 따름(dev-notes에 verify_jwt 정책 기록).
- **CORS·jsonResponse·핸들러 분리 export**: place-search 패턴 그대로(Deno 테스트로 fetch/env 모킹 단위 검증).

> ⚠️ **Deno 런타임**(앱 jest/tsc 대상 아님, tsconfig exclude). 실 검증은 `supabase functions serve` + 디바이스 스모크. 단위 테스트는 `normalizeNearbyDocuments`·`handleNearbySearch`(핸들러)만 Deno 테스트(이 프로젝트는 Deno 테스트 미구동 → 핸들러 로직은 클라 측 모킹으로 계약만 검증, place-search 선례 동일).

### 3.3 MapMarker 계약 변경 (`saved: true` → `saved: boolean`) — §9.3 확정
```ts
// 변경 전(slice1)
export type MapMarker = { id; lat; lng; emoji; saved: true };
// 변경 후(slice2)
export type MapMarker = {
  id: string;     // saved=muklogId / nearby=kakaoPlaceId
  lat: number;
  lng: number;
  emoji: string;
  saved: boolean; // true=내 맛집(primary) / false=주변 음식점(mapNearbyPin)
};
```
- **영향 최소화**: `pinsToMapMarkers`는 `saved: true`를 **그대로 유지**(리터럴 true는 boolean에 할당 가능 → 시그니처/구현 무변). 기존 `pinsToMapMarkers.spec.ts`의 `saved:true` 단언도 그대로 통과(회귀 0). 변경은 **타입 폭만 넓힘**.
- 신규 `nearbyToMapMarkers`만 `saved: false`를 생산.

### 3.4 신규 순수 유틸 (단위 테스트 1급 대상)
```ts
// boundsToRect — BOUNDS_CHANGED의 sw/ne → Edge 요청 본문(검증 포함).
//   역전 bbox(min>max)·NaN·동일점은 호출측(useNearbyPlaces)이 가드. 직렬화 단위 고정.
boundsToRect({ sw: Coords; ne: Coords }): { sw: Coords; ne: Coords }
type Coords = { lat: number; lng: number }   // 기존 types.ts 재사용

// nearbyToMapMarkers — NearbyPlaceItem[] → MapMarker[] (saved:false).
//   emoji = mapKakaoCategory(categoryName, groupCode) → categoryEmoji, 미매핑/null이면 PIN_FALLBACK_EMOJI 재사용.
//   id = kakaoPlaceId. 좌표 비유한(NaN/Infinity) 항목은 제외(지도 핀 보호 — placeFieldsFromItem 선례).
nearbyToMapMarkers({ items: NearbyPlaceItem[] }): MapMarker[]

// mergeMapMarkers — saved + nearby 머지 + 중복 제거.
//   규칙: saved 우선. saved 핀과 좌표 근접(epsilon)한 nearby는 제외(중복 핀 금지).
//        slice1 saved.id = muklogId(≠ kakaoPlaceId)이므로 id 비교 불가 → 좌표 근접 dedup으로 확정(§9.3).
mergeMapMarkers({ saved: MapMarker[]; nearby: MapMarker[] }): MapMarker[]
```
> **dedup 키 = 좌표 근접(epsilon) 확정(§9.3)**: saved 마커의 `id`는 `muklogId`라 nearby의 `kakaoPlaceId`와 직접 비교 불가하므로, saved 핀과 **좌표가 ~동일**(epsilon 1e-4 ≈ 11m, 정확 값은 테스트로 고정)한 nearby는 제외한다. 계약 변경 0·단순. 정확 dedup(`kakao_place_id` 매칭)은 후속 — `muklogs.kakao_place_id`는 이미 존재하므로 `list_my_muklog_pins` RPC에 컬럼만 추가하면 됨(이번 OUT).

### 3.5 신규 훅 — `useNearbyPlaces` (viewport 디바운스 + 캐시 + 임계)
```ts
useNearbyPlaces(): {
  setBounds: (next: { sw: Coords; ne: Coords }) => void;  // BOUNDS_CHANGED 수신 시 호출
  markers: MapMarker[];                                   // nearby 마커(saved:false). 실패/빈 → []
  status: 'idle' | 'loading' | 'ready' | 'error';
}
```
- **비용 가드레일(핵심)** — usePlaceSearch 패턴 계승:
  - **디바운스 `NEARBY_DEBOUNCE_MS` = 500**(지도 연속 이동 중 과호출 차단). 타이핑보다 느린 제스처라 350보다 약간 길게.
  - **동일 bbox 캐시**: bbox를 **양자화 키**(소수 4자리 반올림 등)로 정규화 → 캐시 히트 시 invoke **0회**. 인메모리 `Map<string, MapMarker[]>`.
  - **최소 이동 임계 `NEARBY_MIN_MOVE`**: 직전 조회 bbox와 **중심 이동·줌(폭) 변화가 임계 미만**이면 미호출(미세 흔들림/관성 흡수). 임계는 bbox 폭의 일정 비율(예: 20%) 또는 중심 거리(예: ~50m) — 테스트로 고정.
  - **레이스 가드**: `requestSeqRef` 증가 → 늦게 온 stale 응답 폐기(usePlaceSearch 동일).
  - **에러는 status='error' + markers 유지/비움**: 핀만 영향, 지도·saved 핀·카드 불변(차단 아님).
- **생산자**: `searchNearby({ sw, ne })`(nearby-search invoke 래퍼, searchPlaces 미러).
- **소비자**: MapTabScreen(머지 후 SET_MARKERS 주입 + nearby 핀 탭 카드).

### 3.6 WebView ↔ JS SDK 메시지 계약 — **신설 1종 + 기존 보존**
- **WebView → RN (`onMessage`) — 신설**:
  - `{ type: 'BOUNDS_CHANGED'; sw: { lat; lng }; ne: { lat; lng } }`
    - 트리거: Kakao Map `idle` 이벤트(드래그·줌 종료 후 1회. `dragend`+`zoom_changed` 대신 `idle`로 통합 — 연속 이벤트 1회 수렴). HTML `kakao.maps.event.addListener(mkMap, 'idle', ...)`.
    - 페이로드: `mkMap.getBounds()` → `getSouthWest()`/`getNorthEast()` (Kakao LatLng).
  - `MapInboundType`에 `BoundsChanged: 'BOUNDS_CHANGED'` 추가. `MapInboundMessage` 유니온에 `{ type; sw; ne }` 추가.
  - `parseMapMessage`에 분기 추가: sw/ne가 `{lat:number,lng:number}` 형태일 때만 통과, 아니면 null 흡수(잡음 방어).
- **기존 보존**: `READY`/`MARKER_TAP`/`ERROR`, `INIT`/`SET_MARKERS` 전부 불변. nearby 핀은 **`SET_MARKERS`로 머지된 전체 마커**를 다시 주입(slice1 경로 재사용 — 신규 outbound 메시지 불필요).
  - **MARKER_TAP에 `saved: boolean` 동봉(확정)**: 현재 `MARKER_TAP{id}`만 와서 saved(muklogId) vs nearby(kakaoPlaceId) 구분 불가 → `{ type:'MARKER_TAP'; id; saved: boolean }`로 확장. HTML `renderMarkers`가 `m.saved`를 클릭 페이로드에 실음. `MapInboundMessage`·`parseMapMessage` 갱신, **`saved`는 필수 boolean**(slice1 HTML도 saved를 동봉). 누락 시 `parseMapMessage`가 null로 흡수.

### 3.7 HTML(`mapHtml.ts`) 변경
- `.mk-pin` 단일 스타일 → **saved 분기**: `m.saved ? border #3366FF : border #B6ABA0`(웜그레이). CSS 클래스 `.mk-pin--nearby` 추가 또는 인라인 border-color.
  > 비주얼 토큰(주변 핀 색)은 ui-publisher가 킷 정합으로 마감. HTML 격리 환경이라 hex 직박힘(slice1 선례 — `#3366FF` 이미 직박힘). `mapNearbyPin #B6ABA0`도 동일하게 HTML에 직박힘(ui-spec 기록).
- `renderMarkers` 클릭 핸들러: `post({ type:'MARKER_TAP', id: m.id, saved: m.saved })`.
- `idle` 리스너 추가 → `post({ type:'BOUNDS_CHANGED', sw, ne })`. **INIT 직후 1회**도 발화(첫 화면 viewport 핀 로딩 트리거). ⚠️ `setCenter`/`relayout`이 유발하는 idle도 발화하므로 RN 측 디바운스/임계가 과호출을 흡수(가드레일이 HTML이 아닌 RN에 있음 — 단일 지점).

---

## 4. 화면 · UX

킷 단일 출처: `templates/muklog/mk-home.jsx` `MapScreen`(범례 "주변 음식점" 칩은 slice1에서 이미 렌더 — 이번에 핀이 실제로 채워짐).

| 컴포넌트 | 역할 | 변경 |
|---------|------|------|
| `MapTabScreen` | saved+nearby 머지 → SET_MARKERS 주입, BOUNDS_CHANGED→setBounds, MARKER_TAP.saved 분기 → 카드 선택 | 배선 증분 |
| 지도뷰(HTML) | saved/nearby 핀 색 분기 + idle→BOUNDS_CHANGED + MARKER_TAP.saved | HTML 증분 |
| `SelectedSpotCard`(saved) | 기존: placeName·별점·카테고리·area | 불변 |
| **`NearbySpotCard`(신규)** | nearby 탭 시 하단: placeName·카테고리 라벨·거리("320m"/거리없으면 생략). 별점/area/heart 없음 | 신규 |
| `MapLegend` | "우리 맛집"(primary)/"주변 음식점"(mapNearbyPin) | 불변(핀이 실제로 채워짐) |

**카드 분기 규칙**(MapTabScreen):
- `MARKER_TAP{ saved:true, id }` → `pins.find(id)` → `SelectedSpotCard`(기존).
- `MARKER_TAP{ saved:false, id }` → nearby 결과에서 `kakaoPlaceId===id` lookup → `NearbySpotCard`(신규).
- 선택 상태는 `{ id, saved }` 쌍으로 보관(같은 좌표 saved/nearby 충돌 방지).

**거리 표기**: `distance` 있으면 `1000m 미만 "{n}m" / 이상 "{km}km"`(순수 포맷 유틸 `formatDistance` 신설, 단위 테스트). null이면 거리 조각 생략.

**상태**:
- nearby **로딩**: saved 핀·카드·지도 전부 유지. 별도 차단 오버레이 없음(슬라이스 1 상태 오버레이 우선순위 유지 — nearby 로딩은 조용히). 선택 시 작은 인디케이터는 ui-publisher 판단.
- nearby **빈(results:[])**: 그 viewport에 음식점 0 → nearby 핀 0, 정상. 안내 없음.
- nearby **에러**: 핀만 비움(또는 직전 유지), 지도·saved 불변. slice1 에러 오버레이를 덮지 않음.

---

## 5. 작업 목록 (각 인수조건 포함)

> T = 테스트 한 줄(§5-1 상세). 슬라이스 1 회귀 0이 전제(`npm test` 전수 green 유지).

- [ ] **`MapMarker` 계약 확장** — `saved: true`→`saved: boolean`. — 인수조건: `pinsToMapMarkers`(saved:true) 무변경 통과, `tsc` green, 기존 spec green. — T: 기존 `pinsToMapMarkers.spec` 회귀 + 타입 폭 확인.
- [ ] **`BOUNDS_CHANGED` 메시지 계약** — `MapInboundType.BoundsChanged` + 유니온 + `parseMapMessage` 분기. — 인수조건: 유효 sw/ne JSON→메시지, sw/ne 누락·비수치→null. — T: parseMapMessage 정상/누락/비JSON.
- [ ] **`MARKER_TAP` saved 필드 추가** — `{id, saved:boolean}`(필수). — 인수조건: saved true/false 파싱, saved 누락/비boolean → null 흡수. — T: parseMapMessage MARKER_TAP saved 분기.
- [ ] **`boundsToRect` 유틸** — 인수조건: sw/ne → 그대로 검증·통과, 역전(min>max)·NaN은 호출측 가드(유틸은 직렬화/패스스루만 — 책임 경계 명시). — T: 정상 + 경계.
- [ ] **`nearbyToMapMarkers` 유틸** — 인수조건: 각 item→`{id:kakaoPlaceId,lat,lng,emoji,saved:false}`, emoji=mapKakaoCategory→categoryEmoji(미매핑 폴백), 좌표 비유한 항목 제외, 빈→빈. — T: 매핑·폴백·NaN 제외·빈 배열.
- [ ] **`mergeMapMarkers` 유틸** — 인수조건: saved+nearby 합치되 saved와 좌표 근접(epsilon) nearby 제외, saved 우선, 비겹침은 모두 포함. — T: 중복 제거(좌표 근접)·비겹침 유지·빈 배열·epsilon 경계.
- [ ] **`formatDistance` 유틸** — 인수조건: <1000 "{n}m", ≥1000 "{km}km"(소수1), null→''. — T: 경계(0·999·1000·1500)·null.
- [ ] **`searchNearby` invoke 래퍼** — 인수조건: invoke('nearby-search',{body:{sw,ne}})→results; error 토큰(BOUNDS_REQUIRED/KAKAO_*)→throw 정규화; 네트워크 reject→실패 토큰. — T: 성공/각 에러 토큰/네트워크(supabase.functions.invoke 모킹).
- [ ] **`useNearbyPlaces` 훅(디바운스·캐시·임계·레이스)** — 인수조건: setBounds 후 디바운스 1회 호출; 디바운스 내 다중 setBounds→1회만; 동일(양자화) bbox 재호출 0(캐시); 최소 이동 미만→미호출; stale 응답 폐기; 에러→status error·markers 정책. — T: fake timers + searchNearby 모킹(다중 이동 1회·캐시 0·임계·stale·에러).
- [ ] **`nearby-search` Edge Function** — 인수조건: sw/ne→rect(lng,lat 순서)+FD6+size15 Kakao 호출, camelCase 정규화 distance 포함, 0건→results:[], BOUNDS_REQUIRED/KAKAO_KEY_MISSING/KAKAO_REQUEST_FAILED 에러, **키 응답 미노출**, page 파라미터 미사용. — T: Deno 핸들러(fetch/env 모킹) — 단위 미구동 환경이라 normalizeNearbyDocuments는 클라 측 계약 모킹으로 보강 + `supabase functions serve` 스모크.
- [ ] **HTML(`mapHtml`) 증분** — 인수조건: saved 분기 border 색, idle→BOUNDS_CHANGED(sw/ne) post(INIT 직후 1회 포함), MARKER_TAP에 saved 동봉. — T: mapHtml 문자열 포함 검증(border-color·BOUNDS_CHANGED·saved 키)·디바이스 스모크.
- [ ] **`NearbySpotCard` 컴포넌트** — 인수조건: placeName·카테고리 라벨·거리 렌더, 거리 null 시 거리 생략, 별점/area/heart 없음. — T: render 텍스트 단언(거리 유/무).
- [ ] **`MapTabScreen` 배선 증분** — 인수조건: BOUNDS_CHANGED→setBounds; saved+nearby 머지→SET_MARKERS 주입; MARKER_TAP.saved=true→SelectedSpotCard / false→NearbySpotCard; nearby 에러가 slice1 오버레이/카드 안 깨뜨림. — T: render + 훅 모킹(메시지 디스패치·머지 주입·카드 분기·회귀).
- [ ] **라이브 스모크 체크리스트(dev-notes)** — 인수조건: `npm run ios:sim`에서 지도 이동→주변 핀(웜그레이) 등장, 디바운스 체감(연속 이동 후 1회), saved/nearby 색 구분, nearby 탭→거리 카드, 동일 영역 재방문 시 네트워크 0(캐시) 확인. — T: 디바이스 스모크.

## 5-1. 테스트 케이스 (TDD)

> 단위 대상(✅): 유틸 5종·훅 1종·메시지 파싱·카드·MapTabScreen. 모킹/스모크(△/❌): Kakao Local·Edge Function·실 지도 idle·네이티브 렌더.

**`parseMapMessage` (✅ 단위)** — 기존 + 증분
- BOUNDS_CHANGED 정상(sw/ne 수치) → 메시지. sw 누락/비수치 → null.
- MARKER_TAP saved:true/false → 보존. saved 누락/비boolean → null 흡수(HTML이 항상 동봉).
- 기존 READY/MARKER_TAP(saved 추가)/ERROR/비JSON 회귀.

**`boundsToRect` (✅ 단위)**
- 정상: sw/ne 통과. (역전/NaN 가드는 useNearbyPlaces 책임 — 유틸은 패스스루임을 테스트로 명시.)

**`nearbyToMapMarkers` (✅ 단위)**
- 정상: FD6 '음식점>한식' item → noodle 이모지, saved:false, id=kakaoPlaceId.
- 경계: categoryName 불명확 → 폴백 이모지.
- 경계: lat NaN/Infinity item → 제외(결과에서 빠짐).
- 경계: 빈 배열 → 빈 배열.

**`mergeMapMarkers` (✅ 단위)**
- 정상: saved 2 + nearby 3(겹침 0) → 5개, saved 색/ nearby 색 보존.
- 중복: nearby 1개가 saved와 좌표 근접(epsilon 내) → 제외(saved 우선) → 결과 4개.
- 경계: epsilon 경계 바깥(살짝 멀면) → 둘 다 유지.
- 경계: saved 빈 → nearby 그대로. nearby 빈 → saved 그대로.

**`formatDistance` (✅ 단위)**
- 0→"0m", 999→"999m", 1000→"1km", 1500→"1.5km", null→"".

**`searchNearby` (✅ 단위, supabase.functions.invoke 모킹)**
- 정상: { results:[...] } → 그대로. 0건 → [].
- 에러: { error:'BOUNDS_REQUIRED' } / KAKAO_KEY_MISSING / KAKAO_REQUEST_FAILED → 토큰 throw.
- 네트워크: invoke reject → 실패 토큰 throw.

**`useNearbyPlaces` (✅ 단위, fake timers + searchNearby 모킹) — 비용 가드레일 강제**
- 정상: setBounds → 500ms 후 1회 호출 → markers ready.
- **디바운스**: 디바운스 창 내 setBounds 3회 → searchNearby **1회만** 호출(마지막 bbox).
- **캐시**: 동일(양자화) bbox 재 setBounds → searchNearby **0회 추가**(히트).
- **최소 이동 임계**: 직전 bbox에서 임계 미만 이동 → **미호출**.
- 임계 이상 이동 → 호출.
- stale: 응답 도착 전 새 bbox → 늦은 응답 폐기(markers 최신만).
- 에러: searchNearby reject → status error, markers 정책(빈/직전 유지) 고정.

**`NearbySpotCard` (✅ 단위)**
- 거리 있음 → placeName·카테고리·"{n}m" 렌더.
- 거리 null → 거리 조각 없음.

**`MapTabScreen` (✅ 단위, 훅·지도뷰 모킹) — 증분 + 회귀**
- BOUNDS_CHANGED 메시지 → useNearbyPlaces.setBounds 호출(인자=sw/ne).
- saved+nearby 머지 → SET_MARKERS injectJavaScript에 머지 마커 포함.
- MARKER_TAP saved:true → SelectedSpotCard(placeName 단언). saved:false → NearbySpotCard(거리 단언).
- 회귀: slice1 로딩/권한거부/에러 오버레이·saved 카드 불변.
- nearby 에러 시 slice1 오버레이/카드 안 깨짐.

**모킹/스모크 (❌ 단위 아님 — 디바이스/serve)**
- 실 Kakao category.json rect 응답·distance·45건 상한 → `supabase functions serve` + 디바이스 스모크.
- 실 지도 idle 발화 타이밍·연속 이동 디바운스 체감·캐시 네트워크 0 → `npm run ios:sim` 스모크.
- nearby 핀 색(웜그레이) 실제 렌더·saved와 구분 → 디바이스 스모크.

---

## 6. 엣지케이스

- **빈 viewport**: 음식점 0 영역(바다·산) → nearby 핀 0, 정상. saved 핀은 유지.
- **광역 줌아웃**: 매우 넓은 bbox → Kakao 45건/15건 캡으로 일부만. 클러스터링 OUT → 핀 밀집 허용(슬라이스 2 표시까지). **전체조회/페이지네이션 금지**(size 캡으로 강제).
- **연속 이동(관성/플링)**: idle 다중 발화 → RN 디바운스+임계가 1회로 수렴(테스트 강제). HTML은 idle 그대로 보냄(가드레일 단일 지점=RN).
- **미세 흔들림**: setCenter/relayout 유발 idle, 손가락 미세 이동 → 최소 이동 임계 미만이면 미호출(쿼터 보호).
- **동일 영역 왕복**: A→B→A 이동 시 A 재방문은 캐시 히트 → 호출 0.
- **saved↔nearby 중복**: 내 먹로그와 같은 음식점이 nearby에도 → 좌표 근접 dedup으로 nearby 제외(중복 핀 0). epsilon 경계는 테스트로 고정. (정확 dedup은 후속 — kakao_place_id 투영.)
- **역전/이상 bbox**: WebView가 보낸 sw>ne(이론상 드묾) → useNearbyPlaces가 1차 가드(미호출), Edge는 2차 BOUNDS_REQUIRED(쿼터 보호).
- **nearby 네트워크 실패**: 핀만 비움/직전 유지, 지도·saved·카드 불변(차단 아님). 재시도는 다음 이동 시 자연 재호출(별도 버튼 없음).
- **권한 거부와 무관**: nearby는 현재위치 불필요(viewport 기준). 권한 거부여도 지도 이동하면 nearby 동작(slice1 bbox 중심에서 시작).
- **거리(distance) 결측**: rect 검색은 center 없으면 distance 빈 → null → 카드에서 거리 생략(깨짐 방지).
- **동시성(커플 2명)**: nearby는 사용자별 독립(공유 상태 아님). saved 핀만 양쪽 공유(slice1, Realtime OUT). 충돌 없음.
- **MARKER_TAP id 충돌**: saved와 nearby가 우연히 같은 문자열 id → `saved` 플래그로 분기(id 단독 lookup 금지). 선택 상태 `{id,saved}` 쌍.
- **마커 폭증 성능**: viewport당 ≤15 nearby + saved N → WebView 마커 부담 제한적. 줌아웃 밀집은 표시 허용(클러스터링 후속).
- **첫 진입 트리거**: INIT 직후 idle 1회 발화 → 초기 viewport nearby 로딩. 없으면 첫 화면 nearby 비어 보임 → INIT 후 발화 필수(테스트/스모크 확인).

---

## 7. QA 교차검증 경계면

| 생산자 | 소비자 | 검증 포인트 |
|--------|--------|------------|
| 지도뷰 `BOUNDS_CHANGED{sw,ne}` | `parseMapMessage` → `MapTabScreen` → `useNearbyPlaces.setBounds` | sw/ne 형태·디스패치·setBounds 인자 일치 |
| `useNearbyPlaces` 디바운스/캐시/임계 | `searchNearby` invoke 호출 횟수 | 다중 이동 1회·동일 bbox 0·임계 미만 0(비용 가드레일 핵심) |
| `nearby-search` Edge `{results}`(camel, distance) | `searchNearby`/`nearbyToMapMarkers` | 필드명·타입 1:1, distance null 처리, rect(lng,lat) 순서 |
| `nearbyToMapMarkers`(saved:false) + `pinsToMapMarkers`(saved:true) | `mergeMapMarkers` | 색 분기 보존·중복 제거(좌표 근접)·id 출처(muklogId vs kakaoPlaceId) |
| `mergeMapMarkers` 결과 | 지도뷰 SET_MARKERS | 머지 마커 전체 재주입·saved 색 분기 직렬화 |
| 지도뷰 `MARKER_TAP{id,saved}` | `MapTabScreen` 카드 분기 | saved=true→SelectedSpotCard / false→NearbySpotCard, id 충돌 시 saved로 분기 |
| `mapKakaoCategory`/`categoryEmoji`(기존) | `nearbyToMapMarkers` emoji | 기존 매핑 재사용(중복 정의 금지) |
| `KAKAO_REST_API_KEY` 시크릿 | `nearby-search` | 응답·클라 번들에 키 미노출(place-search 원칙 보존) |
| slice1 자산(`pinsToMapMarkers`·`initialRegion`·MapTabScreen 오버레이) | slice2 증분 | 회귀 0(`MapMarker` 폭 확장이 기존 spec 안 깸) |

---

## 8. 비용 가드레일 체크 (architecture §6)

- ✅ **AWS 미사용** — nearby는 Kakao Local(Edge 프록시) + 클라. 신규 AWS 0.
- ✅ **viewport 기반 + 전체조회 금지** — bbox(rect)로만 조회, `size=15`·`page` 미사용(페이지네이션 금지). **테스트로 강제**(§5-1).
- ✅ **디바운스(500ms) + 동일 bbox 캐시 + 최소 이동 임계** — 연속 이동 1회·재방문 0·미세 이동 0. usePlaceSearch 패턴 계승, **테스트로 강제**.
- ✅ **REST 키 노출 0** — `KAKAO_REST_API_KEY`는 Edge Function 시크릿만. 응답/번들 미노출(place-search 원칙).
- ✅ **인증 호출만** — nearby-search도 인증 사용자만(쿼터 보호, place-search 정책 계승).
- ✅ **DB 미저장** — nearby 음식점은 표시 전용(Storage/Postgres 쓰기 0).
- ✅ **인증 정책 = place-search 동일**: config.toml 부재 → 배포 시 verify_jwt를 place-search와 동일 정책으로 맞춘다(dev-notes에 기록).

---

## 9. 핵심 의사결정 (확정 — 오케스트레이터/사용자, 2026-06-15. 9.1~9.4는 대안 비교 보존 = 감사 추적용)

### 9.1 Edge Function: 기존 확장 vs 신규 — **확정: 신규 `nearby-search`**
| 안 | 장점 | 단점 |
|----|------|------|
| **A. `place-search` 확장**(rect/category 분기) | 함수 1개 유지·배포 단순 | 요청(`{query}` vs `{sw,ne}`)·응답(address/phone vs distance) shape가 달라 **분기 복잡도↑**, 에러 토큰 혼재, 테스트 커짐 |
| **B. 신규 `nearby-search`** ✅ | 단일 책임(bbox+FD6), 요청/응답/에러 깔끔, place-search 무변경(회귀 0), 시크릿 재사용 | 함수 1개 추가(배포 1회) |
- **확정 = B**. Kakao `category.json?category_group_code=FD6&rect=sw.lng,sw.lat,ne.lng,ne.lat&size=15`, **page 미사용**. REST 키 시크릿 `KAKAO_REST_API_KEY` 재사용(신규 시크릿 0). 에러계약은 place-search 스타일 준용(`KAKAO_KEY_MISSING`/`KAKAO_REQUEST_FAILED` + bbox 필수 검증 `BOUNDS_REQUIRED`). place-search는 손대지 않아 muklog-place 회귀 위험 0.

### 9.2 viewport→조회 트리거 & 가드레일 — **확정**
- 트리거: WebView Kakao Map **`idle`** 이벤트(드래그·줌 종료 + 연속 이벤트 수렴) → `BOUNDS_CHANGED{sw,ne}` inbound → RN.
- **가드레일은 RN 단일 지점**(`useNearbyPlaces`): 디바운스 500ms + 양자화 bbox 캐시(재방문 0) + 최소 이동 임계 + 레이스 가드. HTML은 idle을 그대로 보내고(단순), 과호출 억제는 RN이 전담. **전체조회·페이지네이션 금지(size 캡)**, 비용 인수조건은 테스트로 강제(§5-1·§8).
- INIT 직후 idle 1회 발화로 첫 viewport 핀 로딩.

### 9.3 saved↔nearby 머지·dedup & MapMarker 계약 — **확정**
- `MapMarker.saved`를 `true`→`boolean`으로 **폭만 확장**(`pinsToMapMarkers`는 리터럴 `true` 유지 → 회귀 0). 신규 `nearbyToMapMarkers`가 `false` 생산.
- dedup = **좌표 근접(epsilon)** 확정(saved.id=muklogId ≠ nearby.id=kakaoPlaceId라 id 비교 불가, 계약 변경 0·단순). 정확 dedup(kakao_place_id 매칭)은 후속 — `muklogs.kakao_place_id` 컬럼 존재하므로 `list_my_muklog_pins` RPC에 컬럼만 추가하면 됨(이번 OUT).
- `MARKER_TAP`에 `saved:boolean` 동봉 → MapTabScreen이 saved=true→`SelectedSpotCard` / false→`NearbySpotCard` 분기.

### 9.4 nearby 핀 탭 UX — **확정: 정보 표시만(작성 진입 OUT)**
- `NearbySpotCard`(이름·카테고리·거리)까지. "먹로그로 추가"(MuklogEditor 프리필) 진입은 **후속 슬라이스**(§2 Out 명시). 이번 슬라이스 단일 기능 유지.

---

## 10. 핸드오프

- **결정 게이팅**: §9 4건 모두 **락인 완료**(2026-06-15). ui-publisher/developer 착수 가능.
- **ui-publisher**: nearby 핀 색(킷 `mapNearbyPin #B6ABA0`) HTML 분기 정합 + `NearbySpotCard`(킷 카드 톤, 거리 표기) 비주얼. 범례는 slice1 그대로(핀이 채워짐).
- **developer**: §3 계약(신규 메시지·유틸·훅·Edge Function) + §5/§5-1 TDD. **비용 가드레일을 테스트로 강제**(디바운스·캐시·임계·페이지네이션 금지). slice1 회귀 0.
- **qa-logic**: §7 경계면 + §8 비용 가드레일(호출 횟수 테스트) + REST 키 미노출 + slice1 회귀.
- **qa-visual**: nearby 핀 색 구분·카드 충실도(킷 정합) + 디바이스 스모크.
- **후속(OUT, 명시)**: ① nearby 카드→먹로그 추가(MuklogEditor 프리필), ② 정확 dedup(RPC에 kakao_place_id 투영), ③ 카테고리 필터 칩, ④ 클러스터링.
