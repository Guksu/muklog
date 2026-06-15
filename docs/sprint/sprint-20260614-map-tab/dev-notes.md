# dev-notes — map-tab 슬라이스 1 (지도 셸 + 현재위치 + 내 먹로그 핀)

> developer 산출. 단일 출처: `plan.md`(§3 계약·§5 작업·§5-1 TDD·§8 비용) + `ui-spec.md`(컴포넌트 props·조립 가이드).
> 라이브러리 확정: **WebView + Kakao Map JS SDK**(`react-native-webview`). 비용 가드레일: Kakao Local 호출 0, 진입 1회 조회 + refresh.

---

## 0. 결과 요약

- `npm test`: **706 passed / 96 suites** (green).
- `npx tsc --noEmit`: **0 error** (react-native-webview 설치로 ui-publisher의 미해소 import 1건 해소됨).
- TDD: 모든 유틸·훅·화면은 실패 테스트 선작성 → 구현 → green.
- 미완(의도적, plan §2/§5): 라이브 지도 렌더링 검증(`npm run ios:sim`) = 디바이스 스모크 단계(아래 §5 체크리스트). DB 마이그레이션 적용은 사용자 환경(`supabase db push`).

---

## 1. 구현 파일

### 백엔드 (SQL)
- `supabase/migrations/20260614140000_map_tab_pins.sql` — `list_my_muklog_pins()` RPC 신설(additive).

### 데이터·로직 (`src/features/map/`)
| 파일 | 종류 | 역할 |
|------|------|------|
| `types.ts` | 계약 SSOT | MuklogPinRow/MuklogPin/MuklogPinsState/Coords/Region/MapMarker + enum-style(LocationPermissionStatus·MapInboundType·MapOutboundType·MapInboundMessage) |
| `toMuklogPin.ts` (+spec) | 순수 유틸 | RPC snake row → MuklogPin(camel), lat/lng Number 캐스팅, null 보존 |
| `pinsToMapMarkers.ts` (+spec) | 순수 유틸 | MuklogPin[] → MapMarker[], `categoryEmoji`(categories.ts 재사용) + 폴백 `PIN_FALLBACK_EMOJI` |
| `initialRegion.ts` (+spec) | 순수 유틸 | coords→핀 bbox 중심→`DEFAULT_REGION`(서울시청) 3분기, 0폭 bbox 안전 |
| `parseMapMessage.ts` (+spec) | 순수 유틸 | WebView onMessage 원문 → MapInboundMessage, 비JSON/미지/필드누락 → null(throw 없음) |
| `mapMessages.ts` (+spec) | 직렬화 헬퍼 | `buildInitScript`/`buildSetMarkersScript`(RN→WebView injectJavaScript JS 문자열) |
| `mapHtml.ts` (+spec) | HTML 생성 | Kakao JS SDK 로드 HTML 생성(키 placeholder 치환·READY/MARKER_TAP/ERROR postMessage·CustomOverlay 이모지 마커·__muklogInit/__muklogSetMarkers 핸들러) |
| `useMuklogPins.ts` (+spec) | 훅 | `list_my_muklog_pins` RPC 1회 조회·loading/ready/empty/error·refresh·언마운트 가드 |
| `useLocationPermission.ts` (+spec) | 훅 | expo-location 래핑, undetermined/requesting/granted/denied·coords·request·throw 흡수 |

### 화면 배선
- `src/navigation/screens/MapTabScreen.tsx` (재작성, +spec 재작성) — 훅·유틸·ui-publisher 컴포넌트 조립, 상태→tone/message 판단, WebView 메시지 디스패치, 권한 1회 요청, refresh.

### 설정·의존성
- `package.json`: `expo-location@~18.0.10`, `react-native-webview@13.12.5` 추가(`npx expo install`).
- `app.json`: ① iOS `infoPlist.NSLocationWhenInUseUsageDescription` ② plugins에 `expo-location`(`locationWhenInUsePermission` 카피).
- `src/lib/env.ts`: `optional()` 헬퍼 + `KAKAO_JS_KEY`(EXPO_PUBLIC_KAKAO_JS_KEY, 미설정 시 빈 문자열 → 지도뷰가 ERROR 분기). **키 값 미기록.**
- `.env.example`: `EXPO_PUBLIC_KAKAO_JS_KEY` 항목 + JS키 안내 추가.

