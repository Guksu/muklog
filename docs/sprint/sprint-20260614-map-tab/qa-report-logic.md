# QA Report — Logic (map-tab 슬라이스 1)

> 작성: qa-logic. 범위 = 로직·통합 정합성·보안·비용·TDD·컨벤션(퍼블리싱 제외 — 비주얼/킷 충실도는 qa-visual).
> 방법: plan §7 경계면을 **생산자↔소비자 양쪽 동시 읽기**로 교차검증. 발견은 파일:라인 근거.
> 결과 요약: **통과 — 로직/통합 인수조건 전부 충족. 실패(blocking) 0건.** 권고(non-blocking) 2건, 미검증(디바이스/실DB 스모크) 3건.

---

## 검증 환경 실측
- `npx tsc --noEmit`: **0 error** (통과).
- `npm test`: **96 suites / 706 passed** (통과). map 슬라이스 신규 스펙 11종 전부 green.
- 테스트 유의미성(load-bearing) 표본: `toMuklogPin.ts`의 `placeName: row.place_name` → `row.room_id`로 변조 시 `toMuklogPin.spec`·`useMuklogPins.spec` 2 suite RED 확인 → 매핑 단언이 실제로 깨짐(껍데기 아님). 변조 후 원복 완료.

---

## 통과 (PASS)

### 1. RPC(snake) ↔ toMuklogPin/useMuklogPins(camel) — 컬럼·타입 1:1
- 생산자 `supabase/migrations/20260614140000_map_tab_pins.sql:26-35` `returns table(muklog_id uuid, room_id uuid, place_name text, category text, area text, rating smallint, lat double precision, lng double precision)`.
- 소비자 `src/features/map/types.ts:6-15` `MuklogPinRow` 8필드 ↔ `:18-27` `MuklogPin` camel. `toMuklogPin.ts:13-22`이 8필드를 1:1 매핑.
- 실 스키마 대조: `20260611130000_muklog_list.sql:28-47` muklogs 컬럼 타입과 RPC `returns table` 타입 완전 일치(rating smallint, lat/lng double precision, place_name text not null, category/area text nullable).
- **lat/lng number 캐스팅**: `toMuklogPin.ts:20-21` `Number(row.lat/lng)`. 드라이버가 문자열로 줘도 안전. `toMuklogPin.spec.ts:40-47`이 문자열 입력 → number 단언으로 고정.
- **null 보존**: category/area/rating은 캐스팅 없이 통과(`:16-19`), `toMuklogPin.spec.ts:33-38`이 null 보존 단언.
- **0행 = 빈 상태(정상)**: `useMuklogPins.ts:37-38` `(data ?? []).map(...)` → `ready{pins:[]}`. `useMuklogPins.spec.ts:68-78`이 빈 배열·null data 모두 `ready{pins:[]}`로 흡수 검증(에러 아님). 에러 분기는 한국어 메시지(`:32-34`).

### 2. pinsToMapMarkers 마커 ↔ mapHtml 직렬화 — id/좌표/이모지 정합
- `pinsToMapMarkers.ts:19-29`: `id = p.muklogId`(plan §3.4 id=muklogId 충족), lat/lng 그대로, `emoji = categoryEmoji({key: p.category})` 폴백 `PIN_FALLBACK_EMOJI`('🍽️'), `saved:true` 고정.
- 이모지 출처 재사용: `categories.ts:43-48` `categoryEmoji` (중복 정의 0 — plan §7 충족). null/미지 key → `''` → `pinsToMapMarkers.ts:26`이 폴백 치환. `pinsToMapMarkers.spec.ts:34-42`이 null·미지 둘 다 폴백 단언.
- 직렬화: `buildInitScript`/`buildSetMarkersScript`(`mapMessages.ts:24,34`)가 `JSON.stringify`로 `{type, center, markers, me}` 안전 직렬화. 소비측 `mapHtml.ts:47-67` `renderMarkers`가 `m.emoji`/`m.lat`/`m.lng`/`m.id`를 읽어 CustomOverlay 생성 — 키 이름 정합(id/lat/lng/emoji).
- 마커 클릭 → `mapHtml.ts:55-57` `post({type:'MARKER_TAP', id:m.id})`로 id 역전송. 송신 id = `pinsToMapMarkers` id = muklogId로 일관.

