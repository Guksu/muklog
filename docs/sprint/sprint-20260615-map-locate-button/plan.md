# Sprint: 지도 탭 현재위치 버튼 (map-locate-button)

> map-tab 슬라이스 1·2(완료, 706+ green) 위에 증분. 한 스프린트 = 한 기능(현재위치 재센터 버튼만).
> 단일 출처: `docs/design/architecture.md`(§4 화면·§6 비용 가드레일), 디자인 정답지 `.claude/skills/ui-design/templates/muklog/mk-home.jsx:289-298`.
> **게이팅 결정 락인(오케스트레이터/사용자 확정):** ① 재센터 = 신규 outbound `RECENTER{me}` + `__muklogRecenter`(panTo) / ② 위치 = 탭 시 `getCurrentPositionAsync` 재취득(`refreshCoords`) / ③ me 마커도 fresh 좌표로 갱신 / ④ 버튼 항상 표시 + 미결정 탭→권한요청 + 거부 탭→no-op.

## 1. 기능 한줄 정의
지도 탭 우하단 FAB("내 위치로 이동")를 탭하면 **현재위치를 재취득해** 지도가 그 좌표로 재센터링(panTo)되고, 현재위치(파란 점) 마커도 fresh 좌표로 갱신되며 펄스 애니메이션이 1회 재생된다.

## 2. 범위
- **In-scope**
  - 우하단 FAB 1개(킷 mk-home:289-298 정합 — `46×46`, `radius 999`, `mk-card` 배경, 헤어라인/그림자, `locate` 아이콘 24/`#3B82F6`).
  - 탭 시 `getCurrentPositionAsync`로 **현재위치 재취득**(`useLocationPermission.refreshCoords()`, 탭당 1회).
  - 재취득한 fresh 좌표로 지도 재센터. **신규 outbound 메시지 `RECENTER{me}`** + WebView `__muklogRecenter` 핸들러(`panTo(me)` + me 마커 위치 갱신).
  - 위치 권한 분기(미결정/거부/허용)에 따른 버튼 동작.
  - `locate` 아이콘 추가(ui-design verbatim glyph — ui-publisher 담당, 본 plan에 글리프 출처 명시).
  - 펄스 애니메이션(킷 `mkLocate`) RN 근사 — **ui-publisher 몫**(이 plan은 트리거 계약만; "탭 시 펄스 1회"는 디바이스 스모크).
- **Out-of-scope (다음 스프린트/안 함)**
  - 경로 안내·내비게이션·길찾기.
  - 실시간 위치 추적(`watchPosition`)·위치 폴링 — **금지**(비용·배터리, §8).
  - 지도 줌 레벨 변경(재센터만, 줌은 현 레벨 유지).
  - 현재위치 마커 모양/스타일 변경(기존 INIT.me 마커 비주얼 재사용 — 위치만 갱신).
  - 권한 거부 시 버튼 숨김 / OS 설정 딥링크(`Linking.openSettings`) — 후속 스프린트.

## 3. 데이터 · API 계약

### 3.1 테이블/RLS
- **변경 없음.** 위치는 디바이스 로컬(expo-location), DB·Supabase 호출 0. RLS·DDL 무관.

### 3.2 신규 outbound 메시지 타입 (RN → WebView)
`src/features/map/types.ts`의 `MapOutboundType`에 `Recenter` 추가(Init/SetMarkers **불변**):
```ts
export const MapOutboundType = {
  Init: 'INIT',
  SetMarkers: 'SET_MARKERS',
  Recenter: 'RECENTER', // 신설 — 현재위치로 panTo + me 마커 갱신
} as const;
```
- `buildInitScript` 재사용은 **폐기**. 지도 재init(새 `kakao.maps.Map` 생성)은 마커 깜빡임·me 마커 중복·idle 재발화(nearby 재조회) 부작용이 있어 부적합 → 신규 outbound `RECENTER` 사용.

