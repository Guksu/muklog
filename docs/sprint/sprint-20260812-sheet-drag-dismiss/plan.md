# Sprint: 바텀시트 드래그 dismiss (sheet-drag-dismiss)

> 작성: planner-sheet-drag (2026-08-12). 단일 출처 = 이 문서.
> 선행 정찰 결과 **기능이 부분적으로 이미 존재한다.** §0을 먼저 읽을 것 — 이번 스프린트의 성격이 "신규 구현"이 아니라 "잡히는 영역 확장 + 판정 계약 정정 + 폴리시"다.
>
> **개정 R3 (2026-08-12)** — U1-j를 무작위 → **결정적 격자 10×10**으로 확정(실패 재현성; 커버리지 동일, dev-sheet-drag 제안 승인). 뮤테이션 표본 확인은 **격리 사본**에서 한다는 규범을 §5-1에 명문화(rating-drag 트리 오염 전례).
>
> **개정 R2 (2026-08-12)** — dev-sheet-drag의 뮤테이션 표본 확인 결과 반영. ① **AC6-a(D3)는 껍데기가 아니다** — 캡처 핸들러 `()=>true` 삽입 시 D3·D3-b만 red, 나머지 42 green(dedup 가드가 아니라 실제 캡처 부재를 측정 중). ② `shouldDismissSheet`의 `dy > 0` 절이 현재 상수 조합에선 **중복(dead)** 임이 확인돼 — **코드는 유지**하되 B1을 행동 불변식 **U1-j**(위로 끈 상태 무작위 100조합 전부 `false`) + 상수 불변식 **U3-b**(`SHEET_FLICK_MIN_DISTANCE > 0`)로 고정하고 §6 **E11**에 무결함으로 명시했다. 판정식·상수값 불변.
>
> **개정 R1 (2026-08-12)** — dev-sheet-drag의 `PanResponder` 실측 보고를 반영해 **AC5·AC6·AC8**을 정정했다(planner가 `PanResponder.js:405-460`으로 재확인, 3건 모두 사실). 요지: ① 캡처 prop은 RN이 항상 만들므로 "prop 부재"로 검증할 수 없다 → **행동(`false` 반환) + 소스 문자열** 2중 검증으로 교체, ② `gestureState`는 내부 객체라 테스트 주입이 불가 → 활성화 게이트를 순수 유틸 `shouldStartSheetDrag`로 승격(유틸 2종 → 3종), ③ 딤 중간값은 부동소수라 strict 비교 불가 → 양 끝만 정확값, 중간은 근사. **판정식·상수값·부착 방침·범위는 전부 불변.** 해당 위치에 *(개정 R1)* 표기.

---

## 0. 정찰 결과 — 현재 상태 (이 스프린트의 출발점)

`git log -S PanResponder`로 확인: 커밋 **`51d4b43` (2026-06-17) "feat: 공용 Sheet 핸들 드래그-to-dismiss (sheet-drag-dismiss)"** 에서 이미 드래그 dismiss가 들어갔다. `src/components/Sheet/Sheet.tsx`에 `PanResponder` + `Animated.translateY` + `shouldDismissSheet` 순수 유틸 + 단위 테스트 4개가 **모두 존재하고 green이다.**

그런데 리더 관측("드래그로 못 내린다")은 사실이다. 원인은 **부착 위치**다:

```tsx
// Sheet.tsx:119-125 — panHandlers가 핸들 영역에만 붙어 있다
<View testID="sheet-handle"
      style={[styles.handleZone, { paddingTop: 10, paddingBottom: 14 }]}
      {...panResponder.panHandlers}>
  <View style={styles.handle} />   {/* 40×5 */}
</View>
```

잡히는 세로 영역이 `10 + 5 + 14 = 29px`뿐이다. 사용자는 시트 본문·제목 어디든 잡고 내리려 하는데 그 영역은 제스처를 전혀 받지 않는다 → **체감상 "드래그가 안 된다".** 즉 이번 스프린트의 본질은 **드래그 영역을 패널 전체로 확장**하되 내부 스크롤·탭과 경합하지 않게 하는 것이다.

### 부수적으로 발견한 판정 계약의 결함 2건 (이번에 같이 고친다)

| # | 현재 | 문제 |
|---|------|------|
| B1 | `shouldDismissSheet = dy > 80 \|\| vy > 0.5` | `dy`가 **음수여도**(위로 끌어 패널이 제자리에 있는 상태) `vy > 0.5`면 닫힌다. 위로 끌었다가 손을 아래로 튕기며 떼면 패널이 0에 있는데 갑자기 닫힌다. |
| B2 | 같은 식 | 거의 움직이지 않은 상태(`dy=2`)에서도 순간 속도만 넘으면 닫힌다. 탭 직후 미세 흔들림이 dismiss로 오인될 수 있다. |

### 현재 시트 소비처 전수 (공용 `Sheet` 사용 8곳)

| 사용처 | 파일 | 본문 성격 | 내부 스크롤 |
|--------|------|-----------|-------------|
| AddSheet | `src/navigation/AddSheet/AddSheet.tsx:80` | 액션 2행(Pressable) | ✗ |
| DatePickerSheet | `src/components/DatePickerSheet/DatePickerSheet.tsx:105` | 월 네비 + 날짜 그리드(Pressable 42개) | ✗ |
| LogPickerSheet | `src/features/map/components/LogPickerSheet/LogPickerSheet.tsx:56` | 로그 행 리스트 | **✅ `ScrollView bounces={false}`** |
| DeleteAccountSheet | `src/features/profile/DeleteAccountSheet/DeleteAccountSheet.tsx:48` | 안내문 + danger 버튼 | ✗ |
| LeaveLogSheets(메뉴) | `src/features/room/LeaveLogSheets/LeaveLogSheets.tsx:69` | 메뉴 2행 | ✗ |
| LeaveLogSheets(확인) | `…LeaveLogSheets.tsx:88` | 안내문 + danger/ghost | ✗ |
| MuklogDetail(메뉴) | `src/navigation/screens/MuklogDetailScreen/MuklogDetailScreen.tsx:450` | 메뉴 2행 | ✗ |
| MuklogDetail(삭제확인) | `…MuklogDetailScreen.tsx:478` | 안내문 + danger/ghost | ✗ |

- **내부 스크롤은 `LogPickerSheet` 단 1곳.** 나머지 7곳은 스크롤 없음(→ 패널 전체 드래그가 안전).
- **`TextInput`을 가진 Sheet 소비처는 0개.** 키보드는 `RenameDialog`(중앙 다이얼로그, `Modal` 직접 사용 — `Sheet` 아님)에만 뜬다 → 이번 변경의 키보드 회귀 위험은 구조적으로 0. (§6 K1 참고)
- 리더 메시지의 `LogNameSheet`는 **이미 폐기됨**(`rename-dialog` 스프린트에서 `RenameDialog`로 통일, architecture.md:225). 남은 잔재는 `src/features/room/logName`(순수 유틸)뿐 — 시트 아님.
- `Sheet.tsx:6` 주석의 "본문(장소검색 등) 스크롤"은 **스테일**이다. 장소검색은 `ui-fidelity-audit`에서 풀스크린 `PlaceSearchView`로 이관됐다(architecture.md:193). 주석 정정 대상(T7).

