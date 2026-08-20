# qa-report-logic — 바텀시트 드래그 dismiss 재작업 (sheet-drag-rework)

> 검증: qa-logic (2026-08-19). 대상 브랜치 `feat/sheet-drag-rework`, 워킹트리 기준(미커밋 5파일).
> 계약 출처: `docs/sprint/sprint-20260819-sheet-drag-rework/dev-notes.md` §4 매핑 10건 + `docs/sprint/sprint-20260812-sheet-drag-dismiss/plan.md`(판정 계약·소비처 8곳 전수표).
> 방법: 생산자·소비자 양쪽 동시 읽기 + **격리 사본(`supabase/functions/.qa-probe/`, 검증 후 삭제)에서 뮤테이션 17종** + 실행 검증(`npm test`, `tsc --noEmit`).

## 판정: ✅ **통과** (라운드 2 — L1 수정 재검증 완료)

| 라운드 | 판정 | 요지 |
|---|---|---|
| R1 (초회) | ❌ 조건부 실패 | 매핑 #5가 실제 소비처에서 미성립(**L1**). 나머지 9건 통과 |
| **R2 (재검증)** | ✅ **통과** | L1 수정 확인 — 실제 소비처에서 관계 성립을 **독립 실측**, L1 재현 뮤테이션이 신규 소비처 테스트를 red로 만드는 것까지 확인. 매핑 10/10 통과 |

**R2 종료 기준**: `npm test` **200 suites / 2064 tests green**, `npx tsc --noEmit` **0 error**(직접 실행). dev 제출 지문 6건 SHA-256 **전부 일치** — 검증 대상과 동결 소스가 동일함을 확인했다.

> 자동 검증 기준으로는 통과다. **디바이스 스모크 S0~S19는 여전히 전부 미검증**이며(§4-6), 이번 스프린트의 본체(네이티브 터치 도달)는 그쪽에서만 확정된다.

---

## 1. L1 (R1 블로커 → R2 해소) — `useSheetScrollGesture`가 실제 소비처에서 관계를 맺지 못했다

### R2 수정 확인 (2026-08-19, dev-sheet-rework 수정분)

| 확인 | 결과 |
|---|---|
| 소비처 배치 교정 (`LogPickerSheet.tsx:44-98`) | ✅ 스크롤 본문이 `LogPickerBody`로 분리돼 `<Sheet>`의 **children으로** 렌더되고, 훅은 그 안(`:51`)에서 호출된다. `LogPickerSheetProps` 불변, 렌더 결과 불변 |
| **독립 실측** (격리 probe, `Gesture.Native` 스파이) | ✅ `{"blocks":"SET","count":1,"target":"sheet-drag"}` — 실제 소비처에서 관계가 이 시트의 드래그 제스처 **1건**과 정확히 맺힌다 (R1: `UNDEFINED`) |
| 조용한 실패 방어 (`Sheet.tsx:131-154`) | ✅ 컨텍스트 밖 호출 시 `__DEV__` `console.warn` + 문구를 `SHEET_SCROLL_GESTURE_OUT_OF_SHEET_WARNING`으로 export. JSDoc(`:140-142`)에 호출 위치 제약 명시. 훅 순서 위반 없음(`useContext`는 무조건 먼저 실행) |
| 소비처 테스트 (`LogPickerSheet.spec.tsx:56-72`) | ✅ 원본 팩토리를 캡처해 감싸는 스파이 형태 — `requireActual` 재진입 없이 실제 `NativeGesture` 인스턴스를 얻는다(제안 스니펫보다 견고) |
| **L1 재현 뮤테이션(독립 수행)** | ✅ 격리 사본에서 훅을 부모로 되돌리고 제스처를 props로 내리는 **타입 안전한** L1 재현 → 신규 소비처 테스트 **red**(`Expected: "sheet-drag"` / `Received: undefined`), 같은 파일 나머지 5건 green, `console.warn` 6회 발화(2차 방어선 작동). 원복 후 6/6 green |

**재발 방지 2겹**(소비처 spec + `__DEV__` 경고)이 서로 다른 층을 막는다 — 전자는 이 소비처, 후자는 **미래의 새 소비처**를 막는다. 적절하다.

> 잔여 관찰(수정 요구 아님): 신규 소비처 테스트는 `blocked?.[0]`만 단언하고 `toHaveLength(1)`은 두지 않아, 블록 대상이 2건 이상으로 늘어나는 변형은 통과한다. S1이 `toHaveLength(1)`을 잡고 있어 실질 공백은 아니다.