### 3.3 신규 직렬화 헬퍼 (`src/features/map/mapMessages.ts`)
```ts
/** 현재위치로 재센터(RECENTER) 스크립트를 만든다(panTo + me 마커 갱신). me는 non-null(가드는 호출부). */
export const buildRecenterScript = ({ me }: { me: Coords }): string => {
  const payload = JSON.stringify({ type: MapOutboundType.Recenter, me });
  return `window.__muklogRecenter && window.__muklogRecenter(${payload}); true;`;
};
```
- 입력: `{ me: Coords }`(`{lat:number, lng:number}`). **`me`는 non-null 계약** — null/미획득 가드는 MapTabScreen 핸들러가 책임(아래 §3.6). 헬퍼는 non-null `Coords`만 받는다(`buildInitScript`의 `me: Coords | null`과 다름).
- 출력: `injectJavaScript` 문자열. 끝을 `true;`로 종결(iOS WKWebView 평가 경고 회피, 기존 관례).

### 3.4 WebView 핸들러 + me 마커 갱신 (`src/features/map/mapHtml.ts`)
`__muklogRecenter`는 `panTo(me)`로 카메라를 옮기고, **me 마커(파란 점) 위치도 fresh 좌표로 갱신**한다(없으면 생성). 카메라만 옮겨 파란 점이 옛 위치에 남는 문제를 방지한다.
- HTML_TEMPLATE에 me 마커 오버레이를 **모듈 스코프 변수로 보관**한다(`__muklogInit`에서 생성 시 `mkMeOverlay`에 저장, 기존엔 지역 `meOverlay`였음 → 보관용으로 승격). 핸들러가 이 참조를 재배치한다:
```js
var mkMeOverlay = null; // INIT에서 생성한 현재위치 오버레이 참조 보관(재센터 시 위치 갱신용)

// __muklogInit 내부: 기존 meOverlay 생성을 mkMeOverlay에 저장하도록 변경
//   mkMeOverlay = new kakao.maps.CustomOverlay({ position: ..., content: meEl });
//   mkMeOverlay.setMap(mkMap);

// RN → WebView: 현재위치로 재센터(panTo) + me 마커 갱신. 지도 재init 없음(경량).
window.__muklogRecenter = function (payload) {
  if (!mkMap || !payload || !payload.me) return;
  var pos = new kakao.maps.LatLng(payload.me.lat, payload.me.lng);
  mkMap.panTo(pos);
  if (mkMeOverlay) {
    mkMeOverlay.setPosition(pos); // 기존 파란 점 위치 갱신
  } else {
    // INIT 시 me 없었던 경우(권한 늦게 허용) → 마커 신규 생성(INIT.me와 동일 비주얼)
    var meEl = document.createElement('div');
    meEl.style.cssText = 'width:16px;height:16px;border-radius:8px;background:#3366FF;border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.15);';
    mkMeOverlay = new kakao.maps.CustomOverlay({ position: pos, content: meEl });
    mkMeOverlay.setMap(mkMap);
  }
};
```
- `panTo`(부드러운 이동, 줌 레벨 미변경)를 쓴다(`setCenter` 점프 아님 — 킷의 부드러운 재센터 감각).
- `panTo`가 유발하는 `idle` 이벤트는 기존 `emitBounds` → BOUNDS_CHANGED → `useNearbyPlaces`로 흐르나, **디바운스/캐시/임계가 과호출을 흡수**(slice2 가드레일, §8). 신규 비용 없음.
- me 마커 비주얼(16px 파란 점/흰 보더)은 기존 INIT.me와 **동일**(모양 변경 없음 — 위치만 갱신/생성). 비주얼 토큰은 WebView 격리 영역이라 킷 hex 유지(기존 정책).

### 3.5 inbound 영향 없음
WebView → RN 신규 메시지 없음(`MapInboundType` 불변). FAB는 RN 측 버튼이므로 inbound 불필요.

