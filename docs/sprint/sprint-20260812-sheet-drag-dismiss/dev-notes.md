# Dev Notes — 바텀시트 드래그 dismiss (sheet-drag-dismiss)

> 작성: dev-sheet-drag. 단일 출처 = `plan.md`. 구현 범위는 `Sheet` 컴포넌트 1개 + 그 spec.

## 1. 변경 파일 (2개 — 이게 전부다)

| 파일 | 변경 | 내용 |
|------|------|------|
| `src/components/Sheet/Sheet.tsx` | +137 / −39 | 인터랙션 상수 10종 export, 순수 유틸 3종, `panHandlers` 패널 전체 이동(비캡처), 딤 페이드 보간, 닫힘 가드(`closingRef`), **중단된 닫힘 가드(`finished`, F1)**, terminate 복구, 재오픈 리셋, 헤더 주석 정정(T7) |
| `src/components/Sheet/Sheet.spec.tsx` | +428 / −13 | U1(U1-j 포함)·U1-b·U2·U3(U3-b 포함) + D1~D9 + O1·O2 구조 단언 추가 (**기존 4개 컴포넌트 케이스는 무수정**, 순수 유틸 케이스만 신 계약으로 갱신 — §3) |

**변경하지 않은 것 (AC15·AC16)**

`git diff --stat`이 위 2개 파일만 보고한다. 즉 소비처 8곳(6개 디렉터리) **diff 0줄**:
`src/navigation/AddSheet/` · `src/components/DatePickerSheet/` · `src/features/map/components/LogPickerSheet/` ·
`src/features/profile/DeleteAccountSheet/` · `src/features/room/LeaveLogSheets/` · `src/navigation/screens/MuklogDetailScreen/`.
`SheetProps`(`visible`/`onClose`/`title`/`children`) 시그니처 불변.

- `supabase/migrations/` 신규 0개, `supabase/functions/` 변경 0줄. DB·RLS·Edge Function·네트워크 호출 **전부 0**.
- `docs/design/architecture.md` 변경 0줄(데이터·화면 계약 불변 — plan §5 T7 지시).
- 신규 npm 의존성 0 (RN 내장 `PanResponder`/`Animated`/`Easing`). **Dev Client 재빌드 불필요.**
- **비주얼 값 불변** — 핸들바 40×5 hairline, 정지 상태 딤 0.32, 상단 라운드 26, 패딩(`spacing[10]`/`[14]`/`[16]`/`[20]`), `theme.shadow.lg`, `maxHeight 88%` 전부 그대로. `useNativeDriver: false` 유지, RNGH 미채택(plan §3-A).

## 2. 공개 계약 (`src/components/Sheet/Sheet.tsx` export)

```ts
export const SHEET_DRAG_ACTIVATE_DY = 4;
export const SHEET_DISMISS_DISTANCE = 80;
export const SHEET_DISMISS_VELOCITY = 0.5;
export const SHEET_FLICK_MIN_DISTANCE = 24;      // 신규
export const SHEET_DISMISS_TRANSLATE = 700;
export const SHEET_DISMISS_DURATION = 200;       // 기존 180 → 200
export const SHEET_SNAP_BACK_SPRING = { bounciness: 0, speed: 14 } as const;
export const SHEET_BACKDROP_OPACITY = 0.32;
export const SHEET_BACKDROP_OPACITY_MIN = 0.1;
export const SHEET_BACKDROP_FADE_DISTANCE = 240;

export const shouldDismissSheet = ({ dy, vy }: { dy: number; vy: number }) => boolean;
export const shouldStartSheetDrag = ({ dy, dx }: { dy: number; dx: number }) => boolean;  // 신규(§4-2)
export const resolveBackdropOpacity = ({ dy }: { dy: number }) => number;
```

