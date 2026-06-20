# Sprint: 지도 WebView 프리워밍 (map-prewarm)

> 작성 단일 출처: `docs/design/architecture.md`(§4 화면·§6 비용 가드레일) · 실측 근거(아래 §0) · 현재 코드(§3 계약).
> lean 스프린트: **planner → developer → qa-logic** (ui-publisher / qa-visual 비관여 — 비주얼 변화 0).
> git 작업 없음. TDD(인수조건 = 테스트 케이스, Red 먼저).

---

## 0. 배경 — 실측 근거 (측정 완료, dev/시뮬 1회)

지도탭 콜드 진입 타임라인:

| 구간 | 시각/소요 | 비고 |
|------|-----------|------|
| `rn:screen-mount` | t=1 | 지도탭 마운트 |
| → `wv:script-start` | t=3363 (**2642ms**) | **WebView 부팅 — 전체 3760ms의 88%, 진짜 병목** |
| `wv:sdk-loaded` | +249ms | SDK 다운로드 |
| `kakao.maps.load` | +28ms | |
| `wv:map-created` | +36ms | 지도 객체 생성(첫 페인트) |
| `wv:markers-rendered` | +76ms | INIT 마커 렌더 |
| 핀 RPC 왕복 | 721ms | 지도보다 ~3초 먼저 끝남 → INIT에 핀 동봉(markers:1), 깜빡임 없음 |

**결론**: SDK 캐싱·핀 프리페치는 첫 페인트 체감 기여 **0**. 유일한 유효 레버 = **지도 WebView를 미리 부팅(프리워밍)**.
**리스크 메모**: dev WKWebView 콜드 부팅(2642ms)은 release/실기기 대비 **과대평가 가능성** 있음. 이번 스프린트의 개선폭은 dev/시뮬 기준 상대비교이며, 절대값은 릴리스 재측정에서 재확인(이번 스프린트 OUT, §2).

---

## 1. 기능 한줄 정의

사용자가 지도탭을 처음 누르기 **전**(앱 진입 후 홈 탭 체류 중) 백그라운드에서 지도 WebView를 미리 마운트·부팅해 두어, 지도탭 진입 시 Kakao SDK 로드·`kakao.maps.load`가 **이미 끝나 있어** 진입 시점 기준 첫 지도 페인트까지의 체감 지연이 대폭 단축된다 — **위치 권한 팝업·핀 RPC는 실제 지도탭 방문 시에만** 일어난다(불변).

---

## 2. 범위

### In-scope
- 지도 WebView(`mapHtml` 임베드)를 **지도탭 포커스 이전에** 1회 마운트·부팅(SDK 다운로드 → `kakao.maps.load` → `READY`까지 도달).
- 프리워밍 **시점 게이팅**: 앱 콜드스타트(첫 화면 표시)를 눈에 띄게 늦추지 않도록 **유휴/지연 시점**에 시작.
- 위치 권한 다이얼로그·핀 RPC가 프리워밍으로 **앞당겨지지 않음**을 보장(인수조건·테스트로 강제).
- 프리워밍 단일화: SDK 다운로드 1회·RPC 1회만(프리워밍+탭진입 2회 호출 금지).
- 개선 전후 재측정 절차 정의(PERF-TEMP 재사용) + 스프린트 종료 시 PERF-TEMP 일괄 제거.

### Out-of-scope (일부러 안 함 — 별도/후속)
- **SDK 캐싱**(WebView HTTP 캐시, 로컬 번들 SDK) — 첫 페인트 체감 기여 0(§0).
- **핀 프리페치**(RPC를 더 일찍) — 이미 지도보다 ~3초 먼저 끝남, 무의미.
- **릴리스/실기기 재측정** — dev 과대평가 검증은 배포 준비 배치(§5 출시 전 필요)로 이월.
- 지도탭 **시각적/UX 변경** — 비주얼 결과·카피·레이아웃 전부 동일(qa-visual 비관여).
- WebView↔RN **메시지 계약 변경**(INIT/SET_MARKERS/RECENTER/READY/MARKER_TAP/BOUNDS_CHANGED/ERROR) — 불변.
- nearby viewport 조회·핀 색·현재위치 FAB 동작 — map-tab-nearby / map-locate-button 산출물 그대로.

---

## 3. 데이터 · API 계약

