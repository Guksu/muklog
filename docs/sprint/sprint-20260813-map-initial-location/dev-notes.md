# Dev Notes — 지도 초기위치 선취득 (map-initial-location)

> 작성일 2026-08-13 · developer · 입력: `plan.md`(T1~T8) · 상태: **구현 완료 + qa-logic 지적 L1·L2·L3 반영 (§9 참조)**
> `npm test` **198 suites / 1980 tests 전부 통과** · `npm run typecheck` **0 error** · 회귀 0(기존 케이스 전부 유지)

## 1. 한 줄 요약

지도 탭 첫 프레임이 서울시청 폴백이 아니라 **내 동네**로 뜨도록, 앱 구동 유휴 시점에 **OS 캐시 위치(GPS 미기동·권한 프롬프트 0)** 를 프로세스 메모리에 선취득하고, `useLocationPermission`이 그 값을 **첫 렌더에 동기 시드**한다. 좌표에 **출처(warm/fresh)** 를 붙여 자동 RECENTER 1회 가드가 **정밀 픽스에서만** 소진되게 정정했다.

## 2. 변경/신설 파일

### 신설
| 파일 | 역할 |
|------|------|
| `src/features/map/lastKnownLocation/lastKnownLocation.ts` | 권한 게이트된 OS 캐시 위치 취득 + 프로세스 메모리 캐시(read/write/clear·멱등·in-flight·이상치 차단·throw 흡수) |
| `src/features/map/lastKnownLocation/lastKnownLocation.spec.ts` | 단위 테스트 17케이스(권한 게이트·인자 계약·매핑·이상치·멱등·동시호출·throw·정적 검사) |
| `src/features/map/lastKnownLocation/index.ts` | 배럴 |
| `src/features/map/LocationPrewarm/LocationPrewarm.tsx` | 앱 구동 유휴(400ms) 1회 워머. **렌더 산출물 `null`**(비주얼 0) |
| `src/features/map/LocationPrewarm/LocationPrewarm.spec.tsx` | 단위 테스트 8케이스(deferred 전/후·리렌더·킬 스위치·null 렌더·400ms 계약) |
| `src/features/map/LocationPrewarm/index.ts` | 배럴 |

### 변경
| 파일 | 변경 내용 |
|------|-----------|
| `src/features/map/types/types.ts` | `LocationCoordsSource`(Warm/Fresh) enum-style 상수+타입 추가 (T1). 기존 타입 무변경 |
| `src/features/map/useLocationPermission/useLocationPermission.ts` | warm 캐시 **lazy initializer 동기 시드**, `coordsSource` 반환 추가, granted 시 last-known 선시드(R2①), fresh 실패 시 warm 유지(R3), denied/throw 시 캐시 clear(R4), fresh 성공 시 `writeWarmCoords`(R5), `refreshCoords`가 좌표+출처(`LocationFix`)를 반환(§9.4 ②) |
| `src/features/map/useLocationPermission/useLocationPermission.spec.ts` | 기존 12케이스 유지 + 10케이스 추가(총 20). `lastKnownLocation`은 **실물 사용**(경계면 왕복 검증), expo-location만 모킹 |
| `src/navigation/AuthGate/AuthGate.tsx` | authenticated 분기에 `<LocationPrewarm />` 마운트(MapPrewarm 옆) |
| `src/navigation/AuthGate/AuthGate.spec.tsx` | LocationPrewarm 모킹 + 마운트/미마운트 2케이스 추가 |
| `src/navigation/screens/MapTabScreen/MapTabScreen.tsx` | 자동 재센터 판정을 boolean 1회 가드에서 **좌표 정밀도 단조 비교**로 교체(`rankCoordsSource` + `centeredSourceRef`). warm으로 가드가 잘못 소진되던 원버그와, 폴백 INIT 뒤 warm이 반영되지 않던 경로(qa L1)를 함께 해소 — 상세 §9.1 |
| `src/navigation/screens/MapTabScreen/MapTabScreen.spec.tsx` | `setPermission` 헬퍼가 `coordsSource`를 좌표 유무에서 파생(기존 호출부 무수정) + 7케이스 추가(총 52) |

