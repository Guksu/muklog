# dev-notes — 바텀시트 드래그 dismiss 재작업 (sheet-drag-rework)

> 작성: dev-sheet-drag (2026-08-19). 선행: `docs/sprint/sprint-20260812-sheet-drag-dismiss/`(plan §0 정찰·판정 계약·소비처 전수표는 그대로 유효).
> 한 줄 요약: **제스처 수단을 RN 내장 `PanResponder`(JS responder 협상) → `react-native-gesture-handler`(네이티브 제스처 인식기)로 교체**했다. 판정 계약·상수·순수 유틸 3종은 전부 불변.

---

## 1. 원인 분석 — 무엇을 확인했고, 무엇을 확정하지 못했나

### 1-1. 확정: JS 레이어(PanResponder 배선)에는 결함이 없다

이전 구현의 전제("비캡처면 자식이 우선하고, `Pressable` 위에서 시작한 드래그도 termination 양보로 패널이 이어받는다")를 **RN 소스로 끝까지 따라가 검증했다.** 결과는 **전제가 맞다** — 반박 실패다.

| # | 확인한 것 | 근거(설치본) | 결론 |
|---|-----------|--------------|------|
| A1 | `Pressable`은 responder 양보를 거절하지 않는다 | `Pressability.js:527-530` — `onResponderTerminationRequest: () => cancelable ?? true`, `Pressable.js`는 `cancelable`을 기본 미지정 → **항상 `true`** | Pressable 위 드래그도 패널이 이어받을 수 있어야 한다 |
| A2 | 자식이 responder를 쥐고 있어도 **패널은 협상에 참여한다** | `ReactNativeRenderer-dev.js:1565-1583` — `bubbleShouldSetFrom = LCA(responderInst, targetInst)`, `skipOverBubbleShouldSetFrom`이면 `accumulateTwoPhaseDispatchesSingleSkipTarget`(`:1334-1341`)이 **자식의 부모부터** 2-phase를 돌린다 → 패널의 capture(=`gestureState` 갱신)와 bubble(=`onMoveShouldSetPanResponder`)이 **둘 다 실행된다** | 게이트가 호출조차 안 되는 시나리오는 아니다 |
| A3 | `gestureState.dy` 누적 경로가 끊기지 않는다 | `PanResponder.js:445-460`(capture가 `_updateGestureStateOnMove`) + `:505-520`(grant 후엔 `onResponderMove`가 갱신). 패널이 responder가 된 뒤엔 A2의 skip 규칙 때문에 capture가 안 돌아 dedup 가드에 걸리지 않는다 | dy는 정상 누적된다 |
| A4 | Android `Modal`이 JS 터치를 삼키지 않는다 | `ReactModalHostView.kt:451-465` — `DialogRootViewGroup.onInterceptTouchEvent`/`onTouchEvent`가 모두 `JSTouchDispatcher.handleTouchEvent`를 부르고, `requestDisallowInterceptTouchEvent`는 **의도적 no-op**(`:493-495`)이라 자식이 lock을 잡아도 인터셉트가 계속 들어온다 | "Modal이라 터치가 JS에 안 온다"는 아니다 |

**즉 핸들·제목(비-Pressable) 영역에서도 Pressable 영역에서도, JS 코드상으로는 동작해야 한다.** 그런데 실기기에선 전부 안 됐다 → 남은 구간은 **"네이티브 터치 → RN responder 협상 성립" 사이**뿐이고, 그 구간은 jest가 볼 수 없고 나도 디바이스 없이 재현할 수 없다.

### 1-2. 확정하지 못한 것 — 리더 질문("핸들 영역에서도 안 됐는지")에 대한 정직한 답

**확정 불가.** 실기기 접근이 없어 두 경우를 갈라 재현하지 못했다. 대신 **원인 후보를 두 개로 좁혔고, 둘 다 이번 변경으로 덮인다.**