파일 안에 이 값들의 리터럴 중복은 0(스타일 값 포함, AC3). `SHEET_TOP_RADIUS`/`HANDLE_WIDTH`/`HANDLE_HEIGHT`/
`PANEL_MAX_HEIGHT_RATIO`는 기존 비주얼 상수 그대로.

**`resolveBackdropOpacity` 보장(테스트 고정)** — 양 끝은 정확값(`0.32` / `0.1`, early-return 클램프)이고 그 사이는 선형, dy에 대해 단조 비증가. 이 정확값이 `interpolate`의 `outputRange`로 그대로 들어간다.

## 3. 계약 변경 — 기존 테스트 1개를 의도적으로 갱신했다 (plan §3-C)

| 항목 | 구 계약 | 신 계약 |
|------|---------|---------|
| 판정식 | `dy > 80 \|\| vy > 0.5` | `dy > 0 && (dy > 80 \|\| (vy > 0.5 && dy > 24))` |
| `{ dy: 10, vy: 0.6 }` | `true` | **`false`** (플릭 최소거리 24 미달) |

`Sheet.spec.tsx`의 "느리게 끌어도 속도 임계 초과(빠른 플릭)면 닫는다"(`{dy:10, vy:0.6}` → true)가 신 계약에서 `false`가 된다. plan §3-C 지시대로 **`{dy:40, vy:0.6}` → true로 갱신하고 `{dy:10, vy:0.6}` → false를 신규 케이스로 추가**했다(U1-c·U1-d). **회귀가 아니라 계약 변경**이다 — 탭 직후 미세 흔들림이 dismiss로 오인되던 B2를 막는 것이 목적.

**⚠️ 발견: `dy > 0` 절은 현재 판정에 영향을 주지 않는다(죽은 조건).**
소스에서 `dy > 0 &&`를 **제거하고 전 스위트를 돌려도 전부 green**이다(직접 뮤테이션으로 확인, §5. 측정 당시 44케이스, U1-j·U3-b를 더한 46케이스에서도 동일 — U1-j는 절이 아니라 행동을 고정하므로 이 절의 유무에 반응하지 않는다). 두 분기가 이미 `dy > 80` 또는 `dy > 24`를 요구하므로 `dy > 0`이 결과를 바꾸는 입력이 존재하지 않는다. 즉 **B1(위로 끈 상태에서 빠른 플릭이 닫아버림)을 실제로 막는 것은 `dy > 0`이 아니라 플릭 최소거리(B2의 수정)** 다. AC1(`{dy:-100, vy:5}` → false)은 그래도 충족된다.
**결정(planner, plan 개정 R2)**: **`dy > 0`은 현재 dead지만 코드는 유지**하고, B1을 절(clause)이 아니라 **행동으로 고정**한다. `SHEET_FLICK_MIN_DISTANCE`를 0으로 낮추는 날 곧바로 load-bearing이 되는 방어선이기 때문이다. 이를 위해 테스트 2개를 추가했다.

- **U1-j** — `dy ∈ [−300, 0]` × `vy ∈ [−5, +5]` 조합 100개가 전부 `false`. 어느 절이 그 행동을 만들든 무관하게 "위로 끈 상태는 절대 안 닫힌다"를 고정한다(rating-drag U6의 불변식 패턴). **load-bearing 확인**: 구 계약(`dy > 80 || vy > 0.5`)으로 되돌리면 U1-j가 red다(격리 사본 뮤테이션, §6-b와 같은 방식).
- **U3-b** — `SHEET_FLICK_MIN_DISTANCE > 0`. B1을 실제로 막는 값이 이것임을 테스트에 적어두고, 누군가 0으로 낮추면 red로 "이제 `dy > 0`이 유일한 방어선"임을 알린다.

**두 뮤테이션 결과를 나란히 둔다(E11 재논의 방지용).** 아래 조합이 "절은 dead지만 행동은 고정됨"의 증거다.