### R1 원본 기록 (해소됨)

### 증상 (경계면: 생산자 `Sheet` Context ↔ 소비자 `LogPickerSheet`)

| | 파일:라인 | 내용 |
|---|---|---|
| 생산자 | `src/components/Sheet/Sheet.tsx:127-129` | `SheetDragGestureContext` 생성(기본값 `null`) |
| 생산자 | `src/components/Sheet/Sheet.tsx:316-318` | Provider가 **`Sheet`의 렌더 트리 안쪽**(패널 body, `{children}` 위치)에 있다 |
| 소비자 | `src/features/map/components/LogPickerSheet/LogPickerSheet.tsx:51` | `const scrollGesture = useSheetScrollGesture();` 를 **`LogPickerSheet` 본문에서** 호출 |

`LogPickerSheet`는 `<Sheet>`를 **자기 자식으로 렌더하는 부모**다(`LogPickerSheet.tsx:60`). React Context는 JSX 중첩이 아니라 **렌더 트리 위치**로 해석되므로, `LogPickerSheet` 본문에서의 `useContext`는 Provider보다 **위**에서 실행돼 항상 `null`을 받는다.

→ `Sheet.tsx:141`의 `if (dragGestureRef) scrollGesture.blocksExternalGesture(dragGestureRef);` 가 **한 번도 실행되지 않는다.** `GestureDetector`에는 관계가 0인 맨 `Gesture.Native()`가 물린다.

### 실측 근거 (격리 probe, `Gesture.Native`를 스파이해 생성 객체를 포획)

```
[probe] LogPickerSheet native gestures: 1 [{"blocksHandlers":"UNDEFINED"}]   ← 실제 소비처
[probe] children 위치 native gestures: 1 [{"blocksHandlers":"SET"}]          ← 대조군(S1과 같은 배치)
```

### 영향

dev-notes §3-2가 근거로 든 시나리오가 그대로 남는다 — 시트 pan은 4px에서 활성화되고 iOS `UIScrollView` pan은 더 큰 slop에서 시작하므로, **관계가 없으면 시트 드래그가 먼저 이겨 리스트 스크롤이 죽는다**(RNGH iOS는 비-RNGH 인식기와의 동시 인식을 기본 거부). Android도 스크롤이 되찾기 전 pan이 활성→취소되며 튄다. 디바이스 스모크 **S10이 실패할 것으로 예상**되는 지점이다.

### 왜 테스트가 못 잡았나 (테스트 설계 사각지대)

`src/components/Sheet/Sheet.spec.tsx:236-252` — `ScrollProbe`를 `<Sheet>…<ScrollProbe/>…</Sheet>` 의 **children 위치**에 렌더한다. 이는 훅이 동작하는 위치일 뿐, **유일한 실제 소비처가 서 있는 위치가 아니다.** S1은 훅 자체는 검증하지만 소비처 배선은 검증하지 않는다. `LogPickerSheet.spec.tsx`(5케이스)에는 제스처 관련 단언이 0건이다.

### 수정 방법 (권장)

1. `LogPickerSheet.tsx` — 스크롤 본문을 **`Sheet`의 자식으로 렌더되는 내부 컴포넌트**로 분리해 그 안에서 훅을 호출한다.

```tsx
// LogPickerSheet.tsx — 시트 body(= Provider 안쪽)에서 호출해야 관계가 맺힌다.
const LogPickerBody = ({ logs, onSelect }: { logs: LogPickerItem[]; onSelect: LogPickerSheetProps['onSelect'] }) => {
  const scrollGesture = useSheetScrollGesture();
  // … 기존 <GestureDetector><ScrollView>…</ScrollView></GestureDetector> 그대로
};

// LogPickerSheet 본문
<Sheet visible={visible} onClose={onClose} title={title}>
  <LogPickerBody logs={logs} onSelect={onSelect} />
</Sheet>
```

2. `Sheet.tsx:131-137` 훅 JSDoc에 **호출 위치 제약**을 명시한다 — 현재 문서(`<GestureDetector gesture={useSheetScrollGesture()}>…`)는 "Sheet의 children 서브트리 안에서 호출해야 한다"를 말하지 않아 같은 실수를 다시 부른다. (선택: `__DEV__`에서 context가 `null`이면 `console.warn`으로 조용한 실패를 드러내는 방어를 추가.)

3. **소비처 테스트 추가**(이번 사고의 재발 방지선) — `LogPickerSheet.spec.tsx`에 다음을 넣으면 위 구조가 깨지는 순간 red가 된다. 실제 트리에서 `blocksHandlers`가 이 시트의 드래그 제스처를 가리키는지 단언한다.

