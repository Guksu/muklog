# Dev Notes — 지도 WebView 프리워밍 (map-prewarm)

> 전략 **A′(루트 숨김 WebView 프리워밍, 인스턴스 비공유)** 구현. TDD(Red→Green→Refactor). git 작업 없음.
> 종료 기준: `npm test` 전체 통과(136 suites / 1162 tests green) + `npx tsc --noEmit` 통과(exit 0).

---

## 1. 변경/신규 파일

### 신규
| 파일 | 책임 |
|------|------|
| `src/features/map/useDeferredFlag.ts` | 콜드스타트 보호 지연 플래그 훅. 초기 `false` → `InteractionManager.runAfterInteractions`(첫 프레임 완료) + 옵션 `delayMs` 경과 후 `true`. 언마운트 시 `cancelled` 플래그·`clearTimeout`·interactionHandle.cancel로 정리(setState-after-unmount 경고 0). |
| `src/features/map/useDeferredFlag.spec.ts` | T1·T6 — 초기 false / 인터랙션 후 true / delayMs 추가지연 / delayMs=0 즉시 / 언마운트 후 flush 경고 0. (InteractionManager mock + fake timer) |
| `src/features/map/MapPrewarm.tsx` | T2 — 루트 숨김 1×1 WebView 프리워머. `mapHtml({jsKey})`를 `useDeferredFlag` true 시점에 1회 숨김 마운트(READY까지 부팅). 권한·RPC·INIT 미보유(구조적 격리). |
| `src/features/map/MapPrewarm.spec.tsx` | T2·T3·T4·T6 — enabled 분기 / deferred 게이팅 / injectJavaScript 0회 / 권한 0회 / rpc 0회 / 두 훅 import 정적검사. |

### 수정
| 파일 | 변경 |
|------|------|
| `src/navigation/AuthGate.tsx` | T7 — `authenticated` 분기에만 `<MapPrewarm />` 마운트(MyLogsProvider 내부, NavigationContainer 형제). import 1줄 추가. 인증 5분기 기존 동작 회귀 0. |
| `src/navigation/AuthGate.spec.tsx` | T7 — MapPrewarm 마커 모킹 + "authenticated만 마운트 / 그 외(unauth·loading·error·authenticating) 부재" 2케이스 추가. 기존 6케이스 무변경. |

**무변경 보장(요구사항)**: `mapHtml.ts` · `MapWebView.tsx` · `MapTabScreen.tsx` · 메시지 계약 모듈(`parseMapMessage`·`mapMessages`·`types`) · `useMuklogPins.ts` · `useLocationPermission.ts` 전부 손대지 않음. PERF-TEMP 계측(mapHtml·useMuklogPins·MapTabScreen·scripts/mapPerf.mjs) 그대로 유지(스프린트 종료 재측정용).

---

## 2. 핵심 구현 결정

- **마운트 시점**: `useDeferredFlag({ delayMs: PREWARM_DELAY_MS=1200 })`. 첫 프레임 완료(`runAfterInteractions`) 후 추가 1.2s idle을 더 둬 홈 첫 페인트와의 경합을 최소화(콜드스타트 보호 우선). `delayMs` 미지정/0이면 인터랙션 직후 전환(타이머 없이 동기 setReady).
- **격리 방식(권한 팝업·RPC 앞당김 차단의 핵심)**: `MapPrewarm.tsx`는 `useLocationPermission`·`useMuklogPins`을 **import조차 하지 않는다**(코드 정적 검사로 강제 — 주석 제외 본문에 두 식별자 0). 두 훅이 권한 다이얼로그·`list_my_muklog_pins` RPC의 유일한 출처이므로, import 부재 = 앞당김 구조적 불가.
- **blank 부팅**: 프리워머는 `injectJavaScript`(INIT/SET_MARKERS/RECENTER)를 **호출하지 않는다**. `mapHtml` 계약상 `__muklogInit`을 받기 전엔 `kakao.maps.Map`을 생성하지 않으므로 → SDK 다운로드·`kakao.maps.load`(READY)까지만 도달, 지도/마커는 안 그림 = 권한·핀 불필요.
- **인스턴스 비공유**: 지도탭(`MapTabScreen`)은 평소대로 자기 WebView를 표준 마운트. 프리워머와는 별개 인스턴스이고, 공유되는 것은 WKWebView 프로세스/네트워크/SDK HTTP 캐시 워밍업뿐(B의 reparent 깨짐 회피).
- **숨김 스타일**: `position:absolute; top:0; left:0; width:1; height:1; opacity:0` + `pointerEvents="none"` + `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`. 레이아웃·입력·접근성 트리 영향 0. (0×0이면 일부 엔진이 스크립트 실행을 미뤄 1×1 — plan §4.1, 디바이스 스모크에서 실부팅 확인 권고.)
- **메시지 처리**: `handlePrewarmMessage`는 PERF만 `[mapPerf:prewarm]`로 콘솔 패스스루(PERF-TEMP), READY/ERROR는 조용히 무시(프리워밍 실패는 사용자 영향 0). RN state 없음(인스턴스 비공유라 지도탭이 안 읽음).
- **킬 스위치**: `enabled=false`(기본 true)면 `null` 렌더 — 저사양/저메모리 기기 트레이드오프가 음(-)일 때 비활성. AuthGate는 기본값(true)로 마운트.