| 뮤테이션 | 결과 | 의미 |
|----------|------|------|
| `dy > 0 &&` 절만 제거 | **green**(46 전부) | 이 절은 현재 dead — 두 분기의 거리 조건에 가려 결과를 못 바꾼다 |
| 판정식을 구 계약 `dy > 80 \|\| vy > 0.5`로 되돌리기 | **U1-j 포함 5개 red** | B1 행동은 고정돼 있다 — 절이 아니라 플릭 최소거리가 만드는 행동을 U1-j가 잡는다 |

plan **§6 E11**에 무결함(rating-drag N2와 동일 취급)으로 명문화됐다 — qa-logic은 이 절을 "테스트 없는 죽은 코드" 결함으로 분류하지 않는다.

> **U1-j는 `Math.random`을 쓰지 않는다(plan 개정 R3).** `dy` 10구간 × `vy` 10구간의 **결정적 격자 100조합**이다. 무작위였다면 실패가 재현되지 않아 디버깅이 어려운 반면, 격자도 경계(`dy=0`·`vy=+5`)를 포함해 커버리지는 동일하다. plan §5-1에 규범으로 반영됐다(rating-drag U6의 무작위 방식을 고친 것).

## 4. plan 인수조건 대비 — RN API와 맞지 않아 정정한 3건

planner(`planner-sheet-drag`)에게 실측 근거와 함께 통보 완료. 계약의 **의미**는 그대로 두고 검증 방법만 바꿨다.

1. **AC6 — `sheet-panel.props.onMoveShouldSetResponderCapture`가 `undefined`: 달성 불가.**
   `node_modules/react-native/Libraries/Interaction/PanResponder.js:446-460`에서 `panHandlers`는 config와 무관하게 캡처 래퍼를 **항상** 만든다(내부 `_updateGestureStateOnMove` 때문). 실측에서도 `typeof === 'function'`.
   → **D3(행동)**: 비캡처 게이트가 `true`를 주는 제스처(dy=60)에서 `onMoveShouldSetResponderCapture(evt) === false` && `onMoveShouldSetResponder(evt) === true` — LogPickerSheet가 필요로 하는 보장 그 자체.
   → **D3-b(소스)**: 주석 제거 후 `onMoveShouldSetPanResponderCapture`/`onStartShouldSetPanResponderCapture` 문자열 부재 단언(plan §7-3의 "문자열 Capture 검색"을 테스트로 고정).
2. **AC5/D2 — `onMoveShouldSetResponder(evt, {dy,dx})`의 2번째 인자는 무시된다.** 래퍼는 `(event) => config.onMoveShouldSetPanResponder(event, gestureState)`이고 gestureState는 PanResponder 내부 상태(캡처 래퍼가 `touchHistory`로 갱신).
   → 활성화 게이트를 순수 유틸 **`shouldStartSheetDrag`로 분리·export**해 4조합을 단위로 고정하고(U1-b), 배선은 "캡처 호출로 gestureState 갱신 → 비캡처 게이트 호출"의 실제 경로로 검증(D2).
3. **AC8 — `resolveBackdropOpacity({dy:120}) === 0.21`: 부동소수라 strict 비교 실패**(`0.21000000000000002`). 양 끝은 클램프 early-return으로 **정확값 보장**(`interpolate` outputRange 정확도가 여기 달림), 중간값만 `toBeCloseTo(0.21, 10)`.

## 5. 생산자 ↔ 소비자 매핑 (qa-logic 교차검증용 — plan §7)