### 3. MARKER_TAP id ↔ MapTabScreen 선택카드 lookup
- 수신 `MapTabScreen.tsx:86-89`: `setSelectedId(message.id)`. lookup `:102` `pins.find((p) => p.muklogId === selectedId)`. id 도메인(muklogId)이 양끝 일치.
- 카드 데이터는 핀 페이로드에서 직접(`:163-168` placeName/rating/category/area) — 추가 조회 0(plan §3.2 충족).
- `MapTabScreen.spec.tsx:115-126`이 `MARKER_TAP id='m9'` 발화 → 선택카드에 해당 placeName('스시 오마카세') 단언으로 lookup 정합 고정.

### 4. useLocationPermission coords ↔ initialRegion/INIT center 분기
- granted+획득: `useLocationPermission.ts:47-52` status granted + coords 채움. `initialRegion.ts:28-30` coords 있으면 그 중심.
- denied: `:42-45` coords null·status denied → `initialRegion.ts:32-40` 핀 bbox 중심(없으면 DEFAULT_REGION 서울시청). 지도 차단 안 함.
- granted지만 위치 throw(타임아웃): `:53-55` coords null 유지 → bbox 폴백(무한 로딩 금지). `useLocationPermission.spec.ts:71-82`이 granted+coords null 단언.
- 권한 모듈 throw: `:36-39` denied 흡수(예외 전파 0). `useLocationPermission.spec.ts:59-69` 단언.
- `initialRegion`은 0폭 bbox(핀1개)·극단값에 NaN 없이 안전(`:36-40` min/max 평균), `initialRegion.spec.ts:37-41` 단일핀 단언.
- MapTabScreen 배선: `:56` `initialRegion({coords: permission.coords, pins})`, `:73` INIT.me = `permission.coords`. 분기 일관.

### 5. WebView 메시지 계약(§3.5) 송신↔수신 shape
- WV→RN 송신: `mapHtml.ts:103`(READY) `:56`(MARKER_TAP id) `:88,99,110`(ERROR reason). 수신·파서 `parseMapMessage.ts:24-38`이 READY/MARKER_TAP(id string 검증)/ERROR(reason 기본'') 파싱, 비JSON/미지/필드누락 → null(throw 0). `parseMapMessage.spec.ts` 7케이스 전부 커버.
- RN→WV 송신: `mapMessages.ts` `{type:'INIT', center, markers, me}` / `{type:'SET_MARKERS', markers}`. 수신 핸들러 `mapHtml.ts:70`(`__muklogInit`) `:93`(`__muklogSetMarkers`)가 동일 페이로드 shape 소비(`payload.center.lat/lng/zoom`, `payload.markers`, `payload.me`).
- type 상수 단일 출처: `types.ts:61-73` `MapInboundType`/`MapOutboundType` enum-style, 양측 사용(parseMapMessage·mapMessages·MapTabScreen). 문자열 드리프트 위험 0.
- READY 후에만 INIT 주입: `MapTabScreen.tsx:81-84` READY 수신 시 `sendInit()` → SDK 로드 완료 보장(`mapHtml.ts:102 kakao.maps.load` 콜백 후 READY).

### 6. RLS/DEFINER 격리 (코드/SQL 검토)
- `20260614140000_map_tab_pins.sql:48-52`: `join public.room_members rm on rm.room_id = m.room_id where rm.user_id = auth.uid()` — DEFINER가 RLS 우회하나 본인 멤버십 스코프를 명시 조인으로 강제(C-RLS 함정 방어). 내가 속한 **모든 로그** 통합 + 타 사용자 격리 동시 충족.
- `room_members(room_id, user_id)` PK 실재 확인(`20260609120000_invite_room.sql:34-36`). `auth.uid()` 조인 컬럼 유효.
- 좌표 필터 `:51-52` `m.lat is not null and m.lng is not null` → 수동입력(좌표 없는) 먹로그 제외(설계 §3·plan §6 충족).
- 권한 `:56-57` `revoke from public,anon` + `grant to authenticated` — 익명/미인증 실행 차단. 기존 `list_my_rooms` 패턴 정합.
- (실 격리 동작은 멀티계정 실DB 스모크 권고 — 아래 미검증.)