**변경 0 확인**: `supabase/`(마이그레이션·Edge Function·RPC) · `initialRegion.ts` · `mapHtml`/`mapMessages`(WebView 계약) · 디자인 토큰·컴포넌트 일체.

## 3. 계약 shape (신규)

```ts
// src/features/map/types — enum-style 단일 출처
export const LocationCoordsSource = { Warm: 'warm', Fresh: 'fresh' } as const;
export type LocationCoordsSource = (typeof LocationCoordsSource)[keyof typeof LocationCoordsSource];

// src/features/map/lastKnownLocation — 전부 절대 throw하지 않음
export const LAST_KNOWN_MAX_AGE_MS = 3_600_000;          // 1시간(E4)
export const LAST_KNOWN_REQUIRED_ACCURACY_M = 1000;      // 1km(E5)
export const warmLastKnownLocation: () => Promise<Coords | null>;  // 멱등 + in-flight 1회화
export const readWarmCoords: () => Coords | null;                  // 동기(렌더 중 호출 가능)
export const writeWarmCoords: ({ coords }: { coords: Coords }) => void;  // 이상치는 미적재
export const clearWarmCoords: () => void;

// src/features/map/LocationPrewarm
export const LOCATION_PREWARM_DELAY_MS = 400;            // MapPrewarm 1200ms와 프레임 분리(E15)
export const LocationPrewarm: ({ enabled }: { enabled?: boolean }) => null;

// 현재위치 재취득 결과 — 좌표와 "그 좌표의 실제 출처"를 함께 싣는다(§9.5)
export type LocationFix = { coords: Coords; source: LocationCoordsSource };

// useLocationPermission 반환 — 기존 4개 + coordsSource 1개
{ status, coords, coordsSource: LocationCoordsSource | null, request,
  refreshCoords: () => Promise<LocationFix | null> }   // ★ plan §3.4 대비 반환 확장(§9.5)
```

내부 구현 노트: 좌표와 출처는 **단일 state(`{coords, source}`)로 묶어 원자적으로 갱신**한다 — 두 개의 useState로 두면 "coords는 fresh인데 source는 warm" 같은 중간 렌더가 생길 수 있어 소비자(RECENTER 가드)가 오판한다.

## 4. 생산자 ↔ 소비자 매핑 (plan §7 경계면 7쌍 대응 — qa-logic 교차검증용)

| # | 생산자 | 저장소/경유 | 소비자 | 검증 위치 |
|---|--------|------------|--------|-----------|
| 1 | `LocationPrewarm`(`AuthGate.tsx:56~` authenticated) → `warmLastKnownLocation()` | `lastKnownLocation` 모듈 변수(메모리) | `useLocationPermission` `useState(() => readWarmCoords())` **lazy initializer** | `useLocationPermission.spec.ts` "R1: 첫 렌더에서 이미 coords" (실물 모듈 왕복) · `LocationPrewarm.spec.tsx` |
| 2 | `useLocationPermission.coordsSource` | — | `MapTabScreen.sendInit:156`(지도 센터 출처 기록) + `recenterOnMorePreciseCoords:250`(정밀도 비교 발화) + `handleLocate:174`(FAB 리센터 기록) | `MapTabScreen.spec.tsx` T6 3케이스 + L1 3케이스 + L2 1케이스 |
| 3 | `useLocationPermission.coords` | `initialRegion`(**무변경**) | `buildInitScript({center, markers, me})` | `MapTabScreen.spec.tsx` T7 — INIT payload를 JSON 파싱해 `center`·`me`가 **같은 좌표원**임을 단언 |
| 4 | `warmLastKnownLocation`의 `getForegroundPermissionsAsync`(비프롬프트) | — | `MapTabScreen.requestLocationOnEnter` → `requestForegroundPermissionsAsync`(프롬프트) | `lastKnownLocation.spec.ts` **정적 소스 검사**: 워밍 경로 **2파일 모두**(`lastKnownLocation.ts`·`LocationPrewarm.tsx`)에 `request*PermissionsAsync`·`getCurrentPositionAsync`·`watchPositionAsync`가 **0개**임을 강제(§9.3) |
| 5 | `AuthGate` state 분기 | — | `LocationPrewarm` 마운트 조건 | `AuthGate.spec.tsx` — authenticated만 마운트 / loading·unauthenticated·authenticating·error 4상태 미마운트 |
| 6 | `useDeferredFlag` | — | `LocationPrewarm`(400) · `MapPrewarm`(1200) | `LocationPrewarm.spec.tsx` "useDeferredFlag에 400ms" (인자 캡처) · 정리 로직은 `useDeferredFlag.spec.ts`(기존, 무변경) |
| 7 | 기존 `refreshCoords`/FAB(`handleLocate`) — 반환이 `LocationFix`(좌표+출처)로 확장 | `writeWarmCoords` | `MapTabScreen.handleLocate:170-176`(RECENTER 주입 + 센터 출처 기록) | `MapTabScreen.spec.tsx` map-locate-button T4/T5/T6 **전부 유지 green** + `useLocationPermission.spec.ts` refreshCoords 8케이스(신규 3 포함) |

