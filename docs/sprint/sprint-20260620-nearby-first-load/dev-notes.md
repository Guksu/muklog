# Dev Notes — 주변 음식점 첫 로드 즉시화 (nearby-first-load)

## 변경/신규 파일
- **수정** `src/features/map/useNearbyPlaces.ts` — 첫 조회 leading-edge 분기 추가(단일 파일 변경).
- **수정** `src/features/map/useNearbyPlaces.spec.ts` — 신규 즉시성 테스트(T1-a~d, T2) 추가 + 기존 "디바운스 3회 수렴"을 G1(첫 조회 warm 후 2회차+ 트레일링)로 의미 보존 갱신.
- **신규 산출물** 이 문서.

## 핵심 구현 (첫 조회 분기 방식)
- 상수 `NEARBY_FIRST_DELAY_MS = 0`(export) 추가 — 0틱 leading-edge 의미 명시(매직넘버 회피).
- `debounceNearbyFetch` effect에서 캐시·동일키·최소이동 임계 분기를 **모두 통과한 뒤**(= 캐시 미스 + 임계 이상) 타이머 예약 직전에:
  ```
  const delay = last === null ? NEARBY_FIRST_DELAY_MS : NEARBY_DEBOUNCE_MS;
  const timer = setTimeout(runNearbySearch, delay);
  ```
  `last`은 `lastQueriedRef.current`. 첫 조회(`null`)만 0ms, 2회차+는 500ms 트레일링.
- cleanup의 `clearTimeout(timer)`는 두 경로 동일 — **0ms 타이머도 회수 대상**. 이것이 invoke≤1과 언마운트 유령 invoke 방지의 핵심.

## invoke ≤1 논리 (T2)
- 첫 진입 INIT relayout/setCenter가 idle을 다발로 쏴 `setBounds`가 연속 들어와도, effect는 `[bounds]` 변경마다 재실행되며 **직전 effect의 cleanup이 직전 0틱 타이머를 clearTimeout** → 마지막 bounds 1건만 발사. 0틱을 흘리면 `searchNearby` 정확히 1회(마지막 bbox).
- 동일 viewport 재-idle은 그보다 상위의 `last.key === key` 분기에서 return → 추가 0. 두 방어선으로 첫 진입 2회 이상 invoke 없음.

## 불변(동결) 확인
- 계약 불변: `searchNearby`/`nearby-search` 호출 인자·응답 shape, `nearbyToMapMarkers`(saved:false)·머지·dedup, 에러처리(status='error'+markers []), 훅 시그니처 `UseNearbyPlacesResult` 전부 미수정.
- 가드레일 회귀 0: 캐시/최소이동/동일키 분기는 타이머 예약 **이전 상위**에서 평가되므로 leading-edge와 독립. G1~G5 전부 green.
- 순수 JS 변경 → Dev Client 재빌드 불필요. 의존성·네이티브 추가 0.

## 테스트 결과
- `npx jest src/features/map/useNearbyPlaces.spec.ts` → 12 passed (기존 7 + 신규 5: T1-a/b/c/d, T2; "디바운스 3회"는 G1로 갱신).
- `npm test` 전체 → **136 suites / 1168 tests 통과**(baseline 1163 + 5, 회귀 0).
- `npx tsc --noEmit` → exit 0.

## qa-logic 교차검증 경계면
- **`mapHtml.ts`(INIT relayout/setCenter idle) ↔ `MapTabScreen`(BOUNDS_CHANGED→nearby.setBounds) ↔ `useNearbyPlaces`(첫 조회 분기)**: 첫 진입 idle 다발이 몇 번 쏘이든 invoke≤1을 RN(0틱 타이머 cleanup)이 흡수하는지 — T2가 단위로 못박음, 라이브는 디바이스 스모크.
- **훅 외부 계약 불변**: `setBounds`/`markers`/`items`/`status` 소비처(SET_MARKERS 재주입·NearbySpotCard lookup·status 사용) 영향 없음 — 변경은 내부 타이머 delay 결정뿐.
- **spec 의미 보존**: 갱신된 G1이 "첫 조회 즉시 + 2회차+ 트레일링"을 모두 단언(warm 후 mockClear → 3회 대이동 1회 수렴).

---

## 보완: 첫 bounds 명시 emit (2026-06-20)