### 7. 비용 가드레일(§8) — 코드 강제 확인
- **Kakao Local 호출 0**: `mapHtml.ts:13,108` SDK URL에 `services` 라이브러리 미로드(`&libraries=` 부재, `autoload=false`만). map 소스 전수 grep으로 Local/places 호출 0 확인.
- **진입 1회 조회 + refresh만**: `useMuklogPins.ts:41-48` 의존성 없는 useEffect 1회. 폴링/Realtime/subscribe/setInterval 부재(grep 0). `useLocationPermission`도 `getCurrentPositionAsync` 1회, `watchPosition` 미사용.
- **컬럼 투영**: RPC 8컬럼만, 커버/사진/signed URL 미발급(`:40-47` select 목록).
- **SDK 재로드 회피**: INIT/SET_MARKERS는 `injectJavaScript`(`MapTabScreen.tsx:71` + `mapMessages`) → WebView remount 없음.
- **AWS 미사용**: 신규 AWS 리소스 0(Supabase RPC + 클라 + Kakao JS SDK만).
- **KAKAO_JS_KEY 미설정 시 ERROR 분기**: `env.ts:40` `optional()` → 빈 문자열(앱 부팅 막지 않음). `mapHtml.ts:108`에 빈 appkey 주입 → `mapHtml.ts:99,110` SDK 미로드 → `ERROR` postMessage → `MapTabScreen.tsx:90-92` mapErrored → "지도를 불러오지 못했어요" 오버레이. **키 값 코드/문서 미기록**(placeholder만) 확인.

### 8. TDD/테스트 품질
- 인수조건↔테스트 대응(plan §5-1) 전부 존재: toMuklogPin(3)·pinsToMapMarkers(5)·initialRegion(5)·useMuklogPins(7)·useLocationPermission(5)·parseMapMessage(7)·mapHtml(6)·mapMessages(3)·MapTabScreen(9). 경계·실패경로(빈/null/throw/비JSON/미지타입/언마운트) 커버.
- 단위 경계 준수: SQL/RPC·expo-location·react-native-webview는 모킹(`useMuklogPins.spec.ts:8` supabase.rpc mock / `useLocationPermission.spec.ts:8` expo-location mock / `MapTabScreen.spec.tsx:11-18` webview virtual mock). 네이티브 렌더·실 RPC/RLS는 디바이스/실DB 스모크로 분리(dev-notes §5).
- 훅 테스트가 계약 매핑(snake→camel)·상태 전이(loading/ready/empty/error)·언마운트 가드 검증.
- `tsc`/`npm test` 통과 + 변조 표본 RED 확인(위 환경 실측).

### 9. 코드 컨벤션
- `useCallback`/`useMemo` 실제 호출 **0건**(grep: 주석 2건만 — useMuklogPins.ts:25, useLocationPermission.ts:25 "지양" 언급).
- 컴포넌트·훅 전부 `export const X = () => {}` 화살표(`export function` 0건).
- named-object 인자: toMuklogPin/pinsToMapMarkers/initialRegion/parseMapMessage/buildInitScript/buildSetMarkersScript/mapHtml 모두 `{ ... }` 단일 객체. (예외 정당: `pins.map((p) =>`·`pins.find((p) =>`·`markers.map`은 배열 콜백, `LEGEND_ITEMS.map((item) =>`도 배열 콜백.)
- useEffect 명명 함수: `useMuklogPins.ts:41 loadPinsOnMount` / `MapTabScreen.tsx:62 requestLocationOnEnter`(인라인 `useEffect(() =>` 0건).
- enum-style 상수: `LocationPermissionStatus`/`MapInboundType`/`MapOutboundType`(types.ts) / `MapStatusTone`(MapStatusOverlay) / `MAP_COPY`·`LEGEND_ITEMS` `as const`. 판별유니온 status는 예외 정당.
- 파일명=심볼명 전부 일치(toMuklogPin/pinsToMapMarkers/initialRegion/parseMapMessage/mapMessages/mapHtml/useMuklogPins/useLocationPermission/MapTabScreen/MapWebView/MapLegend/MapStatusOverlay/SelectedSpotCard).
- app.json 권한: `:17` iOS `NSLocationWhenInUseUsageDescription` + `:46-51` plugins expo-location `locationWhenInUsePermission` 양쪽 카피 존재(런타임 크래시 방지 — plan §7 마지막 행 충족).