---

## 1. 기능 한줄 정의

공용 하단 시트를 **패널 어디든 잡고 아래로 끌어 닫을 수 있다** — 손가락을 따라 시트가 내려오고(딤도 함께 옅어짐), 충분히 내렸거나 빠르게 튕기면 닫히고, 모자라면 제자리로 스프링 복귀한다. 시트 안의 스크롤·탭은 그대로 동작한다.

## 2. 범위

**In-scope** (전부 `src/components/Sheet/` 2개 파일 안에서 끝난다)
- `panHandlers` 부착 위치를 핸들 영역 → **패널 전체**로 확장 (T2)
- dismiss 판정 계약 정정 — 위로 끈 상태 방어 + 플릭 최소 이동거리 (T1, B1·B2)
- 드래그 추종 중 **딤 배경 페이드**(0.32 → 0.10) (T3)
- 닫힘 애니메이션 중 **재터치·재진입 가드** + 제스처 강제 종료(terminate) 처리 (T4)
- 재오픈 시 오프셋 리셋(부모가 `onClose`를 무시해도 잔상 0) (T5)
- 인터랙션 파라미터 전부 **명명 상수 + export** (숫자 리터럴 0) (T1)
- 소비처 8곳 **코드 변경 0**으로 회귀 없음 증명 (T6)

**Out-of-scope** (일부러 안 한다)
- **진입(slide-up) 애니메이션.** 킷 `mk-ui.jsx:207`은 `mkSlideUp .26s`를 쓰지만 RN은 `animationType="none"`으로 즉시 표시한다. 이건 `ui-fidelity-audit`에서 "시트→시트 전환 잔상 제거"를 위해 **의도적으로 선택된 것**(`Sheet.tsx:91-92`)이라, 되돌리면 잔상 회귀 위험이 있다. 별도 스프린트 후보.
- **키보드 대응**(킷 `marginBottom: kb ? KB_HEIGHT : 0`). 현재 `TextInput`을 품은 Sheet 소비처가 0개라 검증 불가능한 코드를 추가하게 된다.
- `RenameDialog`·`AppVersionGate`·`UpdateSuggestModal`·`OtaReadyDialog` — **중앙 다이얼로그**이지 바텀시트가 아니다. 특히 `AppVersionGate`(강제 업데이트)는 **닫혀서는 안 되는** 모달이므로 드래그 dismiss를 절대 넣지 않는다.
- 스냅 포인트(half/full detent), 시트 리사이즈, `react-native-gesture-handler`/`reanimated` 도입 (§3-A).
- DB·RLS·Edge Function·마이그레이션 — **변경 0.** 네트워크 호출 0.

---

## 3. 데이터 · API 계약

### 3-A. 제스처 수단 결정 — `PanResponder` + `Animated` 유지 (RNGH 미채택)

`react-native-gesture-handler@~2.20.2`는 이미 의존성에 있다(react-navigation이 끌어옴). 그럼에도 **채택하지 않는다.**

| 근거 | 내용 |
|------|------|
| ① 애니메이션 이점이 없다 | `react-native-reanimated`는 **미설치**다(`package.json` 확인). RNGH만 쓰면 값 갱신은 결국 JS 스레드 `Animated`라 현재와 동일. 손이 큰 변경 대비 이득 0. |
| ② `Modal` 내부 제스처 리스크 | 우리 시트는 RN `Modal` 안에 있다. RNGH 제스처는 `GestureHandlerRootView` 하위에서만 동작하고, RN `Modal`은 별도 뷰 계층이라 **Modal 내용을 다시 감싸야 한다**(Android에서 조용히 무동작하는 알려진 함정). 재빌드 없는 스프린트에서 감당할 리스크가 아니다. |
| ③ 선례 일관성 | 같은 날 끝난 `rating-drag`(`Stars.tsx`)와 기존 `Sheet`가 모두 `PanResponder`다. 제스처 수단을 파일마다 섞으면 다음 사람이 매번 판단해야 한다. |
| ④ 재빌드 회피 | RN 내장 API만 쓰면 신규 네이티브 링크 0 → Dev Client 재빌드 불필요(리더 제약). |

`useNativeDriver`도 **`false` 유지**(현행). 시트는 화면당 1개고 드래그 추종은 `setValue` 기반이라 프레임 여유가 있으며, 테스트에서 native animated 모듈 경고를 만들지 않는다.

### 3-B. 인터랙션 파라미터 (전부 `Sheet.tsx`에서 `export`, 숫자 리터럴 금지)

```ts
/** 드래그로 인식하기 시작하는 최소 아래 방향 이동(px). 탭·가로 제스처 보존. */
export const SHEET_DRAG_ACTIVATE_DY = 4;      // 기존 리터럴 4를 상수화 (Stars.DRAG_ACTIVATE_DX 선례)
/** 이 거리(px)를 넘겨 내리면 속도와 무관하게 닫는다. */
export const SHEET_DISMISS_DISTANCE = 80;     // 기존 값 유지
/** 이 속도(px/ms) 이상으로 아래로 튕기면 닫는다(플릭). */
export const SHEET_DISMISS_VELOCITY = 0.5;    // 기존 값 유지
/** 플릭으로 닫히기 위한 최소 이동(px) — 제자리 미세 흔들림 오인 방지(B2). */
export const SHEET_FLICK_MIN_DISTANCE = 24;   // 신규
/** 닫힐 때 패널을 밀어낼 거리(px)·시간(ms). */
export const SHEET_DISMISS_TRANSLATE = 700;   // 기존 값 유지
export const SHEET_DISMISS_DURATION = 200;    // 기존 180 → 200 (킷 mkSlideUp 260ms 대비 약간 빠르게)
/** 스냅백 스프링 — 오버슈트 없이 단정하게. */
export const SHEET_SNAP_BACK_SPRING = { bounciness: 0, speed: 14 } as const;
/** 딤 페이드 — dy 0→FADE_DISTANCE 구간에서 OPACITY→OPACITY_MIN 선형. */
export const SHEET_BACKDROP_OPACITY = 0.32;      // 킷 rgba(20,12,8,.32) 근사, 기존 값 유지
export const SHEET_BACKDROP_OPACITY_MIN = 0.10;
export const SHEET_BACKDROP_FADE_DISTANCE = 240;
```

닫힘 이징은 `Easing.out(Easing.quad)`(가속 후 감속하며 화면 밖으로). `Easing`은 RN 내장.

### 3-C. 순수 유틸 계약 (단위 테스트 대상 — 이 스프린트의 TDD 축)