| # | 생산자 | 소비자 | 실제 배선 | 확인 |
|---|--------|--------|-----------|------|
| 1 | `shouldDismissSheet` | `onPanResponderRelease` | `shouldDismissSheet({ dy: gesture.dy, vy: gesture.vy })` — 가공 없이 그대로 전달. true 경로에서만 `Animated.timing(...).start(cb)`, `onClose`는 **완료 콜백에서만** 1회 | D6·D6-b·D5-b |
| 2 | `resolveBackdropOpacity` | 딤 `translateY.interpolate` | `outputRange: [resolveBackdropOpacity({dy:0}), resolveBackdropOpacity({dy: SHEET_BACKDROP_FADE_DISTANCE})]`, `extrapolate:'clamp'` — **리터럴 재기입 0** | D4-b(패널 이동 → 딤 실측값) |
| 3 | 패널 `panHandlers`(비캡처) | `LogPickerSheet`의 `ScrollView bounces={false}` | 캡처 config 키 부재 → 더 깊은 `ScrollView`가 responder 선점 | D3·D3-b + **스모크 S6(유일한 실증 경로)** |
| 4 | 패널 `panHandlers` | 자식 `Pressable`(메뉴 행·날짜 셀·danger 버튼) | 게이트 `dy > 4 && \|dy\|>\|dx\|`. `Pressability` 기본 `onResponderTerminationRequest: () => true`로 양보 | D2 + 소비처 spec 전부 green. 실제 협상은 S8·S9 |
| 5 | `SheetProps` | 소비처 8곳 | 시그니처 불변, 6개 디렉터리 diff 0줄 | `git diff --stat` 2파일 + `npm run typecheck` 0 error |
| 6 | testID `sheet-backdrop`/`sheet-panel`/`sheet-handle` | 기존 spec 4케이스 + 소비처 spec | 딤은 `Animated.createAnimatedComponent(Pressable)`로 **같은 노드**에 testID·`accessibilityRole="button"`·`accessibilityLabel="닫기"`·`onPress` 유지(A1) | 기존 4케이스 무수정 green + 접근성 단언 신설 |
| 7 | `closingRef` 가드 | `onMoveShouldSetPanResponder` · 딤 `onPress` · `Modal.onRequestClose` | 세 경로 모두 `closingRef.current`면 no-op. 릴리스 핸들러 자체도 재진입 시 early-return | D7 |
| 7-b | `Animated.timing` 완료 콜백의 `finished` | `onCloseRef.current()` | **중단된 닫힘은 `onClose`를 내보내지 않는다**(F1). 중단 경로인 `resetOffsetOnOpen`이 `closingRef=false` → `setValue(0)` 순서라 콜백 early-return이 상태를 굳히지 않는다 | D9 |
| 8 | `Sheet.tsx` 헤더 주석 | `architecture.md:193`(PlaceSearchView 풀스크린 이관) | "본문(장소검색 등) 스크롤" 스테일 서술 삭제, 현재 유일한 내부 스크롤 소비처(LogPickerSheet)와 **비캡처 = 자식 우선** 정책으로 교체 | AC17 |
| 9 | 이 스프린트 전체 | `supabase/` | `git status` 신규/변경 0건 | 확인 |

**딤 탭 vs 드래그 — 새 취소 경로가 아니다(E5).** 드래그 dismiss는 `onClose`만 호출하며, 파괴적 동작(삭제·나가기)은 danger 버튼 탭이 유일한 실행 경로다. 삭제 진행 중 드래그로 닫아도 **기존 딤 탭과 완전히 동일**하게 동작한다(동작 변경 0).

**`Modal.onRequestClose`도 `closingRef` 가드를 태웠다**(plan 미명시 — 안드로이드 뒤로가기가 닫힘 애니메이션 중 `onClose`를 중복 호출하지 않게. 평상시 동작은 기존과 동일, S14로 확인).

## 6. 테스트 결과

```
npm test          → 195 suites / 1913 tests, 전부 green (직전 1873 → +40)
npm run typecheck → 0 error
Sheet.spec.tsx    → 48 tests (기존 8 → 48)
```

신규: U1 진리표 11행 + U1-j 불변식(dy<=0 × vy 100조합) + 상수 유래 4단언 · U1-b 게이트 6행 · U2 딤 보간 5(단조성 불변식 포함) · U3 상수 10종 + U3-b 불변식 · 접근성 1 · D1~D9(+D3-b·D4-b·D5-b·D6-b) · O1·O2 구조 단언.

