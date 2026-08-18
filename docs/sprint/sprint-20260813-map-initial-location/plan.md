# Sprint: 지도 초기위치 선취득 (map-initial-location)

> 작성일 2026-08-13 · planner · 선행 스프린트: `sprint-20260614-map-tab`(슬라이스1 초기 region·권한) · `sprint-20260615-map-locate-button`(refreshCoords·RECENTER) · `sprint-20260702-map-pins-cache`(모듈/로컬 캐시 선례) · `map-prewarm`(WebView 프리워밍)

## 0. 문제 정찰 — 왜 서울시청으로 시작하나 (코드로 확정한 타이밍 체인)

사용자 관측("지도 첫 진입 시 내 위치가 아닌 디폴트로 시작")은 **재현 가능한 레이스**이며, 원인은 위치 취득이 느려서가 아니라 **위치 취득이 지도 READY보다 늦게 *시작*하기 때문**이다.

| 시각 | 사건 | 근거 |
|------|------|------|
| t0 | 앱 부팅 → `AuthGate` authenticated → `AppNavigator`(홈 탭). **지도 탭은 lazy — MapTabScreen 미마운트** | `src/navigation/AuthGate/AuthGate.tsx:45-59` |
| t0+첫프레임+1200ms | `MapPrewarm` 마운트 → 숨김 WebView가 Kakao SDK 부팅(READY까지). **위치는 의도적으로 손대지 않음** | `MapPrewarm.tsx:8-11`(권한·RPC 미보유 명시), `PREWARM_DELAY_MS = 1200` |
| tN (사용자가 지도 탭 탭) | `MapTabScreen` 첫 마운트. **이 순간 `permission.coords === null`** (훅 초기값) | `useLocationPermission.ts:19-21` |
| tN+0 (렌더 1) | `center = initialRegion({ coords: null, pins })` → 핀 있으면 bbox 중심, **핀 없으면 `DEFAULT_REGION`(서울시청 37.5665/126.978)** | `MapTabScreen.tsx:112`, `initialRegion.ts:12` |
| tN+ε | effect `requestLocationOnEnter` → `permission.request()` 시작 → `await requestForegroundPermissionsAsync()`(이미 granted여도 네이티브 왕복) → **`await getCurrentPositionAsync({ Balanced })` = 새 GPS 픽스(수백 ms~수 초, 실내면 더, 실패 가능)** | `MapTabScreen.tsx:117-124`, `useLocationPermission.ts:41-70` |
| tN+α (α ≪ GPS) | WebView가 **프리워밍된 환경 덕에 빠르게** 부팅 → `READY` → `sendInit()` → **coords가 아직 null인 렌더의 center로 INIT** | `MapTabScreen.tsx:163-167, 137-143` |
| tN+β (β ≫ α) | GPS 픽스 도착 → `autoRecenterOnFirstFix`가 1회 `RECENTER` → 지도가 서울시청에서 **뒤늦게 점프** | `MapTabScreen.tsx:228-237` |

**핵심 통찰 2가지**

1. **프리워밍이 문제를 악화시켰다.** `map-prewarm`이 READY를 −63% 앞당긴 만큼(메모리 `map-perf-bottleneck`) α가 줄어 `α ≪ β` 격차가 벌어졌다. 즉 이건 프리워밍의 부작용이 아니라 **위치 취득만 워밍되지 않은 비대칭**이다. 지도 부팅은 워밍하면서 위치는 안 워밍한 것이 이번 스프린트의 공백이다.
2. **`getCurrentPositionAsync`는 구조적으로 이 레이스를 못 이긴다.** 새 픽스는 하드웨어 대기라 아무리 일찍 시작해도 수백 ms 이상이다. **OS가 이미 갖고 있는 마지막 위치(`getLastKnownPositionAsync`)는 즉시 반환**되므로, 이걸 쓰지 않는 한 첫 프레임 센터는 항상 폴백이 된다.

**결론:** 고쳐야 할 것은 "위치를 더 빨리 받기"가 아니라 **"INIT 시점에 이미 손에 쥔 좌표가 있게 하기"**다.

## 1. 기능 한줄 정의

지도 탭에 처음 들어갔을 때, 지도가 **첫 프레임부터 내 동네를 센터로** 뜬다 — 서울시청 폴백을 보고 몇 초 뒤 점프하는 일이 없다. (위치 권한이 없거나 마지막 위치조차 없으면 기존 폴백 그대로.)

## 2. 범위

**In-scope**
- 앱 구동(인증 세션) 유휴 시점에 **권한이 이미 허용된 경우에만** OS 캐시 위치(`getLastKnownPositionAsync`)를 1회 선취득해 **프로세스 메모리 캐시**에 적재 (`LocationPrewarm`).
- `useLocationPermission`이 그 캐시를 **첫 렌더에 동기 시드** → `initialRegion`이 렌더 1부터 실좌표를 받는다.
- 지도 탭 진입 시에도 `getCurrentPositionAsync` **이전에** `getLastKnownPositionAsync`로 즉시 시드(앱 구동 워밍이 없었던 경우의 2차 안전망).
- 좌표 **출처(`warm` | `fresh`) 구분** 도입 → 자동 RECENTER 1회 가드가 "정밀 픽스 도착 시"에만 소진되도록 정정.
- 권한 취소·좌표 이상치·staleness 가드.