- **H1 — 테스트한 빌드가 이전 스프린트 수정을 안 담고 있었을 가능성.** `panHandlers`를 패널 전체로 옮긴 커밋은 `838fd33`(2026-08-12, main 포함 확인). 그 **이전** 코드는 드래그 영역이 핸들존 `10+5+14 = 29px`뿐이라, 증상이 "모든 시트가 어디를 잡아도 안 내려감"과 **정확히 일치한다**(29px 스트립을 정확히 집지 않으면 무반응). QA 빌드가 스토어/preview 바이너리거나 구 OTA 번들이었다면 이 설명이 가장 단순하다. → **사용자 확인 요청(§6 첫 항목).**
- **H2 — Modal 안에서 RN responder 협상이 네이티브 레벨에서 성립하지 않았을 가능성.** §1-1에서 JS 코드는 무결로 확인됐으므로, 남는 건 이 층이다.

### 1-3. 그래서 무엇을 했나

두 가설을 **더 추측으로 가르는 대신, 의존 자체를 끊었다.** RNGH는 네이티브 제스처 인식기를 패널 뷰에 직접 붙이므로 RN responder 협상(H2)을 통째로 우회하고, H1이었다면 어차피 정상 동작한다. jest로 잠글 수 없는 층에 계속 베팅하지 않는 게 이번 재작업의 핵심 판단이다.

---

## 2. 선택한 해법 / 기각한 대안

### 채택 — RNGH `Gesture.Pan()` + `GestureDetector`

- `react-native-gesture-handler@2.20.2`는 **이미 설치·링크·루트 배선**(`App.tsx:81` `GestureHandlerRootView`)돼 있다 → **재빌드 불필요, 신규 의존성 0.**
- `react-native-reanimated`는 미설치 → RNGH가 조용히 JS 콜백 경로로 폴백한다(`handlers/gestures/reanimatedWrapper.js`의 try/catch). `.runOnJS(true)`로 그 전제를 코드에 명시했다.
- **Android + RN Modal 함정 처리**: Modal은 별도 네이티브 윈도우(Dialog)라 앱 루트의 제스처 컨텍스트가 끊긴다 → **Modal 내용물을 `GestureHandlerRootView`로 다시 감쌌다**(`Sheet.tsx`). 안드로이드에선 네이티브 루트 뷰(`RNGestureHandlerRootView`), iOS에선 평범한 `View`로 렌더돼(`GestureHandlerRootView.android.js` vs `.js`) 레이아웃 영향이 없다. 이 구조는 렌더 트리로 관측되지 않아 **소스 문자열 테스트(G2)** 로 고정했다.
- 활성화 조건은 선언적·네이티브: `.activeOffsetY(SHEET_DRAG_ACTIVATE_DY)`(아래로 4px 초과에서만 활성) + `.failOffsetY(-SHEET_DRAG_FAIL_UP_DY)`(위로 8px 먼저 끌면 실패 → 자식에게 양보).

### 기각한 대안

| 대안 | 기각 사유 |
|------|-----------|
| PanResponder 미세조정(캡처 전환·임계 조정) | §1-1에서 JS 배선이 무결로 확인됐다. 고칠 결함이 JS에 없으므로 조정해봐야 같은 층에 계속 베팅하는 것이고, 실패해도 jest는 여전히 green이라 알 방법이 없다. 캡처 전환은 plan §4-B "최대 함정"(리스트 스크롤 사망)도 다시 만든다. |
| RNGH **manual activation**(`manualActivation` + `onTouchesMove`에서 `shouldStartSheetDrag`로 직접 `activate()`) | 계약 유틸을 100% load-bearing으로 만들 수 있어 매력적이었지만, **디바이스에서만 검증 가능한 신규 기계장치를 하나 더 얹는다.** 이번 스프린트의 실패 모드가 정확히 "디바이스에서만 안 되는 것"이라 가장 검증된 선언적 경로(`activeOffsetY`)를 택했다. 대신 `shouldStartSheetDrag`는 **추종 게이트**(세로 우세 판정)로 실사용에 남겼다 — 죽은 코드가 아니다. |
| 드래그 영역을 헤더(핸들+제목)로 축소 | 사용자 불만이 "본문 어디를 잡아도 안 내려간다"인데 정면으로 역행한다. |
| LogPickerSheet를 안 건드리고 넘어가기 | iOS에서 리스트 스크롤이 죽는다(§3-2). 하드 요구사항 위반. |