### 3.0 DB / Edge Function / RPC
- **변경 없음.** 신규 마이그레이션 0, 신규 Edge Function 0, 신규 RPC 0. `list_my_muklog_pins()` 시그니처·응답 불변.

### 3.1 WebView ↔ RN 메시지 계약 (불변)
- 송신(WV→RN): `READY` / `MARKER_TAP{id,saved}` / `BOUNDS_CHANGED{sw,ne}` / `ERROR{reason}` / (PERF-TEMP) `PERF{label,t}`.
- 수신(RN→WV): `__muklogInit(INIT{center,markers,me})` / `__muklogSetMarkers{markers}` / `__muklogRecenter{me}`.
- **이 스프린트는 메시지 타입·필드·핸들러를 추가/변경하지 않는다.** 프리워밍은 "언제 WebView를 마운트하는가"만 바꾼다.
- 핵심 불변식: **WebView는 INIT을 받기 전까지 지도를 그리지 않는다**(`__muklogInit`이 `kakao.maps.Map` 생성). → 프리워밍된 WebView는 `READY`까지만 도달하고, **INIT은 보이는 지도탭이 마운트되어 권한·핀이 준비된 뒤** 보낸다. 이것이 "프리워밍해도 권한 팝업이 안 뜨는" 구조적 근거다.

### 3.2 프리워밍 컴포넌트/훅 시그니처 (권장안 = 전략 A′, §4.0)
신규 파일(이름은 developer 재량이나 시그니처 고정):

```ts
// src/features/map/MapPrewarm.tsx — 루트 레벨 숨김 WebView 프리워머(프리젠테이션 격리).
//   책임: mapHtml을 1회 마운트해 SDK를 부팅(READY까지). 지도탭이 아직 안 보여도 부팅만 진행.
//   NON-책임: 권한 요청·RPC·INIT 송신(전부 MapTabScreen의 몫 — 프리워머는 절대 호출하지 않음).
export type MapPrewarmProps = {
  /** false면 렌더 안 함(프리워밍 비활성·테스트 토글). 기본 true. */
  enabled?: boolean;
};
export const MapPrewarm: (props: MapPrewarmProps) => JSX.Element | null;
```

```ts
// src/features/map/useDeferredFlag.ts — 콜드스타트 보호용 지연 플래그(첫 프레임 후/유휴 시점에 true).
//   InteractionManager.runAfterInteractions + (옵션) 추가 idle 지연으로 "유휴 시점" 게이팅.
export const useDeferredFlag: (args: { delayMs?: number }) => boolean; // 초기 false → 지연 후 true
```

**계약 핵심(developer가 추측 금지)**:
- `MapPrewarm`은 **`useMuklogPins`·`useLocationPermission`을 import/호출하지 않는다**(이 둘이 권한 팝업·RPC의 출처). WebView만 마운트한다.
- `MapPrewarm`이 마운트하는 WebView는 **`onMessage`로 READY/ERROR/PERF만 수신**하고 INIT을 **보내지 않는다**(blank 부팅). → 콘솔 PERF 로그로 부팅 진행 확인 가능, 지도는 안 그려짐.
- 프리워밍과 지도탭이 **같은 WebView 인스턴스를 공유**할지(전략 B) vs **별개 인스턴스이되 부팅 비용만 워밍 캐시로 공유**할지(전략 A′)는 §4.0에서 A′ 확정 — 인스턴스는 별개, 공유되는 것은 **WKWebView 프로세스/네트워크/SDK 캐시 워밍업**이다. (트레이드오프·근거는 §4.0.)

---

## 4. 화면 · UX

### 4.0 전략 선택 — 트레이드오프 표 + 권장안