**Out-of-scope (일부러 안 함)**
- **좌표의 디스크 영속(AsyncStorage)** — `pinsCache` 선례가 있지만 위치는 다르다. 프라이버시 등급이 올라가고(앱 삭제 전까지 남는 위치 기록), 세션 간 staleness가 무한해진다. **메모리 캐시만.** (§8 참조)
- `watchPositionAsync`·폴링·백그라운드 위치 — 영구 금지(비용·배터리·프라이버시).
- 앱 구동 시 **권한 요청 트리거** — 절대 금지(§6 E1). 권한 프롬프트는 지금처럼 지도 탭 진입 시에만.
- 새 GPS 픽스를 앱 구동 시 돌리기 — 지도를 안 여는 사용자에게 매 구동 GPS를 깨우는 낭비 (§3.5 대안 비교에서 기각).
- 지도 줌 레벨 개인화, 마지막으로 본 영역 복원, 현재위치 마커 펄스 — 별도 후속.
- 비주얼 변경 일체.

## 3. 데이터 · API 계약

### 3.1 DB / Edge / 마이그레이션
**변경 0.** 테이블·컬럼·RLS·RPC·Edge Function 전부 불변. 순수 클라이언트 스프린트다.

### 3.2 신규 모듈: `src/features/map/lastKnownLocation/`

프로세스 수명 메모리 캐시 + 권한 게이트된 expo-location 래퍼. **절대 throw하지 않는다**(모든 실패는 조용히 null).

```ts
/** 마지막 위치 허용 나이(ms) — 이보다 오래된 OS 캐시는 무시(다른 도시에서 시작 방지). */
export const LAST_KNOWN_MAX_AGE_MS = 3_600_000; // 1시간
/** 최소 요구 정확도(m) — 이보다 부정확한 캐시는 무시. */
export const LAST_KNOWN_REQUIRED_ACCURACY_M = 1000;

/**
 * 권한이 이미 허용된 경우에만 OS 캐시 위치를 읽어 메모리 캐시에 적재한다.
 * 권한 프롬프트를 절대 띄우지 않는다(getForegroundPermissionsAsync = 비프롬프트 getter).
 * @returns 적재된 좌표 또는 null(권한 없음·캐시 없음·실패)
 */
export const warmLastKnownLocation = (): Promise<Coords | null>;

/** 메모리 캐시를 동기로 읽는다(렌더 중 호출 가능). @returns 좌표 또는 null */
export const readWarmCoords = (): Coords | null;

/** 최신 좌표로 메모리 캐시를 갱신한다(fresh 픽스 도착 시 훅이 호출). */
export const writeWarmCoords = ({ coords }: { coords: Coords }): void;

/** 메모리 캐시를 비운다(권한 거부·취소 확인 시). 테스트 격리에도 사용. */
export const clearWarmCoords = (): void;
```

- `warmLastKnownLocation` 내부 순서: `getForegroundPermissionsAsync()` → `granted !== true`면 **`getLastKnownPositionAsync` 미호출·즉시 null 반환** → granted면 `getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS, requiredAccuracy: LAST_KNOWN_REQUIRED_ACCURACY_M })` → 결과 `{ coords: { latitude, longitude } }`를 `{ lat, lng }`로 매핑해 캐시 적재.
- **중복 호출 가드**: in-flight ref로 동시 호출 1회화. 이미 캐시가 있으면 재호출하지 않는다(멱등).
- 반환 위치가 null이거나 `latitude`/`longitude`가 유한수가 아니면 캐시 미적재.
- **설치 확인 완료**: `expo-location@~18.0.10`에 `getLastKnownPositionAsync`·`getForegroundPermissionsAsync`·`LocationLastKnownOptions{maxAge, requiredAccuracy}` 모두 존재(`node_modules/expo-location/build/Location.d.ts`). **JS API 표면만 추가 — 네이티브 재빌드 불필요, 신규 네이티브 모듈 0.**

### 3.3 신규 컴포넌트: `src/features/map/LocationPrewarm/`

`MapPrewarm`과 **동일 패턴·동일 위치**의 형제. 렌더 결과는 항상 `null`(비주얼 0).

```ts
export type LocationPrewarmProps = {
  /** false면 워밍하지 않음(킬 스위치·테스트 토글). 기본 true. */
  enabled?: boolean;
};
export const LocationPrewarm = ({ enabled }: LocationPrewarmProps): null;
```

- `useDeferredFlag({ delayMs: LOCATION_PREWARM_DELAY_MS })`로 **첫 페인트 후**에만 동작 → 콜드스타트 첫 프레임과 경합 0.
- `LOCATION_PREWARM_DELAY_MS = 400`. **MapPrewarm의 1200ms보다 앞선다** — 위치 워밍은 네트워크·렌더 비용이 사실상 0이라 무거운 WebView 워밍보다 먼저 끝내는 게 유리하고, 두 워밍이 같은 프레임에서 겹치지 않는다.
- deferred true가 되면 `void warmLastKnownLocation()` **1회**. 이후 재호출 없음(모듈 멱등 가드가 이중 방어).
- `AuthGate`의 **authenticated 분기에서만** 마운트(`<MapPrewarm />` 바로 옆). 미인증 사용자는 위치를 건드리지 않는다.