## 5. 가드레일 확인

| 항목 | 결과 | 근거 |
|------|------|------|
| 앱 구동 시 권한 프롬프트 | **0** | 워밍 경로는 `getForegroundPermissionsAsync`(비프롬프트 getter)로 게이트 → `granted !== true`면 위치 API **미호출**. 정적 검사로 request 계열 사용 자체를 금지(경계면 4) |
| `watchPosition`/폴링/타이머 반복 | **0** | 취득은 이벤트 1회씩(앱 구동 유휴 1회 + 탭 진입 1회 + FAB 탭당 1회). 훅은 캐시를 폴링·구독하지 않음(E10) |
| Kakao Local API 호출 증가 | **0** | `BOUNDS_CHANGED` 채널 무변경 |
| Supabase 호출 | **0** | `supabase/` 변경 0, RPC/쿼리/Realtime 무변경 |
| AWS | 미사용 | 해당 없음 |
| 위치 디스크 영속 | **없음** | 모듈 변수(프로세스 메모리)만. AsyncStorage·SecureStore 미사용, 서버 전송·로깅 0 |
| 배터리 | 추가 ~0 | `getLastKnownPositionAsync`는 OS 캐시 읽기(GPS 미기동). 앱 구동 시 fresh 픽스 미실행 |
| 네이티브 재빌드 | **불필요** | `expo-location@~18.0.10`의 기존 JS API 표면만 추가 사용(신규 네이티브 모듈 0). 설치본 `.d.ts`에서 `getLastKnownPositionAsync`·`getForegroundPermissionsAsync`·`LocationLastKnownOptions{maxAge,requiredAccuracy}` 존재 확인 |
| 네이티브 미탑재 방어 | 있음 | 권한/위치 getter 호출 전체가 try/catch — 모듈 부재로 인한 TypeError도 조용히 null(테스트로 강제) |
| DB 뮤테이션 | **0** | 순수 클라이언트 스프린트 → 뮤테이션 표본·격리 사본 불필요 |
| git 작업 | **없음** | 커밋·브랜치 등 일절 미수행 |

## 6. 알아둘 설계 판단 2가지 (qa-logic 참고)

1. **`refreshCoords` 실패 시 캐시를 비우지 않는다.** 세션 중 권한이 취소되면 `getCurrentPositionAsync`가 throw하는데, 이는 GPS 타임아웃과 **구분 불가**하다. 타임아웃에 좌표를 지우면 지도가 폴백으로 튕기므로 plan R6("직전 coords 폴백·source 불변")를 그대로 따랐다. E7(권한 취소)의 안전은 다른 두 겹으로 확보된다 — ① `request()` 경로의 denied가 `clearWarmCoords()` 수행(R4), ② 캐시가 **프로세스 메모리**라 앱 재시작 시 소멸하고, 재시작 후 워밍은 비프롬프트 getter가 denied를 반환해 **좌표를 읽지도 않는다**. 즉 "권한 없는데 stale 좌표로 me 마커"가 세션을 넘어 남지 않는다.
2. **`request()`의 last-known 선시드는 fresh보다 먼저 `await`한다.** 병렬로 쏘면 warm 응답이 fresh 뒤에 도착해 정밀 좌표를 근사 좌표로 덮을 수 있다. last-known은 로컬 I/O(수 ms)라 순차 실행의 지연 비용이 무시 가능하고, 순서 보장이 훨씬 값싸다.

