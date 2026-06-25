# dev-notes-B — 그룹 B 지도 (#4·#5)

실기기 버그 2건 수정. 그룹 B(map) 파일만 수정. `kakaoCategory.ts`·`categories.ts`(그룹 C) 미변경. TDD(Red→Green). 컨벤션 100%.

---

## #4 지도 첫 진입 디폴트가 서울역(현위치 아님)

### 근본 원인
첫 진입 흐름의 타이밍 불일치:
1. `MapTabScreen`이 진입 시 `requestLocationOnEnter` 이펙트로 `permission.request()` 호출 → 비동기.
2. `permission.request()`는 권한 grant 후 `Location.getCurrentPositionAsync()`로 좌표를 받는데, GPS 첫 픽스는 수 초 걸림.
3. 그 사이 WebView가 먼저 `READY`를 보내고, `handleMessage`가 `sendInit()`으로 **그 시점의** `center = initialRegion({ coords: permission.coords=null, pins })`를 INIT으로 주입 → coords가 null이라 **핀 bbox 또는 DEFAULT_REGION(서울시청)** 폴백으로 센터링.
4. 이후 `coords`가 도착해도 **지도를 재센터하는 경로가 없었음**. "내 위치" FAB(`handleLocate`)만 명시적으로 `RECENTER`를 inject해서 정상 동작했던 것.

즉 `initialRegion` 로직 자체는 옳음(coords 있으면 coords 사용). 문제는 **READY 시점에 coords가 아직 없어 폴백으로 INIT되고, 늦게 도착한 coords로 재센터하지 않은 것**.

### 수정 (파일:라인)
`src/navigation/screens/MapTabScreen.tsx`
- L66 부근: `autoCenteredRef = useRef(false)` 추가 — 첫 진입 현위치 자동 센터링 1회 가드.
- `sendInit()`(L89~): INIT center가 이미 현위치면(`permission.coords` 존재) 자동 RECENTER 불필요 → `autoCenteredRef.current = true`로 가드 소진.
- `autoRecenterOnFirstFix` 이펙트 신설(L146 부근, 의존성 `[mapReady, myCoords]`): mapReady && !autoCenteredRef.current && coords 도착 시 1회 `buildRecenterScript`를 inject하고 가드 소진. 이후 coords 변경(사용자 이동)은 따라가지 않음(FAB로만 재센터).

분기 정리:
- coords가 READY **전**에 있으면 → INIT이 이미 현위치 센터 → sendInit이 가드 소진 → 자동 RECENTER no-op.
- coords가 READY **후** 도착(실기기 GPS 첫 픽스, 흔한 경로) → 자동 RECENTER 1회로 현위치 센터.
- 권한 거부/획득 실패 → coords null 유지 → 자동 RECENTER 없음 → 기존대로 핀 bbox/서울 폴백(의도된 동작).

### 테스트
`src/navigation/screens/MapTabScreen.spec.tsx`(신규 3건, 모두 green):
- READY 후 coords 도착 시 1회 자동 RECENTER inject(좌표 정합).
- coords가 READY 전부터 있으면 INIT 센터가 현위치라 자동 RECENTER 안 함.
- 자동 RECENTER는 1회만 — coords가 또 바뀌어도(사용자 이동) 따라가지 않음(첫 픽스만).

### 디바이스 스모크 (사용자 안내 — 단위테스트 한계)
실제 GPS 좌표·WebView panTo는 단위테스트 경계 밖. 디바이스에서 확인 필요:
- 권한 미부여 상태로 지도 탭 첫 진입 → 권한 다이얼로그 표시 → 허용 시 지도가 **현재 위치**로 센터링(서울역 고정 아님).
- 이미 권한 허용된 상태로 재진입 → 현위치 센터링.
- 권한 거부 → 서울 폴백 + "위치 권한을 허용하면…" 배너(차단 아님).

---

## #5 지도에서 음식 종류 텍스트 상단 살짝 가려짐

### 근본 원인
타이포 토큰 `meta`(`src/theme/tokens.ts` L209)는 `size:13, ratio:1` → `lineHeight = round(13*1) = 13`으로 **lineHeight == fontSize**. 한글 글리프(SUIT-Medium)는 lineHeight가 fontSize와 같으면 윗부분(상단 어센더/한글 윗 획)이 클리핑됨(메모리 qa-layout-blind-spot 패턴). 지도 카드 메타줄(주변 음식점 카드의 "카테고리 · 거리", 선택 카드의 "· 카테고리 · area")이 이 토큰을 써서 상단이 잘림.

### 수정 (파일:라인) — 그룹 B 파일만, 글로벌 토큰 미변경
`tokens.ts`(공용 테마, 타 화면 전체 영향 + ui-publisher 소유)는 건드리지 않고, **지도 카드 메타에서만** lineHeight를 넉넉히(18, ratio≈1.38) 인라인 오버라이드. `Text` 컴포넌트가 `style`을 마지막에 머지하므로 인스턴스 오버라이드가 토큰을 덮음.
- `src/features/map/components/NearbySpotCard.tsx`: `META_LINE_HEIGHT = 18` 상수 추가, 메타 `Text` style에 `lineHeight: META_LINE_HEIGHT` 추가.
- `src/features/map/components/SelectedSpotCard.tsx`: 동일(`META_LINE_HEIGHT = 18`, 메타 `Text`에 적용).

MapLegend 라벨은 `caption`(ratio 1.4) / 카드 타이틀은 `cardTitle`(ratio 1.3)이라 클리핑 없음 → 그대로 둠.

### 테스트
- `NearbySpotCard.spec.tsx`(신규 1건): 메타 텍스트 flatten 스타일의 `lineHeight > fontSize`.
- `SelectedSpotCard.spec.tsx`(신규 1건): 동일.

### 디바이스 스모크 (사용자 안내)
한글 글리프 실제 렌더 클리핑은 픽셀 검증 영역(메모리 qa-layout-blind-spot). 디바이스에서 주변/선택 스팟 카드의 카테고리 텍스트 상단이 잘리지 않는지 육안 확인.

---

## 생산자 ↔ 소비자 매핑 (QA 교차검증용)

| 변경 | 생산자 | 소비자 |
|------|--------|--------|
| #4 자동 RECENTER | `useLocationPermission`(coords) + `autoRecenterOnFirstFix` 이펙트 → `buildRecenterScript` | WebView `window.__muklogRecenter`(mapHtml) |
| #4 가드 소진 | `sendInit`(coords 존재 시) | `autoCenteredRef` |
| #5 lineHeight | `META_LINE_HEIGHT` 인라인 style | `Text`(style 마지막 머지) → 메타줄 렌더 |

## 테스트 결과
`npx jest src/features/map src/navigation/screens/MapTabScreen.spec.tsx` → **26 suites / 228 tests green**. 회귀 0.
(전체 suite·tsc는 리더가 통합 후 1회 — 그룹 규칙대로 미실행.)

## 미완/주의
- 없음. 단 #4·#5 모두 실제 픽셀/GPS 검증은 디바이스 스모크 필요(위 안내).
- 글로벌 `meta` 토큰의 lineHeight==fontSize 문제는 타 화면에도 잠재 → 근본 수정은 ui-publisher가 토큰 레벨에서 검토 권장(본 그룹 범위 밖이라 지도 한정으로만 처리).