### 3.4 변경: `useLocationPermission` (하위호환 확장)

```ts
// 반환 계약 (기존 4개 + 신규 1개)
{
  status: LocationPermissionStatus;              // 불변
  coords: Coords | null;                          // 불변(단, 초기값이 warm 캐시에서 올 수 있음)
  coordsSource: LocationCoordsSource | null;      // ★신규 — coords가 null이면 null
  request: () => Promise<void>;                   // 불변 시그니처
  refreshCoords: () => Promise<LocationFix | null>; // ★개정 R1 — 좌표와 함께 출처를 반환(구 Coords|null)
}
```

`src/features/map/types/types.ts`에 enum-style 상수 추가(컨벤션 §enum-style):

```ts
/** 현재위치 좌표의 출처 — warm=OS 캐시(마지막 위치, 근사) / fresh=이번 세션의 실제 픽스(정밀). */
export const LocationCoordsSource = { Warm: 'warm', Fresh: 'fresh' } as const;
export type LocationCoordsSource = (typeof LocationCoordsSource)[keyof typeof LocationCoordsSource];

/** 좌표 + 그 좌표의 출처 쌍 — 출처를 잃지 않고 전달하기 위한 반환형(개정 R1). */
export type LocationFix = { coords: Coords; source: LocationCoordsSource };
```

동작 규칙:

| # | 상황 | 결과 |
|---|------|------|
| R1 | 훅 마운트 | `useState(() => readWarmCoords())` **lazy initializer로 동기 시드**. 값이 있으면 `coordsSource = Warm`. 없으면 `null`/`null`. status는 여전히 `Undetermined`에서 시작(권한 상태와 좌표 보유는 독립). |
| R2 | `request()` → granted | ① `coords`가 아직 없으면 `getLastKnownPositionAsync`로 **즉시 시드**(source=`Warm`) → ② 이어서 기존대로 `getCurrentPositionAsync` → 성공 시 `coords` 갱신 + source=`Fresh` + `writeWarmCoords`. |
| R3 | `request()` → granted인데 `getCurrentPositionAsync` 실패/타임아웃 | **warm 좌표를 유지**(기존엔 null로 남았음). source=`Warm` 유지. → 지도는 근사 위치로라도 뜬다. |
| R4 | `request()` → denied (또는 권한 모듈 throw) | `setCoords(null)` + `coordsSource=null` + **`clearWarmCoords()`** — 권한 없는데 이전 warm 좌표로 me 마커를 그리는 일 방지. |
| R5 | `refreshCoords()` 성공 | 좌표 갱신 + source=`Fresh` + `writeWarmCoords`. **반환값 `{ coords, source: Fresh }`**(개정 R1). in-flight 가드 불변. |
| R6 | `refreshCoords()` 실패 | 직전 coords 폴백. source 불변. **반환값은 그 폴백 좌표의 실제 출처를 그대로 실어 보낸다** — 직전 값이 warm이었으면 `{ coords, source: Warm }`(개정 R1). 폴백할 좌표조차 없으면 `null`. |

**불변 보장**: `request()`의 중복 가드(`requestedRef`), `refreshCoords()`의 in-flight 가드, denied 흡수(지도 미차단), 폴링/watchPosition 미사용 — 전부 그대로.

> **개정 R1 (2026-08-13, 리더 승인 · qa-logic 승인)** — 위 R5·R6의 반환형이 `Coords | null` → `LocationFix | null`로 바뀌었다. 상세 사유는 §11.

### 3.5 `initialRegion` — **변경 없음**

우선순위 `coords → 핀 bbox → DEFAULT_REGION(서울시청)`이 이미 옳다. 이번 스프린트는 **"coords가 렌더 1에 존재하게" 만들 뿐**이다. 폴백 체인 자체는 손대지 않으므로 위치 취득이 전부 실패해도 회귀 0.

최종 폴백 체인:
```
warm 좌표(앱 구동 선취득)          ← 이번 스프린트가 채우는 자리
  └ 없으면 → 탭 진입 시 last-known  ← 2차 안전망
      └ 없으면 → fresh GPS 픽스(늦게 도착 → RECENTER 1회)
          └ 없으면 → 핀 bbox 중심   ← 기존
              └ 없으면 → DEFAULT_REGION 서울시청  ← 기존
```

### 3.6 변경: `MapTabScreen` — 자동 RECENTER 가드 정정

현재 `sendInit()`은 `permission.coords`가 있기만 하면 `autoCenteredRef.current = true`로 1회 가드를 소진한다(`MapTabScreen.tsx:139`). warm 좌표가 생기면 **이 줄이 버그가 된다** — 근사 좌표로 INIT한 뒤 정밀 픽스가 도착해도 RECENTER가 막혀 지도 센터와 me 마커가 최대 1km 어긋난 채 고정된다.

```
- if (permission.coords) autoCenteredRef.current = true;
+ if (permission.coordsSource === LocationCoordsSource.Fresh) autoCenteredRef.current = true;
```