> **개정 R1 (2026-08-12, dev-sheet-drag 실측 반영).** 유틸이 2종 → **3종**이다. 활성화 게이트를 컴포넌트 안에 두면 테스트에서 `dy`/`dx`를 주입할 수 없다는 사실이 RN 소스로 확인됐다(§4-B 개정 R1) → 순수 유틸로 승격.

```ts
/**
 * 이 이동을 시트 드래그로 인식할지 결정한다(responder 획득 게이트).
 *   아래로 활성화 임계를 넘고 세로가 우세할 때만 true — 탭·가로 제스처·위로 끌기를 보존한다.
 * @param dy 시작점 대비 세로 이동(px, 아래로 +)
 * @param dx 시작점 대비 가로 이동(px)
 */
export const shouldStartSheetDrag = ({ dy, dx }: { dy: number; dx: number }): boolean =>
  dy > SHEET_DRAG_ACTIVATE_DY && Math.abs(dy) > Math.abs(dx);

/**
 * 드래그 릴리스 시 시트를 닫을지 결정한다.
 *   dy<=0(위로 끌었거나 제자리)이면 절대 닫지 않는다(B1) — 현재 상수 조합에선 두 분기가 이미
 *   dy>80 / dy>24를 요구해 이 절이 **중복(dead)** 이다. 의도 명시 + FLICK_MIN을 0에 가깝게
 *   낮추는 날의 방어선으로 유지한다(개정 R2, §6 E11 — rating-drag N2 선례와 동일한 취급).
 *   충분히 내렸거나(dy>DISTANCE) — 또는 최소 이동을 넘긴 상태에서 아래로 빠르게 튕기면(vy>VELOCITY && dy>FLICK_MIN) 닫는다(B2).
 * @param dy 시작점 대비 세로 이동(px, 아래로 +)
 * @param vy 세로 속도(px/ms, 아래로 +)
 */
export const shouldDismissSheet = ({ dy, vy }: { dy: number; vy: number }): boolean =>
  dy > 0 &&
  (dy > SHEET_DISMISS_DISTANCE || (vy > SHEET_DISMISS_VELOCITY && dy > SHEET_FLICK_MIN_DISTANCE));

/**
 * 드래그 이동량에 대응하는 딤 불투명도(선형, 양 끝 클램프).
 *   Animated.interpolate의 outputRange를 이 함수로 산출해 값의 단일 출처를 유지한다(죽은 코드 아님).
 *   ⚠️ 양 끝(dy<=0, dy>=FADE_DISTANCE)은 반드시 **클램프 early-return으로 상수를 그대로 반환**해야 한다 —
 *      보간식을 태우면 부동소수 오차가 섞여 interpolate의 outputRange가 0.32/0.10 정확값이 아니게 된다(개정 R1).
 */
export const resolveBackdropOpacity = ({ dy }: { dy: number }): number;
```

> ⚠️ **기존 테스트 1개가 의도적으로 깨진다.** `Sheet.spec.tsx:21` "느리게 끌어도 속도 임계 초과(빠른 플릭)면 닫는다"가 `{ dy: 10, vy: 0.6 }` → 현재 `true`, 신 계약에선 `false`(10 < 24). **이 케이스를 `{ dy: 40, vy: 0.6 } → true` 로 갱신하고, `{ dy: 10, vy: 0.6 } → false`(플릭 최소거리 미달)를 신규 케이스로 추가**한다. 계약 변경이지 회귀가 아니다 — dev-notes에 명시할 것.

### 3-D. 컴포넌트 계약

**`SheetProps`는 변경하지 않는다** (`visible` / `onClose` / `title` / `children`). 소비처 8곳은 **diff 0줄**이어야 한다. 이것이 이번 스프린트의 회귀 방어선이다(T6·AC9).

testID 계약(QA·테스트가 잡는 손잡이):

| testID | 노드 | 이번 변경 |
|--------|------|-----------|
| `sheet-backdrop` | 딤 배경 | `Pressable` → **`Animated.View` 안의 `Pressable`**(또는 `Animated.createAnimatedComponent(Pressable)`). testID는 **탭 onClose를 받는 노드에 유지**해야 기존 테스트가 산다. |
| `sheet-panel` | 패널 `Animated.View` | **`panHandlers`가 여기로 이동.** `onResponderMove`/`onResponderRelease`/`onMoveShouldSetResponder…` props가 이 노드에 실린다. |
| `sheet-handle` | 핸들 영역 `View` | **유지**(비주얼). `panHandlers`는 더 이상 붙지 않는다 — 패널 자식이므로 핸들 드래그는 버블링으로 계속 동작. |

### 3-E. 데이터·백엔드

- 테이블/컬럼 변경: **없음.**
- RLS 정책: **없음.**
- Edge Function / RPC / 쿼리: **없음.** 이 스프린트는 네트워크 호출을 1건도 만들지 않는다.
- 마이그레이션 파일 신규: **0개.**
- 신규 npm 의존성: **0개.** Dev Client 재빌드 **불필요.**

---

## 4. 화면 · UX

### 4-A. 상호작용 상태 기계 (패널 1개)

| 상태 | 진입 | 시각 | 이탈 |
|------|------|------|------|
| `idle` | 시트 오픈 | `translateY=0`, 딤 0.32 | 아래로 `SHEET_DRAG_ACTIVATE_DY` 초과 + 세로 우세 → `dragging` |
| `dragging` | 위 | 패널이 손가락 따라 내려옴(위로는 안 올라감, 0 클램프), 딤이 최대 0.10까지 옅어짐 | 릴리스 → 판정 / 강제 종료(terminate) → `snapping` |
| `dismissing` | 릴리스 + `shouldDismissSheet=true` | 200ms 동안 아래로 밀려남 | 완료 → `onClose()` + 오프셋 0 복원. **이 구간 재터치·딤탭 무시** |
| `snapping` | 릴리스 + 판정 false | 스프링으로 0 복귀, 딤 0.32 복귀 | 완료 → `idle` |

### 4-B. 드래그 영역과 경합 (핵심 설계)

`panHandlers`를 패널 전체에 붙이되 **캡처 단계는 쓰지 않는다**(`onMoveShouldSetPanResponder`만, `…Capture` 아님). RN responder 협상이 버블링(깊은 노드 우선)이므로 이 한 줄이 경합을 자동으로 해결한다:

| 터치 시작 위치 | 결과 | 이유 |
|----------------|------|------|
| 핸들·제목·패널 여백 | **시트 드래그** | 위에 responder를 주장하는 자식이 없어 패널이 가져간다 |
| `LogPickerSheet`의 `ScrollView` 내부 | **리스트 스크롤** (시트는 안 내려감) | `ScrollView`가 더 깊은 노드로 먼저 responder를 가져가고, 스크롤 중엔 `onResponderTerminationRequest`로 양보를 거절한다 |
| 메뉴 행·날짜 셀 등 `Pressable` 위 | 움직이지 않으면 **탭**, 아래로 끌면 **시트 드래그** | `Pressability` 기본 `onResponderTerminationRequest: () => true` → 패널이 이어받는다 |

