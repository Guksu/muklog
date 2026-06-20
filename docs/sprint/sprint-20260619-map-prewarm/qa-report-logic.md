# QA Report — Logic / Integration (지도 WebView 프리워밍 · map-prewarm)

> 검증자: qa-logic · 날짜: 2026-06-19 · 범위: 로직·통합 정합성·보안/비용 가드레일·TDD·컨벤션(비주얼 OUT — 이 스프린트 비주얼 변화 0).
> 단일 출처: `plan.md`(T1~T7·T-MEASURE), 구현 메모: `dev-notes.md`.
> 방법: 생산자↔소비자 양쪽 동시 읽기 + 표본 mutation으로 테스트 load-bearing 확인.

## 종료 기준 (직접 실행 결과)

| 항목 | 결과 |
|------|------|
| `npx tsc --noEmit` | **PASS** (exit 0, 출력 0) |
| `npx jest` (전체) | **PASS** — 136 suites / 1162 tests green (dev-notes 수치와 일치) |
| 컨벤션: useCallback/useMemo 신규 0건 | PASS (`grep` 0건) |
| 컨벤션: `export function` 컴포넌트/훅 0건 | PASS (전부 `export const … = () =>`) |
| PERF-TEMP 보존(제거 시 결함) | PASS — `grep -rn PERF-TEMP src scripts` 5파일/15건 보존(mapHtml 6·MapTabScreen 4·useMuklogPins 2·MapPrewarm 2·mapPerf.mjs 1) |

---

## 인수조건별 판정 (T1~T7)

### T1. useDeferredFlag — 초기 false→유휴 후 true, 언마운트 정리 — PASS (테스트 1건은 weak, 아래 참고)
- 생산자 `src/features/map/useDeferredFlag.ts:13-50`: 초기 `useState(false)` → `runAfterInteractions` 후 `delayMs>0`이면 `setTimeout(markReady, delayMs)`, 아니면 즉시 `markReady`. cleanup에서 `cancelled=true`·`clearTimeout`·`interactionHandle.cancel()` — 정리 로직 **소스상 올바름**.
- 테스트 `useDeferredFlag.spec.ts`: 초기 false / 인터랙션 후 true / delayMs 추가지연 / delayMs=0 즉시 — 모두 load-bearing.

### T2. MapPrewarm 격리 + blank 부팅 — PASS
- `MapPrewarm.tsx:42-62`: `enabled=false || !deferred` → `null`; 아니면 `mapHtml({jsKey: env.KAKAO_JS_KEY})`로 숨김 1×1 `MapWebView` 1개 마운트. `injectJavaScript`(INIT/SET_MARKERS/RECENTER) **미호출** = blank 부팅.
- 소비자 계약 정합: `MapWebView`(components/MapWebView.tsx)는 `{html,onMessage}`만 받아 forward — MapPrewarm이 정확히 그 shape으로 전달. PERF 메시지 약속도 일치: mapHtml `post({type:'PERF',...})` → 직렬화 `"type":"PERF"`, 핸들러(`MapPrewarm.tsx:30`) `data.indexOf('"type":"PERF"')`로 매칭.
- blank 부팅 계약: `mapHtml`은 `__muklogInit` 수신 전 `kakao.maps.Map`을 만들지 않음(`mapHtml.ts` `window.__muklogInit`). 프리워머가 INIT 미주입 → 지도/마커 미생성, READY까지만. **계약 일치.**
- 테스트(injectJavaScript 0회)는 mock ref capture로 검증 — load-bearing.

### T3. 권한 팝업 타이밍 불변 (requestForegroundPermissionsAsync 0회) — PASS
- 정적 격리 확인: `MapPrewarm.tsx` 본문에 `useLocationPermission` 식별자 0(주석 제외). expo-location import 0. 권한 요청의 유일 출처를 import조차 안 함 → **구조적 차단**.
- 대조(소비자): 권한 1회는 `MapTabScreen.tsx`의 `requestLocationOnEnter` effect(무변경)에서만.
- 테스트: `MapPrewarm.spec.tsx:113` `requestPermsMock not called` + 정적 import 검사(`:123-133`). **정적 import 검사가 진짜 가드** — mutation(본문에 `'useLocationPermission'` 주입)으로 red 확인.

### T4. RPC 단일 호출 가드 (list_my_muklog_pins) — PASS
- `MapPrewarm.tsx` 본문 `useMuklogPins`·`supabase.rpc` 식별자 0. RPC 유일 출처(`useMuklogPins.ts fetchPins`)를 import 안 함 → 프리워밍 0회 구조 보장. 지도탭은 자기 인스턴스에서 평소대로 1회 → 합산 1회(2회 불가).
- 테스트: `MapPrewarm.spec.tsx:118` rpc 0회 + 정적 import 검사(load-bearing, mutation red 확인).

### T5. 계약·비주얼 불변 회귀 0 — PASS
- 메시지 계약 모듈(`parseMapMessage`·`mapMessages`·`types`·`useLocationPermission`) **git diff 부재** = 수정 0 확인.
- `mapHtml.ts`·`useMuklogPins.ts`·`MapTabScreen.tsx`는 diff에 나오나 **전부 PERF-TEMP 계측 라인뿐**(로직/계약/오버레이 트리 변경 0) — dev-notes의 "PERF-TEMP 유지" 주장과 정확히 일치. **회귀 유발 변경 없음.**
- 전체 jest green(기존 map/MapTabScreen 테스트 포함).