그리고 `autoRecenterOnFirstFix`는 **fresh 좌표가 도착했을 때만** 발화하도록 조건을 `coordsSource === Fresh`로 좁힌다(warm 좌표 도착만으로는 RECENTER 불필요 — 이미 INIT이 그 좌표로 그려졌으므로 중복 주입 0).

결과 UX: **첫 프레임 = 내 동네(warm) → 정밀 픽스 도착 시 같은 동네 안에서 조용한 소폭 보정(RECENTER 1회)**. 오늘의 "서울시청 → 수 초 후 대륙 이동" 점프가 사라진다.

## 4. 화면 · UX

**신규/변경 화면 0. 비주얼 변경 0.** 사용자가 보는 차이는 "지도가 처음부터 올바른 곳에 있다" 하나뿐이다.

| 상태 | 오늘 | 이번 스프린트 후 |
|------|------|-----------------|
| 권한 granted + 마지막 위치 있음 | 서울시청/핀bbox → (수 초) → 내 위치로 점프 | **첫 프레임부터 내 동네** → 소폭 정밀 보정 |
| 권한 granted + 마지막 위치 없음(재설치 직후 등) | 서울시청 → 점프 | 동일(회귀 0) |
| 권한 denied | 서울시청/핀bbox + "위치 권한을 허용하면…" 배너 | 동일(회귀 0) |
| 권한 undetermined(첫 실행) | 탭 진입 시 프롬프트 | 동일 — **앱 구동 시 프롬프트 없음(E1)** |
| 위치 취득 실패 | 서울시청/핀bbox 고정 | warm 있으면 warm 유지, 없으면 동일 |

- 로딩/에러/빈 상태 카피: `MAP_COPY` 그대로. 신규 카피 0.
- **원티드 토큰 사용 지점 없음** — 렌더 산출물이 없는 스프린트.
- **▶ ui-publisher 판정: 불필요.** 신규 컴포넌트 `LocationPrewarm`은 `null`을 반환하고 스타일·레이아웃·카피를 일절 갖지 않는다. 킷 `templates/muklog` 대비 변경 대상 화면이 없으므로 **ui-spec.md 산출 없음 · qa-visual 생략 가능**(qa-logic만 진행). 단, qa-visual이 돌 경우 "지도 탭 렌더 트리 변화 0 확인"만 수행하면 된다.

## 5. 작업 목록

- [ ] **T1. `LocationCoordsSource` 상수 추가** (`src/features/map/types/types.ts`) — 인수조건: `LocationPermissionStatus`와 같은 enum-style 패턴으로 `Warm`/`Fresh` 2값이 export되고 타입이 값에서 파생된다 — 테스트: 타입 컴파일 + 소비 모듈 테스트에서 상수 참조.
- [ ] **T2. `lastKnownLocation` 모듈 신설** — 인수조건: 권한 미허용이면 `getLastKnownPositionAsync`가 **호출조차 되지 않고** null 반환 / 허용이면 `{maxAge:3600000, requiredAccuracy:1000}` 인자로 1회 호출해 `{lat,lng}`를 캐시에 적재 / 어떤 예외도 밖으로 새지 않는다 — 테스트: `lastKnownLocation.spec.ts` (권한 게이트·인자·매핑·throw 흡수·멱등·read/clear).
- [ ] **T3. `LocationPrewarm` 컴포넌트 신설** — 인수조건: deferred 전에는 `warmLastKnownLocation` 호출 0 / deferred 후 정확히 1회 / `enabled=false`면 0회 / 렌더 산출물은 `null` — 테스트: `LocationPrewarm.spec.tsx`(fake timers + `useDeferredFlag` 경과).
- [ ] **T4. `AuthGate`에 `LocationPrewarm` 마운트** — 인수조건: authenticated 분기에서만 렌더되고, unauthenticated/loading/error 분기에서는 렌더되지 않는다(= 미인증 사용자에겐 위치 접근 0) — 테스트: `AuthGate.spec.tsx`에 상태별 마운트 단언 추가.
- [ ] **T5. `useLocationPermission` warm 시드 + `coordsSource`** — 인수조건: 캐시가 있으면 **첫 렌더에서 이미** `coords`가 채워져 있고 `coordsSource==='warm'` / granted 시 last-known 시드 후 fresh로 승격돼 `coordsSource==='fresh'` / fresh 실패 시 warm 유지 / denied 시 coords null + 캐시 clear — 테스트: `useLocationPermission.spec.ts` 확장(기존 케이스 전부 green 유지).
- [ ] **T6. `MapTabScreen` 자동 RECENTER 가드 정정** — 인수조건: warm 좌표로 INIT된 뒤 fresh 좌표가 도착하면 RECENTER가 **정확히 1회** 주입된다 / READY 시점에 이미 fresh였으면 RECENTER 0회 / warm→warm 갱신만으로는 RECENTER 0회 — 테스트: `MapTabScreen.spec.tsx` 확장.
- [ ] **T7. INIT center·me 검증** — 인수조건: warm 좌표 보유 시 READY 직후 주입되는 INIT 스크립트의 `center.lat/lng`와 `me`가 warm 좌표와 일치한다(서울시청 아님) — 테스트: `MapTabScreen.spec.tsx`에서 injectJavaScript 인자 문자열 파싱 단언.
- [ ] **T8. 회귀 스윕** — 인수조건: `npm test` 전체 green, 신규/변경 파일이 `docs/code-convention.md` 100% 준수(화살표 함수·named-object 인자·명명된 useEffect·useCallback/useMemo 미사용) — 테스트: `npm test`.