---

## 3. 구현 상세

### 3-1. `Sheet.tsx` — 제스처 교체 (판정 계약 불변)

```ts
Gesture.Pan()
  .withRef(dragGestureRef)                     // 자식 스크롤이 우선권을 협상할 수 있게 컨텍스트로 내려보냄
  .withTestId(SHEET_DRAG_GESTURE_TEST_ID)      // 테스트에서 실제 이벤트를 흘려보내는 손잡이
  .runOnJS(true)                               // reanimated 미설치 전제 명시
  .activeOffsetY(SHEET_DRAG_ACTIVATE_DY)       // 아래로 4px 초과에서만 활성
  .failOffsetY(-SHEET_DRAG_FAIL_UP_DY)         // 위로 8px 먼저 끌면 실패(자식에게 양보)
  .onBegin(beginDrag)                          // 추종 플래그 리셋
  .onStart(followDrag).onUpdate(followDrag)    // 활성화 이벤트도 이미 이동량이 있어 같은 로직으로 처리
  .onEnd(settleDrag);                          // success=false(강제 종료) → 스냅백
```

- **속도 단위 환산이 이번 교체의 유일한 실질 계약 위험이었다.** `PanResponder.gestureState.vy`는 **px/ms**, RNGH `velocityY`는 **px/s**다. 그대로 넣으면 `SHEET_DISMISS_VELOCITY = 0.5` 임계가 1000배 어긋나 "아주 살짝만 움직여도 닫힘"이 된다. `SHEET_VELOCITY_MS_PER_SECOND = 1000`으로 환산하고 **양방향 테스트(D10)** 로 잠갔다.
- `shouldStartSheetDrag`는 **추종 게이트**로 남았다: 네이티브가 "아래로 4px 초과"를 먼저 거르고, 이 유틸이 "세로 우세(`|dy| > |dx|`)"를 판정해 가로 우세 제스처에서는 패널이 따라오지 않게 한다(D5).
- `shouldDismissSheet` / `resolveBackdropOpacity` / 상수 10종 / `SheetProps` / testID 3종(`sheet-backdrop`·`sheet-panel`·`sheet-handle`) — **전부 불변.**
- 신규 export 4종: `SHEET_DRAG_FAIL_UP_DY`, `SHEET_VELOCITY_MS_PER_SECOND`, `SHEET_DRAG_GESTURE_TEST_ID`, `useSheetScrollGesture`.

### 3-2. 내부 스크롤 우선권 — 소비처 1곳만 최소 변경 (사유 기록)

RNGH는 **관계를 선언하지 않으면 먼저 활성화된 쪽이 이긴다.** 우리 pan은 4px에서 활성화되고 iOS `UIScrollView`의 pan은 그보다 큰 slop에서 시작하므로, 아무것도 안 하면 **iOS에서 LogPickerSheet 리스트 스크롤이 죽는다**(RNGH iOS는 비-RNGH 인식기와의 동시 인식을 기본 거부 — `RNGestureHandler.mm:478-507`). Android는 `ReactScrollView`의 disallow-intercept가 RNGH 핸들러를 취소해(`RNGestureHandlerRootHelper.kt:87-93`) 스크롤이 이기지만, 그 전에 pan이 활성화됐다 취소되는 만큼 튐이 생긴다.

→ **양 플랫폼에서 결정적으로 "스크롤 우선"** 이 되도록 관계를 명시했다.

```tsx
// Sheet.tsx (생산자) — pan 제스처 ref를 body(children 위치)에서 컨텍스트로 제공
export const useSheetScrollGesture = (): NativeGesture => { … blocksExternalGesture(dragGestureRef) … };

// LogPickerSheet.tsx (소비자) — 훅은 반드시 Sheet의 **children 서브트리 안**에서 호출한다
const LogPickerBody = ({ logs, onSelect }) => {
  const scrollGesture = useSheetScrollGesture();
  return <GestureDetector gesture={scrollGesture}><ScrollView bounces={false} …>…</ScrollView></GestureDetector>;
};
export const LogPickerSheet = (…) => (
  <Sheet …><LogPickerBody logs={logs} onSelect={onSelect} /></Sheet>
);
```