### ui-publisher 컴포넌트에 가한 비주얼-무관 변경 (검토 요청)
- `src/features/map/components/MapWebView.tsx`: **ref forward용** `webviewRef?: React.Ref<MapWebViewHandle>` prop + `MapWebViewHandle` 타입 추가(+barrel export).
  - **사유**: 메시지 계약(plan §3.5)은 RN→WebView를 `injectJavaScript`로 보낸다(READY 후 INIT, refresh 후 SET_MARKERS). MapWebView가 WebView 인스턴스를 노출하지 않으면 주입 경로가 없다. **비주얼·레이아웃 0 변경**(WebView에 ref만 연결). ui-publisher 검토 바람 — 비주얼 영역이면 되돌리고 대안(예: html에 INIT 임베드 + refresh 시 remount) 협의.

---

## 2. RPC 결정 근거 (`list_my_muklog_pins`)

- **DEFINER 채택** — 기존 `list_my_rooms`(20260610150000) 패턴 계승. plan §3.2가 INVOKER+RLS도 허용했으나, list_my_rooms와 일관성·정책 서버 고정·슬라이스 2 bbox 인자 확장 자리 마련을 위해 DEFINER.
- **함정 방어(C-RLS)**: DEFINER는 RLS를 우회하므로 `join room_members rm on rm.room_id = m.room_id where rm.user_id = auth.uid()`로 본인 멤버십 스코프를 명시(누락 시 전 로그 핀 노출). 이로써 크로스-로그(내가 속한 모든 로그) 통합 + 타 사용자 격리 동시 충족.
- **좌표 필터**: `m.lat is not null and m.lng is not null` — 수동입력(좌표 없는) 먹로그는 핀에서 제외(설계 §3·plan §6).
- **투영**: muklog_id/room_id/place_name/category/area/rating/lat/lng만(커버/사진 미포함 → signed URL N장 배치 발급 회피, 비용 §8).
- **정렬 생략**: 지도 핀은 순서 무관 → ORDER BY 미사용(불필요 연산 회피).
- **반환 타입 = muklogs 컬럼 타입 1:1**: rating `smallint`, lat/lng `double precision`, category/area/place_name `text`(20260611130000 스키마 확인). 무인자(슬라이스 2에서 bbox 인자 추가 예정 — 지금 추가 금지).

---

## 3. 생산자 ↔ 소비자 매핑 (QA 교차검증용, plan §7)

| 생산자 | 소비자 | 검증 포인트 |
|--------|--------|------------|
| `list_my_muklog_pins` RPC(snake) | `toMuklogPin` / `useMuklogPins`(camel) | 컬럼명·타입 1:1, lat/lng Number 캐스팅, 0행→ready{pins:[]}(에러 아님), error→한국어 message |
| `useMuklogPins` 상태 | `MapTabScreen` | loading→로딩 오버레이 / ready+pins:[]→빈 안내 / error→에러 배너+재시도(refresh) |
| `useLocationPermission` coords/status | `MapTabScreen` / `initialRegion` / mapHtml(me) | granted→coords로 센터·me 마커 / denied→coords null·bbox 중심·안내 / throw→denied 흡수(지도 차단 안 함) |
| `pinsToMapMarkers` 마커 | `buildInitScript`/`buildSetMarkersScript` → mapHtml `__muklogInit/__muklogSetMarkers` | id=muklogId, lat/lng/emoji 직렬화 정합, saved:true 고정 |
| mapHtml `MARKER_TAP id` postMessage | `parseMapMessage` → `MapTabScreen` selectedId → `pins.find` → `SelectedSpotCard` | id로 핀 lookup → placeName/rating/category/area 카드 텍스트 |
| mapHtml `READY` postMessage | `MapTabScreen.handleMessage` → `sendInit()` (injectJavaScript INIT) | READY 후에만 INIT 주입(SDK 로드 완료 보장) |
| mapHtml `ERROR` postMessage | `MapTabScreen` mapErrored → MapStatusOverlay(error)+재시도 | SDK 로드/JS키 실패 → "지도를 불러오지 못했어요" |
| `categories.ts` `categoryEmoji`/`MUKLOG_CATEGORIES` | `pinsToMapMarkers`/`SelectedSpotCard` | 기존 CAT 매핑 재사용(중복 정의 0) |
| `env.KAKAO_JS_KEY` | `mapHtml({ jsKey })` | 키 이름만 코드, 값은 .env/빌드 주입(미기록) |
| app.json 권한 카피 / Info.plist | expo-location 런타임 | 권한 문자열 누락 시 크래시 방지 |