### 트레이드오프 / 리스크
- A′의 개선 효과는 "프로세스/네트워크/SDK 캐시 워밍업으로 부팅 단축"이라는 **가설 의존**. dev/시뮬 재측정(T-MEASURE, 종료 단계)에서 `wv:script-start`~`wv:map-created` 진입기준 단축이 미달(<30%)이면 fallback(전략 A 가드강화 / B 재검토)을 리더에 보고 — plan §4.0 ⚠.
- 단위 테스트는 InteractionManager·WebView를 mock하므로 **실제 유휴 타이밍·실부팅·메모리는 디바이스 스모크 대상**(메모리: "레이아웃/네이티브 동작은 디바이스 스모크 필수").

---

## 3. 생산자 ↔ 소비자 매핑 (qa-logic 교차검증 포인트)

| 경계면 | 생산자 | 소비자 | 검증 포인트 |
|--------|--------|--------|-------------|
| 격리(권한·RPC 앞당김 차단) | `MapPrewarm.tsx`(두 훅 미import) | `useLocationPermission`·`useMuklogPins` | MapPrewarm 소스 정적검사로 두 식별자 본문 0(MapPrewarm.spec). 권한 mock 0회·rpc mock 0회. |
| blank 부팅 | `MapPrewarm`(injectJavaScript 미호출) | `mapHtml`의 `__muklogInit` 계약 | injectJavaScript 0회 단언(MapPrewarm.spec). INIT 없이는 지도 미생성 = 권한·핀 불필요. |
| 콜드스타트 게이팅 | `useDeferredFlag`(false→true) | `MapPrewarm` 마운트 분기 | deferred=false면 WebView 미마운트 / true면 1개. (MapPrewarm.spec T6) |
| 인증 게이팅 | `AuthGate` state(useAuth 5분기) | `MapPrewarm` 존재 여부 | authenticated만 마운트, 그 외 부재(AuthGate.spec T7). 로그아웃 시 언마운트=WebView 파기. |
| 지도탭 불변(회귀 0) | — | `MapTabScreen` | requestLocationOnEnter·useMuklogPins·INIT 송신·오버레이 분기 무변경. MapTabScreen.spec 전부 green. |
| 메시지 계약 불변 | — | `parseMapMessage`·`mapMessages`·`types` | 모듈 수정 0(파일 mtime/내용 무변경). 기존 map 테스트 green. |

---

## 4. 테스트 결과

- 신규: `useDeferredFlag.spec.ts`(5) + `MapPrewarm.spec.tsx`(9) + `AuthGate.spec.tsx` 추가 2케이스.
- **`npm test`(jest): 136 suites / 1162 tests 전부 green** (이전 134 suites + 신규 2).
- **`npx tsc --noEmit`: exit 0**.
- 회귀(T5): 기존 map 단위 테스트·MapTabScreen 트리 전부 무변경 green.

---

## 5. 미완 / 후속 (developer 범위 밖)

- **T-MEASURE(스프린트 종료 단계, 리더)**: 프리워밍 ON/OFF 베이스라인 재측정(`scripts/mapPerf.mjs`, 지도탭 첫 진입 기준 `wv:script-start`~`wv:map-created`), A′ 확정/fallback 판정 후 `grep -rn PERF-TEMP src scripts` → 0이 되도록 PERF-TEMP 일괄 제거. **developer는 PERF-TEMP를 제거하지 않았다**(재측정에 필요).
- **디바이스 스모크**: 1×1 숨김 WebView 실부팅·워밍 효과·메모리/배터리 음(-) 트레이드오프 → 배포 준비 스모크 배치로 이월 가능(메모리 권고). `enabled=false` 킬 스위치로 비활성 가능.