> **⚠️ QA L1로 잡힌 실수 (2026-08-19 수정 완료).** 처음엔 훅을 `LogPickerSheet` 본문(= `<Sheet>`를 렌더하는 **부모**)에서 호출했다. 컨텍스트는 렌더 트리 위치로 해석되므로 거기선 항상 null이라 `blocksExternalGesture`가 **한 번도 실행되지 않았다** — §3-2가 하드 요구로 못박은 것이 정작 소비처에서 미성립. 훅 단독 테스트(S1)는 프로브를 children 위치에 두고 있어 이걸 못 잡았다.
> 수정: 본문을 `LogPickerBody`로 분리해 children으로 넘기고 그 안에서 호출. 렌더 결과는 동일하다(`Wrap`이 뷰를 추가하지 않음).
> 재발 방지 2겹: ① `useSheetScrollGesture`가 컨텍스트 밖 호출 시 `__DEV__`에서 `console.warn`(조용한 실패 제거, S2가 경고 발생을 단언) ② **소비처 레벨 테스트**를 `LogPickerSheet.spec.tsx`에 추가 — `Gesture.Native`를 스파이해 `blocksHandlers[0].current.config.testId === SHEET_DRAG_GESTURE_TEST_ID`를 단언한다. 훅을 부모로 되돌리는 뮤테이션(타입 에러 없이 컴파일되는 형태)으로 **이 테스트만 red, 나머지 5개 green** 확인했다.

- `GestureDetector`의 `Wrap`은 자식에 `collapsable: false`만 얹고 **뷰를 추가하지 않는다**(`Wrap.js:18-36`) → 레이아웃·비주얼 영향 0.
- 관계 해석 타이밍은 안전하다: 자식의 attach는 부모보다 먼저 돌지만, RNGH가 관계 전송을 `ghQueueMicrotask`로 미루므로(`attachHandlers.js:51-62`) 그 시점엔 부모의 `withRef`가 이미 채워져 있다.
- **트레이드오프(문서화)**: 리스트 영역에서는 **스크롤만** 동작한다. 스크롤 최상단에서 아래로 당겨 시트를 닫는 건(리더가 "이상적"이라 한 동작) **이번엔 미구현** — 하드 요구("스크롤이 죽지 않아야")를 결정적으로 만족시키는 쪽을 택했다. 시트를 닫으려면 헤더(핸들·제목·여백)를 잡는다(iOS 표준 시트와 같은 멘탈 모델, plan §6 E1과 동일한 결정).
- **나머지 소비처 7곳(AddSheet·DatePickerSheet·DeleteAccountSheet·LeaveLogSheets ×2·MuklogDetailScreen ×2) diff 0줄.** `git diff --stat`으로 확인.

### 3-3. 변경 파일

| 파일 | 변경 |
|------|------|
| `src/components/Sheet/Sheet.tsx` | PanResponder → RNGH 교체, Modal 내부 `GestureHandlerRootView`, `useSheetScrollGesture` 신설, 신규 상수 3종 |
| `src/components/Sheet/Sheet.spec.tsx` | D 시리즈를 RNGH 공식 테스트 유틸 기반으로 재작성, G1~G3·S1~S2 신설 |
| `src/components/index.ts` | `useSheetScrollGesture` 배럴 export 1줄 |
| `src/features/map/components/LogPickerSheet/LogPickerSheet.tsx` | 스크롤 우선권 선언(§3-2). 본문을 `LogPickerBody`(Sheet children)로 분리 — props·렌더 결과 불변 |
| `src/features/map/components/LogPickerSheet/LogPickerSheet.spec.tsx` | 소비처 배선 단언 1케이스 추가(QA L1 재발 방지) |
| `jest.setup.ts` | `react-native-gesture-handler/jestSetup` 로드(네이티브 모듈 목) — 없으면 Sheet를 렌더하는 **모든** spec이 깨진다 |

