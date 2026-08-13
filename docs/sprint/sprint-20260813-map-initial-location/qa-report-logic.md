# QA Report — 로직·통합 정합성 (map-initial-location)

> 작성일 2026-08-13 · qa-logic · 입력: `plan.md`(T1~T8, §7 경계면 7쌍) · `dev-notes.md` · 구현 소스
> 스킬: `integration-qa` (로직 전용 — 비주얼 충실도는 범위 밖. 본 스프린트는 리더 판정으로 qa-visual 생략)

## 0. 판정 요약

> **최종 판정: 통과** — 2026-08-13 재검증 완료(§10). 아래 §0~§9는 **1차 검증 시점의 기록**이며, L1·L2·L3는 전부 해소됐다.

**[1차] 조건부 통과.** 이 스프린트의 목적인 **원버그(warm 좌표가 자동 RECENTER 1회 가드를 잘못 소진해 me 마커가 stale 고정)는 정확히 해결됐고, 뮤테이션 표본으로 테스트가 load-bearing임을 실증했다.** 회귀 0, 가드레일 전항 통과.

다만 plan §3.5가 선언한 **2차 안전망("탭 진입 시 last-known 시드")이 지도까지 도달하지 못하는 경로**를 1건 발견했다(L1). 스프린트 이전 대비 **회귀는 아니지만**, plan이 약속한 동작(스모크 S2)이 실현되지 않는다.

| 구분 | 건수 | 비고 |
|------|------|------|
| 통과 | 경계면 7쌍 전부 + 가드레일 9항 + 컨벤션 6항 | |
| 실패(수정 권고) | **L1** (Medium) | plan §3.5 2차 안전망 미실현 — 재현 테스트 첨부 · **→ §10에서 해소** |
| 개선 권고 | L2·L3·L4 (Low) | 회귀 아님 · **L2·L3 → §10에서 해소, L4는 조치 불요 확정** |
| 참고(수용 가능) | L5·L6·L7 (Info) | 조치 불요 |
| 미검증 | 디바이스 스모크 S1~S6 | 사용자 환경 이월(단위 대상 아님) |

### 실행 결과

| 항목 | 결과 |
|------|------|
| `npm test` | **198 suites / 1973 tests 전부 통과** (dev-notes 수치와 일치) |
| `npm run typecheck` (`tsc --noEmit`) | **0 error** |
| `supabase/` diff | **0** (`git status` 확인 — DB·RPC·RLS·Edge Function 무변경) |
| `initialRegion.ts` diff | **0** (폴백 체인 무변경 → 회귀 0) |
| 소스 무결성 | 검증 전후 17개 파일 SHA-256 **전부 동일**(실 소스 변형 0) |

---

## 1. plan §7 경계면 7쌍 — 생산자↔소비자 양쪽 동시 읽기

### ① warm 캐시 → 훅 lazy initializer 동기 시드 ✅ 통과

| | 파일:라인 |
|---|---|
| 생산자 | `src/features/map/LocationPrewarm/LocationPrewarm.tsx:38` → `void warmLastKnownLocation()` |
| 저장소 | `src/features/map/lastKnownLocation/lastKnownLocation.ts:23` 모듈 변수 `warmCoords`, 적재는 `:90` |
| 소비자 | `src/features/map/useLocationPermission/useLocationPermission.ts:44-47` `useState(() => readWarmCoords())` |

`readWarmCoords()`는 동기 함수(`lastKnownLocation.ts:43`)이고 lazy initializer 안에서 호출되므로 **첫 렌더 시점에 값이 반영**된다. `useLocationPermission.spec.ts`의 R1 케이스는 `lastKnownLocation`을 **모킹하지 않고 실물로 태워** 캐시↔훅 왕복을 실제로 검증한다 — 이 스프린트 급소에 대한 올바른 테스트 설계다. `await`/`waitFor` 없이 `result.current.coords`를 단언하는 점이 "렌더 1 반영"을 정확히 표현한다.

좌표·출처를 **단일 state(`CoordsState`)로 묶은 것**(`:28`, `:44`)도 옳다. 두 개의 `useState`였다면 "coords는 fresh인데 source는 warm"인 중간 렌더가 발생해 소비자(RECENTER 가드)가 오판할 수 있다.

### ② `coordsSource` → MapTabScreen RECENTER 가드 ✅ 통과 (원버그 해결 확인)

| | 파일:라인 |
|---|---|
| 생산자 | `useLocationPermission.ts:137` `coordsSource: coordsState.source` |
| 소비자 A | `MapTabScreen.tsx:142` `if (permission.coordsSource === LocationCoordsSource.Fresh) autoCenteredRef.current = true;` |
| 소비자 B | `MapTabScreen.tsx:238` `if (myCoordsSource !== LocationCoordsSource.Fresh) return;` |