### 3.6 useLocationPermission 확장 (`src/features/map/useLocationPermission.ts`)
탭 시 현재위치를 재취득하는 메서드 추가(진입 1회 `request`·`requestedRef` 가드는 불변):
```ts
/** 탭 시 현재위치를 1회 재취득한다(폴링/watchPosition 금지). granted 아니면 null.
 *  in-flight 가드로 연타 시 중복 호출 0. 타임아웃/실패면 직전 coords 폴백(없으면 null). */
const refreshCoords = async (): Promise<Coords | null> => { ... }
```
- 동작 계약:
  - status !== Granted → `null` 반환(위치 호출 0, no-op).
  - in-flight(이미 재취득 진행 중) → 중복 `getCurrentPositionAsync` 호출 0(가드).
  - 성공 → 새 coords로 state 갱신 + 그 coords 반환.
  - 실패(타임아웃) → **직전 `coords` 폴백 반환**(있으면), 없으면 `null`. 무한 로딩·throw 금지(§6 정합).
- 훅 반환 시그니처: 기존 `{ status, coords, request }`에 `refreshCoords` 추가 → `{ status, coords, request, refreshCoords }`.
- `getCurrentPositionAsync`는 **탭당 1회**만(폴링/watchPosition 금지, §8).

### 3.7 MapTabScreen 배선 계약
- FAB 컴포넌트(`MapLocateButton`, ui-publisher 신설)를 `MapWebView` children 오버레이로 우하단 배치.
- 탭 핸들러(MapTabScreen 내 일반 함수, async):
```ts
const handleLocate = async () => {
  if (permission.status === LocationPermissionStatus.Undetermined) {
    await permission.request(); // 미결정 → 권한 요청. granted면 아래로 진행(요청 직후 재센터)
  }
  if (permission.status === LocationPermissionStatus.Denied) return; // 거부 → no-op(기존 배너가 안내)
  const me = await permission.refreshCoords(); // 탭 시 현재위치 재취득(탭당 1회)
  if (!me) return; // 미획득(미결정 거부됨/granted+취득실패) → no-op(무한로딩 금지)
  webviewRef.current?.injectJavaScript(buildRecenterScript({ me }));
};
```
- 흐름: 탭 → (미결정이면 `request`) → granted면 `refreshCoords` → coords 있으면 `buildRecenterScript` inject **1회**.
- ⚠️ `request()`는 비동기로 state를 갱신하므로, 요청 직후 `permission.status`가 아직 갱신 전일 수 있음(클로저). developer는 `request`의 반환/내부 상태를 신뢰해 분기하거나, `refreshCoords`가 granted 아니면 null을 반환하는 계약(§3.6)에 의존해 안전하게 흡수한다(미결정→거부 시 `refreshCoords`가 null → no-op). 화면 테스트(T4·T5)가 이 경로를 고정한다.

## 4. 화면 · UX
- **컴포넌트**: `MapLocateButton`(신설, ui-publisher) — 우하단 FAB. props 최소(`onPress`, `disabled?`). 비주얼은 mk-home:289-298 정합(ui-publisher가 ui-spec으로 확정).
- **배치**: `MapWebView` children 오버레이, `position:absolute; right: spacing[16]; bottom: spacing[16]`. NearbySpotCard/SelectedSpotCard가 하단 도킹될 때 **겹쳐 가려지지 않는다**(카드 위 z 또는 카드 높이만큼 bottom 상향 — ui-publisher 결정, 디바이스 스모크).
- **상태별 동작**(확정):
  | 권한 상태 | 버튼 가시성 | 탭 동작 |
  |---|---|---|
  | Undetermined | 표시 | 권한 요청 → granted면 즉시 재취득·재센터, 거부면 no-op |
  | Requesting | 표시 | no-op(요청 진행 중 — `refreshCoords`가 granted 아니라 null) |
  | Granted | 표시 | **현재위치 재취득 → 재센터 + me 마커 갱신 + 펄스** |
  | Granted + 재취득 실패 | 표시 | 직전 coords로 재센터(있으면), 없으면 no-op(무한로딩·에러배너 없음) |
  | Denied | **표시** | no-op(기존 permissionDenied 배너가 안내, 중복 금지) |
  - **버튼 가시성: 항상 표시.** 권한 상태와 무관하게 FAB는 늘 보인다(거부 사용자에게 버튼이 사라지는 혼란 방지). 거부 시 탭은 no-op.