```tsx
it('리스트 스크롤이 시트 드래그를 블록한다(스크롤 우선)', () => {
  const created: NativeGesture[] = [];
  const original = Gesture.Native;
  jest.spyOn(Gesture, 'Native').mockImplementation(() => { const g = original(); created.push(g); return g; });
  renderWithTheme(<LogPickerSheet visible onClose={() => {}} logs={[…2건…]} onSelect={() => {}} />);
  const blocked = created[0].config.blocksHandlers as { current?: { config: { testId?: string } } }[];
  expect(blocked).toHaveLength(1);
  expect(blocked[0].current?.config.testId).toBe(SHEET_DRAG_GESTURE_TEST_ID);
});
```

> S1(`Sheet.spec.tsx`)은 훅 단위 검증으로 그대로 유지해도 좋다 — 다만 **소비처 위치 검증을 대신하지 못한다**는 주석을 다는 편이 정확하다.

---

## 2. 매핑 10건 판정

| # | 경계면 | 판정 | 근거 |
|---|--------|------|------|
| 1 | `shouldDismissSheet` ↔ `settleDrag` (속도 단위 환산) | ✅ 통과 | `Sheet.tsx:199-204` — `dy: event.translationY`, `vy: event.velocityY / SHEET_VELOCITY_MS_PER_SECOND`. 환산 **정확히 1회**, 나눗셈 방향 맞음(px/s ÷ 1000 = px/ms). 뮤테이션 3종 전부 D10이 red(§3) |
| 2 | `resolveBackdropOpacity` ↔ 딤 `interpolate.outputRange` | ✅ 통과 | `Sheet.tsx:256-263`이 유틸 호출로 outputRange 산출(리터럴 재기입 아님). 리터럴로 바꾸면 G3 red |
| 3 | `shouldStartSheetDrag` ↔ `followDrag` | ✅ 통과 | `Sheet.tsx:185` 호출만, 판정식 중복 보유 0. 게이트 제거 시 G3·D5 red |
| 4 | `SHEET_DRAG_ACTIVATE_DY`/`FAIL_UP_DY` ↔ `Gesture.Pan()` config | ✅ 통과 | `Sheet.tsx:232-233`. D1이 `activeOffsetYEnd===4`·`activeOffsetYStart===undefined`·`failOffsetYStart===-8`·`runOnJS===true`를 단언, 4종 뮤테이션 모두 red |
| 5 | `SheetDragGestureContext`+`useSheetScrollGesture` ↔ `LogPickerSheet` | ✅ 통과 (R2) | R1 실패(**L1**) → 수정 후 실측 `blocksHandlers = [sheet-drag] (1건)`. S2는 "관계 미성립 + 경고 발화"까지 단언하도록 강화됨 |
| 6 | Modal 내부 `GestureHandlerRootView` | ✅ 통과 | `Sheet.tsx:268-322` 구조 확인. `View`로 치환 시 G2 red. 레이아웃 영향 0(§5) |
| 7 | `closingRef` 가드 3경로 | 🟡 통과(관측 1건) | `followDrag`(`:182`)·`requestClose`(`:250`) 제거 시 D11 red = load-bearing. **`settleDrag`(`:196`)의 `closingRef.current` 절만 뮤테이션 생존** — 다만 닫힘 시작 시 `followingRef`가 이미 `false`이고 후속 드래그는 `followDrag` 가드에 막혀 `followingRef`가 다시 서지 않으므로 **행동상 도달 불가(중복 방어)**. 결함 아님, 제거 권고도 아님(방어 유지 타당) |
| 8 | `SheetProps` ↔ 소비처 8곳 | ✅ 통과 | `SheetProps`(`:149-157`) diff 0줄. 변경 파일 5개 중 소비처는 `LogPickerSheet` 1곳뿐(`git status`) → 나머지 7 사용처(AddSheet·DatePickerSheet·DeleteAccountSheet·LeaveLogSheets×2·MuklogDetailScreen×2) **diff 0줄 확인**. `tsc --noEmit` 0 error |
| 9 | testID 3종 + 딤 접근성 | ✅ 통과 | `sheet-backdrop`(`:273`)·`sheet-panel`(`:283`)·`sheet-handle`(`:298`) 이동·유실 0. `accessibilityRole="button"`·`accessibilityLabel="닫기"`가 딤과 **같은 노드**에 유지 |
| 10 | 스프린트 전체 ↔ `supabase/` | ✅ 통과 | `git status --porcelain supabase/` 빈 결과. `package.json` 미변경 = 신규 의존성 0 |