DB·RLS·Edge Function·마이그레이션·네트워크 호출: **전부 0건**(plan §8 비용 가드레일 유지). 신규 npm 의존성 0, Dev Client 재빌드 불필요.

---

## 4. 생산자 ↔ 소비자 매핑 (qa-logic 교차검증용)

| # | 생산자 | 소비자 | 확인 포인트 |
|---|--------|--------|-------------|
| 1 | `shouldDismissSheet` (`Sheet.tsx`) | `settleDrag`의 `onEnd` | `event.translationY`가 dy로, `event.velocityY / SHEET_VELOCITY_MS_PER_SECOND`가 vy로 전달되는지. **단위 환산 누락이 이번 교체의 1순위 회귀 지점**(D10) |
| 2 | `resolveBackdropOpacity` | 딤 `Animated.interpolate` `outputRange` | 리터럴 재기입이 아니라 유틸 호출인지(G3) |
| 3 | `shouldStartSheetDrag` | `followDrag` | 컴포넌트가 판정식을 중복 보유하지 않고 호출만 하는지(G3). 가로 우세면 패널이 안 따라오는지(D5) |
| 4 | `SHEET_DRAG_ACTIVATE_DY` / `SHEET_DRAG_FAIL_UP_DY` | `Gesture.Pan()` config | `activeOffsetYEnd === 4`, `activeOffsetYStart === undefined`(위로는 활성화 안 함), `failOffsetYStart === -8`(D1) |
| 5 | `Sheet`의 `SheetDragGestureContext` + `useSheetScrollGesture` | `LogPickerSheet`의 `GestureDetector` | **훅이 Sheet의 children 서브트리에서 호출되는지**(= 관계가 실제로 맺어지는지). 훅 단독(S1)이 아니라 **소비처 spec의 `Gesture.Native` 스파이 단언**이 이 경계면의 방어선이다. 컨텍스트 밖 호출은 `__DEV__` 경고(S2) |
| 6 | Modal 내부 `GestureHandlerRootView` | Android 제스처 루트 | 소스에 `<Modal … <GestureHandlerRootView … </Modal>` 구조가 있는지(G2) — 빠지면 Android에서 **조용히** 무동작 |
| 7 | `closingRef` 가드 | `followDrag` · `settleDrag` · 딤 `onPress` | 닫힘 구간에서 세 경로 모두 무력화되는지(D11) |
| 8 | `SheetProps` | 소비처 8곳 | 시그니처 불변, LogPickerSheet 외 diff 0줄, `tsc --noEmit` 0 error |
| 9 | testID 3종 | 기존 Sheet 케이스 + 소비처 spec | 이동·유실 없음. 딤의 `accessibilityRole`·`accessibilityLabel`이 같은 노드에 유지(A1) |
| 10 | 이 스프린트 전체 | `supabase/` | 신규·변경 0건 |

---

## 5. 테스트

- `npm test` — **200 suites / 2064 tests 전부 green**(Sheet 51개 + LogPickerSheet 6개 포함, 회귀 0).
- `npx tsc --noEmit` — **0 error.**

### 재작성한 이유와 살아남은 것

| 구분 | 내용 |
|------|------|
| **그대로 살린 것** | 순수 유틸 3종의 전 케이스(U1·U1-j·U1-b·U2·U3·U3-b) — 판정 계약이 안 바뀌었으므로 **한 줄도 안 고쳤다.** 기존 Sheet 컴포넌트 5케이스(visible 토글·title/children·딤 탭·패널 탭·딤 접근성)도 무수정 통과 |
| **폐기한 것** | D1~D9의 `panel().props.onResponderMove(...)` 직접 호출 — 그 props가 더는 존재하지 않는다(그 props의 존재를 확인하던 D1·D3·D3-b도 함께 목적을 잃었다) |
| **새로 넣은 것** | G1(PanResponder 부재)·G2(Modal 안 제스처 루트)·G3(값 이중화 방지), S1·S2(스크롤 우선권 관계), D1~D13(RNGH 공식 `fireGestureHandler`로 **실제 이벤트 스트림**을 흘려 검증), 특히 **D10(px/s ↔ px/ms 환산 양방향)** |