### 뮤테이션 검증 (테스트가 규칙을 실제로 격리하는지)

소스를 일부러 깨뜨려 확인했다. **전부 원복 후 재실행 green**(shasum 일치 확인).

| 뮤테이션 | 결과 |
|----------|------|
| 플릭 최소거리 조건 제거(B2) | U1-d·U1-e·상수단언 red ✅ |
| 게이트를 **캡처 단계로** 이동(최대 함정) | D2·D3·D3-b red ✅ |
| **비캡처는 두고 `onMoveShouldSetPanResponderCapture: () => true`만 추가** | **D3·D3-b만 red, 나머지 42 green ✅**(§6-b) |
| **판정식을 구 계약(`dy > 80 \|\| vy > 0.5`)으로 되돌리기** | **U1-j 포함 5개 red ✅** — U1-j가 load-bearing임을 증명(§3 R2) |
| `finished` 가드 제거(F1 이전 상태) | **D9만 red ✅** — 중단된 닫힘의 `onClose` 유출이 회귀로 고정됨 |
| 딤 `outputRange`를 리터럴 `[0.32, 0.1]`로 + 게이트에 판정식 인라인(O1·O2) | **O1·O2 단언만 red ✅** — 값·판정 이중화가 회귀로 고정됨 |
| `resetOffsetOnOpen`의 `closingRef.current = false` 제거 | **D9 확장분만 red ✅**(qa 재검증 MB) — 중단 경로에서 해제를 빠뜨리면 재오픈된 시트가 **영구 드래그 불가**가 되는데, 리더 보강분이 정확히 그 상태를 잡는다 |
| 닫힘 중 재진입 가드 제거 | D7만 red ✅ |
| 재오픈 오프셋 리셋 제거 | D8만 red ✅ |
| 0 클램프 제거(위로 솟음) | D4만 red ✅ |
| `onPanResponderTerminationRequest` → `true` | D5만 red ✅ |
| **`dy > 0` 가드 제거(B1)** | **44 전부 green ❌ — 죽은 조건(§3 참고)** |

### 6-b. D3가 dedup 가드를 측정하고 있지 않은지 표본 확인 (planner 요청, plan R1)

**우려**: 캡처 래퍼에는 `_accountsForMovesUpTo === touchHistory.mostRecentTimeStamp` dedup 가드(`PanResponder.js:451-456`)가 있어, 합성 이벤트의 타임스탬프가 안 늘면 **캡처를 쓰든 안 쓰든** `false`가 나온다 → D3가 "캡처 미사용"이 아니라 dedup 가드를 측정하는 껍데기 단언일 수 있다.

**확인 방법**: 비캡처 게이트는 그대로 둔 채 config에 `onMoveShouldSetPanResponderCapture: () => true`만 **추가**하고 스위트를 돌렸다.

**결과 — D3는 껍데기가 아니다.**

```
✕ D3 — 캡처 단계로는 절대 가져가지 않는다(자식 ScrollView 우선)
✕ D3-b — 소스에 캡처 계열 config 키가 없다
Tests: 2 failed, 42 passed, 44 total
```

캡처 래퍼가 dedup 가드를 통과해 **config까지 실제로 도달**함이 증명됐다(`moveEvent` 헬퍼가 호출마다 `touchTimeStamp += dt`로 타임스탬프를 올리고, `beforeEach`에서 0으로 리셋해 첫 이벤트도 `_accountsForMovesUpTo(0) ≠ mostRecentTimeStamp(1)`). 나머지 42개가 green인 것으로 이 뮤테이션이 D3·D3-b에만 격리됨도 확인된다.