| 전략 | 방식 | 권한팝업/RPC 격리 | 콜드스타트 영향 | 복잡도/리스크 | 부팅 워밍 효과 |
|------|------|-------------------|-----------------|----------------|----------------|
| **A. `lazy:false`** | HomeTabs에서 MapTab 스크린을 미리 마운트 | ❌ **MapTabScreen 마운트가 곧 권한 팝업+RPC** — 강한 가드 필요(effect를 isFocused로 게이트). 가드 누락 시 앱 시작 시 권한 팝업 발생(치명) | 중(마운트 비용이 홈 첫 프레임과 경합) | 중 — 가드가 깨지기 쉬움(qa가 항상 회귀 점검 필요) | 높음(실제 화면이 그려짐) |
| **B. 루트 숨김 WebView 재사용** | 탭 트리 밖에서 WebView를 프리워밍 후 MapTab이 **그 인스턴스를 재사용** | ✅(권한·RPC를 프리워머가 안 가짐) | 중 | **높음** — RN에서 단일 WebView 인스턴스를 트리 간 이동/재부모(reparent)는 깨지기 쉬움(언마운트 시 WebView 파기) | 최고(완전 재사용) |
| **A′. 루트 숨김 WebView 프리워밍(인스턴스 비공유)** ⭐ | 루트에 **숨김 프리워머 WebView**를 1개 둠. 부팅(SDK 다운로드·`kakao.maps.load`)으로 **WKWebView 프로세스·네트워크·HTTP 캐시를 워밍**. MapTab은 평소처럼 **자기 WebView를 새로 마운트**하되 워밍된 환경 덕에 부팅이 빠름 | ✅(프리워머가 권한·RPC 미보유 — 구조적으로 불가) | **낮음**(지연 플래그로 유휴 시점 시작 + 숨김 1개라 첫 프레임 경합 작음) | **낮음**(인스턴스 reparent 없음 — 각자 표준 마운트/언마운트) | 중~높음(공유 캐시·워밍 프로세스 의존, 인스턴스 자체는 미공유) |

**권장안 = A′ (루트 숨김 WebView 프리워밍, 인스턴스 비공유).**

**사유(단순·저위험 우선)**:
1. **권한/RPC 격리가 구조적으로 보장**된다 — 프리워머는 `useLocationPermission`·`useMuklogPins`을 아예 import하지 않으므로, "가드를 깜빡해서" 팝업이 새는 일이 원천 차단(A의 약점 제거).
2. **인스턴스 reparent 불필요**(B의 약점 제거) — RN WebView를 트리 간 이동시키는 깨지기 쉬운 패턴을 피한다. 프리워머와 지도탭 WebView는 각자 표준 생명주기.
3. **콜드스타트 보호** — 숨김 WebView 1개를 `useDeferredFlag`로 첫 프레임 후/유휴 시점에 마운트 → 홈 첫 페인트와 경합 최소.
4. **계약·비주얼 불변** — INIT을 안 보내므로 프리워머는 빈 부팅, 지도탭 코드는 그대로.

> ⚠️ **A′의 효과는 "WebView 부팅 비용이 프로세스/네트워크/SDK-캐시 워밍업에 의해 단축된다"는 가설에 의존**한다. dev/시뮬 재측정(§5 작업)에서 `wv:script-start`~`wv:map-created` 진입 기준 단축이 **유의미하지 않으면**, fallback으로 전략 A(가드 강화한 `lazy:false`)를 채택한다 — 이 fallback 분기와 판정 기준을 §5 T-MEASURE에 명시한다. (효과가 부족하면 리더에게 A 전환 또는 B(인스턴스 공유) 재검토를 보고.)

### 4.1 마운트 위치
- **AuthGate `authenticated` 분기**(NavigationContainer 내부, AppNavigator 형제 또는 HomeTabs 인근)에 `<MapPrewarm enabled={...} />`를 둔다.
  - 근거: 프리워밍은 **로그인 후에만** 의미(미인증 화면에선 지도탭 도달 불가). `MyLogsProvider`/NavigationContainer 안쪽이면 인증 사용자 세션에서만 산다.
  - 숨김: `position:absolute`, `width/height: 1`(또는 0), `pointerEvents:'none'`, `opacity:0`, `accessibilityElementsHidden`/`importantForAccessibility:'no-hide-descendants'` — **레이아웃·입력·접근성 트리에 영향 0**(WebView가 0×0이면 일부 엔진이 스크립트 실행을 미루므로 1×1 권장, dev-notes에서 디바이스 스모크로 확인).
- 시점: `useDeferredFlag({ delayMs })`가 true가 된 뒤에만 프리워머 WebView를 렌더(첫 프레임 후/유휴). `enabled === false`면 영구 미렌더.

### 4.2 상태 (로딩 / 빈 / 에러 / 성공)
- 프리워머는 **UI 없음**(숨김). 사용자 가시 상태 변화 0.
- READY 수신: 부팅 완료(콘솔 PERF-TEMP 로그로만 관측). 별도 RN state 불필요(인스턴스 비공유라 지도탭이 이 상태를 읽지 않음).
- ERROR 수신: **조용히 무시**(프리워밍 실패는 사용자 영향 0 — 지도탭이 평소대로 자기 WebView에서 다시 부팅·에러 처리). 재시도/배너 없음.
- 지도탭 자체의 로딩/빈/에러/권한 안내 오버레이는 **MapTabScreen 그대로**(불변).