---

## 3. 뮤테이션 검증 (테스트 유의미성)

격리 사본(`Sheet.tsx`+spec 복제)에 17종 결함을 주입해 red 여부를 확인했다. **src/ 트리는 오염시키지 않았고**, 실험 후 사본 삭제·원복(50/50 green) 검증까지 마쳤다.

### 3-1. 속도 단위 환산 (리더 지정 중점 항목)

| 뮤테이션 | D10 결과 |
|---|---|
| 환산 누락 — `vy: event.velocityY` | ✅ **red** (D10만 실패) |
| 이중 환산 — `/1000 /1000` | ✅ **red** (D10만 실패) |
| 상수 `SHEET_VELOCITY_MS_PER_SECOND = 1` | ✅ **red** (D10 + U3 상수 케이스) |

→ **D10은 양방향(과민·무반응) 모두 load-bearing.** dev 주장 검증 완료.

### 3-2. 나머지 14종

| 뮤테이션 | 결과 |
|---|---|
| `closingRef` 가드 제거 — `followDrag` | red (D11) |
| `closingRef` 가드 제거 — `settleDrag` | 🟡 **생존** (행동상 도달 불가 — §2 #7) |
| `closingRef` 가드 제거 — `requestClose`(딤 탭) | red (D11) |
| `.activeOffsetY(...)` 제거 | red (D1) |
| `.failOffsetY` 부호 반전 | red (D1) |
| `.runOnJS(true)` 제거 | red (D1) |
| `GestureHandlerRootView` → `View` | red (G2) |
| `shouldStartSheetDrag` 게이트 무력화 | red (G3·D5) |
| `Math.max(dy, 0)` 클램프 제거 | red (D4) |
| `if (!finished) return` 제거 | red (D12) |
| `onEnd`의 `!success` 절 제거 | red (D6·D8) |
| 딤 `outputRange` 리터럴 재기입 | red (G3) |
| `.withRef(dragGestureRef)` 제거 | red (S1) |
| `SheetDragGestureContext.Provider` 제거 | red (S1) |

**16/17 killed.** 껍데기 단언 없음. 유일한 생존 뮤테이션도 중복 방어 코드다.

---

## 4. 그 밖의 검증 항목

### 4-1. 판정 계약 불변 (이전 스프린트 대비)

`git diff`로 `Sheet.spec.tsx`의 순수 유틸 블록(U1~U3)을 추출 대조한 결과, **단언은 한 줄도 바뀌지 않았다.** 차이는 2건뿐:
- `describe` 라벨 `드래그 활성화 게이트` → `드래그 추종 게이트` (문구, RNGH가 활성화를 맡게 된 역할 변화 반영 — 정확)
- U3에 **추가**된 신규 상수 케이스(`SHEET_DRAG_FAIL_UP_DY===8`, `SHEET_VELOCITY_MS_PER_SECOND===1000`)

`shouldDismissSheet`·`shouldStartSheetDrag`·`resolveBackdropOpacity` 3종의 **시그니처·본문·상수 10종 값 전부 불변**(`Sheet.tsx:82-111`, `:48-72`). dev 주장 사실.

### 4-2. `jest.setup.ts` 전역 영향

추가분은 `require('react-native-gesture-handler/jestSetup')` 1줄(`jest.setup.ts:18`). 해당 파일의 내용은 **`RNGestureHandlerModule` 3경로를 공식 목으로 대체하는 `jest.mock` 3줄이 전부**다 — 타이머·전역 객체·다른 네이티브 모듈에 손대지 않는다. 실행 결과 **200 suites / 2063 tests green**(회귀 0). 부작용 없음.

### 4-3. 비용 가드레일

- `supabase/` 변경 0건, 마이그레이션·RPC·RLS·Edge Function 변경 0건.
- 네트워크 호출 추가 0건, 이미지 처리 무관, Kakao 키 노출 무관(변경 파일에 키 참조 0).
- `package.json` 미변경 → **신규 npm 의존성 0**(RNGH는 기존 설치본 `~2.20.2`). AWS 리소스 무관.

### 4-4. 코드 컨벤션 (`docs/code-convention.md`)

- 변경 파일 내 `useCallback`/`useMemo` 호출 **0건**, `export function` 컴포넌트/훅 **0건**, `useEffect(() =>` 인라인 **0건**(`useEffect(resetOffsetOnOpen, [visible])` 명명 함수), raw hex **0건**(전부 `theme.*` 토큰 경유), 파일명=심볼명 일치.
- 신규 함수 인자 named-object 준수(`shouldDismissSheet({dy,vy})` 등). 예외는 RNGH 콜백 시그니처(`settleDrag(event, success)`) — 외부 API 콜백이라 컨벤션 예외에 해당.
- **범위 밖 기존 위반 1건**(이번 스프린트 무관·수정 요구 아님): `src/navigation/useRefreshOnFocus/useRefreshOnFocus.ts:26` `React.useCallback` 잔존.

### 4-5. 비주얼 무변경 주장 (qa-visual 생략에 따른 소스 확인)

- `GestureDetector`의 `Wrap`(`node_modules/react-native-gesture-handler/lib/commonjs/handlers/gestures/GestureDetector/Wrap.js:18-36`): `React.Children.only(children)`를 `cloneElement`해 **`collapsable: false`만 추가**한다. 뷰 추가·스타일 주입 없음 → 레이아웃 영향 0. **확인됨.**
- `GestureHandlerRootView`(`.js` = iOS/기본 → `View`, `.android.js` → `RNGestureHandlerRootView`): 둘 다 `style ?? {flex:1}`을 그대로 전달한다. `Sheet.tsx:270`은 `styles.gestureRoot = {flex:1}`을 넘기고, 그 안의 딤은 `absoluteFillObject`·패널랩은 `flex:1`로 이전 Modal 직속 배치와 동일한 채움 결과가 된다 → **레이아웃 영향 0. 확인됨.**
- 패널 스타일·radius·토큰·카피·핸들 치수 diff 0줄.

> 단, `LogPickerSheet`는 L1 수정 시 내부 컴포넌트 분리가 들어간다 — **렌더 결과는 동일**(`GestureDetector`가 뷰를 추가하지 않으므로)하지만, 수정 후 해당 시트의 비주얼 스냅 확인은 남겨둔다.

### 4-6. 미검증 (자동 테스트 경계 밖 — 통과로 처리하지 않음)

이번 스프린트의 **본체(네이티브 터치가 핸들러까지 도달하는가)** 는 jest가 볼 수 없다. dev-notes §6 디바이스 스모크 **S0~S19 전부 미검증**이다. 특히:
- **S10**(LogPickerSheet 리스트 스크롤) — L1로 인해 **현재 코드로는 실패 예상**. 수정 후 필수 재확인.
- S1·S2·S19(양 플랫폼) — RNGH 교체의 성패 자체를 가르는 항목.
- S5/S6 — 속도 환산 실기기 확인(정적으로는 통과).
- ⚠️ dev-notes 경고대로 **dev build + Metro 로그**로 진행할 것(preview/production은 조용히 무동작).

---

## 5. 종료 기준 실행 결과

| 항목 | R1 (초회) | R2 (재검증) |
|---|---|---|
| `npm test` | 200 suites / 2063 tests passed | ✅ **200 suites / 2064 tests passed** (소비처 테스트 +1) |
| `npx tsc --noEmit` | 0 error | ✅ **0 error** |
| Sheet 스위트 단독 | 50/50 passed | ✅ 51/51 passed (S2 강화 포함) |
| 지문 대조 | — | ✅ dev 제출 SHA-256 **6/6 일치** |
| 워킹트리 정리 | ✅ | ✅ 격리 사본·probe 전량 삭제, `git status` = 변경 6파일 + 신규 sprint 디렉터리 |

---

## 6. 재검증 결과 (R2) 및 남은 항목

| # | 항목 | 결과 |
|---|---|---|
| 1 | `LogPickerSheet`의 스크롤 제스처가 `blocksHandlers = [이 시트의 드래그 제스처]`를 갖는가 | ✅ 실측 확인(`count:1`, `target:"sheet-drag"`) |
| 2 | 그 테스트가 수정 전 코드에서 red인가(load-bearing) | ✅ L1 재현 뮤테이션 독립 수행 — red 확인, 원복 검증 완료 |
| 3 | `npm test` green + `tsc --noEmit` 0 error | ✅ 2064 green / 0 error |
| 4 | **디바이스 스모크 S10·S11·S12(+ S0~S19 전체)** | ⛔ **미검증 — 사용자/실기기 몫.** 관계가 코드상 맺어진 것까지가 자동 테스트의 한계이며, 실제 우선순위 협상·네이티브 터치 도달은 dev build + Metro 로그에서만 확정된다 |