### 테스트 작성 중 알아낸 함정 (다음 사람 주의)

1. **RNGH `fireGestureHandler`의 pan 기본 페이로드는 `translationX: 100`·`velocityX: 3`** (`jestUtils.js:78-88`)이다. 세로 드래그를 표현하려면 가로 성분을 **매번 0으로 눌러야** 한다 — 안 그러면 `shouldStartSheetDrag`가 "가로 우세"로 판정해 조용히 아무 일도 안 일어난다(처음에 여기 걸려 7개가 red였다). `fireDrag` 헬퍼가 기본값을 덮는다.
2. **`ACTIVE` 이벤트가 하나뿐이면 `onUpdate`가 아니라 `onStart`만 발화한다**(상태 전이 이벤트라서). 그래서 구현도 `.onStart(followDrag).onUpdate(followDrag)`로 둘 다 물렸다 — 실기기에서도 활성화 프레임에 패널이 즉시 붙는 게 맞다.
3. 딤 페이드 구간(240px)은 닫힘 거리(80px)보다 멀어서, 한 render 안에서 두 지점을 관측하려면 각 드래그를 `CANCELLED`로 끝내야 한다(END로 끝내면 첫 드래그에서 시트가 닫혀버린다).
4. **컨텍스트 기반 훅은 프로브 위치가 곧 테스트 대상이다.** S1처럼 프로브를 "이상적인 위치"에 두면 훅의 계약만 증명되고 **소비처가 정말 그 위치에서 부르는지는 증명되지 않는다**(QA L1이 정확히 이 틈으로 통과했다). 컨텍스트를 새로 만들 땐 훅 spec과 **소비처 spec을 둘 다** 둔다.

---

## 6. 디바이스 스모크 체크리스트 (필수 — 자동 테스트로 못 덮는 층이 여기 전부다)

> **jest는 "이벤트가 핸들러에 도달했을 때의 계산"만 검증한다. "네이티브 터치가 그 핸들러까지 오는가"는 이번 버그의 본체이고, 오직 아래 항목으로만 확인된다.**
> ⚠️ **preview/production 빌드로 하지 말 것 — dev build + Metro 로그로 할 것**(네이티브 모듈·제스처 문제는 preview에서 조용히 무동작한다).