### 10. dev-notes §1 특이사항 — MapWebView ref forward 메시지 계약
- 로직 관점만 평가(비주얼은 qa-visual). `MapWebView.tsx:23` `MapWebViewHandle = { injectJavaScript }` + `:31 webviewRef` prop + `:42 ref={webviewRef}`. `MapTabScreen.tsx:51 useRef<MapWebViewHandle>` + `:71 webviewRef.current?.injectJavaScript(...)`.
- **메시지 계약상 올바름**: plan §3.5 RN→WV는 `injectJavaScript`로 INIT/SET_MARKERS 주입을 요구 → WebView 인스턴스 노출 경로가 필수. `injectJavaScript` 핸들 타입이 정확히 그 1개 메서드만 노출(과다 노출 없음). `mapMessages` 출력 문자열이 `true;`로 끝나(`mapMessages.ts:25,35`) WKWebView 평가 경고 회피 — 관례 정합. **로직 결함 없음.** (비주얼 영향 여부는 qa-visual 판단으로 위임.)

---

## 권고 (non-blocking, 로직상 동작은 정상)

### R1. SDK 로드 실패 후 "다시 시도"는 실질 복구가 안 됨 (UX 한계, 코드 정상)
- `MapTabScreen.tsx:96-100 handleRetry`: mapErrored 해제 + `refresh()` + `sendInit()`.
- 그러나 ERROR가 `SDK_LOAD_FAILED`/`SDK_UNAVAILABLE`(`mapHtml.ts:99,110`)였다면 `window.__muklogInit`가 정의되지 않은 상태 → `sendInit()`의 `injectJavaScript`는 `window.__muklogInit && ...`(mapMessages.ts:25) 가드로 **no-op**. SDK 스크립트 재삽입이 없어 실제 지도 복구가 안 되고, mapErrored만 꺼져 오버레이가 사라진 빈 WebView가 남을 수 있음.
- 단, 일시적 ERROR(예: INIT 내부 try/catch `mapHtml.ts:87-89`)나 핀 에러는 retry로 정상 복구됨. 슬라이스 1 스모크 항목(dev-notes §5 "잘못된/누락 키 → ERROR + 다시 시도")에서 이 경계를 확인 권고.
- **제안(developer, 선택)**: SDK 로드 실패류 ERROR의 retry는 INIT 재주입 대신 WebView remount(예: key 토글)로 SDK 재로드하거나, 라이브 스모크에서 한계를 dev-notes에 명시. 데이터 계약·테스트엔 영향 없음.

### R2. WebView baseUrl 미설정 — 라이브 origin 화이트리스트 리스크 (이미 dev-notes §6 기록됨)
- `MapWebView.tsx:45 source={{ html }}`만, baseUrl 없음. iOS WKWebView origin이 `null`/`about:blank`로 보고되면 Kakao 콘솔 도메인 화이트리스트와 불일치 → SDK 인증 실패(ERROR) 가능. developer가 dev-notes §6에 이미 plumbing 이슈로 명시·후속 처리 예고 → **로직 결함 아님**. 라이브 스모크에서 막히면 baseUrl 부여 필요(qa-logic 재검 대상 아님 — 디바이스 검증 영역).

---

## 미검증 (단위 경계 밖 — 디바이스/실DB 스모크, 통과로 처리 안 함)

- **M1. 실 Kakao 지도 타일 렌더·현재위치 점·실 좌표 핀 위치 정확도**: `npm run ios:sim` 디바이스 스모크(dev-notes §5). 코드/계약은 준비 완료, 네이티브 렌더는 단위 범위 밖.
- **M2. RLS/DEFINER 실 격리(타 사용자 로그 핀 미노출)**: SQL/조인 로직은 정합 확인(§6 PASS). 실제 멀티계정 실DB 적용(`supabase db push`) 후 격리 스모크 권고 — 클라는 모킹으로 매핑만 검증 가능.
- **M3. 실 권한 다이얼로그·거부 후 동작·KAKAO_JS_KEY 누락 시 ERROR 오버레이**: 분기 로직은 단위로 검증(§4·§7 PASS). 실 OS 다이얼로그·실 키 미설정 부팅은 디바이스 스모크.

---

## developer 수정요청
- **blocking: 없음.** 로직/통합/보안/비용/TDD/컨벤션 인수조건 전부 충족, tsc·706 테스트 green.
- **선택(권고)**: R1(SDK 로드 실패 retry의 실복구 한계) — 라이브 스모크에서 경계 확인 후, 필요 시 SDK 실패류 ERROR에 한해 WebView remount 재로드 도입 또는 dev-notes에 한계 명시. 데이터 계약 불변.
- R2(baseUrl)는 이미 dev-notes §6에 기록됨 — 라이브 검증 단계 처리(현 단계 액션 불요).

> 비주얼/킷 충실도(레이아웃·토큰·radius·카피 시안 정합)는 본 리포트 범위 밖 — qa-visual 담당.