## 5-1. 테스트 케이스 (TDD)

`docs/testing-strategy.md` 경계 준수 — expo-location은 **모킹**(우리 코드의 호출·매핑·분기만 검증), 실제 GPS 타이밍·OS 캐시 존재 여부는 **디바이스 스모크**.

### 단위 — `lastKnownLocation.spec.ts`
| 경로 | 케이스 | 기대 |
|------|--------|------|
| 정상 | granted + 위치 반환 | 캐시 적재, `readWarmCoords()`가 `{lat,lng}` 반환 |
| 정상 | 인자 계약 | `getLastKnownPositionAsync`가 `{maxAge:3600000, requiredAccuracy:1000}`로 호출 |
| **경계** | 권한 `denied`/`undetermined` | `getLastKnownPositionAsync` **미호출**, null 반환, 캐시 비어있음 |
| **경계** | `getLastKnownPositionAsync`가 `null` 반환(캐시 없음) | 캐시 미적재, null 반환, 예외 0 |
| **경계** | 좌표가 NaN/Infinity/누락 | 캐시 미적재(이상치 차단) |
| **경계** | 연속 2회 호출 | 네이티브 호출 1회(멱등·in-flight 가드) |
| 실패 | 권한 getter throw / 위치 getter throw | null 반환, **예외 전파 0** |
| 정상 | `writeWarmCoords`→`readWarmCoords` 왕복 / `clearWarmCoords` | 갱신·비움 동작 |

### 단위 — `LocationPrewarm.spec.tsx`
| 경로 | 케이스 | 기대 |
|------|--------|------|
| **경계** | deferred 전(타이머 미경과) | `warmLastKnownLocation` 0회 |
| 정상 | deferred 경과 | 정확히 1회 |
| 정상 | 리렌더 다수 | 여전히 1회 |
| **경계** | `enabled={false}` | 0회 |
| 정상 | 렌더 결과 | `null`(UI 트리 영향 0) |

### 단위 — `AuthGate.spec.tsx` (확장)
| 경로 | 케이스 | 기대 |
|------|--------|------|
| 정상 | authenticated | `LocationPrewarm` 마운트 |
| **경계** | loading / unauthenticated / error | 마운트 0 (미인증 위치 접근 0) |

### 단위 — `useLocationPermission.spec.ts` (확장, 기존 케이스 전부 유지)
| 경로 | 케이스 | 기대 |
|------|--------|------|
| 정상 | warm 캐시 존재 상태로 마운트 | **첫 렌더**에 `coords` 채움, `coordsSource==='warm'`, status는 `undetermined` |
| 정상 | 캐시 없음 | 기존과 동일(`coords===null`, `coordsSource===null`) |
| 정상 | request→granted, last-known 있음→fresh 성공 | 최종 `coordsSource==='fresh'`, 좌표=fresh, `writeWarmCoords` 호출 |
| **경계** | request→granted, last-known 있음→**fresh 실패** | `coords`=last-known **유지**(null로 떨어지지 않음), source `'warm'` |
| **경계** | request→granted, last-known 없음→fresh 성공 | 기존 동작과 동일 |
| 실패 | request→denied | `coords===null`, `coordsSource===null`, `clearWarmCoords` 호출, `getCurrentPositionAsync` 미호출 |
| 실패 | 권한 모듈 throw | denied 흡수(기존) + 캐시 clear |
| **경계** | `refreshCoords` 연타 | 기존 in-flight 가드대로 네이티브 1회 |
| 정상 | `refreshCoords` 성공 (**개정 R1**) | `{ coords: fresh, source: 'fresh' }` 반환 |
| **경계** | `refreshCoords` 실패 + 직전 좌표가 **warm** (**개정 R1**) | `{ coords: warm, source: 'warm' }` 반환 — **`'fresh'`로 마킹되지 않는다**(이 단언이 §11 회귀의 파수꾼) |
| **경계** | `refreshCoords` 실패 + 폴백 좌표 없음 (**개정 R1**) | `null` 반환 |

### 단위 — `MapTabScreen.spec.tsx` (확장)
| 경로 | 케이스 | 기대 |
|------|--------|------|
| 정상 | warm coords 보유 + READY | INIT `center`/`me`가 warm 좌표(서울시청 아님) |
| 정상 | warm INIT 후 fresh 도착 | `RECENTER` 정확히 1회 |
| **경계** | READY 시점에 이미 fresh | `RECENTER` 0회(INIT이 이미 정밀) |
| **경계** | fresh 도착 후 좌표 재변경 | 추가 RECENTER 0회(1회 가드 유지) |
| **경계** | coords 없음 + 핀 없음 | INIT center = `DEFAULT_REGION`(기존 폴백 회귀 0) |
| **경계** | coords 없음 + 핀 있음 | INIT center = 핀 bbox 중심(기존 회귀 0) |
| 실패 | denied | 기존 배너 카피 유지, me 마커 주입 0 |