> **실행 위생 (plan §5-1 규범 — 이 스프린트에서 명문화됨)**: 이 뮤테이션은 `src/components/Sheet/Sheet.tsx`가 아니라 **격리 사본**(임시 디렉터리에 `Sheet.tsx`+`Sheet.spec.tsx` 복사 후 사본만 변형, 측정 즉시 삭제)에 걸었다. 공유 작업 트리의 실 소스를 잠시라도 깨뜨리면 동시에 도는 qa의 뮤테이션 실험·전 스위트 실행과 경합하기 때문이다(rating-drag에서 실제로 발생했던 문제). 실 소스는 `PanResponderCapture` 문자열 0건으로 무변경 확인.

### 단위 대상 아님 (계획대로 스모크 이관)

실제 터치 협상(`ScrollView`↔패널, `Pressable` termination), 드래그 부드러움·프레임, 멀티터치, 시스템 엣지 제스처.

## 7. 이월 — 디바이스 스모크 체크리스트 (사용자 판정 필요)

자동 테스트가 덮지 못하는 **네이티브 responder 협상**이 여기 걸려 있다. 특히 **S6가 이번 스프린트 최대 리스크**(비캡처 부착이 리스트 스크롤을 살리는지)다.

| ID | 시나리오 | 통과 기준 | 결과 |
|----|----------|-----------|------|
| S1 | 아무 시트(예: 로그 카드 ⋯메뉴)의 **제목/여백을 잡고** 천천히 아래로 | 패널이 손가락을 따라 내려오고 딤이 옅어진다 | ☐ |
| S2 | 조금만(≈30px) 내리고 놓기 | 제자리로 튕겨 복귀, 시트 유지 | ☐ |
| S3 | 100px 이상 내리고 놓기 | 아래로 밀려나며 닫힘 | ☐ |
| S4 | 짧게 아래로 **튕기기**(플릭) | 닫힘(24px 이상 이동 시) | ☐ |
| S5 | 위로 끌어보기 | 패널이 위로 솟지 않고 제자리 | ☐ |
| S6 | **`LogPickerSheet` 리스트 위에서 위아래 스와이프**(지도탭 → 위시 담기, 로그 2개 이상) | **리스트가 스크롤되고 시트는 안 내려간다** ← 최대 함정 | ☐ |
| S7 | 같은 시트의 **핸들/제목을 잡고** 아래로 | 시트가 내려가 닫힌다 | ☐ |
| S8 | 메뉴 행(편집/삭제)·날짜 셀을 **짧게 탭** | 기존대로 동작(드래그 오작동 없음) | ☐ |
| S9 | 메뉴 행을 잡고 **아래로 끌기** | 행이 실행되지 않고 시트가 닫힌다 | ☐ |
| S10 | 닫히는 애니메이션 도중 다시 터치/딤 탭 | 아무 일도 없고 그대로 닫힘(중복 닫힘·깜빡임 0) ← **F1 수정 구간** | ☐ |
| S11 | LeaveLogSheets: 메뉴 시트 → 나가기 → **확인 시트** 전환 | 확인 시트가 제자리에서 뜨고 드래그도 정상 | ☐ |
| S12 | 드래그로 닫은 시트를 **다시 열기** | 정상 위치에서 열림(잔상·오프셋 0). 닫히는 **도중** 다시 열리는 경우도 즉시 닫히지 않아야 한다 ← **F1 수정 구간** | ☐ |
| S13 | `DatePickerSheet` 날짜 그리드 위에서 아래 드래그 | 시트가 닫힌다(그리드는 스크롤이 아님) | ☐ |
| S14 | 안드로이드 **뒤로가기 버튼** | 기존대로 닫힘(`onRequestClose`) | ☐ |
| S15 | **회귀** — `RenameDialog`·`AppVersionGate` | 아무 변화 없음(드래그 dismiss 미적용, 강제 게이트는 여전히 못 닫음) | ☐ |
| S16 | 두 손가락으로 패널 드래그 | 값 튐·이상 동작 없음(허용 범위) | ☐ |

## 8. 알려진 제약 (의도된 것)