> **`rating-drag`와 반대 선택이라는 점을 의식할 것.** `Stars`는 **캡처**(`onMoveShouldSetPanResponderCapture`)로 부모 `ScrollView`에서 제스처를 **뺏어와야** 했다(가로 드래그가 목적). 시트는 **자식 스크롤에게 양보해야** 하므로 **비캡처**가 맞다. 캡처로 붙이면 `LogPickerSheet` 리스트 스크롤이 죽는다 — **이 스프린트 최대의 함정.**

#### 개정 R1 (2026-08-12) — `PanResponder` API 실측으로 확인한 3가지 (dev-sheet-drag 보고, planner가 `node_modules/react-native/Libraries/Interaction/PanResponder.js`로 재확인)

| 사실 | 근거(라인) | 계획에 미친 영향 |
|------|-----------|------------------|
| `panHandlers.onMoveShouldSetResponderCapture`는 **config와 무관하게 항상 존재**한다. config에 캡처 핸들러가 없으면 래퍼가 `_updateGestureStateOnMove`만 돌리고 **`false`를 반환**한다 | `:446-460` | **AC6을 "prop이 `undefined`"에서 "캡처가 `false`를 반환"으로 정정**(아래). 원래 문구는 달성 불가능 |
| `onMoveShouldSetPanResponder`에 넘어오는 `gestureState`는 **PanResponder 내부 객체**다. 래퍼가 `(event) => config.onMoveShouldSetPanResponder(event, gestureState)`이므로 **테스트에서 2번째 인자로 주입할 수 없다** | `:427-431` | **활성화 게이트를 순수 유틸 `shouldStartSheetDrag`로 승격**(§3-C). 배선 검증은 캡처→비캡처 순서 호출로 |
| 그 `gestureState`를 `dy`/`dx`로 채우는 곳은 **캡처 래퍼**(`_updateGestureStateOnMove`)다. 비캡처 래퍼에는 갱신도 dedup 가드도 없이 위임만 있다 | `:427-431` vs `:446-460` | 테스트에서 `capture(evt)` → `nonCapture(evt)` **같은 이벤트로 연달아** 호출하는 것이 정확하다(2번째 호출이 dedup에 걸리지 않음). 프로덕션 디스패치 순서(캡처 root→target, 버블 target→root)와도 일치 |

추가 안전장치:
- `onPanResponderTerminationRequest: () => false` — 드래그를 획득한 뒤에는 뺏기지 않는다.
- `onPanResponderTerminate` — 그래도 뺏기면(시스템 제스처·전화 수신 등) **스냅백**으로 복구(패널이 내려간 채 굳지 않게).

### 4-C. 퍼블리싱 범위 — **없음 (ui-publisher 불필요)**

킷 `templates/muklog/mk-ui.jsx:196-216` `Sheet` 시안 대조:

| 킷 요소 | 킷 값 | 현재 RN | 판정 |
|---------|-------|---------|------|
| 드래그 핸들바 | `width 40, height 5, borderRadius 999, background var(--line), margin "0 auto 14px"` (`mk-ui.jsx:210`) | `HANDLE_WIDTH 40 / HANDLE_HEIGHT 5 / borderRadius 5 / color.hairline`, `paddingTop 10 + paddingBottom 14` (`Sheet.tsx:18,119-125`) | ✅ **이미 있음.** 킷 `padding "10px 20px 34px"`의 상단 10을 핸들존 paddingTop으로, 하단 여백 14를 paddingBottom으로 번역한 것까지 정합 |
| 딤 | `rgba(20,12,8,.32)` | `color.fg + opacity 0.32` | ✅ 정합. 드래그 중 페이드는 킷에 없는 **RN 확장**(모션 폴리시) — 정지 상태(dy=0) 값이 0.32로 동일하므로 시안 위반 아님 |
| 상단 라운드 | `26px 26px 0 0` | `SHEET_TOP_RADIUS 26` | ✅ |
| 진입 애니메이션 | `mkSlideUp .26s` | 없음(`animationType="none"`, 의도적) | ⚠️ 기존 갭 — **Out-of-scope**(§2), 이 스프린트가 만든 차이가 아님 |

→ **신규/변경 비주얼 자산 0. 토큰 추가 0. 퍼블리싱 작업 없음.** 이번 스프린트는 developer 단독으로 끝난다. `qa-visual`은 "핸들바·딤·라운드가 그대로인지(비주얼 회귀 0)"만 확인하면 된다.

---

## 5. 작업 목록 (각 인수조건 포함)

> 전부 `src/components/Sheet/Sheet.tsx` + `Sheet.spec.tsx` 2개 파일. 그 외 파일 수정은 T7(주석 1줄)뿐.

- [ ] **T1 — 판정 계약 정정 + 파라미터 상수화**
  - 인수조건 **AC1**: `shouldDismissSheet({ dy: -100, vy: 5 })`가 `false`(위로 끈 상태에선 아무리 빨라도 안 닫힘, B1).
  - 인수조건 **AC2**: `shouldDismissSheet({ dy: 10, vy: 0.6 })`가 `false`(플릭 최소거리 24 미달, B2) / `({ dy: 40, vy: 0.6 })`가 `true`.
  - 인수조건 **AC3**: `Sheet.tsx`에 §3-B의 상수 10종이 전부 `export`되어 있고, 파일 안에 대응하는 숫자 리터럴이 중복 등장하지 않는다(스타일 값 포함).
  - 테스트: `shouldDismissSheet` 진리표(§5-1 U1) + 상수 export 존재/값 단언(U3).
  - **개정 R1**: 활성화 게이트도 순수 유틸 `shouldStartSheetDrag`로 이 작업에 포함(§3-C). 인수조건 **AC5**가 이 유틸의 진리표가 된다.