### 4.3 원티드 토큰 사용 지점
- 없음(숨김 0×0~1×1, 가시 스타일 없음). 토큰 신규 사용 없음 → qa-visual 비관여 근거.

---

## 5. 작업 목록 (각 인수조건 포함)

- [ ] **T1. `useDeferredFlag` 훅 신설** — 인수조건: 초기 반환 `false`, `InteractionManager.runAfterInteractions`(+옵션 `delayMs`) 경과 후 `true`로 전환. 언마운트 시 타이머/콜백 정리(setState-after-unmount 경고 0). — 테스트: `renderHook` 후 초기 false, fake timer/interaction flush 후 true, 언마운트 후 flush 시 경고 없음.
- [ ] **T2. `MapPrewarm` 컴포넌트 신설(격리)** — 인수조건: `enabled=false`면 `null` 렌더(WebView 없음). `enabled=true`+deferred true면 `mapHtml({jsKey})`로 **MapWebView 1개**를 숨김 마운트. **`useMuklogPins`·`useLocationPermission`을 import/호출하지 않음**(소스 정적 검사). INIT/SET_MARKERS/RECENTER를 **주입하지 않음**(injectJavaScript 미호출). — 테스트: ① enabled=false → `queryByTestId('map-prewarm-webview')` null, ② enabled=true+deferred → 1개 렌더, ③ 모듈 import 그래프/소스 정적 검사로 두 훅 미참조, ④ render 후 injectJavaScript 0회.
- [ ] **T3. 권한 팝업 타이밍 불변 — Location.requestForegroundPermissionsAsync 비호출 가드** — 인수조건: `MapPrewarm`(+상위 AuthGate authenticated, 지도탭 **미포커스**) 마운트 후 deferred true가 되어도 `Location.requestForegroundPermissionsAsync`가 **0회** 호출된다. — 테스트: `expo-location` 모킹 후 MapPrewarm(또는 AuthGate authenticated stub) 렌더+deferred flush → `requestForegroundPermissionsAsync` not called. **MapTabScreen 포커스 시에만** 1회 호출됨을 대조 테스트로 확인.
- [ ] **T4. RPC 단일 호출 가드 — `list_my_muklog_pins` 중복 방지** — 인수조건: 프리워밍으로 `supabase.rpc('list_my_muklog_pins')`가 **앞당겨 호출되지 않는다**(프리워밍 단계 0회). 지도탭 첫 진입 시 **정확히 1회**. 프리워밍+탭진입 합산이 2회가 되지 않는다. — 테스트: `supabase.rpc` 모킹 후 (a) 프리워밍만 → rpc 0회, (b) 지도탭 마운트 → rpc 1회.
- [ ] **T5. 계약·비주얼 불변 회귀 0** — 인수조건: 기존 map 테스트(706+/757+/832 green 라인) 전부 통과, MapTabScreen 렌더 결과(오버레이/카드/FAB/legend 트리) 변화 없음, 메시지 계약(parseMapMessage/buildInitScript/...) 수정 0. — 테스트: `npm test` 전체 green, 기존 MapTabScreen 스냅샷/트리 테스트 무변경 통과.
- [ ] **T6. 콜드스타트 비경합 — 프리워머는 deferred 이후에만 마운트** — 인수조건: 첫 프레임(InteractionManager interactions 완료) 전에는 프리워머 WebView가 마운트되지 않는다. — 테스트: deferred flush 전 `queryByTestId('map-prewarm-webview')` null, flush 후 not null.
- [ ] **T7. AuthGate 배선 — 인증 사용자에서만 프리워밍** — 인수조건: `unauthenticated`/`loading`/`error` 상태에선 `MapPrewarm`이 트리에 없다. `authenticated`에서만 마운트. 로그아웃 시 언마운트(WebView 파기). — 테스트: AuthGate를 각 state로 렌더 → authenticated만 prewarm 존재, 그 외 부재.
- [ ] **T-MEASURE. (스프린트 종료 단계, developer 아님) 개선 전후 재측정 + PERF-TEMP 제거** — 인수조건: 기존 PERF-TEMP 계측으로 ① 프리워밍 OFF(현행) 베이스라인과 ② 프리워밍 ON에서 **지도탭 첫 진입 시점 기준** `wv:script-start`~`wv:map-created` 경과를 `scripts/mapPerf.mjs`로 비교, 단축 폭 기록. **판정**: 진입 기준 첫 페인트 경과가 베이스라인 대비 유의미(예: ≥30%) 단축이면 A′ 확정; 미달이면 §4.0 fallback(전략 A 가드강화 또는 B 재검토)을 리더에 보고. 재측정 후 `grep -rn PERF-TEMP src scripts` 0건이 되도록 계측 일괄 제거(`mapHtml.ts`·`useMuklogPins.ts`·`MapTabScreen.tsx`·`scripts/mapPerf.mjs` + 신규 코드 내 PERF-TEMP). — 테스트: 제거 후 `npm test` green + `grep -rn PERF-TEMP src scripts` → 0.

