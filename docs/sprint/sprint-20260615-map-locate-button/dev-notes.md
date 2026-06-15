# dev-notes — map-locate-button (지도 현재위치 버튼)

> 슬라이스 1·2 위 증분. **회귀 0**(전체 827 green, 기존 706+ → +121 누적). 단일 출처: plan.md §3~5.
> 본 스프린트는 **A(로직·HTML, ui 독립)** 를 완료. **B(화면 배선 + FAB 컴포넌트)** 는 ui-publisher의 `MapLocateButton`·ui-spec·`locate` 아이콘(T8·T9) 산출이 선행 조건이라 **대기 중**(아래 §미해결).

## A. 완료 — 로직·HTML (T1·T2·T3·T7)

### 변경 파일
| 파일 | 변경 | 작업 |
|---|---|---|
| `src/features/map/types.ts` | `MapOutboundType.Recenter = 'RECENTER'` 추가(Init/SetMarkers 불변) | T1 |
| `src/features/map/mapMessages.ts` | `buildRecenterScript({me:Coords})` 신설 | T2 |
| `src/features/map/mapMessages.spec.ts` | RECENTER 직렬화·종결자·음수/소수 좌표 케이스 | T2 |
| `src/features/map/mapHtml.ts` | `mkMeOverlay` 모듈 스코프 승격(INIT 보관) + `window.__muklogRecenter`(panTo + setPosition/없으면 생성 + `!mkMap`/`!payload.me` 가드) | T3 |
| `src/features/map/mapHtml.spec.ts` | `__muklogRecenter`·panTo·`mkMeOverlay`·setPosition·가드 문자열 단언 | T3 |
| `src/features/map/useLocationPermission.ts` | `refreshCoords(): Promise<Coords\|null>` 신설(granted 가드·in-flight 가드·실패 시 직전 coords 폴백) | T7 |
| `src/features/map/useLocationPermission.spec.ts` | refreshCoords: granted 1회·null 반환·폴백·null 폴백·in-flight 중복 0 | T7 |

### 생산자 ↔ 소비자 매핑 (QA 교차검증 경계면)
- **`buildRecenterScript`(생산: mapMessages)** ↔ **`__muklogRecenter`(소비: mapHtml)** — 메시지 shape `{type:'RECENTER', me:{lat,lng}}` 양쪽 일치. `type`은 `MapOutboundType.Recenter` 단일 출처(하드코딩 불일치 없음). 종결자 `true;`.
- **`__muklogInit` me 오버레이 보관(`mkMeOverlay =`)** ↔ **`__muklogRecenter` 갱신/생성** — 동일 모듈 스코프 변수 참조. INIT에서 me 있으면 `mkMeOverlay`에 저장, RECENTER가 `setPosition`으로 재배치. INIT 시 me 없던(권한 늦게 허용) 경우 RECENTER 핸들러가 동일 비주얼로 신규 생성.
- **`useLocationPermission.refreshCoords`(생산: `Coords\|null`)** ↔ **`handleLocate`(소비: 예정)** — 계약상 granted 아니거나 실패+직전coords없음이면 `null` 반환. null 가드는 호출부(B) 책임. `buildRecenterScript`는 non-null `Coords`만 받음(타입으로 강제).
- **비용 가드레일**: `refreshCoords`는 `getCurrentPositionAsync` **탭당 1회**(in-flight `refreshingRef` 가드로 연타 중복 0). watchPosition/폴링 없음. RECENTER는 panTo(지도 재init 없음 → 마커 깜빡임/idle 폭주 없음). panTo가 유발하는 idle은 기존 `emitBounds`→BOUNDS_CHANGED→`useNearbyPlaces` 디바운스/캐시 가드가 흡수(신규 호출 0). Kakao Local/Supabase/이미지 호출 0.

### 구현 노트
- `refreshCoords`는 화살표 `const`, 매개변수 없음(현재위치 취득은 인자 불요). `request` 본문도 폴백 일관성 위해 `coordsRef.current` 갱신하도록 정리(회귀 없음 — 기존 케이스 그대로 green).
- `coordsRef`(렌더마다 `coordsRef.current = coords`)로 실패 폴백 시 stale 클로저 방지. `refreshingRef`로 in-flight 가드.
- mapHtml의 me 마커 비주얼(16px 파란 점/흰 보더 `#3366FF`)은 INIT·RECENTER 동일(WebView 격리 영역 — 킷 hex 유지, 기존 정책). 모양 변경 없음, 위치만.