### 근본 원인(재확정)
이전 수정(useNearbyPlaces 첫 조회 0틱화)은 **조회가 트리거된 이후의 지연**만 줄였고, 트리거 자체가 안 되는 버그는 못 고쳤다. `mapHtml.ts __muklogInit`에서 첫 nearby 조회를 트리거하는 **유일한 경로가 `idle` 리스너 하나뿐**이었는데, INIT 직후 `setTimeout(0)`의 `relayout()`+`setCenter(center)`(같은 센터)는 **idle을 발화하지 않아** 첫 `BOUNDS_CHANGED`가 RN으로 안 나갔다 → `useNearbyPlaces.setBounds` 미호출 → 첫 조회 0. 사용자가 지도를 직접 움직여 idle을 만들어야 비로소 조회됨. (저장핀=내 맛집은 `renderMarkers`로 INIT에서 동기 렌더라 항상 즉시 보여 둘이 차이가 났음.)

### 수정 (mapHtml.ts __muklogInit)
- `setTimeout(0)` 블록에서 `relayout()`+`setCenter(center)` **직후 `emitBounds()`를 명시 1회 호출**(idle 의존 제거). relayout로 컨테이너 사이즈가 확정된 뒤라 `getBounds()`가 유효 bbox 반환. 함수명 `initEmitFirstBounds`.
- belt-and-suspenders: 초기 레이아웃이 늦게 안정화되는 기기 대비, `setTimeout(~60ms)`에서 `emitBounds()` 한 번 더(`initEmitFirstBoundsRetry`). 중복 emit이 와도 RN 양자화 키 dedup + 첫조회 0틱 cleanup으로 invoke≤1 보장(비용 안전).
- 기존 `idle` 리스너는 **이후 사용자 이동용으로 유지**(제거 금지). `emitBounds`의 `if (!mkMap) return;` 가드 그대로 활용.

### 변경/신규 파일
- `src/features/map/mapHtml.ts` — init 경로 명시 emit(+ 60ms 재emit), 주석 갱신.
- `src/features/map/mapHtml.spec.ts` — 신규 3건: (1) init 경로(idle 콜백 밖)에 `emitBounds();` 명시 호출 존재, (2) 명시 emit이 `relayout()` 이후 위치, (3) idle 리스너 유지(회귀 0). idle 콜백 등록(`addListener(..., emitBounds)`)과 직접 호출(`emitBounds();`)을 문자열로 구분 단언.
- `src/features/map/useNearbyPlaces.spec.ts` — 신규 T2-b: 명시 emit + 60ms 재emit(동일 bbox) → invoke 정확히 1회(양자화 키 dedup + 0틱 cleanup).

### 핵심 수정 + invoke≤1 유지 논리
- 명시 emit 위치: `initEmitFirstBounds`의 `mkMap.setCenter(center)` **직후**(유효 bbox 보장). 추가 `initEmitFirstBoundsRetry`(60ms)는 belt-and-suspenders.
- invoke≤1: 첫 emit·재emit·혹시 모를 idle이 모두 같은 viewport(동일 양자화 키)라 — 같은 0틱 창이면 effect cleanup이 직전 0틱 타이머를 clearTimeout → 마지막 1건만 발사, 다른 틱이면 `last.key === key` 분기에서 return. 두 방어선으로 사용자 동작 없이 첫 조회 invoke 정확히 1회.

### 테스트 결과
- `npm test` 전체 → **136 suites / 1172 tests 통과**(회귀 0, 신규 4건 추가).
- `npx tsc --noEmit` → exit 0.
- 순수 JS/HTML 문자열 변경 → Dev Client 재빌드 불필요. 라이브 핀 첫 진입 자동 등장은 **디바이스 스모크**로 확인.

### qa-logic 교차검증 경계면
- **`mapHtml.ts`(init 명시 emit) ↔ `MapWebView`/`MapTabScreen`(BOUNDS_CHANGED→nearby.setBounds) ↔ `useNearbyPlaces`(첫 조회 분기)**: 사용자 idle 없이 첫 BOUNDS_CHANGED가 나가 첫 조회가 트리거되는지(라이브는 디바이스 스모크), 그리고 명시+재emit+idle 다발에도 invoke≤1인지(T2/T2-b 단위로 못박음).
- **계약/회귀 불변**: READY/INIT/SET_MARKERS/RECENTER/MARKER_TAP/ERROR 메시지 계약, `renderMarkers`(저장핀 동기 렌더), idle 리스너(이동 시 emit), 훅 시그니처 전부 미수정 — 변경은 init 경로의 명시 emit 추가뿐.