> 작업 순서: T1 → T2 → (T3·T4 병렬) → T6·T7 → T5 회귀 → **T-MEASURE는 맨 마지막**(재측정에 PERF-TEMP 필요하므로 developer는 제거하지 않는다).

## 5-1. 테스트 케이스 (TDD)

**단위 테스트 대상(jest-expo + @testing-library/react-native — `docs/testing-strategy.md`)**:
- `useDeferredFlag`(훅): 정상 false→true / 경계 delayMs=0 즉시 / 실패경로 언마운트 후 flush 경고 0. (fake timer + InteractionManager mock)
- `MapPrewarm`(컴포넌트): enabled false/true 분기 / deferred 전후 / injectJavaScript 0회 / 두 훅 미참조(정적·import 검사).
- 권한 타이밍(T3): `expo-location` 모킹 — 프리워밍 경로 0회 vs 지도탭 포커스 경로 1회(정상·경계 대조).
- RPC 단일(T4): `supabase.rpc` 모킹 — 프리워밍 0회 / 지도탭 1회 / 합산 ≤1회.
- AuthGate 배선(T7): `useAuth` state 5분기 — authenticated만 prewarm 존재.
- 회귀(T5): 기존 map 단위 테스트 전체 무변경 green.

**모킹/스모크 대상(외부 SDK·네이티브 — 단위 불가)**:
- 실제 WKWebView 콜드 부팅 단축(워밍 효과)·1×1 숨김 WebView가 스크립트를 실제 실행하는지 → **디바이스 스모크**(T-MEASURE, dev/시뮬). (메모리: "레이아웃/네이티브 동작은 디바이스 스모크 필수".)
- `InteractionManager` 실제 타이밍 → 단위는 mock, 실제 유휴 시점 체감은 스모크.

---

## 6. 엣지케이스

- **권한 미결정(undetermined) 상태에서 프리워밍**: 프리워머는 `useLocationPermission`을 안 가지므로 **권한 다이얼로그가 절대 안 뜬다**(T3 핵심). 사용자가 지도탭을 처음 방문할 때만 `requestLocationOnEnter`가 1회 요청.
- **프리워밍 진행 중(READY 전)에 지도탭 진입**: 지도탭은 자기 WebView를 표준 마운트 → 워밍 캐시 덕에 부팅이 빠르거나, 미완이면 평소처럼 부팅(최악도 현행과 동일, 회귀 없음). 프리워머와 지도탭 WebView는 독립이라 경쟁/충돌 없음.
- **프리워밍 ERROR(SDK_LOAD_FAILED/SDK_UNAVAILABLE/인증 실패)**: 프리워머는 조용히 무시(사용자 영향 0). 지도탭은 자기 WebView에서 평소대로 ERROR 오버레이+재시도 처리(불변).
- **저사양/저메모리 기기**: 숨김 WebView 1개가 메모리·배터리 부담 → `useDeferredFlag`로 유휴 시점 게이팅 + 1×1 최소 크기. 효과/부담 트레이드오프가 음(-)이면 `enabled=false`로 비활성 가능(킬 스위치). 디바이스 스모크에서 확인(메모리 사각지대).
- **로그인 직후/직전 전환**: AuthGate `authenticated`에서만 마운트(T7) → 미인증·로딩·에러에선 부재. 로그아웃 시 언마운트로 WebView 파기(잔존 프로세스 0).
- **빠른 앱 전환(백그라운드 진입)**: 프리워밍 중 앱이 background로 가도 WebView는 OS가 관리(추가 처리 불필요). 신규 폴링/타이머 미도입이라 백그라운드 부하 0.
- **JS 키 미설정(`KAKAO_JS_KEY` 빈값)**: 프리워머도 ERROR로 끝남(무시). 라이브 키 설정·콘솔 도메인 화이트리스트는 map-tab 산출물과 동일 전제(별 추가 없음).
- **커플 동시성**: 프리워밍은 클라이언트 로컬·읽기성 SDK 부팅뿐 — 두 멤버 데이터 상호작용 없음(쓰기/RPC 앞당김 0이므로 동시성 영향 0).
- **deferred 미발화(InteractionManager 영구 점유)**: `delayMs` 타임아웃 폴백으로 일정 시간 후 강제 true(영구 미프리워밍 방지) — 단, 콜드스타트 보호가 우선이므로 폴백 지연은 넉넉히. (또는 폴백 없이 "프리워밍 안 됨=현행 동작"으로 안전 degrade — developer 판단, 단 회귀 0.)