## 7. 디바이스 스모크 체크리스트 (사용자 환경 이월 — 단위 대상 아님)

- [ ] **S1.** 권한 허용 상태에서 앱 완전 종료 → 재실행 → 홈에서 3초 대기 → 지도 탭 진입 → **첫 프레임이 내 동네**(서울시청 미노출) 육안 확인.
- [ ] **S2.** 앱 재실행 직후 **1초 내** 곧바로 지도 탭 진입 → 워밍 미완료 상황에서도 탭 진입 last-known 시드로 서울시청 폴백이 보이지 않는지.
- [ ] **S3.** (**최우선**) 첫 설치/권한 미결정 상태 → 앱 구동 시 **위치 권한 프롬프트가 뜨지 않는지** → 지도 탭 진입 시에만 뜨는지 (E1 핵심).
- [ ] **S4.** 설정에서 위치 권한을 **끈 뒤** 앱 재실행 → 지도 탭 → me 마커 없음 + "위치 권한을 허용하면…" 배너 정상.
- [ ] **S5.** 비행기모드/실내 등 GPS 실패 유도 → warm 좌표로 지도가 뜨고 무한 로딩 없음.
- [ ] **S6.** 앱 구동 후 지도 미진입 상태에서 상태바 **위치(GPS) 아이콘이 켜지지 않는지** — last-known이 GPS를 깨우지 않음을 실측.

## 8. 미완 항목 / 후속

- 없음(T1~T8 전부 완료 + qa 지적 L1·L2·L3 반영). plan §2 Out-of-scope(좌표 디스크 영속·watchPosition·줌 개인화·마지막 본 영역 복원)는 의도적 미구현.
- 후속 후보(이번 스프린트 범위 밖): qa L4가 제안한 "`refreshCoords` 실패 시 비프롬프트 getter로 권한 취소만 정확히 구분해 캐시 clear" — 이번에 `getForegroundPermissionsAsync`가 이미 배선돼 비용이 낮아졌다.

---

## 9. qa-logic 지적 반영 (2026-08-13, 리더 결정 = L1 수정)

`qa-report-logic.md` §7 기준. **L1(Medium) 수정 / L2·L3(Low) 동반 수정 / L4는 조치 불요(§6.1에 수용 근거 기재)**.

### 9.1 L1 — 폴백 INIT 뒤 도착한 warm이 지도에 반영되지 않던 경로

**지적 내용은 재현·근거 모두 타당하다.** `autoRecenterOnFirstFix`가 Fresh에서만 발화해, READY가 폴백(서울시청)으로 INIT된 뒤 warm이 도착하는 경로(스모크 S2 시나리오)에서 RECENTER가 0회였다 — warm 좌표를 손에 쥐고도 지도는 서울시청에 머물렀다.

**수정 형태는 qa 수정안과 다르다(리더 승인 범위 내, 아래에 차이·사유 기록).**

| | qa 수정안 (§7 L1) | 실제 적용 |
|---|---|---|
| 상태 | boolean ref 3개: `autoCenteredRef` · `initHadCoordsRef` · `warmRecenteredRef` | **ref 1개**: `centeredSourceRef: LocationCoordsSource \| null` (`MapTabScreen.tsx:112`) |
| effect | 기존 1개 + 신규 `recenterOnLateWarmSeed` 1개 = 2개 | **1개**: `recenterOnMorePreciseCoords` (`:250-259`) |
| 판정 방식 | 조건 5개의 순차 가드(폴백 여부·fresh 선점·warm 1회·좌표 존재·source 일치) | 정밀도 **단조 비교** 1줄 — `rankCoordsSource`(폴백 0 < warm 1 < fresh 2, `:83-87`) |