### 디바이스 스모크 (단위 대상 아님 — 사용자 환경)
1. 권한 허용 상태로 **앱 완전 종료 후 재실행** → 홈에서 3초 대기 → 지도 탭 → **첫 프레임이 내 동네**인지(서울시청 미노출) 육안 확인.
2. 앱 재실행 직후 **곧바로**(1초 내) 지도 탭 진입 → 워밍이 안 끝난 경우에도 탭 진입 last-known 시드로 폴백이 안 보이는지.
3. **첫 설치/권한 미결정** → 앱 구동 시 **위치 프롬프트가 뜨지 않는지**(E1 핵심) → 지도 탭 진입 시에만 뜨는지.
4. 설정에서 위치 권한 **끈 뒤** 앱 재실행 → 지도 탭 → me 마커 없음 + 권한 배너 정상.
5. 비행기모드/실내 등 GPS 실패 유도 → warm 좌표로 지도가 뜨고 무한 로딩 없음.
6. 배터리: 앱 구동 후 지도 미진입 시 위치 아이콘(상태바 GPS 표시)이 **켜지지 않는지** — last-known은 GPS를 깨우지 않음을 실측 확인.

## 6. 엣지케이스

| # | 엣지케이스 | 처리 |
|---|-----------|------|
| **E1** | **권한 미허용인데 앱 구동 시 위치 요청 트리거** | **절대 금지.** `warmLastKnownLocation`은 비프롬프트 getter `getForegroundPermissionsAsync`로 게이트하고, `granted !== true`면 위치 API를 **호출조차 하지 않는다**. `requestForegroundPermissionsAsync`는 이 경로에서 사용 금지(권한 플로우 회귀 방지). T2·스모크 3으로 강제. |
| E2 | 미인증(로그인 전) 사용자 | `LocationPrewarm`이 authenticated 분기에만 마운트 → 위치 접근 0(T4). |
| E3 | OS 마지막 위치가 없음(재설치·부팅 직후) | `getLastKnownPositionAsync` → null → 캐시 미적재 → 기존 폴백 체인 그대로(회귀 0). |
| E4 | 마지막 위치가 매우 오래됨(어제 다른 도시) | `maxAge` 1시간 초과분은 OS가 null 반환 → 폴백. 1시간 내이면 채택하되 fresh 픽스가 곧 보정(RECENTER 1회). |
| E5 | 마지막 위치가 부정확(셀타워 수 km) | `requiredAccuracy: 1000m` 미달이면 미채택. 채택돼도 fresh 보정. |
| E6 | 좌표 이상치(NaN/Infinity/0,0) | 유한수 검증 후에만 캐시 적재. `initialRegion`은 이미 NaN 안전(map-tab §6). |
| E7 | **세션 중 사용자가 설정에서 권한 취소** | 다음 `request()`/`refreshCoords()`가 denied로 귀결 → `clearWarmCoords()` + coords null → me 마커 사라짐(R4). 권한 없는 채로 stale 좌표를 그리지 않는다. |
| E8 | 워밍과 지도 탭 진입이 **동시** 발생(사용자가 즉시 탭) | 모듈 in-flight 가드로 네이티브 호출 1회. 훅의 시드는 캐시가 아직 비었으면 자기 경로(R2 ①)로 독립 취득 → 어느 쪽이 먼저여도 좌표 1개로 수렴. |
| E9 | 워밍 완료 **이후** 훅이 마운트 | lazy initializer가 동기로 읽음 → 렌더 1에 반영(레이스 없음). |
| E10 | 워밍이 훅 마운트 **이후** 완료 | 훅은 이미 자기 경로로 시드/취득 중 → 캐시는 다음 마운트를 위해 남음. 훅이 캐시를 폴링하지 않는다(불필요한 구독 0). |
| E11 | 커플 2명 동시 사용 | 위치는 **기기 로컬**이라 공유 상태 없음 — 동시성 이슈 0. 서버 왕복 0. |
| E12 | 네트워크 없음 | last-known은 OS 로컬 캐시라 **네트워크 무관**하게 동작. 오히려 오프라인에서 개선 폭이 가장 크다. |
| E13 | 계정 전환(로그아웃→다른 계정) | 위치는 사용자 데이터가 아닌 기기 상태라 `pinsCache`식 userId 네임스페이싱 불필요. 단 프로세스 메모리라 앱 종료 시 소멸(디스크 잔존 0). |
| E14 | 지도 탭 재진입(바텀탭은 언마운트 안 됨) | 훅이 유지되므로 추가 취득 0. `writeWarmCoords`가 fresh를 캐시에 반영해 만약의 재마운트도 정밀 좌표로 시작. |
| E15 | `MapPrewarm`(1200ms)과 워밍(400ms) 경합 | 시점 분리로 같은 프레임 경합 0. 위치 워밍은 렌더/네트워크 비용 0에 가까워 첫 페인트 영향 무시 가능. |
| E16 | 지도 SDK ERROR 후 `handleRetry` | `sendInit()` 재주입 시 그 시점 최신 coords 사용 — warm이든 fresh든 정상 동작(기존 경로 불변). |

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