**가드는 Fresh일 때만 소진된다.** 지적된 원버그(warm으로 소진 → 정밀 픽스 리센터 차단)는 재발하지 않는다.

실행 순서도 안전하다. READY 핸들러가 `setMapReady(true)` → `sendInit()`(`MapTabScreen.tsx:169`) 순으로 **동기 실행**되므로 `autoCenteredRef`는 `autoRecenterOnFirstFix` effect가 도는 시점보다 먼저 세팅된다 — "READY 시점에 이미 fresh면 RECENTER 0회"가 타이밍상 보장된다.

**뮤테이션 표본(격리 사본, 실 소스 변형 0):**

| 뮤테이션 | 결과 |
|---------|------|
| M1a: `:142`를 스프린트 이전 형태 `if (permission.coords)`로 되돌림 | **2 테스트 RED** (T6 warm→fresh 1회 / 1회 가드 유지) |
| M1b: `:238` Fresh 조건 삭제 | **3 테스트 RED** (위 2건 + warm 갱신만으로는 0회) |

두 뮤테이션 모두 정확히 해당 인수조건 테스트만 빨개진다 — 테스트가 껍데기가 아니라 **실제로 이 회귀를 잡는다**.

### ③ coords → initialRegion → `buildInitScript({center, me})` ✅ 통과

`initialRegion.ts` **무변경**(diff 0). `MapTabScreen.tsx:113`이 `permission.coords`로 center를 계산하고 `:144`가 같은 `permission.coords`를 `me`로 넘긴다 — **동일 좌표원**. `MapTabScreen.spec.tsx` T7 케이스가 INIT 스크립트를 문자열 포함이 아니라 **JSON 파싱해** `center`·`me`를 직접 단언하는 점이 좋다(계약을 정확히 본다).

### ④ 워밍 권한 게이트 ↔ 탭 진입 권한 요청 ✅ 통과 (E1 급소)

| | |
|---|---|
| 워밍 경로(비프롬프트) | `lastKnownLocation.ts:71` `getForegroundPermissionsAsync()` → `:73` `granted !== true`면 **즉시 return**(위치 API 미호출) |
| 프롬프트 경로 | `useLocationPermission.ts:64` `requestForegroundPermissionsAsync()` (MapTabScreen 진입 시에만) |

**두 경로가 섞이지 않았다.** 직접 grep으로 확인 — 워밍 경로 2개 파일(`lastKnownLocation.ts`·`LocationPrewarm.tsx`)에 `requestForegroundPermissionsAsync`·`requestBackgroundPermissionsAsync`·`getCurrentPositionAsync`·`watchPositionAsync` **0건**.

정적 테스트(`lastKnownLocation.spec.ts:79-92`)의 load-bearing 여부도 확인했다. 실제 소스 파일을 읽어 `//` 주석을 제거한 뒤 4개 식별자를 검사하므로, 워밍 경로에 request 계열이 들어가면 **실제로 RED가 된다**. 소스 주석이 "request 계열은 이 파일에서 사용 금지"라고만 쓰고 식별자를 적지 않아 위양성도 없다. (범위 한계는 L3 참조.)

### ⑤ AuthGate 분기 ↔ LocationPrewarm 마운트 ✅ 통과

`AuthGate.tsx:61` — `case 'authenticated'` 분기 안, `MapPrewarm` 옆에만 마운트. `loading`/`unauthenticated`/`authenticating`/`error` 4분기는 조기 return이라 구조적으로 도달 불가. `AuthGate.spec.tsx`가 4상태 전부를 순회하며 미마운트를 단언한다(E2 — 미인증 위치 접근 0).

### ⑥ useDeferredFlag ↔ 두 소비자 ✅ 통과

`LocationPrewarm.tsx:15` = 400ms / `MapPrewarm.tsx:17` = 1200ms — **분리 확인**. `useDeferredFlag.ts`의 cleanup(`cancelDeferredFlag`)이 `cancelled` 플래그·`clearTimeout`·`interactionHandle.cancel()` 3중으로 정리하므로 **언마운트 누수 0**. 지연값은 `[delayMs]` deps라 두 소비자가 서로 간섭하지 않는다.

### ⑦ 기존 refreshCoords / FAB 경로 ✅ 통과 (회귀 없음, 단 L2 참조)

`refreshCoords`의 in-flight 가드(`useLocationPermission.ts:115`)·granted 게이트(`:114`)·실패 시 직전 coords 폴백(`:128`) 전부 불변. map-locate-button 기존 케이스 전부 green. 신규 2케이스(fresh 승격·실패 시 유지)가 추가됐다.

---

## 2. 가드레일 직접 검증 ✅ 전항 통과