- [ ] **T2 — `panHandlers`를 패널 전체로 이동 (이 스프린트의 본체)**
  - 인수조건 **AC4**: `sheet-panel` 노드가 `onResponderMove`·`onResponderRelease`·`onMoveShouldSetResponder`를 갖고, `sheet-handle` 노드는 갖지 않는다.
  - 인수조건 **AC5** *(개정 R1)*: **순수 유틸** `shouldStartSheetDrag`가 `{dy: 10, dx: 2}`→`true`, `{dy: 2, dx: 0}`→`false`(활성화 임계), `{dy: 10, dx: 40}`→`false`(가로 우세), `{dy: -20, dx: 0}`→`false`(위로). 컴포넌트의 `onMoveShouldSetPanResponder`는 **이 유틸을 호출하기만** 하고 판정식을 중복 보유하지 않는다.
  - 인수조건 **AC6** *(개정 R1 — 원 문구 `onMoveShouldSetResponderCapture === undefined`는 RN API상 달성 불가, §4-B 표 참조)*: 캡처 단계에서 제스처를 뺏지 않는다 —
    - **(a) 행동**: 비캡처 게이트가 `true`를 주는 제스처(예: dy=60)에 대해 `panel.props.onMoveShouldSetResponderCapture(evt)`가 **`false`**, 이어서 `panel.props.onMoveShouldSetResponder(evt)`가 **`true`**.
    - **(b) 소스**: `Sheet.tsx`에 `onMoveShouldSetPanResponderCapture`·`onStartShouldSetPanResponderCapture` 문자열이 **없다**(주석 제거 후 검색).
    - ⚠️ (a)만으로는 부족하다 — 캡처 래퍼에는 `_accountsForMovesUpTo === touchHistory.mostRecentTimeStamp` dedup 가드가 있어 **타임스탬프가 안 늘면 이유와 무관하게 `false`가 나온다**(`PanResponder.js:451-456`). 합성 이벤트가 매번 타임스탬프를 증가시키는지 확인하고, **뮤테이션으로 (a)가 load-bearing인지 표본 확인할 것**: config에 `onMoveShouldSetPanResponderCapture: () => true`를 임시로 넣으면 (a)가 red가 되어야 한다(안 되면 dedup 가드를 측정하고 있는 것). 그래서 (b)를 함께 둔다.
  - 인수조건 **AC7**: `onPanResponderTerminationRequest`가 `false`를 반환하고, `onPanResponderTerminate` 후 오프셋이 0으로 복귀한다.
  - 테스트: D1~D5(§5-1).

- [ ] **T3 — 드래그 추종 딤 페이드**
  - 인수조건 **AC8** *(개정 R1 — 부동소수)*: `resolveBackdropOpacity`가 **양 끝은 정확값**(`{dy: 0}`·`{dy: -50}` → `0.32` strict, `{dy: 240}`·`{dy: 9999}` → `0.10` strict — 클램프 early-return이라 오차가 낄 수 없고, 이 정확성이 `interpolate` `outputRange`의 전제다), **중간값은 근사 비교**(`{dy: 120}` → `toBeCloseTo(0.21, 10)`. 실제 산출은 `0.21000000000000002`). 계약 의미(선형·양끝 클램프)는 불변.
  - 인수조건 **AC9**: 딤 노드의 `opacity`가 상수가 아니라 `translateY` 기반 보간값이고, `interpolate`의 `outputRange`가 `resolveBackdropOpacity`로 산출된다(값 단일 출처).
  - 인수조건 **AC10**: `sheet-backdrop` 탭 시 `onClose` 1회 호출(**기존 테스트 무수정 통과** — 딤을 Animated로 감싸며 testID가 이동하지 않았음을 증명).
  - 테스트: U2 + 기존 `Sheet.spec.tsx` 4케이스 무수정 green.

- [ ] **T4 — 닫힘 중 재진입 가드 + terminate 복구**
  - 인수조건 **AC11**: 닫힘 애니메이션이 도는 동안 `onMoveShouldSetPanResponder`가 항상 `false`(패널 재잡기 무시).
  - 인수조건 **AC12**: 닫힘 애니메이션 중 `sheet-backdrop` 탭이 `onClose`를 **추가로** 호출하지 않는다(총 1회).
  - 인수조건 **AC13**: dismiss 판정 1회당 `onClose`는 정확히 1회(애니메이션 완료 콜백에서만).
  - 테스트: D6·D7.

- [ ] **T5 — 재오픈 오프셋 리셋**
  - 인수조건 **AC14**: `visible` false→true 전환 시 `translateY`가 0으로 리셋된다(부모가 `onClose`를 무시해 시트가 안 닫혔다가 다시 열려도 패널이 화면 밖에 있지 않다).
  - 구현 메모: 명명 `useEffect`(컨벤션) — `const resetOffsetOnOpen = () => { … }; useEffect(resetOffsetOnOpen, [visible]);`
  - 테스트: D8.

- [ ] **T6 — 소비처 회귀 0 증명**
  - 인수조건 **AC15**: `src/navigation/AddSheet/`, `src/components/DatePickerSheet/`, `src/features/map/components/LogPickerSheet/`, `src/features/profile/DeleteAccountSheet/`, `src/features/room/LeaveLogSheets/`, `src/navigation/screens/MuklogDetailScreen/` **6개 소비처의 diff가 0줄**이고, 각자의 기존 spec이 전부 green.
  - 인수조건 **AC16**: `SheetProps` 타입 시그니처 불변(`visible`/`onClose`/`title`/`children`), `npm run typecheck` 0 error.
  - 테스트: 전 스위트 `npm test` green + dev-notes에 diff 0 명시.

- [ ] **T7 — 스테일 주석 정정**
  - 인수조건 **AC17**: `Sheet.tsx` 헤더 주석에서 "본문(장소검색 등) 스크롤" 서술을 현실에 맞게 고친다 — 장소검색은 풀스크린 `PlaceSearchView`로 이관됐고(architecture.md:193), 현재 유일한 내부 스크롤 소비처는 `LogPickerSheet`다. 새 드래그 영역 정책(패널 전체 + 비캡처 = 자식 스크롤 우선)도 주석에 남긴다.
  - `docs/design/architecture.md`는 **변경 없음**(데이터·화면 계약 불변). 변경이 필요해 보이면 planner에게 먼저 물을 것.

- [ ] **T8 — 디바이스 스모크 체크리스트 작성**
  - 인수조건 **AC18**: dev-notes에 §5-2 표를 그대로 옮기고 실행 결과를 채운다(자동 테스트로 못 덮는 네이티브 협상이 여기 유일한 방어선).

---

## 5-1. 테스트 케이스 (TDD)

`docs/testing-strategy.md` 경계 준수 — **순수 유틸 = 단위 필수 / 실제 터치 협상·네이티브 스크롤 경합 = 디바이스 스모크.**

### 합성 responder 이벤트 — 선행 스프린트 노하우를 반드시 재사용할 것

`docs/sprint/sprint-20260812-rating-drag/dev-notes.md` **§4**와 `src/components/Stars/Stars.spec.tsx:228-270`의 `responderEvent` 헬퍼를 그대로 가져다 쓴다. 두 가지가 핵심이다:

1. **`touchHistory`를 실제 형태로 채워야 한다.** `mostRecentTimeStamp`가 이벤트마다 증가해야 `PanResponder`의 early-return 가드(`PanResponder.js:513-519`)를 통과하고, `numberActiveTouches === 1`이면 `TouchHistoryMath`가 `touchBank[indexOfSingleActiveTouch]`를 역참조하므로 빈 배열이면 `TypeError`다.
2. **호출 방식**: `Stars`는 캡처 전용이라 `fireEvent`가 막혀 `props.onResponderMove(...)` 직접 호출이 필요했다. **시트는 비캡처(`onMoveShouldSetResponder`)라 `fireEvent`가 통할 여지가 있지만**, RNTL `isEventEnabled`가 `onMoveShouldSetResponder`의 **반환값**을 보고 건너뛸 수 있다. 안전하게 **`screen.getByTestId('sheet-panel').props.onResponderMove(...)` 직접 호출**을 기본으로 하고, `fireEvent`가 되면 그쪽을 써도 좋다(둘 다 실제 배선을 통과).