qa-logic이 **양쪽을 같이 열어** 볼 쌍:

1. `LocationPrewarm`(생산자) ↔ `lastKnownLocation` 메모리 캐시(저장소) ↔ `useLocationPermission` lazy initializer(소비자) — **동기 시드가 실제로 렌더 1에 반영되는지**가 이 스프린트의 급소.
2. `useLocationPermission.coordsSource`(생산자) ↔ `MapTabScreen.sendInit` 가드 + `autoRecenterOnFirstFix`(소비자) — **`Fresh`로 좁히지 않으면 me 마커가 stale 고정되는 회귀**가 발생. 두 지점을 반드시 함께 읽을 것.
3. `useLocationPermission.coords`(생산자) ↔ `initialRegion`(불변 확인) ↔ `buildInitScript({center, markers, me})`(소비자) — `center`와 `me`가 **같은 좌표원**을 쓰는지.
4. `warmLastKnownLocation`의 권한 게이트(`getForegroundPermissionsAsync`) ↔ `MapTabScreen.requestLocationOnEnter`의 권한 요청(`requestForegroundPermissionsAsync`) — **두 경로가 섞이지 않았는지**(워밍 경로에 request 계열이 단 하나도 없어야 함). `grep`으로 확인 권장.
5. `AuthGate` 분기(생산자) ↔ `LocationPrewarm` 마운트 조건(소비자) — 미인증 트리에 위치 접근이 새지 않는지.
6. `useDeferredFlag`(생산자) ↔ `LocationPrewarm`·`MapPrewarm` 두 소비자 — 지연값 400/1200이 의도대로 분리돼 있는지, 언마운트 정리 누수 0인지.
7. 기존 `refreshCoords`/FAB 경로(`handleLocate`) ↔ 신규 source 필드 — **FAB 재센터가 회귀하지 않는지**(map-locate-button 인수조건 재확인). **개정 R1 반영**: `refreshCoords`가 `LocationFix{coords, source}`를 반환하므로 소비자(`handleLocate` 1곳)가 `fix.coords`로 RECENTER하고 `fix.source`를 그대로 상태에 반영하는지 확인 — **실패 폴백 좌표를 무조건 `Fresh`로 마킹하지 않는 것**이 검증 핵심(§11).

## 8. 비용 · 프라이버시 · 배터리 가드레일 체크

| 항목 | 판정 | 근거 |
|------|------|------|
| **Kakao Local API 호출 증가** | **0** (감소 가능) | nearby는 `BOUNDS_CHANGED` 구동이며 이번 변경은 메시지 채널을 건드리지 않는다. 오히려 INIT 센터와 RECENTER 후 센터가 **같은 동네**가 되어 `useNearbyPlaces`의 양자화 캐시·최소이동 임계가 2번째 조회를 흡수할 여지가 커진다(오늘은 서울시청↔실위치라 반드시 2회). |
| **Supabase 호출 증가** | **0** | RPC·쿼리·Realtime·Edge Function 변경 0. |
| **AWS 리소스** | **미사용** | 해당 없음. |
| **폴링 / `watchPositionAsync`** | **없음** | 취득은 전부 **이벤트 기반 1회** — 앱 구동 유휴 1회 + 탭 진입 1회 + FAB 탭당 1회. 타이머 반복·구독 0. |
| **배터리** | **사실상 0 추가** | `getLastKnownPositionAsync`는 **GPS를 켜지 않고** OS 캐시만 읽는다. 앱 구동 시 새 픽스(`getCurrentPositionAsync`)를 돌리지 않는 것이 §2 Out-of-scope 결정의 핵심 근거 — 지도를 안 여는 사용자에게 매 구동 GPS를 깨우면 낭비다. |
| **네트워크** | **0** | last-known은 로컬 I/O. |
| **프라이버시** | **디스크 영속 0** | 좌표는 **프로세스 메모리에만** 존재하고 앱 종료 시 소멸. AsyncStorage 영속을 의도적으로 기각(§2). 서버 전송 0, 로깅 0. 권한 없으면 좌표를 **읽지도 않는다**(E1). |
| **네이티브 재빌드** | **불필요** | `expo-location@~18.0.10` 기존 의존성의 **JS API 표면만** 추가 사용(설치본 `.d.ts`에서 3개 API 존재 확인). 신규 네이티브 모듈 0 → 메모리 `native-module-lazy-require`가 경고하는 "의존성 추가 ≠ 기능 활성" 상황에 **해당하지 않음**. |
| **뮤테이션 규범** | 준수 | 이번 스프린트는 DB 뮤테이션 0. 뮤테이션 검증이 필요한 경우 격리 사본(`src/` 밖 + `testMatch` 미매치 + 즉시 삭제) 규범을 따른다. |

## 9. 대안 비교 (왜 이 설계인가)