| 항목 | 결과 | 검증 방법 |
|------|------|----------|
| 워밍 경로 권한 프롬프트 | **0** | 코드 판독(`lastKnownLocation.ts:71-77` 게이트) + grep 0건 + 정적 테스트가 load-bearing |
| `watchPositionAsync` / `setInterval` | **0** | `grep -rn` 전체 `src/`(테스트 제외) 0건 |
| AsyncStorage / SecureStore 위치 저장 | **0** | 신규·변경 3모듈 grep 0건 — 좌표는 모듈 변수(프로세스 메모리)에만 |
| 위치 로깅 / 서버 전송 | **0** | `console.`·`fetch(`·`supabase` grep 0건 |
| `supabase/` diff | **0** | `git status` |
| AWS | 미사용 | 해당 없음 |
| 네이티브 재빌드 | 불필요 | `expo-location@18.0.10` 설치본 확인(package.json `~18.0.10` ↔ node_modules 18.0.10 일치). 기존 JS API 표면만 추가 사용 |
| GPS 미기동 | 설계상 보장 | `getLastKnownPositionAsync`만 사용, 워밍 경로에 `getCurrentPositionAsync` 0건 |
| 이상치 차단 | 있음 | `toFiniteCoords`(`:33-37`)가 `warmLastKnownLocation`·`writeWarmCoords` **양쪽 진입점** 모두 통과 |

### lazy require 패턴 (native-module-lazy-require 메모리 규칙) ✅ 해당 없음 — 현행 유지가 옳음

`lastKnownLocation.ts:13`이 `import * as Location from 'expo-location'`로 **top-level import**한다. 메모리 규칙은 **신규·선택 네이티브 모듈**을 대상으로 하는데, `expo-location`은 이미 `useLocationPermission.ts:17`에서 동일하게 top-level import돼 **현재 프로덕션에서 동작 중인 기존 의존성**이다. Dev Client에 이미 탑재돼 있으므로 lazy require로 바꿀 이유가 없고, 기존 방식과의 **일관성도 유지**된다.

추가로 모든 호출부가 try/catch로 감싸여 있고(`:70-77`, `:79-94`), "모듈 미탑재로 인한 TypeError도 조용히 null"을 강제하는 테스트가 있다(`lastKnownLocation.spec.ts:167-173`) — 방어는 오히려 기존보다 두텁다.

---

## 3. 폴백 체인 회귀 ✅ 통과

`initialRegion.ts` diff 0. `MapTabScreen.spec.tsx` 회귀 케이스로 확인:

- warm 없음 + 권한 denied/undetermined + 핀 없음 → INIT center = `DEFAULT_REGION(37.5665, 126.978, zoom 5)`, `me = null` ✅
- 좌표 없음 + 핀 있음 → 핀 bbox 중심 ✅
- denied → me 주입 0 + RECENTER 0 + 기존 배너 카피 유지 ✅

---

## 4. 엣지케이스

| # | 케이스 | 결과 |
|---|--------|------|
| E1 | 앱 구동 시 권한 프롬프트 | ✅ 구조적 차단(§2) |
| E3 | OS 캐시 없음 | ✅ `getLastKnownPositionAsync` null → 미적재 → 기존 폴백 |
| E6 | NaN/Infinity/누락 | ✅ 양쪽 진입점 `toFiniteCoords` |
| E8 | 워밍·탭 진입 동시 | ✅ `warmingPromise` in-flight 가드(`:104`), 동시 호출 테스트로 네이티브 1회 확인 |
| E9 | 워밍 후 마운트 | ✅ lazy initializer 동기 반영 |
| E10 | 워밍이 마운트 후 완료 | ⚠️ 훅은 폴링하지 않음(설계대로) — 다만 **지도 반영 경로가 없다 → L1** |
| R3 | fresh 실패 시 warm 유지 | ✅ 테스트 확인 |
| E14 | 재마운트 | ✅ `writeWarmCoords`로 fresh 반영(단 L6 참조) |
| E7 | 세션 중 권한 취소 | ⚠️ L4 — dev-notes §6.1이 근거와 함께 수용 |

---

## 5. TDD · 테스트 품질 ✅ 통과

- **인수조건 ↔ 테스트 대응**: T1~T8 전부 대응 테스트 존재. `lastKnownLocation.spec.ts` 17케이스 · `LocationPrewarm.spec.tsx` 8 · `useLocationPermission.spec.ts` +10(총 20, 기존 12 유지) · `AuthGate.spec.tsx` +2 · `MapTabScreen.spec.tsx` +7(총 52).
- **load-bearing 실증**: §1②의 M1a/M1b 뮤테이션 2종 모두 해당 테스트만 정확히 RED.
- **단위 경계 준수**: expo-location만 모킹, 실제 GPS 타이밍·OS 캐시는 디바이스 스모크로 분리(`docs/testing-strategy.md` 준수).
- **경계·실패 경로 커버**: 권한 3상태·null 반환·이상치 5종·throw 3종·동시 호출·킬 스위치 등 충실.
- **설계 판단 우수**: 훅 테스트가 `lastKnownLocation`을 실물로 태워 경계면 왕복을 검증(모킹했으면 이 스프린트 급소가 테스트 사각지대가 됐을 것).
- **헬퍼 하위호환**: `setPermission`이 `coordsSource`를 좌표 유무에서 파생시켜 기존 45개 호출부 무수정 — 회귀 위험을 줄인 좋은 선택.