### T6. 콜드스타트 비경합 — deferred 이후에만 마운트 — PASS
- `MapPrewarm.tsx:46` `!deferred` → null. 테스트 `MapPrewarm.spec.tsx:102` deferred=false면 미마운트.
- mutation(게이트를 `!enabled`만으로 축소)으로 해당 테스트 red 확인 → **load-bearing**.

### T7. AuthGate 배선 — authenticated에서만 — PASS
- `AuthGate.tsx:38-48` `authenticated` 분기에서만 `<MapPrewarm />`(MyLogsProvider 내부). 그 외 4분기 부재. 로그아웃 시 분기 전환=언마운트=WebView 파기.
- 테스트 `AuthGate.spec.tsx:118·124`(authenticated만 존재 / 그 외 4상태 부재) + 기존 6케이스 무변경 통과.
- mutation(error 분기에도 MapPrewarm 렌더)으로 "그 외 미마운트" 테스트 red 확인 → **load-bearing**.

---

## 경계면 교차검증 요약 (생산자 ↔ 소비자)

| 경계면 | 판정 | 근거 |
|--------|------|------|
| MapPrewarm ↔ useLocationPermission/useMuklogPins (격리) | PASS | 본문 식별자 0, 정적 import 테스트 load-bearing |
| MapPrewarm ↔ MapWebView/mapHtml (blank 부팅) | PASS | `{html,onMessage}` shape 일치, INIT 미주입, `__muklogInit` 미발화 계약 일치 |
| useDeferredFlag ↔ MapPrewarm 마운트 | PASS | deferred 전 null / 후 1개 |
| AuthGate state ↔ MapPrewarm 존재 | PASS | authenticated만 |
| MapTabScreen(소비자) 불변 | PASS | PERF-TEMP 외 무변경, 권한·RPC·INIT·오버레이 경로 그대로 |
| 메시지 계약 모듈 불변 | PASS | git diff 부재 |
| env.KAKAO_JS_KEY 경로 | PASS | MapPrewarm·MapTabScreen 동일 `mapHtml({jsKey: env.KAKAO_JS_KEY})`, env.ts에 export 존재 |

## 비용 가드레일 — PASS
- 신규 폴링/Realtime/타이머 반복 0(`useDeferredFlag`는 일회성). 신규 네트워크 0(SDK/RPC 시점 이동만, 횟수 불변 — RPC는 프리워머 미보유로 2회 불가). Kakao REST 키 신규 파일 노출 0(JS 키는 공개키, 정상). AWS 미사용(클라이언트 전용).

---

## 미해결 / 주의 (결함 아님, 품질 메모)

1. **[테스트 품질 — minor] T1 언마운트-정리 테스트가 weak (load-bearing 아님)**
   `useDeferredFlag.spec.ts:73-85`. 두 단언 모두 정리 로직을 실제로 증명하지 못함:
   - `expect(consoleErrorSpy).not.toHaveBeenCalled()` — React 18.3.1은 setState-after-unmount 경고를 **제거**했으므로 이 경고는 어떤 구현에서도 발생하지 않음(껍데기 단언).
   - `expect(result.current).toBe(false)` — `renderHook` 언마운트 후 `result.current`는 마지막 값으로 고정되고, 언마운트 후 setState는 no-op이라 재렌더 안 됨 → cleanup을 일부러 깨도(`cancelled` 가드 + `clearTimeout` 제거) **여전히 green**(mutation으로 확인).
   **영향**: 소스의 cleanup 로직(`useDeferredFlag.ts:37-44`)은 올바르게 구현돼 있어 런타임 결함은 없음. 다만 "언마운트 정리"라는 T1 인수조건의 한 갈래가 테스트로 보호되지 않음(회귀 시 적발 불가).
   **수정안(developer)**: cleanup이 실제로 호출되는지 직접 단언으로 강화 — 예) `runAfterInteractions` mock이 반환하는 핸들의 `cancel` spy가 언마운트 후 호출됐는지(`expect(cancelHandle.cancel).toHaveBeenCalled()`), 그리고 delayMs 경로에서 언마운트 시 `clearTimeout`이 타이머를 취소해 이후 `advanceTimers`로도 markReady가 호출되지 않는지(setReady spy 0회)를 검증. 다른 4개 테스트는 모두 load-bearing이라 T1 본질은 보호됨 — 이 한 케이스만 보강 권고.

2. **[범위 밖, 정상] T-MEASURE·PERF-TEMP 제거**: 종료 단계 리더 몫. PERF-TEMP 계측이 5파일에 그대로 보존됨을 확인(제거됐으면 결함이었음) → **정상**.
3. **[범위 밖] 디바이스 스모크**: 1×1 숨김 WebView 실부팅·워밍 효과·메모리는 단위 검증 불가(메모리 권고대로 배포 준비 스모크 이월). 단위 경계 준수 적절.

---

## 결론

**로직 PASS.** T1~T7 인수조건 전부 충족, 경계면 정합·격리·계약 불변 모두 교차검증 통과, tsc/jest green, 컨벤션·비용 가드레일 준수. 유일한 보완 권고는 T1 언마운트-정리 테스트의 단언 강화(런타임 결함 아님, 테스트 커버리지 공백). 스프린트 로직 완료 처리 가능 — 단 위 권고를 developer에 전달.