> **계약 shape (camel)** — `MuklogPin = { muklogId, roomId, placeName, category(string|null), area(string|null), rating(number|null), lat(number), lng(number) }`. `MapMarker = { id, lat, lng, emoji, saved:true }`. `Region = { lat, lng, zoom }`. 메시지: RN→WV `{type:'INIT'|'SET_MARKERS', ...}`, WV→RN `{type:'READY'} | {type:'MARKER_TAP', id} | {type:'ERROR', reason}`.

---

## 4. 비용 가드레일 적용 (plan §8)

- ✅ **Kakao Local 호출 0** — 슬라이스 1은 내 먹로그 핀만(RPC). Kakao JS SDK는 지도 타일 렌더만(Local 검색 미사용 — services 라이브러리도 HTML에서 미로드).
- ✅ **진입 1회 조회 + refresh만** — useMuklogPins는 마운트 1회 RPC, 폴링/Realtime 없음(useMyLogs 정책 계승). useLocationPermission도 watchPosition 미사용(1회 getCurrentPosition).
- ✅ **컬럼 투영** — RPC가 8개 컬럼만 반환, 커버 signed URL 미발급.
- ✅ **AWS 미사용**, **JS키 번들 직박힘 회피**(env 주입), **REST 키 클라 노출 0**(슬라이스 1 미사용).
- ✅ **SDK 재로드 회피** — INIT/SET_MARKERS는 `injectJavaScript`로 주입(refresh 시 WebView/SDK remount 없음).

---

## 5. 디바이스 스모크 체크리스트 (`npm run ios:sim`, 라이브 렌더 검증)

> 단위 대상이 아닌 항목(실 Kakao 타일·실 권한 다이얼로그·실 RPC/RLS). 키·콘솔 설정 후 수행.

**선행 준비**
1. `.env`에 `EXPO_PUBLIC_KAKAO_JS_KEY=<JS 키>` 설정(REST 키 아님 — 카카오 콘솔 > 앱 키 > **JavaScript 키**).
2. 카카오 콘솔 도메인 화이트리스트 등록(아래 §6).
3. `npx expo prebuild` 또는 Dev Client 재빌드(react-native-webview·expo-location 네이티브 모듈 추가 → 1회 재빌드 필요).
4. Supabase에 `20260614140000_map_tab_pins.sql` 적용(`supabase db push` 또는 SQL 에디터).

**스모크 항목**
- [ ] **카카오 콘솔 Web 도메인 등록값 === `https://localhost`**(= `MAP_WEBVIEW_BASE_URL`, MapWebView.tsx). 글자 그대로 일치(scheme `https`·끝 슬래시 없음). 불일치 시 SDK가 ERROR로 응답한다. → §6.
- [ ] 지도 탭 진입 → 실제 Kakao 지도 타일 렌더(흰 화면/ERROR 아님).
- [ ] 위치 권한 다이얼로그 1회 노출 → 허용 시 현재위치 파란 마커 + 그 위치로 센터링.
- [ ] 좌표 있는 먹로그가 핀(이모지 CustomOverlay)으로 표시, 실 좌표 위치 정확.
- [ ] 핀 탭 → 하단 SelectedSpotCard에 해당 가게명·별점·카테고리·area 표시.
- [ ] 권한 거부 재현 → 지도는 유지(차단 아님), 현재위치 마커만 생략 + "위치 권한을…" 안내, 핀 bbox 중심.
- [ ] 빈 상태(좌표 있는 먹로그 0) → 지도만, "좌표가 있는 먹로그가 아직 없어요".
- [ ] 시뮬레이터 Features > Location 시뮬로 위치 변경 시 동작 확인.
- [ ] (선택) 잘못된/누락 키 → ERROR 오버레이 + "다시 시도".
- [ ] 타 사용자 로그 핀 미노출(RLS/DEFINER 격리) — 별 계정 데이터로 확인.