**검증 방법(규범 준수):** 뮤테이션은 전부 **격리 사본**에서 수행했다. 소스+스펙을 프로젝트 내 임시 디렉터리로 복사하고 스펙 파일명을 `*.check.tsx`로 바꿔 기본 `testMatch`가 절대 잡지 못하게 한 뒤 `npx jest --roots <dir> --testMatch '**/*.check.tsx'`로 실행했고, 측정 직후 삭제했다. **실 소스 변형 0** — 착수 시 기록한 17개 파일 SHA-256이 종료 시 전부 동일함을 재확인했다.

---

## 6. 코드 컨벤션 ✅ 통과

| 항목 | 결과 |
|------|------|
| `useCallback`/`useMemo` 실제 호출 | **0건** (유일한 매치는 `useLocationPermission.ts:55` "useCallback 지양" 주석) |
| 컴포넌트·훅 화살표 const | ✅ `export function` 0건 |
| named-object 인자 | ✅ `writeWarmCoords({coords})`·`toFiniteCoords({lat,lng})`·`useDeferredFlag({delayMs})` |
| useEffect 명명 함수 | ✅ `warmLastKnownLocationOnce`·`autoRecenterOnFirstFix` — 인라인 `useEffect(() =>` 0건 |
| enum-style `as const` | ✅ `LocationCoordsSource`가 `LocationPermissionStatus`와 동일 패턴 |
| 파일명 = 심볼명 | ✅ 디렉터리·파일·대표 export 일치 |
| 미사용 코드 | ✅ 신규 export 전부 소비처 존재 |
| 원티드 토큰 | 해당 없음(렌더 산출물 0) |

---

## 7. 발견 사항

### L1 (Medium) — coords 없이 INIT된 뒤 warm이 도착하면 지도에 반영되지 않는다

**위치:** `src/navigation/screens/MapTabScreen/MapTabScreen.tsx:233-243` (`autoRecenterOnFirstFix`)

**증상:** `autoRecenterOnFirstFix`가 `Fresh`에서만 발화하므로, **READY(INIT) 시점에 좌표가 없었다가 나중에 warm 좌표가 도착하는 경로**에서는 RECENTER가 주입되지 않는다. INIT은 이미 `DEFAULT_REGION`(서울시청)으로 그려졌고 `me`도 `null`이라, **손에 warm 좌표를 쥐고도 지도는 서울시청에 머문다.**

plan §3.6의 근거("warm 좌표 도착만으로는 RECENTER 불필요 — 이미 INIT이 그 좌표로 그려졌으므로")는 **warm이 INIT 시점에 이미 있었을 때만** 성립한다. INIT이 폴백으로 그려진 경우엔 전제가 깨진다.

**실증(격리 사본 프로브, 측정 후 삭제):**

| 프로브 | 결과 |
|--------|------|
| PROBE-A: coords 없이 READY → warm 도착 → RECENTER 주입 횟수 | **0회** (기대 1회) |
| PROBE-B: 위 상태에서 fresh까지 실패 | INIT center = 서울시청, `me = null`로 **고정** |

**도달 경로:**
1. 사용자가 앱 실행 직후(워밍 400ms 완료 전) 곧바로 지도 탭 진입 → 프리워밍된 WebView READY가 탭 진입 시드보다 먼저 도착 — 이것이 **plan 스모크 S2가 검증하려던 바로 그 시나리오**다.
2. 첫 실행(권한 미결정) → 탭 진입 → 권한 프롬프트 표시 → 사용자가 수 초 뒤 허용. READY는 그 전에 이미 발생했으므로 이후 도착하는 warm 시드가 지도에 반영되지 않는다.

**영향 범위:** fresh 픽스가 성공하면 그때 RECENTER가 돌아 자연 치유된다. **fresh까지 실패할 때(실내·비행기모드 = 스모크 S5)** 서울시청에 고정된 채 남는다.

**회귀 아님:** 스프린트 이전에는 이 경로에 warm 개념 자체가 없어 동일하게 폴백이었다. 즉 **나빠지지 않았으나 plan이 약속한 2차 안전망(§3.5 폴백 체인 2단)이 실현되지 않았다.**

**수정 방법:** INIT이 실좌표로 그려졌는지를 기록하고, 폴백으로 그려진 경우에 한해 warm 도착 시 1회 보정한다. **`autoCenteredRef`는 소진하지 않아** 이후 정밀 픽스가 여전히 1회 리센터하게 둔다.