**사유:** 이 화면이 실제로 알아야 하는 사실은 "지도 센터가 **지금 어떤 정밀도의 좌표로 그려져 있는가**" 하나다. 그 값을 그대로 ref에 담으면 "더 정밀한 게 오면 1회 보정"이라는 규칙 하나로 네 경로(폴백→warm, 폴백→fresh, warm→fresh, 동일 정밀도 갱신 무시)가 전부 유도되고, **"1회 가드"가 별도 플래그 없이 단조성에서 파생**된다. boolean 3개는 서로 모순된 조합(예: `initHadCoords=true`인데 `warmRecentered=true`)을 표현할 수 있는 반면, 단일 enum ref는 그런 상태 자체가 존재할 수 없다. 결과적으로 기존 `autoCenteredRef`까지 흡수해 **state 총량이 스프린트 이전보다 줄었다**.

동작 결과는 qa 수정안과 동일하다(프로브 시나리오 전부 충족). 부수 이득으로 E16(지도 SDK 에러 → `handleRetry` → `sendInit` 재주입)도 자연히 정합해진다 — 재INIT이 폴백 센터로 그려지면 `centeredSourceRef`가 null로 되돌아가 이후 warm/fresh 보정이 다시 살아난다.

**변경 지점**
- `MapTabScreen.tsx:83-87` — `rankCoordsSource({ source })` 신설(순수 함수, named-object 인자).
- `MapTabScreen.tsx:112` — `autoCenteredRef`(boolean) → `centeredSourceRef`(출처 ref)로 교체.
- `MapTabScreen.tsx:156` — `sendInit`이 INIT을 그린 좌표의 출처를 기록(좌표 없으면 null = 폴백 센터).
- `MapTabScreen.tsx:250-259` — `autoRecenterOnFirstFix` → `recenterOnMorePreciseCoords`로 교체.

**회귀 테스트(qa 프로브 고정)** — `MapTabScreen.spec.tsx`
- `L1: 폴백 센터로 INIT된 뒤 warm 좌표가 도착하면 RECENTER를 1회 주입한다` (PROBE-A 대응)
- `L1: 폴백 INIT → warm 보정 뒤 fresh가 도착하면 정밀 보정이 1회 더 주입된다(총 2회)` (PROBE-B 대응)
- `L1: 폴백 INIT → warm 보정 이후 warm이 또 갱신돼도 추가 주입 0회`
- 네 케이스 모두 **수정 전 RED → 수정 후 GREEN**을 확인했다(Red→Green이 곧 load-bearing 증명).

### 9.2 L2 — warm INIT 상태에서 FAB 탭 시 RECENTER 2회

`handleLocate`가 리센터에 성공하면 `centeredSourceRef`를 `Fresh`로 기록한다(`MapTabScreen.tsx:174`). 사용자가 직접 정밀 좌표로 센터를 잡은 이상 자동 보정은 의미가 없으므로 의미상으로도 맞다. qa 수정안(`autoCenteredRef.current = true`)과 **동일한 의도를 새 어휘로 표현**한 1줄이다.

회귀 테스트: `L2: warm INIT 상태에서 FAB 탭 → RECENTER 1회(자동 보정과 중복 주입 0)` — 훅의 fresh 전이까지 rerender로 모사해 PROBE-C 조건을 그대로 재현한다.

### 9.3 L3 — 정적 request-금지 검사 범위 확장

`lastKnownLocation.spec.ts`의 정적 검사를 **워밍 경로 2파일 전체**(`lastKnownLocation.ts` + `LocationPrewarm.tsx`)로 `it.each` 확장하고, 금지 식별자 4종을 배열 상수(`FORBIDDEN_IN_WARMING`)로 단일화했다. 아울러 qa가 지적한 위양성 여지를 없애기 위해 **블록 주석(`/* */`)도 제거**한 뒤 검사한다(기존엔 `//`만 제거).

**load-bearing 확인(격리 사본 — `src/` 밖 scratchpad, 실행 즉시 삭제, 실 소스 변형 0):**

| 뮤테이션 | 결과 |
|---------|------|
| M-L3a: `LocationPrewarm.tsx` 코드에 `requestForegroundPermissionsAsync` 삽입 | **검출** |
| M-L3b: 같은 파일에 `getCurrentPositionAsync` 삽입 | **검출** |
| M-L3c: 라인/블록 주석에만 금지 식별자 언급 | **미검출(위양성 0)** |

### 9.4 재검증 피드백 2건 (qa 승인 시 첨부된 주의점)