---

## 6. 카카오 콘솔 도메인 화이트리스트 등록 절차 (R2 — ✅ 해결됨)

WebView가 로컬 HTML(`source={{ html, baseUrl }}`)로 Kakao JS SDK를 로드할 때, SDK는 호출 origin을 카카오 콘솔의 등록 도메인과 대조한다. 미등록/불일치 시 SDK가 `ERROR`(인증 실패)로 응답한다.

**✅ R2 반영(2026-06-15)**: WebView `source`에 안정적 `baseUrl = MAP_WEBVIEW_BASE_URL = 'https://localhost'`(MapWebView.tsx, enum-style `as const`)를 부여해 origin을 고정했다. iOS WKWebView가 `baseUrl` 없이 보고하던 불안정 origin(`about:blank`/`null`) 문제 해소. 사용자가 카카오 Web 도메인을 `https://localhost`로 등록하기로 확정.

> **🔒 불변식**: 카카오 콘솔 Web 플랫폼 **등록 도메인 === `source.baseUrl`(`MAP_WEBVIEW_BASE_URL`) === `https://localhost`** — 셋이 **글자 그대로** 같아야 한다. scheme `https`(http 아님)·끝 슬래시 없음·서브도메인 없음. 한 자라도 다르면 SDK origin 검증 실패(ERROR). 이 불변식은 `MapWebView.spec.tsx`가 단언으로 고정한다(`MAP_WEBVIEW_BASE_URL === 'https://localhost'` && `source.baseUrl === 'https://localhost'`).

**등록 절차**
1. https://developers.kakao.com → 내 애플리케이션 → 해당 앱 선택.
2. **앱 설정 > 앱 키**(또는 **요약 정보**)에서 **JavaScript 키** 확인 → `.env`의 `EXPO_PUBLIC_KAKAO_JS_KEY`에 설정(REST 키 아님).
3. **앱 설정 > 플랫폼 > Web** 에서 **사이트 도메인**에 `https://localhost` 등록(글자 그대로, 위 불변식 준수).
   - 카카오 지도(Maps)는 별도 "제품 설정"의 활성화/도메인 항목이 있을 수 있다 — 콘솔 UI에 **제품 설정 > 카카오맵** 또는 **앱 설정 > 플랫폼**의 웹 도메인 둘 중 노출되는 곳에 동일 값(`https://localhost`)을 등록한다.
4. 등록 후 `npm run ios:sim` 스모크에서 SDK가 READY를 송신하는지 확인. 여전히 ERROR(인증 관련 reason)면 등록값 ↔ `baseUrl` 글자 불일치를 1순위로 점검(공백·슬래시·http 여부).

---

## 7. 미해결 / 후속