```ts
// MapTabScreen.tsx
const initHadCoordsRef = useRef(false);   // INIT이 실좌표로 그려졌는가(false=폴백 센터)
const warmRecenteredRef = useRef(false);  // warm 보정은 1회만

const sendInit = () => {
  if (permission.coordsSource === LocationCoordsSource.Fresh) autoCenteredRef.current = true;
  initHadCoordsRef.current = permission.coords !== null;
  webviewRef.current?.injectJavaScript(buildInitScript({ center, markers, me: permission.coords }));
};

// 폴백 센터로 INIT된 경우에만, 뒤늦게 도착한 warm으로 1회 보정(가드는 소진하지 않는다).
useEffect(
  function recenterOnLateWarmSeed() {
    if (!mapReady) return;
    if (initHadCoordsRef.current) return;   // INIT이 이미 실좌표 → 중복 주입 0
    if (autoCenteredRef.current) return;    // fresh가 이미 보정함
    if (warmRecenteredRef.current) return;
    if (!myCoords) return;
    if (myCoordsSource !== LocationCoordsSource.Warm) return;
    warmRecenteredRef.current = true;
    webviewRef.current?.injectJavaScript(buildRecenterScript({ me: myCoords }));
  },
  [mapReady, myCoords, myCoordsSource],
);
```

`buildRecenterScript`는 `mapHtml.ts:206`에서 "INIT 시 me 없던 경우 마커 신규 생성"을 이미 처리하므로 me 마커도 함께 살아난다.

**추가 테스트 권고:** ① 폴백 INIT → warm 도착 → RECENTER 1회 ② 이어서 fresh 도착 → 총 2회(warm 보정 1 + 정밀 보정 1) ③ warm이 INIT에 있던 경우엔 warm 보정 0회(기존 T6 유지).

### L2 (Low) — warm INIT 상태에서 FAB 탭 시 RECENTER가 2회 주입된다

**위치:** `MapTabScreen.tsx:151-159`(`handleLocate`) ↔ `:233-243`(`autoRecenterOnFirstFix`)

warm 좌표로 INIT되면 `autoCenteredRef`가 소진되지 않은 채 남는다. 이 상태에서 사용자가 FAB를 탭하면 `handleLocate`가 RECENTER를 주입하고, 같은 좌표로 fresh 전이한 상태를 보고 effect가 **한 번 더** 주입한다.

**실증:** PROBE-C — 기대 1회, 실제 **2회**.

동일 좌표로의 `panTo` 중복이라 사용자 눈에 보이는 문제는 없다(멱등). 다만 스프린트 이전에는 없던 중복이다. `handleLocate`가 성공적으로 리센터한 뒤 가드를 소진시키면 함께 해소된다 — 사용자가 직접 위치를 잡은 이상 자동 1회 보정은 의미가 없으므로 의미상으로도 맞다.

```ts
    const me = await permission.refreshCoords();
    if (!me) return;
+   autoCenteredRef.current = true; // 사용자가 직접 리센터함 → 자동 1회 보정 불요(중복 주입 방지)
    webviewRef.current?.injectJavaScript(buildRecenterScript({ me }));
```

### L3 (Low) — 정적 request-금지 검사가 워밍 경로 2파일 중 1개만 커버한다

**위치:** `src/features/map/lastKnownLocation/lastKnownLocation.spec.ts:79-92`

plan §7 경계면 4는 범위를 "**워밍 경로**에 request 계열이 단 하나도 없어야 함"으로 정의하는데, 정적 검사는 `lastKnownLocation.ts` 한 파일만 읽는다. 워밍 경로의 다른 축인 `LocationPrewarm.tsx`는 잠기지 않았다(현재 위반 0건은 grep으로 확인했으나, 향후 편집에 무방비).

`LocationPrewarm.spec.tsx`에 동일 정적 검사를 복제하거나, 검사 대상을 두 파일 배열로 확장하면 된다. 부수적으로 `//` 라인 주석만 제거하고 `/* */` 블록 주석은 남기므로, 블록 주석에 해당 식별자를 적으면 위양성이 난다(현재는 해당 없음).

### L4 (Low, 수용됨) — 세션 중 권한 취소 시 stale me 마커가 재시작까지 남는다

`request()`는 `requestedRef`로 1회만 실행되고, 이후 `refreshCoords()` 실패는 R6에 따라 직전 좌표를 유지한다. 따라서 사용자가 설정에서 권한을 끄고 앱으로 돌아와도 me 마커가 그대로 남는다.

dev-notes §6.1이 **"권한 취소와 GPS 타임아웃을 구분할 수 없다"**는 근거로 이 동작을 명시적으로 선택했고, 프로세스 메모리 캐시라 재시작 시 소멸한다는 2겹 방어도 기술돼 있다 — **합당한 판단이며 조치를 요구하지 않는다.**