| ID | 시나리오 | 통과 기준 | 결과 |
|----|----------|-----------|------|
| **S0** | **(선행) 테스트 빌드가 최신인지 확인** — 앱을 새로 빌드/OTA 갱신한 뒤 시작 | 이전 QA 빌드가 `838fd33` 이전이었는지 여부를 먼저 가른다(§1-2 H1) | ☐ |
| S1 | 아무 시트(로그 카드 ⋯메뉴)의 **핸들/제목**을 잡고 천천히 아래로 | 패널이 손가락을 따라 내려오고 딤이 옅어진다 | ☐ |
| S2 | 같은 시트의 **본문(메뉴 행 = Pressable) 위**를 잡고 아래로 | 행이 실행되지 않고 시트가 따라 내려온다 | ☐ |
| S3 | 조금만(≈30px) 내리고 놓기 | 제자리로 튕겨 복귀, 시트 유지 | ☐ |
| S4 | 100px 이상 내리고 놓기 | 아래로 밀려나며 닫힘 | ☐ |
| S5 | 짧게 아래로 **튕기기**(플릭, 24px 이상) | 닫힘. **너무 민감하면 속도 환산 버그**(§4-1) | ☐ |
| S6 | 아주 살짝(≈10px) 느리게 내렸다 놓기 | **닫히지 않는다**(환산 역방향 회귀 감지) | ☐ |
| S7 | 위로 끌어보기 | 패널이 위로 솟지 않고 제자리 | ☐ |
| S8 | 메뉴 행·날짜 셀을 **짧게 탭** | 기존대로 실행(드래그 오작동 0) | ☐ |
| S9 | `DatePickerSheet` 날짜 그리드 위에서 아래로 드래그 | 시트가 닫힌다(그리드는 스크롤이 아니므로) | ☐ |
| S10 | **`LogPickerSheet` 리스트 위 위아래 스와이프**(지도탭 → 위시 담기, 로그 2개 이상) | **리스트가 스크롤되고 시트는 안 움직인다** ← §3-2 핵심 검증 | ☐ |
| S11 | 같은 시트에서 **핸들/제목**을 잡고 아래로 | 시트가 닫힌다(헤더는 드래그 영역) | ☐ |
| S12 | 같은 시트에서 리스트 행을 **탭** | 해당 로그가 선택된다(Native 제스처가 탭을 먹지 않는다) | ☐ |
| S13 | 닫히는 애니메이션 도중 다시 터치/딤 탭 | 아무 일도 없고 그대로 닫힘(중복 닫힘·깜빡임 0) | ☐ |
| S14 | LeaveLogSheets: 메뉴 시트 → 나가기 → **확인 시트** 전환 | 확인 시트가 제자리에서 뜨고 드래그도 정상 | ☐ |
| S15 | 드래그로 닫은 시트를 **다시 열기** | 정상 위치에서 열림(잔상·오프셋 0) | ☐ |
| S16 | 안드로이드 **뒤로가기 버튼** | 기존대로 닫힘(`onRequestClose`) | ☐ |
| S17 | **회귀** — `RenameDialog`·`AppVersionGate`(강제 업데이트)·`UpdateSuggestModal` | 아무 변화 없음(드래그 dismiss 미적용, 강제 게이트는 여전히 못 닫음) | ☐ |
| S18 | **회귀** — `MuklogEditor`의 별점 가로 드래그(`Stars`, PanResponder 유지) | 기존대로 동작(이번 변경과 무관함 확인) | ☐ |
| S19 | **양 플랫폼** — S1·S2·S10을 **Android와 iOS 각각** | 두 플랫폼 모두 통과(제스처 관계는 플랫폼별 구현이 다르다) | ☐ |

### 실패 시 분기 진단

- **S1은 되는데 S2가 안 됨** → 네이티브 터치 취소 관계 문제. `cancelsTouchesInView`/Pressable 상호작용을 본다.
- **S1도 안 됨(Android만)** → Modal 안 `GestureHandlerRootView`가 실제로 안 먹은 것. RNGH 버전·네이티브 링크를 의심한다.
- **S10에서 스크롤이 죽음** → `blocksExternalGesture` 관계가 attach 타이밍에 안 붙은 것. `LogPickerSheet`의 `GestureDetector`가 `Sheet` 안에 있는지 확인.
- **S5/S6이 반대로 동작** → 속도 단위 환산(`SHEET_VELOCITY_MS_PER_SECOND`) 회귀. D10이 잡아야 하는 지점.

---

## 7. 미완 · 후속 후보

- **스크롤 최상단에서 아래로 당겨 시트 닫기** — §3-2 트레이드오프로 이번엔 안 했다(스크롤 생존을 우선). 하려면 `LogPickerSheet`의 스크롤 오프셋을 추적해 top일 때만 pan을 허용하는 상태 기계가 필요하다(@gorhom/bottom-sheet 방식). 별도 스프린트 후보.
- **진입(slide-up) 애니메이션** — 이전 plan §2와 동일하게 Out-of-scope(`animationType="none"`은 시트→시트 잔상 제거를 위한 의도적 선택).
- **키보드 대응** — `Sheet` 소비처에 `TextInput`이 0개라 여전히 검증 불가. 입력 시트를 추가하는 날 함께 설계.
- `Stars.tsx`는 `PanResponder`(캡처)를 그대로 쓴다. 이번 스프린트 범위 밖이고 실기기에서 동작 중이라 건드리지 않았다 — 다만 시트 드래그가 RNGH로 넘어갔으므로 제스처 수단이 파일마다 갈렸다는 점은 기록해 둔다(S18로 회귀만 감시).

## 8. git

git 작업(커밋·브랜치·PR) 없음 — 사용자 전담. 현재 브랜치 `feat/sheet-drag-rework`.