- **진입(slide-up) 애니메이션 없음** — `animationType="none"`은 시트→시트 전환 잔상 제거를 위해 `ui-fidelity-audit`에서 선택된 것. plan Out-of-scope(별도 스프린트 후보).
- **키보드 대응 없음** — 현재 `Sheet` 소비처에 `TextInput` 0개(텍스트 입력은 중앙 `RenameDialog`). 향후 입력 시트를 추가하면 드래그 시작 시 `Keyboard.dismiss()` + 킷 `marginBottom: KB_HEIGHT` 번역을 함께 설계해야 한다.
- **내부 스크롤 영역에서는 시트를 못 내린다**(E1, 의도) — iOS 표준 시트와 같은 멘탈 모델. 헤더를 잡으면 내려간다(S7).
- **스크린리더 사용자는 드래그 불가** — 딤 탭(`accessibilityRole="button"` + "닫기")이 유일한 비제스처 경로이고 그대로 보존했다.
- **멀티터치 신원 게이트 없음**(E9, `rating-drag`와 다른 선택) — 시트는 연속 값 방출이 없어 stale 기준점 문제가 성립하지 않는다. 최악이 "의도치 않게 닫힘/안 닫힘"이고 데이터 영향 0.
- `useNativeDriver: false` 유지 — 드래그 추종이 `setValue` 기반이라 native driver로 못 넘긴다(RNGH/reanimated 미도입, plan §3-A).

## 9. qa-logic 지적 반영 (F1)

`qa-report-logic.md` 판정: **AC1~AC17 전부 통과**, 뮤테이션 15종 격리 확인. 수정 권고 1건(F1, 저~중·차단 아님)을 반영했다.

**재검증 결과: 로직 통과 — 코드 측 검증 종결**(qa-logic-sheet-drag, 3축 전부 통과).
1. **F1 해소** — D9 green(닫힘 50ms 시점 재오픈 → `onClose` 0회, 애니 소진 후에도 0회, `translateY` 0).
2. **해피패스 무손상** — `finished` 가드가 정상 닫힘까지 막지 않는지 확인(jest fake-timer 환경에서도 완료 콜백이 `finished: true`로 전달). D6·D6-b green.
3. **D9 load-bearing** — 격리 사본에서 가드만 제거하면 D9가 `Expected 0 / Received 1`로 red, 같은 사본의 해피패스는 green. 가드만 정확히 격리된다.
4. **확장판 D9 판별력(2라운드)** — 리더 보강분(`closingRef` 해제 확인 + 재닫힘 1회)이 장식이 아님을 확인. `resetOffsetOnOpen`의 해제를 제거하면 **확장 단언만** red(`grantedToPanel` `Received: false`) — 해제 누락 시 재오픈된 시트가 영구 드래그 불가가 되는 상태를 잡는다.
5. **O1·O2 판별력** — qa가 소스 텍스트 변형을 메모리상 적용해 정규식 반응만 측정: outputRange 리터럴 복귀·게이트 인라인·게이트 호출부만 삭제(정의부 잔존) 3종 모두 해당 단언 FAIL. 정의부 `= ({`에 오탐하지 않음도 확인.

**남은 차단 사유는 AC18(디바이스 스모크) 하나뿐이다** — §7 S1~S16 전부 미기입. 사용자 실기기 판정 전에는 스프린트를 "완료"로 표시할 수 없다. 우선순위: **S6**(리스트 스크롤 vs 시트 드래그) > **S10·S12**(닫힘 중 재터치 / 재오픈 잔상 — F1 수정 구간과 인접해 이번 수정의 실기기 검증을 겸한다).

