# Sprint: map-tab (지도 탭) — 슬라이스 1: 지도 셸 + 현재위치 + 내 먹로그 핀

> 백로그 `map-tab`(architecture.md §5, 요구 #5·#6)이 한 스프린트(1기능)에 **과대**하다고 판단해 슬라이스 2개로 분해한다.
> **이번 스프린트 = 슬라이스 1만**. 슬라이스 2(일반 음식점 viewport 핀)는 다음 스프린트로 분리(§2 Out-of-scope, §9 슬라이싱 권고).
> 본 plan은 **계약·작업·테스트만** 정의한다. 비주얼 정합(킷 `templates/muklog` mk-home.jsx `MapScreen`)은 ui-publisher 몫.
>
> ✅ **확정(오케스트레이터/사용자, 2026-06-14)**: ① 라이브러리 = **WebView + Kakao Map JS SDK**(`react-native-webview`) — 네이티브 Kakao SDK(선택지 A) 폐기. ② 범위 = **슬라이스 1만**(일반 음식점 viewport 핀은 다음 스프린트 `map-tab-nearby`). ③ **Kakao JavaScript 키 발급 완료** → 이번 스프린트에서 **라이브 지도 렌더링 검증까지 목표**. 근거·대안 비교는 §9.

---

## 1. 기능 한줄 정의

지도 탭에 들어가면 **현재 내 위치를 중심으로 한 실제 지도**가 뜨고, 내가 속한 모든 로그의 먹로그 중 **좌표가 있는 것(`lat is not null`)이 핀**으로 찍히며, 핀을 탭하면 하단에 그 먹로그 요약 카드가 뜬다.

---

## 2. 범위

### In-scope (슬라이스 1)
- 지도 탭 화면을 정적 셸(현재 `MapTabScreen` 플레이스홀더)에서 **실제 지도 렌더링**으로 교체.
- **현재 위치** 권한 요청 + 현재 위치 마커 + 초기 카메라 센터링.
- **내 먹로그 핀**: 내가 속한 **모든 로그**의 먹로그 중 `lat/lng is not null`만 핀으로 표시(크로스-로그 통합).
- 핀 탭 → 하단 **선택 스팟 카드**(가게명·별점·카테고리·area). 카드의 데이터는 핀 페이로드에서 직접 온다(추가 조회 없음).
- 빈/거부/실패 상태 처리(아래 §4·§6).
- 순수 로직(핀 변환 유틸·권한 훅·로그 통합 조회 훅)은 단위 테스트, 네이티브 지도 렌더는 디바이스 스모크로 분리.

### Out-of-scope (의도적 — 다음 스프린트/슬라이스)
- ❌ **일반 음식점(Kakao Local) viewport 핀** → **슬라이스 2 (`map-tab-nearby`)**. viewport 디바운스/카테고리 검색/핀 머지 전부 슬라이스 2.
- ❌ **네이티브 Kakao Map SDK config plugin 자작** — 슬라이스 1은 빌드 리스크 최소화를 위해 회피(§9 권고). 도입 시 별도 인프라 스프린트.
- ❌ 핀 클러스터링, 핀 → 먹로그 상세(MuklogDetail) 네비게이션, 길찾기, 지도 검색바.
- ❌ Realtime 핀 갱신(파트너가 추가 시 즉시 반영). 진입 1회 조회 + 명시적 refresh만(비용 가드레일 §8).
- ❌ 좌표 없는(수동입력) 먹로그를 지도에 노출(설계상 `lat is not null`만 핀 — architecture §3).
- ❌ 먹로그 작성/편집 흐름 변경(map-tab은 읽기 전용).

---

## 3. 데이터 · API 계약

### 3.1 테이블/컬럼 변경
- **없음.** 기존 `muklogs.lat/lng`(double precision, nullable, muklog-place에서 채움) + `place_name`/`category`/`area`/`rating`만 사용.

### 3.2 신규 RPC: `list_my_muklog_pins()` (SECURITY DEFINER)
크로스-로그 핀 통합 조회. 내가 멤버인 **모든 로그**의 먹로그 중 좌표 있는 것만 반환.

- **이유 — RLS만으론 부족하지 않으나, 명시 RPC로 계약을 고정**: `muklogs` select RLS는 이미 `room_id IN (내 방)`이라 클라 직접 select도 가능. 그러나 (a) viewport/전체 조회 정책을 서버에 못 박고, (b) 좌표 null 필터·필요 컬럼만 투영해 전송량을 줄이며, (c) 슬라이스 2에서 viewport bbox 파라미터를 추가할 자리를 마련하기 위해 RPC로 둔다. **DEFINER 불필요 시 INVOKER + RLS로도 가능** — developer가 RLS 직접 select로 구현해도 무방(계약 shape만 동일하면 됨). 단일 출처는 아래 shape.
- **시그니처(슬라이스 1)**: 무인자. (슬라이스 2에서 `p_min_lat/p_max_lat/p_min_lng/p_max_lng` bbox 인자 추가 예정 — 지금은 추가 금지.)
- **반환 행(snake_case)** — 좌표 있는 행만(`lat is not null and lng is not null`):

```
muklog_id    uuid
room_id      uuid
place_name   text
category     text     (nullable, CAT key)
area         text     (nullable)
rating       smallint (nullable, 1~5)
lat          double precision  (NOT NULL — 필터됨)
lng          double precision  (NOT NULL — 필터됨)
```

> **대표 사진/커버는 핀에 싣지 않는다**(슬라이스 1 카드는 가게명·별점·카테고리·area만 — 킷 `MapScreen` 선택 스팟 카드 정합, FoodCover 이모지 폴백). signed URL N장 배치 발급은 비용·복잡도 증가 → OUT. 커버 썸네일은 추후.

### 3.3 프론트 훅 시그니처

```ts
// useMuklogPins — 내 모든 로그의 좌표 있는 먹로그 핀 1회 조회 (useMyLogs 패턴 계승: 진입 1회 + refresh).
useMuklogPins(): { state: MuklogPinsState; refresh: () => Promise<void> }

type MuklogPinsState =
  | { status: 'loading' }
  | { status: 'ready'; pins: MuklogPin[] }   // pins:[] = 빈 상태(정상, 에러 아님)
  | { status: 'error'; message: string }

// 핀 1건(camelCase). RPC snake row를 toMuklogPin으로 매핑.
type MuklogPin = {
  muklogId: string
  roomId: string
  placeName: string
  category: string | null   // CAT key | null
  area: string | null
  rating: number | null     // 1~5
  lat: number               // 항상 유효(RPC가 null 필터)
  lng: number
}
```

```ts
// useLocationPermission — 현재위치 권한 요청·상태 (expo-location 래핑, 네이티브는 모킹/스모크).
useLocationPermission(): {
  status: LocationPermissionStatus  // 'undetermined' | 'requesting' | 'granted' | 'denied'
  coords: { lat: number; lng: number } | null  // granted일 때만 최종값, 아니면 null
  request: () => Promise<void>
}
type LocationPermissionStatus = 'undetermined' | 'requesting' | 'granted' | 'denied'
```

### 3.4 순수 변환/유틸 계약 (단위 테스트 1급 대상)

```ts
// toMuklogPin — RPC snake row → MuklogPin. (좌표 number 캐스팅·null 안전)
toMuklogPin({ row: MuklogPinRow }): MuklogPin

// pinsToMapMarkers — MuklogPin[] → 지도 라이브러리가 먹는 마커 페이로드.
//   slice1: saved=true 고정, color=primary, emoji=CAT 이모지(없으면 폴백 이모지).
pinsToMapMarkers({ pins: MuklogPin[] }): MapMarker[]
type MapMarker = { id: string; lat: number; lng: number; emoji: string; saved: true }

// initialRegion — 현재위치(있으면) 우선, 없으면 핀들의 bounding box 중심, 둘 다 없으면 기본(서울시청).
//   슬라이스 2의 viewport 계산 기반이 되는 순수 함수 → 단위 테스트로 경계 고정.
initialRegion({ coords, pins }: { coords: Coords | null; pins: MuklogPin[] }): Region
type Region = { lat: number; lng: number; zoom: number }  // zoom은 라이브러리 무관 정수 스케일

const DEFAULT_REGION: Region  // 서울시청 등 안전 기본값(현재위치·핀 모두 없을 때)
```

### 3.5 WebView ↔ JS SDK 메시지 계약 (확정)
> 라이브러리 **WebView + Kakao Map JS SDK** 확정(§9). RN↔WebView postMessage 계약을 아래로 고정한다.

- **RN → WebView (`injectJavaScript` 또는 `source` 초기 데이터)**:
  - `{ type: 'INIT'; center: Region; markers: MapMarker[]; me: Coords | null }`
  - `{ type: 'SET_MARKERS'; markers: MapMarker[] }` (refresh 후)
- **WebView → RN (`onMessage`)**:
  - `{ type: 'READY' }` (SDK 로드 완료 → RN이 INIT 전송)
  - `{ type: 'MARKER_TAP'; id: string }` (핀 탭 → RN이 selectedPin 설정)
  - `{ type: 'ERROR'; reason: string }` (SDK 로드/JS 키 실패 → RN이 에러 상태)
- **Kakao JS SDK 인증키(발급 완료)**: **JavaScript 키**(REST 키 아님)가 WebView HTML에 필요. 키는 발급돼 있어 이번 스프린트에서 **라이브 지도 렌더링 검증까지 목표**. REST 키와 달리 JS 키는 도메인 화이트리스트로 보호되는 공개키 성격이나, 번들 박힘 회피를 위해 **`app.config`/`extra` 또는 빌드 주입**으로 관리(이름만 명시: `KAKAO_JS_KEY`). plan/코드에 **키 값 미기록**. **카카오 개발자 콘솔 플랫폼에 WebView origin/스킴 도메인 화이트리스트 등록 필요**(예: 앱 로컬 HTML이 쓰는 origin — dev-notes에 절차 기록).

---

## 4. 화면 · UX

킷 단일 출처: `templates/muklog/mk-home.jsx` `MapScreen`(현재위치 점 + saved 핀 + 범례 + 선택 스팟 카드). 헤더("지도" 워드마크)는 HomeTabs의 HomeHeader가 제공(현 구조 유지).

| 컴포넌트 | 역할 |
|---------|------|
| `MapTabScreen`(교체) | 권한·핀·지도 상태 오케스트레이션. 지도뷰 + 범례 + 선택 스팟 카드 + 상태 오버레이 |
| 지도뷰(WebView + Kakao Map JS SDK) | 실제 지도 + 현재위치 마커 + 먹로그 핀. ui-publisher가 킷 비주얼로 정합 |
| 선택 스팟 카드 | 핀 탭 시 하단 등장: FoodCover(이모지) + placeName + 별점 + 카테고리 + area |
| 범례 칩 | "우리 맛집"(primary) / "주변 음식점"(슬라이스 1에선 표시만, 핀은 없음 — ui-publisher 판단) |

**상태**:
- **로딩**: 지도 로드 + 핀 조회 중 → 지도 영역 위 로딩 인디케이터(킷 셸 위 오버레이).
- **권한 미결정(undetermined)**: 진입 시 1회 권한 요청(`request()`). 카피: architecture §6 "위치 권한 카피" — 예 "근처 맛집을 지도에 보여주려면 위치 권한이 필요해요." (정확 카피는 ui-publisher/킷 정합.)
- **권한 거부(denied)**: 지도는 **여전히 표시**(현재위치 마커만 생략, 핀들의 bbox 중심으로 센터). "위치 권한을 허용하면 현재 위치를 볼 수 있어요" 안내(차단 아님).
- **빈 상태(pins:[])**: 지도는 뜨되 핀 0개. "좌표가 있는 먹로그가 아직 없어요" 류 안내(차단 아님 — 지도 자체는 유효). 좌표 없는 수동입력 먹로그는 의도적으로 미표시.
- **에러**: 핀 조회 실패(`status:'error'`) → 지도 위 토스트/배너 + 재시도. 지도 SDK 로드 실패(`ERROR` 메시지) → "지도를 불러오지 못했어요" + 재시도.
- **성공**: 지도 + 현재위치 + N개 핀. 첫 핀 자동선택 여부는 킷(`spots[0]`) 따름 — ui-publisher 정합(데이터 계약엔 영향 없음).

**원티드 토큰 지점**: 범례 칩(surface/full radius/caption), 선택 카드(card radius 16, 헤어라인), 핀 색(primary `#3366FF`), dot. 현재 셸의 토큰 사용을 계승.

---

## 5. 작업 목록 (각 인수조건 포함)

> 라이브러리 확정(§9) 후 착수. T = 테스트 한 줄(§5-1 상세).

- [ ] **의존성 추가** — `expo-location`(권한·현재위치) + `react-native-webview`(지도 렌더). — 인수조건: `npm test`·`tsc` 통과, app.json plugins에 `expo-location`(+ `locationWhenInUsePermission` 카피) 추가, iOS `NSLocationWhenInUseUsageDescription` 반영. — 테스트: 모킹된 expo-location으로 훅 테스트가 통과(직접 네이티브 테스트 없음).
- [ ] **`toMuklogPin` 유틸** — 인수조건: snake row(`muklog_id`/`lat:"37.5"` 등)를 camel `MuklogPin`으로 매핑, 좌표는 number, nullable 필드는 null 유지. — T: 정상 매핑 + null category/area/rating 보존.
- [ ] **`pinsToMapMarkers` 유틸** — 인수조건: 각 핀이 `{id,lat,lng,emoji,saved:true}` 마커로 변환, category→CAT 이모지(기존 categories.ts 재사용), 미매핑/ null이면 폴백 이모지. — T: CAT 매핑 + 폴백 + 빈 배열→빈 배열.
- [ ] **`initialRegion` 유틸** — 인수조건: coords 있으면 그 중심, 없고 핀 있으면 bbox 중심, 둘 다 없으면 `DEFAULT_REGION`. — T: 세 분기 + 핀 1개(bbox 0폭) + 핀 다수.
- [ ] **`useMuklogPins` 훅** — 인수조건: 마운트 1회 RPC/select 호출 → ready{pins}; 0행→ready{pins:[]}; 에러→error{message}; refresh() 재조회; 언마운트 후 setState 안 함. — T: renderHook + supabase 모킹(성공/빈/에러/언마운트).
- [ ] **`useLocationPermission` 훅** — 인수조건: undetermined→request()→granted 시 coords 채움; denied 시 coords null·status denied; 권한 모듈 throw 시 denied로 흡수(지도 차단 안 함). — T: renderHook + expo-location 모킹(grant/deny/throw).
- [ ] **`MapTabScreen` 교체(상태 오케스트레이션)** — 인수조건: loading/granted/denied/empty/error 각 상태에서 올바른 오버레이/안내 렌더; 핀 탭 메시지(`MARKER_TAP`/마커 onPress) 수신 시 선택 카드에 해당 먹로그 표시; refresh 동작. — T: render + 훅 모킹으로 상태별 렌더 + 마커 탭 핸들러 → 카드 텍스트 단언.
- [ ] **지도뷰 컴포넌트(WebView)** — 인수조건: READY 후 INIT 전송, SET_MARKERS로 핀 갱신, MARKER_TAP을 상위로 콜백, ERROR를 상위로 콜백. (네이티브 렌더 자체는 스모크.) — T: WebView onMessage 핸들러(메시지 파싱·디스패치)만 단위 + 디바이스 스모크.
- [ ] **Kakao JS SDK HTML 템플릿** — 인수조건: JS 키 주입, READY/MARKER_TAP/ERROR postMessage 송신, 마커 이모지 렌더. — T: HTML 생성 함수(키·마커 직렬화)만 단위(문자열 포함 검증), 실제 SDK는 스모크.
- [ ] **라이브 지도 렌더링 검증**(이번 스프린트 목표) — 인수조건: `npm run ios:sim`에서 실 Kakao 지도 타일 렌더 + 현재위치 마커 + 실 좌표 먹로그 핀 표시 + 핀 탭→선택 카드 동작 확인. — T: 디바이스 스모크(체크리스트 dev-notes 기록).
- [ ] **디바이스 스모크 체크리스트 작성**(dev-notes) — 인수조건: 시뮬레이터 위치 시뮬·실 좌표 핀 탭·권한 거부 재현 + 카카오 콘솔 도메인 화이트리스트 등록 절차 명시(`npm run ios:sim`).

## 5-1. 테스트 케이스 (TDD)

> 단위 대상(✅): 유틸 3종·훅 2종·MapTabScreen·메시지 핸들러. 모킹/스모크(△/❌): expo-location·WebView/지도 SDK·실 RPC/RLS·네이티브 렌더.

**`toMuklogPin` (✅ 단위)**
- 정상: 완전 row → 모든 필드 camel, lat/lng number.
- 경계: category/area/rating = null → null 보존.
- 경계: lat/lng가 문자열로 와도("37.5") Number로 캐스팅(또는 RPC가 number 보장 가정 명시 — developer가 택1, 테스트로 고정).

**`pinsToMapMarkers` (✅ 단위)**
- 정상: category 'korean' → 해당 이모지 마커, saved:true.
- 경계: category null → 폴백 이모지.
- 경계: 빈 배열 → 빈 배열.

**`initialRegion` (✅ 단위)**
- 정상: coords 있음 → coords 중심.
- 경계: coords null + 핀 다수 → bbox 중심.
- 경계: coords null + 핀 1개 → 그 핀 중심(0폭 bbox 안전).
- 실패경로: coords null + 핀 0개 → DEFAULT_REGION.

**`useMuklogPins` (✅ 단위, supabase 모킹)**
- 정상: rows 2건 → ready, pins.length=2, 매핑 검증.
- 경계: 0행 → ready, pins:[] (에러 아님).
- 실패: error 반환 → status error, 한국어 message.
- 동시성/언마운트: 응답 전 언마운트 → setState 호출 안 됨(경고 없음).
- refresh: 호출 시 재조회되고 새 데이터 반영.

**`useLocationPermission` (✅ 단위, expo-location 모킹)**
- 정상: requestForegroundPermissionsAsync granted + getCurrentPositionAsync → coords 채움, status granted.
- 거부: granted=false → status denied, coords null.
- 실패: 권한/위치 모듈 throw → denied로 흡수(예외 전파 안 함).

**`MapTabScreen` (✅ 단위, 훅·지도뷰 모킹)**
- 로딩: 핀 loading → 로딩 오버레이.
- 권한 거부: denied → 현재위치 안내 노출, 지도는 여전히 렌더(차단 아님).
- 빈 상태: pins:[] → 빈 안내, 핀 0.
- 핀 탭: MARKER_TAP(id) → 선택 스팟 카드에 해당 placeName/별점/카테고리 텍스트.
- 에러: pins error → 에러 배너 + 재시도 트리거가 refresh 호출.

**지도뷰 onMessage 핸들러 (✅ 단위)**
- READY 메시지 → onReady 콜백.
- MARKER_TAP 메시지(JSON) → onMarkerTap(id).
- 잘못된/비JSON 메시지 → 조용히 무시(throw 안 함).

**모킹/스모크 (❌ 단위 아님 — 디바이스)**
- 실제 Kakao 지도 타일 렌더·현재위치 점 표시·실 좌표 핀 위치 정확도 → `npm run ios:sim` 스모크.
- 실 권한 다이얼로그·거부 후 동작 → 디바이스 스모크.
- RPC/RLS가 내 로그의 핀만 반환(타 로그 격리) → 실 DB 스모크(클라는 모킹으로 매핑만 검증).

## 6. 엣지케이스

- **빈 상태**: 좌표 있는 먹로그 0개 → 지도만, 핀 0, 안내. 차단 아님.
- **수동입력 먹로그(lat null)**: 지도에 **미표시**(설계 §3). RPC가 null 필터 → 핀 목록에 안 들어옴. (사용자가 "내 먹로그가 지도에 안 보임"을 혼동할 수 있음 → 빈/부분 상태 카피로 "좌표가 있는 기록만 표시" 뉘앙스 권고.)
- **권한 거부/영구거부**: 지도는 뜨되 현재위치 마커 생략 + bbox 중심. 재요청은 OS 설정行 안내(슬라이스 1은 설정 딥링크 OUT — 안내 텍스트만).
- **위치 획득 지연/타임아웃**: granted지만 좌표 못 받음 → coords null 취급(지도는 핀 bbox 중심). 무한 로딩 금지.
- **동시성(커플 2명)**: 파트너가 방금 추가한 좌표 먹로그는 **이번 진입엔 안 보일 수 있음**(Realtime OUT, 진입 1회 조회). refresh(탭 재진입/당겨서 새로고침 — 구현 시) 시 반영. 인수조건에 "실시간 반영"을 넣지 않는다(OUT 명시).
- **크로스-로그**: 솔로+커플 여러 로그의 핀이 **한 지도에 섞여** 표시(로그 구분 없이). 슬라이스 1은 로그별 필터 OUT — 전부 "우리 맛집"으로 동일 색.
- **좌표 이상치**: lat/lng가 0,0 이나 범위 밖 → RPC는 null만 필터하므로 통과 가능. `toMuklogPin`/`initialRegion`이 NaN/극단값에 죽지 않게(테스트로 0폭 bbox·단일핀 케이스 고정). 잘못된 좌표 핀은 잘못된 위치에 찍힐 수 있음(데이터 품질 문제 — 슬라이스 1 허용, 표시).
- **네트워크 실패**: RPC 실패 → error 상태 + 재시도(지도 SDK는 별개로 떠 있을 수 있음). 지도 타일 로드 실패(오프라인) → SDK ERROR → 에러 오버레이.
- **인증**: 세션 만료 시 RPC 401 → error로 흡수(AuthGate가 상위에서 처리, map-tab은 일반 에러 표시).
- **많은 핀**: 한 사용자가 여러 로그에 수십 개 핀 → 클러스터링 OUT(슬라이스 1). 성능 이슈 시 슬라이스 2에서 다룸. 전송량은 컬럼 투영으로 절감(커버 미포함).
- **입력 한계 무관**: 사진5·인원2 한계는 map-tab과 직접 무관(읽기 전용).

## 7. QA 교차검증 경계면

| 생산자 | 소비자 | 검증 포인트 |
|--------|--------|------------|
| `list_my_muklog_pins` RPC / 직접 select (snake) | `toMuklogPin` / `useMuklogPins` (camel) | 컬럼명·타입 1:1, lat/lng null 필터·number 캐스팅, 0행=빈상태 |
| `useMuklogPins` 상태 | `MapTabScreen` | loading/ready/empty/error 분기 렌더 일치 |
| `pinsToMapMarkers` 마커 | 지도뷰(WebView INIT/SET_MARKERS) | 마커 id=muklogId, 좌표·이모지 직렬화 정합 |
| 지도뷰 `MARKER_TAP id` | `MapTabScreen` 선택 카드 | id로 pins에서 해당 먹로그 lookup → 카드 텍스트 |
| `useLocationPermission` coords | `initialRegion` / 지도뷰 center | granted/denied 분기 시 센터링 폴백 |
| RLS(`muklogs` select `room_id IN 내 방`) | RPC/select 쿼리 | 타 사용자 로그 핀 미노출(격리) — 스모크 |
| `categories.ts` CAT 이모지 | `pinsToMapMarkers` | 기존 카테고리 매핑 재사용(중복 정의 금지) |
| app.json 권한 카피 / Info.plist | expo-location 런타임 | 권한 문자열 누락 시 크래시 방지 |

## 8. 비용 가드레일 체크 (architecture §6)

- ✅ **AWS 미사용** — 지도/위치/핀 모두 클라+Supabase(RPC). 신규 AWS 리소스 0.
- ✅ **전체 조회 금지 / viewport** — 슬라이스 1 핀은 **내 로그 한정**(RLS+RPC)으로 이미 범위 제한. **일반 음식점(Kakao Local) 핀은 OUT** → Kakao Local 호출 0(슬라이스 2에서 viewport+디바운스 도입). 슬라이스 1은 Kakao Local 쿼터 소비 없음.
- ✅ **진입 1회 조회 + refresh만** — 폴링/Realtime 미도입(`useMyLogs`/`useMuklogs` 정책 계승).
- ✅ **전송량 절감** — RPC가 필요 컬럼만 투영, 커버 signed URL 미발급(N장 배치 없음).
- ✅ **Kakao JS 키 보호** — JS 키는 도메인 화이트리스트 + 번들 직박힘 회피(`extra`/빌드 주입). REST 키는 슬라이스 1에서 미사용(클라 노출 0 원칙 유지).
- ⚠️ **슬라이스 2 예고**: 일반 음식점 핀은 반드시 **viewport bbox + 디바운스(usePlaceSearch 패턴)**로만 — 전체/페이지네이션 금지. place-search Edge Function 확장(category=FD6 + rect 파라미터) 또는 신규 nearby Edge Function. 이번 plan 범위 아님.

---

## 9. 핵심 의사결정 — 지도 라이브러리 선택 & 슬라이싱 (확정됨, 2026-06-14)

> **확정 결과**: ① 라이브러리 = **선택지 C (WebView + Kakao Map JS SDK)**. ② 범위 = **슬라이스 1만**. ③ Kakao JS 키 발급 완료 → **라이브 렌더링 검증까지 목표**. 아래 9.1~9.3은 결정 근거(감사 추적용 보존).

### 9.1 지도 렌더링 라이브러리 비교 (검토 기록)

현 상태: app.json에 Kakao 네이티브 모듈/플러그인 **전무**, package.json에 지도/위치 의존성 **전무**. 네이티브 Kakao Map SDK 도입은 **이 프로젝트 최초**이며 리스크 큼. 빌드는 `npm run ios:sim`(Xcode 26 ↔ 구 expo-cli 비호환 우회) 환경.

| 선택지 | 빌드/플러그인 부담 | Dev Client/시뮬레이터 영향 | 비용 | 비주얼 충실도(킷) | 리스크 |
|--------|------------------|---------------------------|------|------------------|--------|
| **A. Kakao Map 네이티브 SDK** (Expo config plugin **자작 필요**) | **매우 높음** — 커뮤니티 Expo 플러그인 부재, iOS/Android 네이티브 모듈 + config plugin 직접 작성. fmt 패치처럼 빌드 깨질 위험 | 새 네이티브 모듈 → Dev Client 재빌드. `npm run ios:sim` 우회 환경에서 추가 리스크 | 무료(SDK) | 최상(킷=Kakao 지도 전제) | **최고**. 첫 네이티브 지도 도입을 슬라이스 1에 묶으면 스프린트 좌초 위험 |
| **B. react-native-maps**(Apple/Google Maps) + 좌표만 | 중간 — Expo 플러그인 존재, 비교적 표준. iOS는 Apple Maps라 별도 키 불필요(기본) | Dev Client 재빌드 필요하나 검증된 경로 | 무료(Apple Maps)/Google은 키 | 중 — 지도 타일이 Kakao가 아님(킷의 한국 지도 톤과 이질). 음식점 데이터(슬라이스 2)는 여전히 Kakao Local 별도 | 중 |
| **C. WebView + Kakao Map JS SDK 임베드** ⭐ | **낮음** — `react-native-webview`만 추가(config plugin 자작 0). 지도는 HTML+JS SDK | **시뮬레이터 호환 양호** — 네이티브 지도 모듈 없음. Dev Client 재빌드는 webview 추가 1회 | 무료(JS SDK, 도메인 화이트리스트) | **상** — 실제 Kakao 지도라 킷 톤 일치. 핀 이모지/색은 HTML 마커로 커스텀 가능 | **낮음~중** — postMessage 계약·JS 키 관리·WebView 성능 한계(많은 핀 시) |

### 9.2 결정 ✅ — **선택지 C (WebView + Kakao Map JS SDK)** 로 슬라이스 1 진행

근거:
1. **빌드 리스크 최소화** — config plugin 자작(A)·새 네이티브 지도 모듈(A·B)을 슬라이스 1에서 회피. `npm run ios:sim` 우회 환경에서 네이티브 추가는 비용이 큼. WebView는 검증된 단일 의존성.
2. **킷 비주얼 일치** — 실제 Kakao 지도라 한국 지도 톤·핀 위에 카테고리 이모지(킷 `Pin`) 재현 용이.
3. **슬라이스 2 연속성** — 일반 음식점도 Kakao 생태계(Local API)라, 지도·데이터 제공자가 Kakao로 일관. JS SDK 마커 위에 nearby 핀을 같은 방식으로 얹기 쉬움.
4. **REST 키 노출 0 유지** — JS 키(도메인 제한 공개키)만 WebView에, REST 키는 Edge Function에만(기존 원칙 보존).

**기각된 대안(기록)**: B(react-native-maps)는 한국 지도 톤 포기 + 네이티브 재빌드 트레이드오프로 킷 충실도 손해. A(네이티브 Kakao SDK)는 빌드 리스크 최고 → **폐기**(필요 시 추후 별도 인프라 스프린트로만 재검토).

리스크 메모(dev/qa 주의): WebView 핀 수십~수백 개 성능, postMessage 직렬화 비용, JS 키 도메인 화이트리스트 설정(`muklog://`/file 스킴), iOS WebView geolocation 권한 브리지 → **현재위치는 RN `expo-location`으로 받아 INIT로 주입**(WebView 자체 geolocation 의존 회피, 계약 §3.5 고정).

### 9.3 슬라이싱 권고

`map-tab`(현재위치 + 내 먹로그 핀 + **일반 음식점 핀**)은 1스프린트=1기능 기준 **과대**. 2슬라이스로 분해, **이번엔 슬라이스 1만**:

- **슬라이스 1 (이번 — 본 plan)**: 지도 셸 + 현재위치 + 내 먹로그 핀(크로스-로그) + 선택 카드. Kakao Local 호출 0.
- **슬라이스 2 (`map-tab-nearby`, 다음)**: 일반 음식점 viewport 핀 — viewport bbox + 디바운스로 Kakao Local(category FD6) 조회, saved/주변 핀 머지·구분 색, 비용 가드레일(전체조회 금지) 집중. 슬라이스 1의 `initialRegion`/마커 계약 위에 증분.

이렇게 나누면 (a) 첫 네이티브/WebView 지도 도입 리스크를 슬라이스 1에 격리하고, (b) Kakao Local 쿼터·viewport 디바운스 같은 비용 가드레일을 슬라이스 2에 집중해 각 스프린트가 단일 기능을 유지한다.

---

## 10. 핸드오프 (확정 — 착수 가능)
게이팅 결정 3건 모두 락인됨. ui-publisher/developer 착수 가능.
1. **라이브러리** = WebView + Kakao Map JS SDK(`react-native-webview`). 네이티브(A) 폐기.
2. **범위** = 슬라이스 1만(내 먹로그 핀, 크로스-로그). 일반 음식점 viewport 핀은 다음 스프린트 `map-tab-nearby`.
3. **Kakao JS 키** = 발급 완료 → 이번 스프린트에서 라이브 지도 렌더링 검증까지 목표. 키 값은 plan/코드 미기록, 카카오 콘솔 도메인 화이트리스트 등록은 dev-notes 절차로.

- **ui-publisher**: 킷 `mk-home.jsx MapScreen`(현재위치 점·saved 핀·범례·선택 스팟 카드) → RN 비주얼 정합(§4). 지도뷰는 WebView 컨테이너.
- **developer**: §3 데이터·메시지 계약 + §5/§5-1 작업·TDD 케이스. 진입 1회 조회 + Kakao Local 호출 0(§8).
- **qa-inspector**: §7 경계면 교차검증 + §8 비용 가드레일 + 라이브 렌더 스모크.