**① `sendInit`은 승격이 아니라 평문 대입 — 이미 그렇게 구현돼 있다.** `MapTabScreen.tsx:156`은 `centeredSourceRef.current = permission.coords ? permission.coordsSource : null`로, 정밀도가 **내려가는 방향도 반영**한다. qa가 지적한 E16 경로(지도 SDK ERROR → `handleRetry` → `sendInit` 재주입 시 denied로 coords가 비어 있는 경우)에서 ref가 null로 내려가고, 이후 좌표가 돌아오면 `warm > null`로 정상 복구된다. 승격 로직이었다면 이전 fresh에 머물러 영영 보정되지 않았을 것이다.

**② `handleLocate`의 Fresh 마킹은 실패 분기에서 거짓이 된다 — 수정했다(정직한 쪽 채택).**

지적이 정확하다. `refreshCoords()`는 실패 시 R6에 따라 **직전 좌표를 폴백 반환**하는데 그 좌표의 출처는 warm일 수 있다. 이때 `me`가 non-null이라 RECENTER는 주입되지만, ref에 Fresh를 찍으면 **근사 좌표에 정밀 딱지를 붙이는 것** — 이번 스프린트가 고치려던 실패 양식 그 자체이고, 그 결과 뒤늦게 도착한 진짜 정밀 픽스의 보정이 영구히 막힌다.

"무해하니 주석으로 남긴다"는 선택지도 있었으나 채택하지 않았다. 이 코드베이스에서 정밀도 오마킹은 **이미 한 번 실제 버그를 만든 실패 양식**이고, 주석은 다음 편집자에게 강제력이 없다. 대신 **생산자가 진실을 함께 돌려주게** 만들어 소비자가 추정할 여지 자체를 없앴다(qa 선호안과 동일).

| | 변경 전 | 변경 후 |
|---|---|---|
| 반환 타입 | `Promise<Coords \| null>` | `Promise<LocationFix \| null>` (`types.ts:119`) |
| 소비자 | `centeredSourceRef.current = Fresh` (단정) | `centeredSourceRef.current = fix.source` (`MapTabScreen.tsx:170-176`) |
| 실패 폴백 | 좌표만 반환 → 출처 소실 | `toLocationFix`가 직전 좌표를 **출처째로** 반환 (`useLocationPermission.ts:42-43`·`:147`) |

내부적으로 `coordsRef: Coords | null` → `coordsStateRef: CoordsState`로 넓혀 폴백 시 좌표와 출처가 항상 함께 움직이게 했다(§4 경계면 1의 "좌표·출처는 짝" 원칙을 ref에도 일관 적용).

**plan §3.4 대비 계약 변경**: plan은 `refreshCoords`를 "불변 시그니처"로 선언했으므로 이는 **의도적 이탈**이다. 사유는 위와 같고, 소비자가 `handleLocate` 하나뿐이라 파급이 없다(§4 경계면 7). 기존 map-locate-button 인수조건은 전부 유지된다 — 반환 형태만 넓어졌을 뿐 "granted 아니면 null / 실패 시 직전 좌표 폴백 / in-flight 1회" 규칙은 그대로다.

**신규 회귀 테스트 2건**(둘 다 수정 전 RED 확인)
- `useLocationPermission.spec.ts` — `실패 폴백 시 직전 좌표의 실제 출처를 돌려준다 — warm을 fresh로 오마킹하지 않는다`
- `MapTabScreen.spec.tsx` — `L2 후속: FAB가 실패 폴백(warm 좌표)으로 리센터했으면 이후 정밀 픽스 보정이 살아있다`

**qa 재검증 요청 항목 대응**: L1 경로의 두 RECENTER가 **서로 다른 좌표**임은 `L1: 폴백 INIT → warm 보정 뒤 fresh가 도착하면…` 케이스가 `recenter[0]`=37.55(warm) / `recenter[1]`=37.56(fresh)로 각각 단언한다(횟수만 세지 않는다).

### 9.5 최종 상태

`npm test` **1980 tests 전부 green**(+7: MapTabScreen 5 · useLocationPermission 1 · 정적 검사 1→2 분리) · `npm run typecheck` **0 error** · `supabase/`·`initialRegion.ts` 여전히 diff 0.