- **라이브 렌더 검증(§5)**: 디바이스 스모크 단계 — 키 설정·콘솔 등록·Dev Client 재빌드·DB 적용 후 사용자/QA 수행. 코드/계약은 준비 완료.
- **MapWebView ref forward(§1)**: 비주얼-무관 plumbing 변경. ui-publisher 검토 요청(되돌리려면 html INIT 임베드 + refresh remount 대안).
- ✅ **WebView baseUrl(§6) — 해결됨(R2)**: `MAP_WEBVIEW_BASE_URL = 'https://localhost'`로 origin 고정 + 카카오 Web 도메인 동일 등록 확정. 비주얼 무관 plumbing(레이아웃 0 변경). `MapWebView.spec.tsx`가 불변식 단언.
- **R1(SDK 로드 실패 후 재시도 실복구)**: 이번 미반영(사용자 보류). 라이브 스모크에서 에러 경로(SDK 로드 실패 후 "다시 시도"가 실제 복구하는지)를 확인한 뒤 별도 결정. 현재 `handleRetry`는 INIT 재주입 + 핀 refresh를 시도하나, SDK 자체가 죽은 경우 재주입이 무효일 수 있음 — 스모크 관찰 필요.
- **슬라이스 2(`map-tab-nearby`)**: 일반 음식점 viewport 핀. `list_my_muklog_pins`에 bbox 인자 추가 + Kakao Local(FD6) Edge Function 확장. 이번 범위 아님.

---

## 라이브 스모크 결과 (2026-06-15) — ✅ 지도 렌더 검증 완료

디바이스(iOS 시뮬, `npm run ios:sim`)에서 실 Kakao 지도 렌더·현재위치·핀 동작 확인. 과정에서 나온 **비자명한 해결**(후속 작업·재발 방지용 기록):

1. **네이티브 모듈 추가 후 빌드 실패(`Undefined symbols: _RNCWebViewCls`)** → `react-native-webview`·`expo-location` 오토링크/pod 미설치가 원인. `/ios`는 gitignore(CNG)이므로 **`npx expo prebuild -p ios --clean`** 으로 재생성(autolink + pod install + expo-location Info.plist 권한 주입 + fmt 패치 재적용). **교훈: 네이티브 의존성 추가 시 prebuild/pod install 1회 필요**(JS-only 변경은 불필요).
2. **카카오 도메인 등록 위치** = 콘솔 개편으로 "플랫폼" 탭이 아니라 **[앱] > [플랫폼 키] > [JavaScript 키] > [JavaScript SDK 도메인]**. (제품 링크 관리 > 웹 도메인은 카카오톡 공유용이라 지도와 무관.) 등록값 = WebView `baseUrl` = `https://localhost` 글자 일치 필수. 미등록 시 sdk.js가 401 `AccessDeniedError: domain mismatched! caller=https://localhost`.
3. **키 env** = `EXPO_PUBLIC_KAKAO_JS_KEY`(접두사 필수, JS 키). EXPO_PUBLIC_은 빌드 시 정적 인라인 → .env 변경 후 **Metro `-c` 재시작** 필요.
4. **흰 지도(타일 미표시) 2원인 해결**:
   - WKWebView `loadHTMLString`에서 body `height:100%` 붕괴 → `#map`을 `position:absolute; inset:0`로 뷰포트 직접 채움 + INIT 후 `relayout()`+`setCenter` (mapHtml.ts).
   - https 페이지에서 타일 mixed-content 차단 대비 `<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">` 추가.
   - ⚠️ **최종 흰 화면의 실제 원인**: 시뮬레이터 위치가 한국 밖(Cupertino 등)이면 **Kakao는 한국만 타일 데이터** → 흰 지도. 한국 좌표(서울시청 37.5665,126.9780)로 설정 시 정상. (코드 무관 — 운영 가이드)

## 사용자 결정 반영 (계획 deviation)
- **빈 상태 안내 제거**: plan §4의 "좌표 있는 먹로그 0개 → 빈 안내" 배너를 **사용자 요청으로 제거**(핀 0개여도 지도만 표시). `MAP_COPY.empty` 삭제, MapTabScreen 빈 분기 제거, spec을 "노출 안 함"으로 갱신. 권한거부/에러 안내는 유지.

## 후속 작업 (열림)
- **핀 비주얼 충실도(ui-publisher)**: WebView 내부 `.mk-pin`(흰 원+파란 보더+이모지)이 킷 `mk-home` MapScreen 핀 시안과 차이 → ui-publisher 비주얼 패스로 킷 정합 필요(WebView HTML 격리 영역). qa-visual 재검증 대상.
- **R1**: SDK 로드 실패 후 "다시 시도" 실복구(필요 시 WebView remount).