| 대안 | 초기 정확성 | 배터리 | 프라이버시 | 복잡도 | 판정 |
|------|------------|--------|-----------|--------|------|
| **A. 현행 유지** (탭 진입 시 fresh 픽스만) | ✗ 항상 폴백부터 | 기준 | 기준 | - | 문제 그 자체 |
| **B. 탭 진입 시 last-known 선시드만** | △ 대체로 이김(권한 왕복+스케줄링 여지로 비결정적) | 0 | 최상 | 최소 | **채택(2차 안전망 R2①)** |
| **C. 앱 구동 시 last-known 워밍 + B** | ✓ 렌더 1 동기 시드 = **레이스 자체가 소멸** | ~0(GPS 미기동) | 메모리 한정 | 소 | **★채택(주 설계)** |
| D. 앱 구동 시 **fresh 픽스** 워밍 | ✓ | ✗ 매 구동 GPS 기동(지도 미사용자도) | 상시 정밀 위치 취득 | 중 | **기각** — 배터리·프라이버시 대비 이득이 C와 사실상 동일 |
| E. 좌표 AsyncStorage 영속 | ✓ 첫 구동 즉시 | 0 | ✗ 디스크에 위치 잔존 | 중 | **기각** — 프라이버시 등급 상승 + 무한 staleness |
| F. `watchPositionAsync` 상시 구독 | ✓✓ | ✗✗ | ✗ | 중 | **기각** — 비용 가드레일 정면 위반 |
| G. 프리워밍 WebView에 위치까지 태우기 | ✓ | ~0 | 보통 | ✗ | **기각** — `MapPrewarm`의 "권한·RPC 미보유" 구조적 격리(권한 팝업 앞당김 차단)를 깨뜨린다. 별도 컴포넌트로 분리 유지 |

**채택: C + B 레이어링.** 앱 구동 워밍(C)이 정상 경로를 결정적으로 만들고, 탭 진입 시드(B)가 워밍이 못 끝난 경우(사용자가 즉시 탭)를 덮는다. 둘 다 GPS를 깨우지 않으므로 배터리 비용은 사실상 0이며, 사용자 제안("앱 구동 시 위치를 확인해 가져다 쓰자")을 **권한·배터리 안전한 형태로** 구현한 것이다.

## 10. 완료 기준

- [ ] T1~T8 전부 완료, 각 인수조건이 테스트로 표현됨
- [ ] `npm test` 전체 green (기존 케이스 회귀 0)
- [ ] 신규·변경 파일이 `docs/code-convention.md` 100% 준수
- [ ] qa-logic 리포트 `qa-report-logic.md` 통과 (§7 경계면 7쌍 교차검증)
- [ ] qa-visual: **생략 판정**(비주얼 변경 0, §4) — 진행 시 "렌더 트리 변화 0"만 확인
- [ ] 디바이스 스모크 6항목은 사용자 환경 이월(특히 스모크 3 = 앱 구동 시 권한 프롬프트 미발생)

## 11. 개정 이력

### R1 — `refreshCoords` 반환형 `Coords | null` → `LocationFix | null` (2026-08-13)

**승인**: 리더 승인 · qa-logic 승인 완료(2026-08-13). **제기 경위**: developer가 구현 중 qa 주의점 ②에 대응하며 §3.4의 "불변 시그니처" 선언을 **의도적으로 이탈**함.

**사유** — 계획 원안의 결함이었다. §3.4 R6은 `refreshCoords` 실패 시 "직전 coords 폴백"인데, **그 직전 좌표가 warm일 수 있다.** 반환형이 `Coords | null`이면 출처 정보가 반환 경로에서 소실되고, FAB 소비자(`handleLocate`)는 받은 좌표를 무조건 `Fresh`로 마킹할 수밖에 없다. 그 순간:

1. 근사 좌표(최대 1km 오차)에 "정밀" 딱지가 붙고,
2. `autoCenteredRef` 1회 가드가 소진되며,
3. **이후 진짜 정밀 픽스가 도착해도 자동 보정이 영구히 차단된다.**

이는 §3.6에서 정정한 `MapTabScreen.tsx:139` 버그와 **동일한 실패 양식**이다 — 좌표의 출처를 잃어버린 채 정밀도를 가정하는 것. 이번 스프린트가 고치려는 바로 그 문제를 반환 경로에서 되풀이하게 되므로, **생산자가 출처의 진실을 함께 반환하는 쪽**으로 정정한다. 계약을 "불변"으로 못 박은 원안보다 이 개정이 스프린트 의도에 더 충실하다.

**영향 범위**
- 소비자는 `MapTabScreen.handleLocate` **1곳뿐** — `fix.coords`로 RECENTER를 주입하고 `fix.source`를 상태에 그대로 반영한다.
- `map-locate-button` 스프린트의 기존 인수조건 **전부 유지**(탭당 1회 취득·in-flight 가드·미결정 시 권한 요청·거부 시 no-op·실패 시 무한로딩 없음).
- 외부 계약(DB·Edge·WebView 메시지) 변화 0. 비주얼 변화 0.
- §5-1 `useLocationPermission.spec.ts`에 반환형 3케이스 추가(성공=`fresh` / 실패+warm 폴백=**`warm` 유지** / 폴백 없음=`null`). 세 번째 줄 단언이 이 회귀의 파수꾼이다.
- §7 경계면 7번 검증 항목 갱신.

**기록만 반영** — 다른 조치 불요(리더 지시, 2026-08-13).