다만 이번 스프린트로 **비프롬프트 getter가 이미 배선됐으므로** 구분이 저렴해졌다는 점은 기록해 둔다. `refreshCoords` 실패 시 `getForegroundPermissionsAsync()`를 1회 호출해 `granted !== true`일 때만 좌표를 비우면, 타임아웃은 건드리지 않고 권한 취소만 정확히 처리할 수 있다. 후속 스프린트 후보.

### L5 (Info) — `clearWarmCoords()`가 진행 중인 워밍을 무효화하지 않는다

`lastKnownLocation.ts:90`은 await 이후 `warmCoords = next`를 무조건 쓴다. 그 사이 `clearWarmCoords()`가 돌면 지운 값이 되살아난다.

도달성이 매우 낮다. 쓰기가 일어나려면 `getForegroundPermissionsAsync`가 granted를 반환해야 하는데, `clearWarmCoords`가 호출되는 denied 경로는 권한이 granted가 아닐 때만 성립한다. 유일한 틈은 "비프롬프트 getter는 granted인데 `requestForegroundPermissionsAsync`가 throw"하는 조합이다. 그마저도 훅 state는 이미 비워진 뒤이고(me 마커 미표시) 캐시는 프로세스 종료 시 소멸한다. **조치 불요** — 굳이 막는다면 세대(generation) 카운터를 두고 `clear` 시 증가시켜 stale 쓰기를 버리면 된다.

### L6 (Info) — fresh 좌표가 다음 마운트에서 `Warm`으로 되읽힌다

`writeWarmCoords`가 fresh 좌표를 warm 캐시와 **같은 슬롯**에 저장하므로(`useLocationPermission.ts:104`·`:124`), 재마운트 시 lazy initializer는 정밀 좌표를 `Warm`으로 태깅한다. 결과적으로 RECENTER 가드가 소진되지 않아 다음 fresh 픽스가 **한 번 더** 리센터한다 — 대상은 거의 같은 지점이라 무해하고, plan E14가 이미 인지한 동작이다. 바텀탭은 언마운트되지 않으므로 실제 발생 빈도도 낮다.

### L7 (Info) — 렌더 중 ref 변경 (기존 코드)

`useLocationPermission.ts:53` `coordsRef.current = coordsState.coords`는 렌더 중 ref를 변경한다. React 동시성 모드에서 권장되지 않는 패턴이지만 **이번 스프린트 이전부터 있던 코드**이며(diff상 `coords` → `coordsState.coords` 이름만 변경), 현재 앱은 동시성 렌더링을 쓰지 않는다. 기록만 한다.

---

## 8. 미검증 (통과로 처리하지 않음)

- **디바이스 스모크 S1~S6** — 실제 GPS·OS 캐시·권한 다이얼로그·상태바 GPS 아이콘은 단위 테스트 경계 밖이다. 특히 **S3(앱 구동 시 권한 프롬프트 미발생)** 은 E1의 핵심이므로 실기기 확인이 필요하다(정적·grep 검증은 통과).
- **L1의 실기기 발생 빈도** — READY와 탭 진입 시드의 실제 경합 결과는 기기 성능·권한 왕복 지연에 좌우된다. S2 스모크 시 **앱 재실행 직후 1초 내 지도 탭 진입**으로 재현을 시도할 것.
- **렌더 관련 우려**: 없음. `LocationPrewarm`은 `null`을 반환하고(테스트로 단언), 지도 탭 렌더 트리 변화 0. qa-visual 생략 판정에 이의 없음.

---

## 9. 결론

**로직 인수조건 T1~T8은 전부 충족**됐고, 스프린트의 목적인 원버그 방지가 뮤테이션으로 실증됐다. 회귀 0, 가드레일 전항 통과, 컨벤션 100% 준수.

**L1은 회귀가 아니라 "약속한 개선의 미실현"** 이므로 스프린트를 되돌릴 사유는 아니다. 다만 plan §3.5의 2차 안전망과 스모크 S2가 이 상태로는 통과할 수 없으므로, **L1을 수정하고 재검증하거나 / plan §3.5·S2의 범위를 명시적으로 축소하거나** 둘 중 하나를 리더가 결정해야 "로직 완료"로 표시할 수 있다. L2는 함께 고치면 4줄이면 끝난다.

---

# 10. 재검증 (2026-08-13, 2라운드) — **통과**

리더 결정에 따라 developer가 L1(수정)·L2·L3를 처리했다. **L1·L2·L3 전부 해소를 확인했고, 로직 QA를 통과로 판정한다.**