## B. 완료 — 화면 배선 + FAB (T4·T5·T6)

> ui-publisher 산출물(`MapLocateButton`·`IconName.Locate`·`color.mapLocate`·`shadow.fab`·ui-spec) 확정 후 배선 완료. 비주얼 임의 변경 없음(컴포넌트·토큰 그대로 소비).

### 변경 파일
| 파일 | 변경 | 작업 |
|---|---|---|
| `src/navigation/screens/MapTabScreen.tsx` | `handleLocate`(async) 신설 + `MapLocateButton` 우하단 오버레이 마운트(`buildRecenterScript`/`MapLocateButton` import) + `cardDocked`로 카드 도킹 시 bottom 상향 | T4·T5·T6 |
| `src/navigation/screens/MapTabScreen.spec.tsx` | FAB 렌더(항상 표시)·T4(granted inject 1회)·T5(미결정 request)·T6(거부/refreshCoords=null no-op) | T4·T5·T6 |

### 배선 상세 (생산자 ↔ 소비자)
- **`MapLocateButton.onPress`(소비) ← `MapTabScreen.handleLocate`(생산)**: props 시그니처 `{onPress, testID}` 일치. testID `map-locate-button` 부여(화면 테스트 식별).
- **`handleLocate` 흐름**(plan §3.7): `status===Undetermined`면 `await permission.request()` → `status===Denied`면 `return`(no-op) → `me = await permission.refreshCoords()` → `if (!me) return` → `webviewRef.current?.injectJavaScript(buildRecenterScript({me}))`. null 가드가 호출부에 있어 `buildRecenterScript`로 null이 새지 않음(non-null 계약 충족).
- **배치**: `MapWebView` children 오버레이(형제 아님 — MapWebView가 children 지원). 래퍼 `View style={[styles.locate, {right: spacing[16], bottom: cardDocked ? spacing[80]+spacing[40] : spacing[16]}]}`. 카드 도킹 시 FAB를 카드 높이만큼 상향(매직넘버 회피 위해 토큰 합성 120px). 버튼 **항상 표시**(권한 무관).
- **진입 effect ↔ FAB 탭의 request 중복**: 진입 시 `requestLocationOnEnter` effect가 undetermined면 `request` 1회 호출(기존 회귀 동작 유지). FAB를 미결정 중 탭하면 `handleLocate`가 `request`를 또 호출하나 `useLocationPermission.request` 내부 `requestedRef` 가드로 OS 다이얼로그 중복 0(안전). 테스트 T5는 진입 호출분을 `mockClear` 후 탭 경로만 분리 검증.

### 비용 가드레일(B 반영 확인)
- FAB 탭 → `refreshCoords` **탭당 1회**(in-flight 가드). 폴링/watchPosition 0. RECENTER는 panTo(지도 재init 없음). 신규 Kakao/Supabase 호출 0.

## 라이브 스모크 체크리스트 (디바이스)
- [ ] 지도 드래그로 이동 후 FAB 탭 → 현재위치로 부드럽게 재센터(panTo, 줌 유지) + 파란 점(me 마커)이 현재위치로 이동.
- [ ] 권한 거부 상태에서 FAB 탭 → no-op(에러 배너/무한 로딩 없음, 기존 permissionDenied 배너만 유지).
- [ ] 미결정 첫 탭 → OS 권한 다이얼로그 1회, 허용 시 같은 흐름에서 재센터.
- [ ] FAB 연타 → GPS 재취득 중복 0(in-flight 가드), 재센터 정상.
- [ ] 핀 0개여도 FAB 동작 동일(재센터는 me 좌표만).
- [ ] FAB가 SelectedSpotCard/NearbySpotCard 하단 도킹 시 가려지지 않음(ui-publisher 배치).

## 테스트 결과
- `npx tsc --noEmit` 클린.
- `npm test` 전체 **832 passed / 108 suites**(A: +27 누적분 포함, B: +5 screen 추가). 기존 map-tab 슬라이스 1·2 **회귀 0**.