- **원티드 토큰 사용 지점**: FAB 배경 `mk-card`(흰색 계열 카드 토큰), 아이콘 `#3B82F6`(킷 locate 전용 블루 — 브랜드 `#3366FF`와 미세 차이, **킷 verbatim 유지**: 킷이 디자인 기준), 헤어라인 보더/그림자 근사·radius·spacing은 RN theme 번역(ui-publisher).

## 5. 작업 목록 (각 인수조건 포함)

- [ ] **T1. `MapOutboundType.Recenter` 추가** (`types.ts`) — 인수조건: `MapOutboundType.Recenter === 'RECENTER'`이고 기존 Init/SetMarkers 불변 — 테스트: 상수 값 단언(T2 spec에 흡수 가능).
- [ ] **T2. `buildRecenterScript({me})` 헬퍼** (`mapMessages.ts`) — 인수조건: `me={lat:37.5,lng:127.0}` 입력 시 `window.__muklogRecenter({"type":"RECENTER","me":{"lat":37.5,"lng":127.0}})`를 포함하고 `true;`로 끝나는 문자열 반환 — 테스트: 단위(`mapMessages.spec.ts`에 케이스 추가, 직렬화 정확성·종결자).
- [ ] **T3. `__muklogRecenter` WebView 핸들러 + me 마커 갱신** (`mapHtml.ts`) — 인수조건: 생성된 HTML 문자열에 `window.__muklogRecenter` 정의·`panTo` 호출·`mkMeOverlay.setPosition`(갱신) 및 없을 때 생성 분기·`!mkMap`/`!payload.me` 가드가 포함되고, `__muklogInit`이 me 오버레이를 `mkMeOverlay`에 보관한다 — 테스트: 단위(`mapHtml.spec.ts`에 문자열 포함 단언; 실 panTo/마커 이동은 디바이스 스모크).
- [ ] **T4. MapTabScreen `handleLocate` 배선 + FAB onPress** (`MapTabScreen.tsx`) — 인수조건: granted에서 탭 → `refreshCoords` 1회 호출, 반환 coords로 `injectJavaScript`가 `buildRecenterScript` 결과(RECENTER+coords)로 **1회** 호출된다 — 테스트: 화면 단위(refreshCoords·injectJavaScript 모킹, press 시 순서·1회·페이로드 검증).
- [ ] **T5. 권한 분기 — 미결정 탭** — 인수조건: status=Undetermined에서 탭 → `permission.request()` 1회 호출(요청 후 granted면 재센터 경로 진행) — 테스트: 화면 단위(request 모킹 호출 단언; 요청 후 거부 시 inject 0).
- [ ] **T6. 권한 분기 — 거부/재취득 실패 탭** — 인수조건: status=Denied → `refreshCoords`·`injectJavaScript` 미호출(no-op) / Granted지만 `refreshCoords`가 null 반환 → `injectJavaScript` 미호출(no-op, 에러배너 없음) — 테스트: 화면 단위(양 분기 inject 미호출 단언).
- [ ] **T7. `useLocationPermission.refreshCoords()`** (`useLocationPermission.ts`) — 인수조건: granted일 때 `getCurrentPositionAsync` 1회 호출·coords 갱신·새 coords 반환 / granted 아니면 호출 0·null 반환 / in-flight 재진입 시 중복 호출 0 / 실패 시 직전 coords 폴백(없으면 null) — 테스트: 훅 단위(`useLocationPermission.spec.ts`에 expo-location 모킹 케이스 추가).
- [ ] **T8. `locate` 아이콘 등록** (`assets/icons/icons.ts` + `Icon.tsx` IconName) — 인수조건: `IconName.Locate==='locate'`, `ICON_SVG.locate`가 ui-design `assets/icons/locate.svg` **verbatim**(width/height 제거, viewBox 유지), `<Icon name={IconName.Locate}/>`가 `testID="icon-locate"` 렌더 — 테스트: 화면 단위(Icon 렌더 스모크). **ui-publisher 담당.**
- [ ] **T9. `MapLocateButton` 컴포넌트 + 펄스** (`components/`) — 인수조건: 우하단 FAB 렌더(locate 아이콘 24/blue, 46×46 radius999 mk-card), onPress 전달, 탭 시 펄스 1회 — 테스트: 화면 단위(렌더+onPress 콜백 단언; 펄스 비주얼·배치는 디바이스 스모크/qa-visual). **ui-publisher 담당.**
- [ ] **T10. 회귀 — 기존 INIT/SET_MARKERS/BOUNDS 경로 불변** — 인수조건: `npm test` 전부 green(기존 map spec·`__muklogInit` me 마커 경로 회귀 0) — 테스트: 전체 스위트.