| 항목 | 결과 |
|------|------|
| `npm test` | **198 suites / 1980 tests 전부 통과** |
| `npm run typecheck` | **0 error** |
| `supabase/` · `initialRegion.ts` diff | **여전히 0** |
| 소스 무결성 | 재검증 baseline 17개 파일 SHA-256 착수↔종료 **전부 동일**(실 소스 변형 0) |

## 10.1 구현 형태 변경 — `centeredSourceRef` 단조 승격 (승인)

developer가 리포트 §7 L1의 수정안(ref 3개 + effect 2개) 대신 **ref 1개(`centeredSourceRef: LocationCoordsSource | null` = "지도 센터가 지금 어떤 정밀도로 그려져 있는가")로 통합**했다. 사전에 설계를 검토하고 승인했으며, 인수조건을 벗어나지 않음을 확인했다.

인수조건은 구현 형태가 아니라 **관측 가능한 동작**(시나리오별 RECENTER 횟수·좌표)이다. `null(0) < warm(1) < fresh(2)` 전순서 위의 단조 승격은 그 동작을 전부 재현하면서, 원안의 boolean 3개가 표현할 수 있던 모순 조합을 타입 수준에서 제거하고 기존 `autoCenteredRef`까지 흡수한다. "1회 가드"가 별도 플래그가 아니라 **더 정밀한 좌표가 없다**는 사실에서 파생되므로, 표현하려던 개념에 더 맞는 자료구조다.

| 시나리오 | 결과 | 기대 |
|---|---|---|
| warm INIT → fresh 도착 | 1회 | 1회 ✓ |
| READY 시점 이미 fresh | 0회 | 0회 ✓ |
| warm → warm 갱신 | 0회 | 0회 ✓ |
| fresh 후 좌표 재변경 | 0회 | 0회 ✓ |
| **L1**: 폴백 INIT → warm 도착 | 1회 | 1회 ✓ |
| **L1**: 이어서 fresh 도착 | 누적 2회(좌표 각각 warm·fresh) | 2회 ✓ |
| **L2**: warm INIT → FAB | 누적 1회 | 1회 ✓ |

`sendInit`은 승격이 아니라 **평문 대입**(`permission.coords ? permission.coordsSource : null`)으로 구현됐다 — 지적한 대로 INIT은 정밀도가 **내려갈 수 있는** 지점이라 대입이 맞다.

## 10.2 L2 — 예상보다 나은 해법 (`refreshCoords` → `LocationFix`)

1차 검토 때 "FAB 성공 시 `centeredSourceRef = Fresh`"의 위험을 지적했다. `refreshCoords()`는 실패 시 R6에 따라 **직전 좌표를 폴백 반환**하는데 그 출처는 warm일 수 있어, 그대로 Fresh를 찍으면 **근사 좌표에 정밀 딱지를 붙이는 것** — 이번 스프린트가 고치려던 실패 양식 그 자체가 된다.

developer가 권고안 중 가장 근본적인 쪽을 택했다. `refreshCoords`의 반환을 `Coords | null` → **`LocationFix | null`(`{coords, source}`)** 로 넓히고(`types.ts:119`), `handleLocate`가 `centeredSourceRef.current = fix.source`로 **실제 출처**를 기록한다(`MapTabScreen.tsx:175`). 소비자가 `MapTabScreen` 하나뿐이라 파급도 없다.

**plan 이탈 1건 — 승인.** plan §3.4는 `refreshCoords: () => Promise<Coords | null>`를 **"불변 시그니처"** 로 명시했으므로 이 변경은 계획 이탈이다(developer가 자진 신고). **승인한다**: ① 소비자가 `MapTabScreen.handleLocate` 하나뿐이라 파급이 없고(grep 확인), ② 행동 규칙("granted 아니면 null / 실패 시 직전 좌표 폴백 / in-flight 1회")은 전부 보존됐으며, ③ plan §3.4가 시그니처를 고정한 취지는 **기존 FAB 동작의 회귀 방지**인데 map-locate-button 인수조건이 전부 green으로 그 취지는 달성됐다. 오히려 §3.4가 도입한 `coordsSource` 개념을 `refreshCoords`만 누락하고 있던 비대칭을 바로잡는다. **계획 문서보다 계획의 목적을 지킨 이탈**이라 판단한다.

**양쪽 모두 테스트로 잠겼다**(뮤테이션 실증):

| 뮤테이션 | 결과 |
|---------|------|
| 소비자: `centeredSourceRef.current = fix.source` → `= LocationCoordsSource.Fresh` (경고했던 오마킹) | `L2 후속: FAB가 실패 폴백(warm 좌표)으로 리센터했으면 이후 정밀 픽스 보정이 살아있다` **RED** |
| 생산자: 훅의 실패 폴백이 출처를 Fresh로 위조 | `실패 폴백 시 직전 좌표의 실제 출처를 돌려준다 — warm을 fresh로 오마킹하지 않는다` **RED** |

## 10.3 L3 — 해소