---

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

- **`MapPrewarm` ↔ `useLocationPermission`/`useMuklogPins`**: 프리워머가 이 둘을 **참조하지 않음**을 양쪽 import 그래프로 확인(권한 팝업·RPC 앞당김 차단의 핵심). qa-logic이 정적 검사.
- **`MapPrewarm` ↔ `MapWebView`/`mapHtml`**: 프리워머가 INIT을 **안 보냄**(injectJavaScript 미호출) → blank 부팅. WebView는 INIT 없이는 지도 미생성(`mapHtml` `__muklogInit` 계약)임을 대조.
- **`useDeferredFlag` ↔ `MapPrewarm` 마운트**: deferred 전 미마운트 / 후 마운트(콜드스타트 비경합).
- **AuthGate 상태 ↔ `MapPrewarm` 존재 여부**: authenticated만 존재(T7).
- **`MapTabScreen`(소비자) 불변**: 프리워밍 도입 후에도 `requestLocationOnEnter`/`useMuklogPins`/INIT 송신/오버레이 분기 **무변경** — 기존 동작 회귀 0.
- **메시지 계약 모듈**(`parseMapMessage`·`buildInitScript`·`buildSetMarkersScript`·`buildRecenterScript`·`MapInboundType`): 수정 0 확인.

---

## 8. 비용 가드레일 체크

- **AWS 미사용** — 클라이언트 전용 변경(신규 백엔드 0).
- **신규 네트워크 0**: 프리워밍은 SDK 다운로드 1회·RPC 1회를 **앞당기지 않고 시점만 이동/유지**한다. 특히 RPC는 프리워머가 미보유(T4)라 **2회 호출 불가**. SDK 다운로드도 워밍 캐시 가설상 1회(라이브 스모크 확인).
- **폴링/Realtime 0**: `useDeferredFlag`는 일회성 지연(반복 타이머 아님). 프리워머는 부팅 1회 후 idle. watchPosition·Realtime 미도입.
- **Kakao Local 호출 0**: 프리워밍은 nearby(`nearby-search`)를 트리거하지 않음(INIT 미송신 → idle/BOUNDS_CHANGED로 nearby 조회 안 됨). map-tab-nearby 비용 가드 불변.
- **이미지 압축·viewport 조회**: 본 기능 무관(해당 없음).
- **메모리/배터리**: 숨김 WebView 1개 — 유휴 게이팅 + 1×1 최소화 + `enabled` 킬 스위치로 부담 상한. 디바이스 스모크로 음(-) 트레이드오프 확인.

---

## 9. 산출물 / 완료 기준

- 신규: `src/features/map/MapPrewarm.tsx`, `src/features/map/useDeferredFlag.ts`(+테스트). AuthGate authenticated 분기 배선.
- 무변경 보장: `mapHtml.ts`·`MapWebView.tsx`·`MapTabScreen.tsx`(PERF-TEMP 제거 외)·메시지 계약 모듈·`useMuklogPins`·`useLocationPermission`.
- 완료 기준: T1~T7 인수조건 green + `npm test` 전체 통과 + **T-MEASURE 재측정 기록**(개선폭 + A′ 확정/ fallback 판정) + `grep -rn PERF-TEMP src scripts` → 0.
- 라이브 검증: 디바이스 스모크(1×1 숨김 WebView 실제 부팅·워밍 효과·메모리)는 배포 준비 스모크 배치로 이월 가능(메모리 권고).
