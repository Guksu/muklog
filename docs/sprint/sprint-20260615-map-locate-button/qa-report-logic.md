# QA Report — Logic·Integration (map-locate-button)

> 검증자: qa-logic / 일자: 2026-06-15 / 범위: 로직·통합 정합성·비용·TDD·컨벤션(비주얼 제외)
> 결과: **전 항목 통과(PASS)**. 실패 0 / 미검증(비주얼 위임) 2 / 회귀 0.
> 근거: `npm test` 832 passed / 108 suites, `tsc --noEmit` clean. load-bearing 변이 표본 확인 완료.

## 통과 (PASS)

### 경계면 1 — `buildRecenterScript({me})` ↔ `__muklogRecenter`
- 생산자 `mapMessages.ts:43-46`: `JSON.stringify({ type: MapOutboundType.Recenter, me })` → shape `{type:'RECENTER', me:{lat,lng}}`. `MapOutboundType.Recenter`(`types.ts:90`) 단일 출처 사용(하드코딩 'RECENTER' 없음). `true;` 종결 확인.
- 소비자 `mapHtml.ts:133-146`: `payload.me.lat/lng`로 `LatLng` 생성 → 키명·중첩구조 양쪽 일치.
- 테스트 `mapMessages.spec.ts:38-54`: type·lat·lng·종결자 단언 + 음수/소수 좌표 경계. PASS.

### 경계면 2 — `__muklogInit` mkMeOverlay 보관 ↔ `__muklogRecenter` 갱신/생성
- `mapHtml.ts:48` 모듈 스코프 `var mkMeOverlay = null` 승격. `mapHtml.ts:104-108` INIT이 `mkMeOverlay =`에 저장(`setMap(mkMap)`).
- `mapHtml.ts:137-145` 핸들러: `mkMeOverlay` 있으면 `setPosition(pos)`, 없으면(권한 늦게 허용) 동일 비주얼로 신규 생성 — 동일 모듈 스코프 변수 참조 일치. 카메라(`panTo:136`)+마커 둘 다 fresh 좌표로 이동.
- 가드 `if (!mkMap || !payload || !payload.me) return`(`:134`) 존재. 테스트 `mapHtml.spec.ts:60-76` panTo·`mkMeOverlay =`·setPosition·`!mkMap`/`!payload.me` 단언. PASS.

### 경계면 3 — `refreshCoords()` (useLocationPermission.ts:69-87)
- granted 가드(`:70` status !== Granted → null, GPS 호출 0). in-flight 가드(`:71` `refreshingRef` → 중복 `getCurrentPositionAsync` 0, finally에서 해제 `:84-86`). 실패 시 `catch`에서 `coordsRef.current` 폴백(없으면 null `:83`), throw 미전파.
- `coordsRef`(렌더마다 `:30` 갱신)로 stale 클로저 방지. 기존 `{status, coords, request}` 불변 + `refreshCoords` 추가(`:89`) — 회귀 0.
- 테스트 `useLocationPermission.spec.ts:84-184`: granted 1회·null 반환·폴백·null 폴백·**in-flight deferred 중복 0**(실제 promise 보류로 검증, 껍데기 아님). PASS.

### 경계면 4 — `handleLocate` 분기 (MapTabScreen.tsx:93-101)
- Undetermined → `await request()`(`:94-96`). Denied → `return`(`:97`, refreshCoords/inject 0). granted → `refreshCoords`(`:98`) → `if (!me) return`(`:99`, non-null만 inject) → `buildRecenterScript({me})` inject 1회(`:100`). null이 헬퍼로 새지 않음(호출부 가드, non-null 계약 충족).
- **load-bearing 변이 표본**: `if (!me) return` 제거 시 T5(미결정→거부)·T6(granted+null) 테스트 즉시 red 확인 → 테스트 유의미. (Denied 경로는 조기 return으로 보호되어 변이에도 green = 분기 정확.)
- 테스트 `MapTabScreen.spec.tsx:280-334`: T4(granted inject 1회·payload·refreshCoords 1회·request 미호출), T5(미결정 request 1회·inject 0), T6(거부 no-op / granted+null no-op·에러배너 없음). PASS.

### 비용 가드레일 (경계면 5)
- 탭당 위치 1회: `refreshCoords` in-flight 가드. watchPosition/폴링 grep 0(map 슬라이스 전체). RECENTER=`panTo`(`mapHtml.ts:136`, 지도 재init 없음 → idle 재발화/nearby 재조회/마커 깜빡임 없음). `panTo` idle은 기존 `emitBounds`→BOUNDS_CHANGED→`useNearbyPlaces` 디바운스/캐시가 흡수.
- 신규 Kakao Local/Supabase/이미지/AWS 호출 0. RLS·DDL 무관(위치는 디바이스 로컬). PASS.

### 회귀 0 (경계면 6)
- INIT/SET_MARKERS/BOUNDS_CHANGED/MARKER_TAP·useMuklogPins·useNearbyPlaces·선택카드 경로 불변. 기존 map spec 전부 green. `MapOutboundType.Init/SetMarkers` 불변(`types.ts:88-89`). `npm test` 832 passed(dev-notes 주장 일치), 신규 +5 screen·+27 누적 반영. PASS.

### TDD·컨벤션
- 인수조건 T1~T7·T10 ↔ 대응 spec 전부 존재·green. `tsc --noEmit` clean.
- 컨벤션 grep(map 슬라이스+MapTabScreen): `useCallback`/`useMemo` 0건, `export function` 컴포넌트/훅 0건, useEffect 콜백 명명 함수(`requestLocationOnEnter`·`reinjectMarkersOnChange`), 함수 인자 named-object(`{me}`·`{markers}` 등), enum-style 상수(`MapOutboundType.Recenter`·`IconName.Locate`), 파일명=심볼명. 위반 0. PASS.
- 토큰 경유: FAB가 `theme.color.surface`·`theme.radius.full`·`theme.shadow.fab`·`color="mapLocate"`(`MapLocateButton.tsx:25-39`) 사용. `mapLocate=#3B82F6`(`tokens.ts:59,102`)·`shadow.fab`(`tokens.ts:138`) 정의·테스트(`tokens.spec.ts:102-109`). RN 측 raw hex 0(WebView 내부 `#3366FF` me마커는 HTML 격리 영역 — 기존 정책). PASS.

### deviation 평가 (경계면 7)
- 카드 도킹 시 FAB bottom = `spacing[80]+spacing[40]`=120px(`MapTabScreen.tsx:218-220`) 토큰 합성, 매직넘버 회피. 로직상 문제 없음(z겹침 회피 의도 명확). **정확한 시각 오프셋은 qa-visual 위임.**

## 미검증 (비주얼 위임 — qa-visual)
- `ICON_SVG.locate`(`assets/icons/icons.ts:36`)가 ui-design `locate.svg`와 **verbatim 글리프 일치**하는지(viewBox 보존·width/height 제거는 확인됨, path 정밀 대조는 시안 영역).
- FAB 46×46/radius999/그림자/우하단 배치·펄스 애니메이션 실제 비주얼.

## developer 수정요청
- **없음.** 로직·통합·비용·TDD·컨벤션 전 항목 통과. 라이브 디바이스 스모크(dev-notes 체크리스트 6항목)는 디바이스에서 확인 권장(외부 SDK panTo/펄스·FAB 카드회피 실배치).