`lastKnownLocation.spec.ts:79-109`가 `it.each`로 워밍 경로 **2파일**(`lastKnownLocation.ts` + `LocationPrewarm.tsx`)을 검사하고, 금지 식별자 4종을 `FORBIDDEN_IN_WARMING`으로 단일화했다. 지적한 위양성 여지도 제거돼 **블록 주석(`/* */`)까지 제거 후** 검사한다. plan §7 경계면 4의 선언 범위("워밍 경로")와 검사 범위가 이제 일치한다.

## 10.4 뮤테이션 표본 (2라운드)

새 구조에 맞춰 다시 떴다. 전부 **격리 사본**(프로젝트 내 임시 디렉터리 + 스펙 파일명을 `*.check.*`로 바꿔 기본 `testMatch` 미매치, `npx jest --roots`로 실행, 측정 즉시 삭제)에서 수행했고 **실 소스 변형 0**이다.

| # | 뮤테이션 | 결과 |
|---|---------|------|
| M3a | `handleLocate`이 `fix.source` 대신 `Fresh` 하드코딩 | **1 RED** (L2 후속) |
| M3c | 효과 비교 `<=` → `<` (같은 정밀도도 재센터) | **8 RED** |
| M3e | `rankCoordsSource`에서 Warm을 Fresh와 동급(2)으로 | **4 RED** |
| M4a | 훅 실패 폴백이 출처를 Fresh로 위조 | **1 RED** |
| M3b | `sendInit` 대입 → 단조 승격(정밀도 하강 불가) | **0 RED** → §10.5 |

## 10.5 신규 Info — `sendInit`의 정밀도 하강 분기는 테스트로 잠기지 않는다 (조치 불요)

`sendInit`을 단조 승격으로 바꿔도 57개 테스트가 전부 green이다(M3b). 즉 `: null`로 **내려가는** 분기는 어떤 테스트도 커버하지 않는다.

추적해 보니 **현재 코드에서는 도달 불가능한 방어 분기**다. `permission.coords`가 rank를 낮추려면 R4(denied)가 좌표를 비워야 하는데, `request()`는 `requestedRef`로 1회만 실행되고 `refreshCoords()`는 granted가 아니면 호출조차 되지 않는다. 따라서 좌표가 fresh/warm에서 null로 떨어진 뒤 `sendInit`이 다시 불리는(E16 handleRetry) 조합이 세션 내에 성립하지 않는다.

**테스트를 추가할 필요는 없다**(도달 불가능한 경로의 테스트는 계약이 아니라 구현을 박제한다). 다만 이 대입이 "지금 안 쓰이니 단순화하자"의 대상이 되면, 훗날 좌표를 무효화하는 경로가 생겼을 때 **복구가 조용히 죽는다**. `MapTabScreen.tsx:153-156`의 주석이 이 의도를 이미 설명하고 있어 현 상태로 충분하다. 기록만 남긴다.

## 10.6 프로세스 관찰 — 소스 동결 통지 이후 변경

"소스 재동결" 통지를 받고 검증을 시작했으나, 검증 도중 `MapTabScreen.tsx`·`MapTabScreen.spec.tsx`·`useLocationPermission.ts`·`useLocationPermission.spec.ts` **4개 파일이 추가로 바뀌었다.** 통지 직후 읽은 `handleLocate`은 `centeredSourceRef.current = LocationCoordsSource.Fresh`였는데, 이후 시점의 파일은 `= fix.source`였다(§10.2의 개선). 첫 `npm test`가 보고한 1978개도 최종 상태에서는 1980개였다.

변경 방향은 개선이었고 최종 상태를 기준으로 전항 재검증했으므로 **결과에는 영향이 없다.** 다만 중간 상태를 확정 상태로 오인해 검증했다면 존재하지 않는 코드에 대해 판정을 낼 뻔했다. 앞으로 동결 통지에 **대상 파일의 체크섬(또는 최종 테스트 수)** 을 함께 주면 검증자가 같은 상태를 보고 있는지 즉시 대조할 수 있다.

## 10.7 재검증 결론

**로직 QA 통과.** L1·L2·L3 해소, 회귀 0(1980 tests green), 가드레일·컨벤션 전항 유지. 최종 형태는 1차 권고안보다 나은 해법(단조 승격 + `LocationFix`)이고, 두 회귀 모두 생산자·소비자 양쪽에서 뮤테이션으로 잠긴 것을 확인했다.

**남은 이월**: 디바이스 스모크 S1~S6(사용자 환경)은 여전히 미검증이다. 특히 **S3(앱 구동 시 권한 프롬프트 미발생)** 은 정적·grep 검증만 통과한 상태이고, **S2**는 이번 L1 수정의 실기기 확인 지점이므로 앱 재실행 직후 1초 내 지도 탭 진입으로 함께 봐주기를 권한다.