## 5-1. 테스트 케이스 (TDD)
> 단위 대상: 순수 유틸(`buildRecenterScript`)·문자열 생성(`mapHtml`)·화면(`MapTabScreen` with mock)·훅(`useLocationPermission`). 모킹/스모크: 실제 Kakao `panTo`·`setPosition`·펄스 애니메이션·FAB 실배치는 **디바이스 스모크**(외부 SDK·네이티브 — testing-strategy 경계).

- **buildRecenterScript (T2)**
  - 정상: `{me:{lat:37.5665,lng:126.9780}}` → 페이로드에 정확한 lat/lng·`type:"RECENTER"` 포함, `__muklogRecenter` 호출 + `true;` 종결.
  - 경계: 음수/소수 좌표(`lat:-33.8, lng:151.2`) 직렬화 정확.
  - (me non-null 계약이므로 null 케이스는 호출부 T6에서 검증).
- **mapHtml `__muklogRecenter` + me 보관 (T3)**
  - 정상: HTML에 `window.__muklogRecenter =` 정의·`panTo`·`mkMeOverlay.setPosition` 포함, `__muklogInit`이 `mkMeOverlay =` 로 보관.
  - 분기(없을 때 생성): 핸들러에 `mkMeOverlay` falsy 시 신규 CustomOverlay 생성 문자열 존재.
  - 실패(가드): `if (!mkMap` / `!payload.me` 가드 문자열 존재(런타임 null 방어 — 실행은 디바이스).
- **MapTabScreen handleLocate (T4·T5·T6)**
  - 정상(T4): granted → press → `refreshCoords` 1회 → 반환 coords로 `injectJavaScript` 1회(인자 RECENTER+coords). 순서 단언.
  - 미결정(T5): Undetermined → press → `request` 1회. 요청 후 granted 모킹 시 재센터 진행 / 거부 모킹 시 inject 0.
  - no-op(T6): Denied → refreshCoords·inject 0 / Granted+refreshCoords=null → inject 0 / 에러 오버레이 미표출(state 불변).
  - 경계(연타): 빠른 2회 press → refreshCoords in-flight 가드로 GPS 중복 0(훅 T7이 가드 보장), inject는 완료된 호출만.
- **refreshCoords (T7)**: granted 1회 호출·coords 갱신·반환 / denied 호출 0·null 반환 / in-flight 재진입 중복 0 / getCurrentPositionAsync throw 시 직전 coords 폴백(없으면 null), throw 전파 안 함.
- **회귀(T10)**: 기존 `mapMessages.spec`·`mapHtml.spec`(INIT me 마커)·`useLocationPermission.spec`·`parseMapMessage.spec`·MapTabScreen 관련 스모크 전부 green.