### 단위 — 순수 유틸 (필수)

| ID | 케이스 | 입력 | 기대 | AC |
|----|--------|------|------|-----|
| U1-a | 거리 초과 | `{dy: 81, vy: 0}` | `true` | AC2 |
| U1-b | 거리 경계(같음) | `{dy: 80, vy: 0}` | `false` (초과여야 함) | AC2 |
| U1-c | 플릭 성립 | `{dy: 40, vy: 0.6}` | `true` | AC2 |
| U1-d | 플릭 최소거리 미달 | `{dy: 10, vy: 0.6}` | **`false`** (구 계약은 true — 의도적 변경) | AC2 |
| U1-e | 플릭 거리 경계 | `{dy: 24, vy: 0.6}` | `false` (초과여야 함) / `{dy: 25, vy: 0.6}` → `true` | AC2 |
| U1-f | 속도 경계 | `{dy: 40, vy: 0.5}` | `false` / `{dy: 40, vy: 0.51}` → `true` | AC2 |
| U1-g | 위로 + 빠름 | `{dy: -100, vy: 5}` | **`false`** (B1 회귀 고정) | AC1 |
| U1-h | 제자리 | `{dy: 0, vy: 0}` | `false` | AC1 |
| U1-i | 아래로 끌었다 위로 튕김 | `{dy: 100, vy: -2}` | `true` (거리 조건 단독 성립 — 허용 동작, §6 E7) | AC2 |
| **U1-j** | **불변식 — 위로 끈 상태는 무조건 안 닫힘** *(개정 R2, 표현은 R3)*: `dy ∈ [−300, 0]` × `vy ∈ [−5, +5]` **결정적 격자 10×10 = 100조합**(경계 `dy=0`·`vy=+5` 포함). **무작위(`Math.random`) 금지** — 실패가 재현되지 않으면 디버깅이 불가능하고, 격자가 커버리지는 동일하다 | 전부 `false` | **행동 자체를 고정**한다. 어느 절이 그 행동을 만들든(현재는 플릭 최소거리) 무관 — `dy > 0`이 dead여도 이 테스트는 load-bearing | AC1 |
| **U3-b** | **상수 불변식** *(개정 R2)* | `SHEET_FLICK_MIN_DISTANCE > 0` | B1/B2를 실제로 막는 값이 이것임을 명시. 0으로 낮추면 red → 그때 `dy > 0` 절이 살아난다 | AC1·AC3 |
| U2-a~e | 딤 보간 | `dy = 0 / 120 / 240 / 9999 / -50` | `0.32`(strict) / `toBeCloseTo(0.21, 10)` / `0.10`(strict) / `0.10`(strict) / `0.32`(strict) — 개정 R1 | AC8 |
| U3 | 상수 export | — | 10종 존재 + §3-B 값과 일치 | AC3 |
| **U4-a** | 활성화 — 아래 + 세로 우세 | `shouldStartSheetDrag({dy: 10, dx: 2})` | `true` | AC5 |
| **U4-b** | 활성화 임계 미달 | `{dy: 2, dx: 0}` / 경계 `{dy: 4, dx: 0}` | 둘 다 `false`(초과여야 함) | AC5 |
| **U4-c** | 가로 우세 | `{dy: 10, dx: 40}` | `false` | AC5 |
| **U4-d** | 위로 | `{dy: -20, dx: 0}` | `false` | AC5 |

### 컴포넌트 — 배선 (필수)

| ID | 케이스 | 방법 | 기대 | AC |
|----|--------|------|------|-----|
| D1 | 부착 위치 | `sheet-panel`/`sheet-handle` props 검사 | panel에 responder 핸들러 존재, handle엔 없음 | AC4 |
| D2 | 활성화 게이트 **배선** | `capture(evt)`로 gestureState를 채운 뒤 `panel.props.onMoveShouldSetResponder(evt)` (개정 R1 — 2번째 인자 주입 불가) | dy=60 이벤트 → `true`, dy=2 이벤트 → `false`. 판정값 자체는 U4가 담당 | AC5 |
| D3 | **캡처 미사용(행동)** | 같은 evt로 `onMoveShouldSetResponderCapture(evt)` → `onMoveShouldSetResponder(evt)` | `false` → `true`. **뮤테이션 표본 확인 필수**(config에 캡처 핸들러 `()=>true` 삽입 시 red) | AC6-a |
| **D3-b** | **캡처 미사용(소스)** | `Sheet.tsx` 소스에서 주석 제거 후 문자열 검색 | `onMoveShouldSetPanResponderCapture`·`onStartShouldSetPanResponderCapture` 부재 | AC6-b |
| D4 | 추종 클램프 | `onResponderMove`에 `dy=-50` → 패널 transform | `translateY` 0 유지(위로 안 솟음) | AC4 |
| D5 | terminate 복구 | `onResponderTerminationRequest()` / `onResponderTerminate()` | `false` 반환 / 오프셋 0 복귀 | AC7 |
| D6 | dismiss 1회 | 임계 초과 release → `jest.useFakeTimers`로 애니메이션 진행 | `onClose` 정확히 1회 | AC13 |
| D7 | 닫힘 중 재진입 | release 직후(애니 도중) `onMoveShouldSetResponder` 호출 + backdrop press | 각각 `false` / `onClose` 추가 호출 0 | AC11·AC12 |
| D8 | 재오픈 리셋 | `rerender` visible false→true | `translateY` 0 | AC14 |
| **기존 4케이스** | visible 토글·title/children·딤 탭·패널 탭 | `Sheet.spec.tsx:34-76` | **무수정 green** | AC10 |

> `Animated` 완료 콜백은 `jest.useFakeTimers()` + `jest.advanceTimersByTime(SHEET_DISMISS_DURATION + 50)`로 진행시킨다. `Animated.spring`은 완료 단언 대신 "호출됨/오프셋이 0으로 향함"까지만 본다(스프링 물리 시뮬레이션에 과결합 금지).

### 뮤테이션 표본 확인은 **격리 사본**에서 (개정 R3 — 이번 스프린트에서 확립)

"이 테스트가 정말 이 규칙을 방어하는가"를 확인하려고 소스를 일부러 깨뜨릴 때는, **공유 작업 트리가 아니라 임시 디렉터리 사본**(`Sheet.tsx` + `Sheet.spec.tsx` 복사 → 사본만 변형 → 측정 즉시 삭제)에 건다.