| # | 지적 | 반영 |
|---|------|------|
| F1 | `Animated.timing(...).start(cb)`가 `finished`를 안 봐서, **중단된 닫힘도 `onClose`를 내보낸다**. RN은 애니메이션 중단 시에도 콜백을 `{finished:false}`로 부른다(`AnimatedValue.setValue()` → `_animation.stop()` → `TimingAnimation.stop()`). 닫힘 200ms 중 부모가 재오픈하면 `resetOffsetOnOpen`의 `setValue(0)`이 진행 중 timing을 끊어 **방금 연 시트가 즉시 닫으라는 통보를 받는다** | 콜백에 `if (!finished) return;` 1줄 추가(`Sheet.tsx:150-157`). **D9를 먼저 Red로 재현한 뒤 적용**했고(재오픈 직후 `onClose` 1회 → 0회), 격리 사본에서 가드를 제거하면 **D9만 red**임을 확인 |

**리더 지시로 보강한 2건** (team-lead 메시지, F1 지시와 함께 도착)

| 항목 | 반영 |
|------|------|
| "이후 정상 닫힘 → 1회"까지 회귀로 고정 + **중단 경로의 `closingRef` 해제 타이밍 점검** | D9를 확장했다 — 재오픈 후 `askToStartDrag`가 `true`(=`closingRef` 해제 확인)이고, 다시 드래그로 닫으면 `onClose`가 **정확히 1회**(중단분은 안 세고 이번 닫힘만). 중단 경로에서 해제가 일관됨을 행동으로 증명 |
| O1·O2(값 단일출처 리팩터 회귀 미탐지) — "여력이 되면 상수 참조 단언 정도만" | **구조 단언 1케이스 추가**. 딤 `outputRange`가 `resolveBackdropOpacity(`를 참조하고 게이트가 `shouldStartSheetDrag(`를 호출하는지 소스에서 확인(D3-b와 동일 방식, 주석 제거 후 검사). 격리 사본에서 리터럴·인라인으로 되돌리면 **이 단언만 red**임을 확인했다 |

> **왜 동작 테스트가 아니라 구조 단언인가.** O1·O2는 "같은 값을 두 번 쓰지 않는다"는 규약이라 **오늘의 값이 같은 한 동작으로는 관측되지 않는다**(리터럴 `0.32`와 `SHEET_BACKDROP_OPACITY`는 지금 같은 값이다). 어긋남은 상수를 바꾸는 미래의 리팩터에서만 드러나므로, 그 시점을 red로 알리려면 참조 자체를 고정하는 수밖에 없다. 캡처 미사용(D3-b)에서 이미 승인된 방식과 같다.

**결함 아님 판정에 동의한 항목**
- **`dy > 0` (E11)** — qa가 독립 검증으로 "테스트 미도달이 아니라 논리적 항진"임을 확인했고, U1-j(구 계약 복귀 시 red)·U3-b(`FLICK_MIN=0`에서 red)도 직접 재현했다. plan §6 E11 유지.
- **관찰 2건(딤 `outputRange` 리터럴 복귀·게이트 판정식 인라인이 둘 다 green)** — 둘은 "값 단일출처"라는 **구조 규약**(plan §7-2·§7-3b)이지 동작이 아니라, 같은 값을 두 번 쓰는 것을 테스트로 잡으려면 리팩터를 막는 과결합이 된다. 현 코드는 양쪽 모두 규약을 지키고 있어 조치 없음(기록만 유지).

> **프로세스 메모**: qa의 1라운드 F1 probe는 실 소스에 직접 가해져 Stop 훅이 중간 상태를 2회 오탐했고, 2라운드 사본은 `src/` 안에 `SheetIso.spec.tsx`로 만들어져 **jest 기본 `testMatch`에 수집**되는 문제가 있었다(스위트 195→196, 의도적 red가 전체 red로 보임 + 사용자가 커밋하면 딸려 들어감). qa가 즉시 교정해 `<rootDir>/.qa-probe/` + `mutation.probe.tsx`(spec|test 패턴 미매치)로 옮기고 측정 후 디렉터리째 삭제했다. → **격리 사본 규범의 확정형: `src/` 밖 + testMatch 미매치 파일명 + 측정 직후 `rm -rf`.** 다음 스프린트부터 dev·qa 공통 적용.