## 6. 엣지케이스
- **E1. 빈 상태(핀 0개)**: 핀 없어도 FAB 동작 동일(재센터는 핀 무관, me 좌표만). 핀 0이어도 버튼 표시·동작.
- **E2. 권한 미결정 첫 탭**: `request` OS 다이얼로그 1회(`requestedRef` 가드로 중복 없음). 허용 시 같은 탭 흐름에서 `refreshCoords`→재센터(요청 직후 status 비동기 갱신은 §3.7 주의·refreshCoords의 granted 가드로 안전 흡수). 거부 시 no-op.
- **E3. 권한 거부**: no-op. 지도·다른 기능 차단 없음. MapStatusOverlay 기존 `permissionDenied` 배너가 안내(중복 안내 금지).
- **E4. granted지만 재취득 실패(타임아웃)**: `refreshCoords`가 직전 coords 폴백(있으면 그 좌표로 재센터), 없으면 null→no-op. 무한 로딩·에러 배너·throw 없음(§6 정합).
- **E5. 네트워크 실패/지도 SDK 미준비(mapReady=false)**: WebView `__muklogRecenter`의 `!mkMap` 가드로 흡수(크래시 없음). 지도 ERROR(mapErrored)에서도 RECENTER는 무해(panTo no-op). FAB는 지도 영역이라 SDK 에러 시 가려질 수 있음 — qa-visual 확인.
- **E6. 동시성(커플 2명)**: 위치는 각자 디바이스 로컬. 공유 상태 없음 → 충돌 0. 한 명의 재센터가 상대 화면에 영향 0.
- **E7. me 마커 위치 정합**: 재취득한 fresh 좌표로 `panTo` + `mkMeOverlay.setPosition` 동시 적용 → 카메라 중심과 파란 점이 일치. INIT 시 me 없던(권한 늦게 허용) 경우 핸들러가 마커를 신규 생성(파란 점이 처음 등장).
- **E8. 연속 탭(debounce 없음)**: 탭마다 흐름 1회. `refreshCoords` in-flight 가드로 GPS 재취득 중복 0. inject는 완료된 호출만 1회. 폴링 아님(사용자 입력 1:1). 디바운스 불요(§8).
- **E9. 입력 한계**: 본 기능은 사진/인원 입력과 무관(N/A).
- **E10. 인증(익명 만료 등)**: 위치 기능은 인증 무관(로컬). N/A.

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)
- `buildRecenterScript`(생산: mapMessages) ↔ `__muklogRecenter`(소비: mapHtml) — **메시지 shape `{type:'RECENTER', me:{lat,lng}}` 양쪽 일치**(키명·중첩 구조). qa-logic이 양 파일 동시 확인.
- `__muklogInit` me 오버레이 보관(`mkMeOverlay`) ↔ `__muklogRecenter` 갱신/생성 — **동일 변수 참조 일치**(보관 안 하면 갱신 불가 회귀). qa-logic 확인.
- `useLocationPermission.refreshCoords`(생산: Coords|null) ↔ `handleLocate`(소비: null 가드 후 inject) — **null이 헬퍼로 새지 않는지**(호출부 가드).
- `MapTabScreen.handleLocate`(생산: 권한 분기·refreshCoords·me) ↔ `buildRecenterScript`(소비: me non-null 계약) — granted·non-null만 inject.
- `MapTabScreen`(생산: onPress 배선) ↔ `MapLocateButton`(소비: onPress prop) — props 시그니처 일치(ui-publisher↔developer).
- `MapOutboundType.Recenter` enum ↔ 직렬화 `type` 리터럴 — 'RECENTER' 단일 출처(하드코딩 불일치 금지).
- `IconName.Locate`/`ICON_SVG.locate`(생산: 등록) ↔ `MapLocateButton`(소비: `<Icon name>`) — 키 일치 + ui-design verbatim(qa-visual).
- `panTo`가 유발하는 idle → `emitBounds` → `useNearbyPlaces` — **재센터가 nearby 과호출을 일으키지 않는지**(기존 디바운스/캐시 가드 유효, qa-logic §8).

## 8. 비용 가드레일 체크 (§6)
- **위치 폴링/watchPosition 금지** — FAB는 **사용자 탭 시에만** 동작(이벤트 1:1). 백그라운드 추적 0. ✅
- **`getCurrentPositionAsync`는 탭당 1회** — `refreshCoords` in-flight 가드로 연타 중복 차단. 폴링 아님. ✅
- **Kakao Local 호출 0** — 재센터는 panTo(카메라 이동)+마커 setPosition만, Local API 미사용. nearby 조회는 기존 idle/디바운스 경로 재사용(신규 호출 없음). ✅
- **Supabase/DB 호출 0**, 이미지 처리 0, AWS 미사용. ✅
- 디바운스 불요(사용자 입력 기반, 폴링 아님). panTo idle은 기존 가드레일이 흡수.