- **사유**: `rating-drag`에서 qa-logic의 뮤테이션과 developer의 수정이 같은 트리에서 겹쳐 **측정값이 오염된 전례**가 있다(그 스프린트 dev-notes 말미 "작업 트리 경합 주의"). 또 "QA 재검증 중 소스 미변경" 규칙과도 충돌하지 않는다.
- **확인 의무**: 측정 후 실 소스가 무변경인지 `git diff --stat`으로 확인하고 결과를 dev-notes에 남긴다.
- 이 스프린트에서 실제로 이 방식으로 D3(캡처 미사용)·U1-j(행동 불변식)의 load-bearing 여부를 확인했다.

### 단위 대상 아님 (모킹/스모크로 이관)

- 실제 터치 협상(`ScrollView` ↔ 패널, `Pressable` termination) — **네이티브 동작.** §5-2.
- 드래그 부드러움·프레임 드랍, 멀티터치, 시스템 엣지 제스처와의 충돌.

## 5-2. 디바이스 스모크 체크리스트 (dev-notes로 이관, 사용자 판정)

| ID | 시나리오 | 통과 기준 | 결과 |
|----|----------|-----------|------|
| S1 | 아무 시트(예: 로그 카드 ⋯메뉴)의 **제목/여백을 잡고** 천천히 아래로 | 패널이 손가락을 따라 내려오고 딤이 옅어진다 | ☐ |
| S2 | 조금만(≈30px) 내리고 놓기 | 제자리로 튕겨 복귀, 시트 유지 | ☐ |
| S3 | 100px 이상 내리고 놓기 | 아래로 밀려나며 닫힘 | ☐ |
| S4 | 짧게 아래로 **튕기기**(플릭) | 닫힘(거리 24px 이상 이동 시) | ☐ |
| S5 | 위로 끌어보기 | 패널이 위로 솟지 않고 제자리 | ☐ |
| S6 | **`LogPickerSheet` 리스트 위에서 위아래 스와이프** (지도탭 → 위시 담기, 로그 2개 이상 필요) | **리스트가 스크롤되고 시트는 안 내려간다** ← §4-B 최대 함정 검증 | ☐ |
| S7 | 같은 시트의 **핸들/제목을 잡고** 아래로 | 시트가 내려가 닫힌다(리스트가 아닌 헤더는 드래그 영역) | ☐ |
| S8 | 메뉴 행(편집/삭제)·날짜 셀을 **짧게 탭** | 기존대로 동작(드래그 오작동 없음) | ☐ |
| S9 | 메뉴 행을 잡고 **아래로 끌기** | 행이 실행되지 않고 시트가 닫힌다 | ☐ |
| S10 | 닫히는 애니메이션 도중 다시 터치/딤 탭 | 아무 일도 없고 그대로 닫힘(중복 닫힘·깜빡임 0) | ☐ |
| S11 | LeaveLogSheets: 메뉴 시트 → 나가기 → **확인 시트**로 전환 | 확인 시트가 제자리(translateY 0)에서 뜨고 드래그도 정상 | ☐ |
| S12 | 드래그로 닫은 시트를 **다시 열기** | 정상 위치에서 열림(잔상·오프셋 0) | ☐ |
| S13 | `DatePickerSheet` 날짜 그리드 위에서 아래 드래그 | 시트가 닫힌다(그리드는 스크롤이 아니므로) | ☐ |
| S14 | 안드로이드 **뒤로가기 버튼** | 기존대로 닫힘(`onRequestClose`) | ☐ |
| S15 | **회귀** — `RenameDialog`·강제 업데이트 게이트(`AppVersionGate`) | 아무 변화 없음(드래그 dismiss 미적용, 강제 게이트는 여전히 못 닫음) | ☐ |
| S16 | 두 손가락으로 패널 드래그 | 값 튐·이상 동작 없음(§6 E9 허용 범위 내) | ☐ |

---

## 6. 엣지케이스

| ID | 상황 | 결정 |
|----|------|------|
| **E1** | **내부 스크롤 경합** — `LogPickerSheet` 리스트에서 아래로 스와이프 | **스크롤이 이긴다.** 비캡처 부착이라 더 깊은 `ScrollView`가 responder를 먼저 가져간다. 시트를 내리려면 헤더(핸들/제목/여백)를 잡는다 — iOS 표준 시트와 동일한 멘탈 모델. `bounces={false}`가 이미 있어 top에서 당겨도 시트가 딸려 내려오지 않는다(→ 스크롤 top 감지 로직 불필요). |
| **E2** | 스크롤이 top이 아닌 상태에서 헤더를 잡고 드래그 | 시트가 닫힌다(리스트 위치 무관). 닫히면 컴포넌트가 언마운트되므로 스크롤 위치 보존 이슈 없음. |
| **E3** | `Pressable` 위에서 시작한 드래그 | 4px 넘게 아래로 움직이면 `Pressability`가 termination을 허용해 시트가 이어받는다 → **행이 실행되지 않고** 드래그로 전환(S9). 짧은 탭은 그대로 실행(S8). |
| **E4** | 파괴적 확인 시트(먹로그 삭제·로그 나가기·계정 삭제)를 드래그로 닫음 | **취소와 동일** — `onClose`만 호출하고 파괴적 동작은 전혀 실행되지 않는다(danger 버튼 탭이 유일한 실행 경로). 안전. |
| **E5** | 삭제/나가기 **진행 중**(`deleting`/`leaving=true`)에 드래그로 닫음 | 기존 딤 탭과 **동일하게 닫힌다**(현재도 backdrop 탭으로 닫힘). 진행 중 mutation은 시트 언마운트와 무관하게 완료되고 부모가 결과를 처리한다. 동작 변경 없음 — 새 위험 아님. 단 dev-notes에 "드래그가 새 취소 경로를 만들지 않는다(딤 탭과 동일)"고 명시. |
| **E6** | 닫힘 애니메이션 중 재터치 / 딤 재탭 | `closingRef` 가드로 무시. `onClose`는 애니메이션 완료 콜백에서 **정확히 1회**(AC13). |
| **E7** | 아래로 100px 끌었다가 위로 되돌리는 중 릴리스(`dy=100, vy=-2`) | **닫는다**(거리 조건 단독 성립). 사용자가 "충분히 내렸다"는 사실을 우선. 허용 동작으로 문서화(U1-i로 고정). |
| **E8** | 드래그 중 부모가 `visible=false`로 만듦(외부 닫힘) | 언마운트되고 다음 오픈 때 T5가 오프셋을 0으로 리셋 → 잔상 0. |
| **E9** | 멀티터치(두 손가락) | `PanResponder`는 마지막/평균 터치 기준으로 `dy`를 계산한다. 값이 튀어도 릴리스 시점 판정 1회뿐이라 최악이 "의도치 않게 닫힘/안 닫힘"이고 데이터 영향 0 → **허용**(S16으로 관찰만). `rating-drag`처럼 제스처 신원 게이트까지 넣지 않는다(시트는 연속 값 방출이 없어 stale 기준점 문제가 성립하지 않음). |
| **E10** | 시트→시트 연속 전환(LeaveLogSheets 메뉴→확인) | 서로 다른 `Sheet` 인스턴스라 `translateY`도 별개. 새 시트는 0에서 시작(S11). |
| **K1** | **키보드가 열린 상태** | 현재 `Sheet` 소비처에 `TextInput`이 **0개**라 발생하지 않는다(텍스트 입력은 `RenameDialog` = 중앙 다이얼로그, `Sheet` 미사용). 향후 입력 시트를 추가하면 (a) 드래그 시작 시 `Keyboard.dismiss()`, (b) 킷의 `marginBottom: KB_HEIGHT` 번역을 함께 설계해야 한다 — **이번 Out-of-scope**, 계약만 기록. |
| **A1** | **접근성** — 스크린리더 사용자는 드래그 불가 | `sheet-backdrop`의 `accessibilityRole="button"` + `accessibilityLabel="닫기"`가 **그대로 유지**되어야 한다(유일한 비제스처 닫기 경로). 딤을 `Animated`로 감싸며 이 props가 유실되지 않는지 AC10이 지킨다. |
| **E11** | **`shouldDismissSheet`의 `dy > 0` 절이 현재 상수 조합에선 중복(dead)** — 두 분기가 이미 `dy>80` / `dy>24`를 요구하므로 제거해도 전 케이스 green이다(dev-sheet-drag 실측, 개정 R2) | **코드 유지.** 의도를 문장으로 남기고, `SHEET_FLICK_MIN_DISTANCE`를 0 근처로 낮추는 날 load-bearing이 되는 방어선이다. 대신 **행동 불변식(U1-j)과 상수 불변식(U3-b)으로 B1을 고정**해 "테스트 없는 죽은 코드"가 되지 않게 한다. `rating-drag` N2(도달 불가 fallback을 무결함으로 판정하고 코드 유지)와 같은 취급 — **qa-logic은 이 항목을 결함으로 분류하지 않는다.** |
| **N1** | 네트워크 실패·동시성(커플 2명)·RLS·인증 | **해당 없음.** 이 스프린트는 순수 클라이언트 인터랙션이며 네트워크·DB·세션을 1건도 건드리지 않는다. |

---

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

`qa-logic`은 아래 쌍을 **양쪽 파일을 같이 열고** 확인한다.

| # | 생산자 | 소비자 | 확인 포인트 |
|---|--------|--------|-------------|
| 1 | `shouldDismissSheet` (§3-C) | `onPanResponderRelease` | `gesture.dy`/`gesture.vy`가 그대로 전달되는지, 판정 true 경로에서만 `onClose`가 1회 호출되는지 |
| 2 | `resolveBackdropOpacity` | 딤 `Animated` `interpolate` | `outputRange` 양 끝이 **유틸 호출로 산출**되는지(리터럴 재기입 = 값 이중화 결함) |
| 3 | 패널 `panHandlers` | `LogPickerSheet`의 `ScrollView` | **캡처 단계에서 안 뺏는지**(AC6) — 캡처를 쓰면 리스트 스크롤이 죽는다. **prop 존재 여부로 판정하지 말 것**(RN이 항상 만든다, §4-B 개정 R1): ① `Sheet.tsx` 소스에 `…PanResponderCapture` 문자열 부재, ② D3이 dedup 가드가 아니라 실제 캡처 부재를 측정하는지 뮤테이션으로 표본 확인 |
| 3-b | `shouldStartSheetDrag` (§3-C) | `onMoveShouldSetPanResponder` | 컴포넌트가 유틸을 **호출만** 하는지(판정식 중복 보유 = 값 이중화 결함). `gestureState.dy/dx`가 그대로 전달되는지 |
| 4 | 패널 `panHandlers` | 자식 `Pressable`(메뉴 행·날짜 셀·danger 버튼) | 4px 임계 미만은 탭 유지, 초과는 드래그 전환 — 기존 소비처 spec 전부 green인지 |
| 5 | `SheetProps` (§3-D) | 소비처 8곳 | **diff 0줄**(`git diff --stat`으로 6개 디렉터리에 변경 없음), `npm run typecheck` 0 error |
| 6 | testID `sheet-backdrop`/`sheet-panel`/`sheet-handle` | 기존 `Sheet.spec.tsx` 4케이스 + 소비처 spec | testID가 이동/유실되지 않았는지. 특히 딤을 Animated로 감쌀 때 `accessibilityRole`·`accessibilityLabel`·`onPress`가 **같은 노드**에 남아야 함(A1) |
| 7 | `closingRef` 가드 | `onMoveShouldSetPanResponder` · 딤 `onPress`/`disabled` | 닫힘 구간에서 두 경로 모두 무력화되는지(D7) |
| 8 | 킷 `mk-ui.jsx:196-216` | `Sheet.tsx` 렌더 | **`qa-visual` 담당** — 핸들바(40×5·hairline)·딤 0.32·상단 라운드 26·패딩이 **변경 전과 픽셀 동일**한지(비주얼 회귀 0). 드래그 중 딤 페이드는 킷에 없는 허용된 RN 모션 확장 |
| 9 | `Sheet.tsx` 헤더 주석 | `architecture.md:193`(PlaceSearchView 풀스크린 이관) | 스테일 서술이 정정됐는지(AC17) |
| 10 | 이 스프린트 전체 | `supabase/migrations/`·`supabase/functions/` | **신규/변경 0건**(리더 제약). `git status`로 확인 |

---

## 8. 비용 가드레일 체크

| 항목 | 이번 스프린트 |
|------|---------------|
| Kakao Local API 호출 | **0건** — 지도·검색을 건드리지 않음 |
| Supabase 요청(쿼리/RPC/Storage/Realtime) | **0건** — 순수 클라이언트 인터랙션 |
| 이미지 업로드·압축 | 해당 없음 |
| viewport 기반 조회 | 해당 없음 |
| AWS 리소스 | **미사용**(불변) |
| 신규 npm 의존성 | **0개** — RN 내장 `PanResponder`/`Animated`/`Easing`만. **Dev Client 재빌드 불필요** |
| 마이그레이션·Edge Function | **0건** |

> 이 기능은 런타임 비용을 만들지 않는다. 유일한 비용은 드래그 중 JS 스레드 애니메이션 프레임인데, 시트는 화면당 1개이고 기존에도 같은 방식(`useNativeDriver: false`)이라 **증가분 없음**.

---

## 9. 완료 기준 (Definition of Done)

1. AC1~AC18 전부 충족.
2. `npm test` 전 스위트 green(기존 1873+ 케이스 회귀 0), `npm run typecheck` 0 error.
3. `Sheet.spec.tsx`의 **기존 4개 컴포넌트 케이스는 무수정 통과**. 순수 유틸 케이스 중 §3-C의 계약 변경분 1개만 갱신하고 그 사유를 dev-notes에 기록.
4. 소비처 8곳 diff 0줄, `supabase/` diff 0줄.
5. dev-notes에 §5-2 스모크 표 이관 + 계약 변경(플릭 최소거리 신설) 명시.
6. git 작업은 하지 않는다(사용자 전담).
