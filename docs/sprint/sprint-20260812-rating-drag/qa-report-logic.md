# QA Report — Logic (rating-drag)

> 작성: qa-logic-rating-drag. 기준: `plan.md` · `dev-notes.md` · `.claude/skills/integration-qa` · `docs/testing-strategy.md` · `docs/code-convention.md`.
> **비주얼 충실도는 본 리포트 범위 밖**(qa-visual 담당 — `qa-report-visual.md`).

## 0. 판정 요약

> **2라운드(재검증) 반영본.** 1라운드에서 L1~L4를 지적 → `dev-rating-drag` 수정 → 재검증 완료.
> 아래 표와 §3은 **재검증 후 최종 상태**다. 1라운드 원문 지적은 §3에 이력으로 보존하고 각 항목에 재검증 결과를 덧붙였다.

| 구분 | 결과 |
|------|------|
| 인수조건 AC1~AC11 | **전부 통과** (대응 테스트 존재 + load-bearing 확인) |
| 경계면 8쌍 (plan §7) | **전부 통과** — 생산자/소비자 양쪽 동시 읽기 완료 |
| `npm test` | **green** — 195 suites / **1873 tests** (재검증 시 직접 실행) |
| `npm run typecheck` | **green** — 0 error |
| 가드레일(DB·의존성·비용·컨벤션) | **전부 통과** |
| 이슈 L1~L5 · N1~N2 | **전부 종결** — 뮤테이션으로 독립 재현 확인(§11), 커밋 blob까지 검사(§11-3) |
| 잔여 | **코드 이슈 0.** 프로세스 권고 N3(워크트리 경합)와 디바이스 스모크 사용자 판정만 남음 |

**종료 판정: 로직 통과 (최종).** 계획된 인수조건을 모두 충족하고, 1라운드에서 지적한 테스트 공백(L1)·런타임 엣지케이스(L2)가
모두 코드+회귀 테스트로 닫혔으며, 재검증에서 나온 문서 이슈(N1·N2)까지 종결됐다. **qa-logic이 요청할 코드 변경은 남아 있지 않다.**

**남은 게이트는 디바이스 스모크뿐이며 사용자 판정 대기다.** 우선순위:
1. **S1** — 드래그가 실기기에서 실제로 활성화되는가. 신원 게이트(L2 수정)의 유일한 실패 모드가
   "조용히 활성화 안 됨"이고 **자동 테스트로 잡히지 않는다**(사유 §11-2 N2). 실패 시 전환 대안은 dev-notes에 준비돼 있다.
2. **S3**(세로 스크롤 양보) · **S6**(별 사이 틈에서 시작) — 이번에 고친 L1·L2 두 지점의 실기기 확인.
3. **S9**(두 손가락 → 드래그 미시작) — N1로 확인된 동작의 실기기 확인.

---

## 1. 실행 검증 (직접 실행)

```
npm test          → Test Suites: 195 passed / 195,  Tests: 1869 passed / 1869
npm run typecheck → tsc --noEmit, exit 0
Stars.spec.tsx    → 59 tests (기존 12 + 신규 47)
```

dev-notes §4의 수치(195/1869/59)와 **일치**. 아래 §4의 mutation 실험을 위해 소스를 임시 변형했고,
**전부 원복 후 재실행해 동일하게 green**임을 확인했다(`git diff --stat`: Stars.tsx 138 / Stars.spec.tsx 289 — dev-notes §1과 일치).

---

## 2. 경계면 교차검증 (plan §7 — 생산자/소비자 양쪽 동시 읽기)

| # | 생산자 | 소비자 | 확인 내용 | 판정 |
|---|--------|--------|-----------|------|
| 1 | `resolveRatingAtX` (`Stars.tsx:50-58`) | `onPanResponderMove` (`Stars.tsx:119-128`) | 전달 x = `dragStartXRef.current + dx`, dx = `evt.nativeEvent.pageX − dragStartPageRef.current.x`. size는 `sizeRef.current`(`Stars.tsx:101-102`, 매 렌더 갱신)로 최신 props 사용. `gestureState` 미사용 확인 | ✅ |
| 2 | 탭 영역 분할 (`editOverlay` absoluteFill + `editHalf` flex:1, `Stars.tsx:223-238` / 별1 단일 Pressable `Stars.tsx:206-218`) | `resolveStarOriginX` (`Stars.tsx:67-76`) | **지오메트리 상수 lockstep 확인** — `styles.row.gap = STAR_GAP`(`Stars.tsx:248`), `styles.starEditable.padding = STAR_CELL_PADDING`(`Stars.tsx:249`)가 유틸이 쓰는 `resolveCellWidth`/`resolvePitch`(`Stars.tsx:39-41`)와 **같은 상수를 참조**. 리터럴 `2` 중복 0. 테스트가 렌더된 스타일 실값까지 대조(`spec:123-133`) | ✅ |
| 3 | `Stars.onChange` | `MuklogEditor.setRating` → `rating.toFixed(1)` (`MuklogEditor.tsx:564-567`) | **소비처 diff 0줄**(git status에 미포함). `setRating`은 순수 상태 setter. 유틸 반환 집합 = {1,1.5,…,5} 9개(0.5는 이진 정확값 → 부동소수 오차 없음). NaN·0·5.5 유입 경로 없음 | ✅ |
| 4 | `Stars.onChange` | `validate.ts:60-68` (1~5 + `rating*2 === trunc(rating*2)`) → DB 트리거 `RATING_OUT_OF_RANGE` (`20260720120000_rating_half_step.sql`) | 드래그 값 집합이 **탭이 이미 방출하던 9개와 완전 동일** → 검증기가 새로 통과시켜야 할 값 0. U6이 "0.5 배수 + 1≤v≤5"를 임의 x 100개로 고정 | ✅ |
| 5 | row `panHandlers` (`Stars.tsx:189`) | `MuklogEditor`의 세로 `ScrollView` (`MuklogEditor.tsx:437-444`) | 캡처 게이트·termination 거부 배선 자체는 plan §3-4와 일치. **단 축 우세 항의 자동 검증이 없음 → L1** | ⚠️ |
| 6 | 신규 `testID="stars-row"` (`Stars.tsx:187`) | 기존 `getAllByTestId(/^star-/)` (`spec:24`, `spec:69`) | `"stars-row"`는 `^star-`와 불일치(`stars` 뒤가 `-`가 아님). editable/비editable 모두 정확히 5개 — AC8(`spec:375-378`) 통과 | ✅ |
| 7 | `editable` 분기 (`Stars.tsx:189` `{...(editable ? panResponder.panHandlers : {})}`) | 표시 전용 3곳 — `MuklogCard.tsx:124`(size 14) · `MuklogDetailScreen.tsx:387` · `SelectedSpotCard.tsx:75`(size 13) | 세 곳 모두 `editable` 미전달 → `panHandlers` 미스프레드. D5(`spec:330-337`)가 `onResponderMove`·`onMoveShouldSetResponderCapture` 둘 다 `undefined`임을 단언. 카드 탭 회귀 0 | ✅ |
| 8 | `architecture.md:85` | `20260720120000_rating_half_step.sql` | 문서 `rating numeric(2,1) -- 1~5, 0.5 단위 half-star (옵션). 트리거 RATING_OUT_OF_RANGE로 2차 검증` ↔ 마이그레이션 `alter column rating type numeric(2,1)` + `enforce_muklog_fields`의 `RATING_OUT_OF_RANGE` 조건 **일치**. SQL 변경 0 | ✅ |

---

## 3. 발견 이슈

### L1 (중) — 캡처 게이트의 **축 우세 판정 `|dx| > |dy|` 이 테스트로 전혀 덮이지 않는다**

- **위치**: `src/components/Stars/Stars.tsx:117` / 테스트 `src/components/Stars/Stars.spec.tsx:339-347` (D6)
- **근거(mutation 실험)**: `Stars.tsx:117`을
  `return Math.abs(dx) > DRAG_ACTIVATE_DX && Math.abs(dx) > Math.abs(dy);` →
  `return Math.abs(dx) > DRAG_ACTIVATE_DX;` 로 **축 항을 완전히 삭제해도 Stars.spec 59개 전부 green**,
  전체 스위트도 green이었다.
- **원인**: D6의 케이스가 `pageX 100→102`(dx=2), `pageY 0→40`(dy=40)이라 **`|dx| > DRAG_ACTIVATE_DX`(4) 에서 이미 탈락**한다.
  즉 D6은 "세로 우세라서 양보"를 검증하는 게 아니라 "4px 임계 미달이라 양보"를 검증한다. 축 규칙은 격리되지 않는다.
- **왜 중요한가**: plan §3-4.2·§6(제스처 충돌)이 세로 스크롤 양보의 근거로 삼는 규칙이고, 실기기 S3의 실제 시나리오는
  "세로로 쓸었는데 손가락이 가로로 4px 이상 흐른다"(사람 손가락에서 매우 흔함)이다. 그 구간이 자동 방어선 0이다.
- **수정 방법**: D6를 임계는 넘되 세로가 우세한 값으로 바꾸거나(권장: 케이스 추가로 둘 다 유지),
  ```ts
  // Stars.spec.tsx — D6 옆에 추가
  it('D6-b: 임계를 넘어도 세로가 우세하면 responder를 탈취하지 않는다', () => {
    renderEditable();
    pressInStarOne({ pageX: 100, locationX: 5 });
    const row = screen.getByTestId('stars-row');
    // dx=20(임계 초과) 이지만 dy=60으로 세로 우세 → 스크롤에 양보해야 한다.
    expect(
      row.props.onMoveShouldSetResponderCapture(responderEvent({ pageX: 120, pageY: 60 })),
    ).toBe(false);
  });
  ```
  이 케이스를 넣으면 위 mutation이 red가 된다(축 항 삭제 시 `true` 반환).
- **담당**: `dev-rating-drag`

### L2 (중) — **press-in 없이 시작한 제스처가 stale 기준점으로 값을 방출한다**

- **위치**: `src/components/Stars/Stars.tsx:106-107`(refs) · `:114-118`(캡처 게이트) · `:143-155`(`recordDragStart`)
- **문제**: `dragStartXRef`/`dragStartPageRef`는 `onPressIn`에서만 기록되고 **어디서도 무효화되지 않는다**.
  그런데 row 내부에는 `Pressable`이 덮지 않는 영역이 있다 — 별 사이 `gap` 2px × 4곳(행 폭 188px 중 8px).
  이 영역에서 시작한 터치는 어떤 `Pressable`의 `onPressIn`도 받지 못하지만, **row 자신이 터치 타깃이므로
  `onMoveShouldSetResponderCapture`는 그대로 호출된다.** 그 결과 직전 제스처(또는 초기값 `{0,0}`)의 기준점으로
  dx가 계산돼 손가락 위치와 무관한 별점이 방출된다.
- **재현(임시 probe로 실측, 검증 후 파일 삭제함)**:
  - P1 — press-in이 한 번도 없는 상태에서 `onMoveShouldSetResponderCapture({pageX:200, pageY:150})` → **`true`**(게이트 열림),
    이어서 `onResponderMove({pageX:200})` → **`onChange(5)`**. (별점 행이 화면 상단쪽에 있어 `|dx| > |dy|`가 성립하는 배치에서 발생)
  - P2 — 별5를 탭(press-in→release)한 뒤 gap에서 새 제스처를 시작 → `onResponderMove({pageX:470})` → **`onChange(4)`**.
    직전 press-in의 page 기준점(500)이 새 제스처로 새어나가 상대 오프셋으로 계산된다.
- **plan과의 충돌**: §5-2 S6이 "제스처는 **별 위 press-in에서만** 시작"을 통과 기준으로 명시한다. 현재 코드는 그 불변식을 강제하지 않는다.
- **수정 방법(권장)**: 캡처 게이트에서 **현재 활성 터치의 시작점이 기록된 press-in 지점과 같은지** 확인한다. 새 ref·해제 타이밍 관리가 필요 없다.
  ```ts
  // Stars.tsx onMoveShouldSetPanResponderCapture
  onMoveShouldSetPanResponderCapture: (evt) => {
    // press-in으로 기준점을 기록한 그 터치가 아니면 잡지 않는다(별 사이 gap에서 시작한 터치·직전 제스처 잔존 기준점 차단).
    const { numberActiveTouches, indexOfSingleActiveTouch, touchBank } = evt.touchHistory;
    const touch = touchBank[indexOfSingleActiveTouch];
    if (numberActiveTouches !== 1 || !touch) return false;
    if (
      touch.startPageX !== dragStartPageRef.current.x ||
      touch.startPageY !== dragStartPageRef.current.y
    ) {
      return false;
    }
    const dx = evt.nativeEvent.pageX - dragStartPageRef.current.x;
    const dy = evt.nativeEvent.pageY - dragStartPageRef.current.y;
    return Math.abs(dx) > DRAG_ACTIVATE_DX && Math.abs(dx) > Math.abs(dy);
  },
  ```
  기존 spec의 `responderEvent` 헬퍼는 이미 `startPageX/startPageY`를 채우므로 D1~D7은 그대로 통과한다
  (`pressIn`과 `dragTo`의 pageX가 다르면 D1이 red가 되니, 헬퍼에 press-in 시작점을 넘기도록 소폭 조정 필요 — 이때 회귀 테스트로 P1/P2를 추가할 것).
- **담당**: `dev-rating-drag`

### L3 (하) — `onShouldBlockNativeResponder: () => true`는 **RN 기본값과 동일한 no-op**이고, 테스트 이름이 이를 과대 표현한다

- **위치**: `src/components/Stars/Stars.tsx:131` / 테스트 `src/components/Stars/Stars.spec.tsx:359-363`
- **사실 확인**: `node_modules/react-native/Libraries/Interaction/PanResponder.js:476-478` —
  `onShouldBlockNativeResponder`는 **`panHandlers`의 prop이 아니라 `onResponderGrant`의 반환값**이고,
  config에 없으면 **기본이 이미 `true`** 다. 실측: `row.props.onShouldBlockNativeResponder` → `undefined`,
  `row.props.onResponderGrant(evt)` → `true`.
- **영향**: 동작은 plan 의도대로다(Android 네이티브 블록 유효). 다만 plan §3-4.4·dev-notes §3-5가 이를 "추가 가드"로 서술하는 것은 과대 표현이고,
  테스트 이름 `'드래그 도중 뺏기지 않고(termination 거부) Android 네이티브 스크롤을 막는다'`의 후반부는 **아무것도 단언하지 않는다**
  (해당 테스트는 `onResponderTerminationRequest === false`만 검사 — 이 부분은 load-bearing 확인됨, §4 참조).
- **수정 방법**: 테스트에 한 줄 추가하면 실제로 검증된다(실측으로 `true` 반환 확인).
  ```ts
  expect(row.props.onResponderGrant(responderEvent({ pageX: 0 }))).toBe(true);
  ```
  또는 이름을 "termination 거부"로만 축소한다. 코드의 명시적 `() => true`는 의도 문서화로 유지해도 무해하다.
- **담당**: `dev-rating-drag`

### L4 (하, 문서) — dev-notes §4.1의 early-return 귀속이 부정확

`mostRecentTimeStamp` 기반 early return은 `onResponderMove`(`PanResponder.js` 내 `_accountsForMovesUpTo` 비교)뿐 아니라
**`onMoveShouldSetResponderCapture`에도 동일하게 존재한다**(`PanResponder.js:447-453`). 즉 증가하는 타임스탬프가 필요한 이유가
move 경로 하나가 아니라 게이트 경로에도 걸린다. dev-notes 문장만 보완하면 된다(코드 영향 없음).

### L5 (하, nit) — 파일 헤더 주석의 경로가 실제와 다름

`Stars.tsx:1` `// src/components/Stars.tsx` · `Stars.spec.tsx:1` `// src/components/Stars.spec.tsx` →
실제 경로는 `src/components/Stars/Stars.tsx`. **이번 스프린트가 만든 것이 아니라 선행 스프린트에서 이월된 것**이므로 참고용으로만 기록한다.

---

## 4. 테스트 유의미성 (load-bearing mutation 표본)

껍데기 단언이 아닌지 확인하려고 소스를 일부러 깨고 red 여부를 측정한 뒤 **전부 원복**했다.

| Mutation | 변경 | 결과 | 판정 |
|----------|------|------|------|
| A | `resolveRatingAtX`의 하한 클램프 `Math.max(RATING_MIN, raw)` → `Math.max(0, raw)` | **8 red** — U1(x=0/17/−50)·U5·U6·U7·U8 교차 불변식·D4 | ✅ 유의미 |
| B | `onPanResponderMove`의 dedup 가드(`if (next === lastEmittedRef.current) return;`) 제거 | **1 red** — D2 | ✅ 유의미 |
| C | `recordDragStart` 본문 제거(press-in 기준점 기록 없음) | **2 red** — D1·D6 | ✅ **dev-notes §4.2의 핵심 주장 검증됨** |
| D | 캡처 게이트에서 `&& Math.abs(dx) > Math.abs(dy)` 삭제 | **0 red (전부 green)** | ❌ **미검증 → L1** |
| E | `onPanResponderTerminationRequest: () => false` → `() => true` | **1 red** | ✅ 유의미 |

**Mutation C의 의미**: `onPressIn` → `dragStartXRef`/`dragStartPageRef` → `onPanResponderMove` 전 구간이 통과해야만 D1이 green이다.
dev-notes §4.2가 "직접 props 호출이어도 검증 강도는 동일하다"고 주장한 부분이 실험으로 뒷받침된다.

---

## 5. dev-notes §4 "테스트 축소 아닌 대체 경로" 판단 → **타당함(축소 아님)**

dev-notes는 `fireEvent(row, 'responderMove', …)` 대신 `row.props.onResponderMove(…)` 직접 호출을 택하고,
그 사유로 RNTL의 `isEventEnabled`가 `onStartShouldSetResponder`/`onMoveShouldSetResponder`가 `false`인 View의
responder 이벤트를 건너뛴다는 점을 들었다. **이 주장을 실험으로 확인했다.**

- spec의 `dragTo`를 `fireEvent(...)` 버전으로 되돌려 실행 → **D1·D2·D3·D4 + release-dedup 테스트 5개가 red**
  (핸들러가 아예 호출되지 않아 `onChange` 0회). 즉 `fireEvent`로는 검증 자체가 불가능하고, 직접 호출은 우회가 아니라 **유일한 경로**다.
- 직접 호출도 `PanResponder.panHandlers`가 만든 **실제 래퍼**를 타므로 우리 config(`onPanResponderMove`·dedup·기준점 참조)를 모두 통과한다
  — Mutation B·C가 red가 된 것이 그 증거다.
- **결론: plan §5-1의 폴백(축소) 규칙은 발동할 필요가 없었고, D1~D7은 실제 값 갱신까지 검증한다.** U1~U8은 계획대로 축소 없음.
- 단, 이 방식이 검증하지 못하는 층은 남는다: **responder 협상 자체**(캡처가 실제로 자식 Pressable에서 responder를 뺏는지).
  이는 계획대로 디바이스 스모크 S3·S4·S5의 몫이며, L1이 그중 게이트 판정 로직만이라도 단위로 덮자는 제안이다.

---

## 6. 가드레일

| 항목 | 확인 | 판정 |
|------|------|------|
| DB / 마이그레이션 | `supabase/migrations/` 신규 0개, `supabase/functions/` 변경 0줄 (git status) — AC11 | ✅ |
| 소비처 회귀 | `MuklogEditor.tsx` 변경 0줄(git status에 미포함) — props 계약 불변 증명, AC10 | ✅ |
| 신규 의존성 | `package.json`·`package-lock.json` 변경 0 — RN 내장 `PanResponder`만 사용. Dev Client 재빌드 불필요 | ✅ |
| 폴링 / 타이머 | `Stars.tsx`에 `setTimeout`·`setInterval`·`requestAnimationFrame` 0건 | ✅ |
| 네트워크 · 비용 | Supabase/Kakao 호출 0, 이미지·스토리지 무관, AWS 미사용. 드래그는 로컬 상태만 변경(방출 최대 9스텝, dedup 적용) | ✅ |
| 시크릿 노출 | 해당 없음(키 접근 코드 0) | ✅ |
| RLS | 이번 변경에 쿼리 없음 — 검증 대상 아님 | N/A |

## 7. 코드 컨벤션 (`docs/code-convention.md`)

| 항목 | 확인 | 판정 |
|------|------|------|
| `useCallback`/`useMemo` 미사용 | `Stars.tsx` 0건. 최신 props는 `sizeRef`/`onChangeRef`로 전달(`:101-104`) — `Sheet.tsx` 선례와 동일 | ✅ |
| 화살표 const 컴포넌트·훅 | `export const Stars = (...) => {}`. `src` 전체 `^export function` 컴포넌트 0건 | ✅ |
| named-object 인자 | `resolveRatingAtX`·`resolveStarOriginX`·`recordDragStart`·`resolveState`·`renderStar`·`resolveCellWidth`·`resolvePitch` 전부 객체 인자. `PanResponder` 콜백 `(evt)`·`STAR_POSITIONS.map((position))`·`onPressIn={(evt) => …}`는 외부 시그니처 예외 | ✅ |
| useEffect 명명 함수 | `Stars.tsx`에 `useEffect` 0건. `src` 전체 인라인 `useEffect(() =>`는 spec 파일 3건뿐(테스트 하네스, 선행 이월) | ✅ |
| enum-style 상수 | `StarState`(`:79-84`) `as const` 유지 | ✅ |
| 토큰 경유(raw hex/숫자 0) | `Stars.tsx`에 raw hex 0건(주석 1건은 킷 출처 표기). 색은 `color="starFill"`/`"lineStrong"` 토큰명 | ✅ |
| 파일명 = 대표 심볼명 | `Stars/Stars.tsx` → `Stars`. 유틸 동거 export는 `Sheet.tsx`의 `shouldDismissSheet`(`Sheet.tsx:38`) 선례와 동일 운용 | ✅ |
| 미사용 코드 | 신규 export 7개 상수 + 유틸 2종 전부 스타일 또는 spec에서 소비됨 | ✅ |

**참고(범위 밖·선행 이월)**: `src/navigation/useRefreshOnFocus/useRefreshOnFocus.ts:26`에 `React.useCallback` 1건이 남아 있다.
이번 스프린트 변경분이 아니므로 여기서 조치하지 않는다.

---

## 8. 인수조건 대응표

| AC / T | 내용 | 대응 테스트 | 판정 |
|--------|------|-------------|------|
| T1 | 지오메트리 상수 단일 출처 | `spec:114-134` (상수값 3 + 렌더된 row `gap` + 셀 `padding` 실값 대조) | ✅ |
| T2 / U1~U7 | `resolveRatingAtX` 매핑 | `spec:136-202` (검증 표 11행 · 좌반 시작 4 · 우반 시작 5 · gap 구간 4 · 극단 클램프 · 불변식 100개 · size=15 독립성) | ✅ (Mutation A로 load-bearing 확인) |
| T3 / U8 | `resolveStarOriginX` + 탭↔드래그 교차 불변식 | `spec:204-226` | ✅ |
| T4 | press-in은 값을 방출하지 않음 | `spec:292-296` | ✅ |
| T5(a) D1 | 드래그로 0.5 단위 방출 | `spec:298-303` | ✅ (Mutation C) |
| T5(b) D2 | 중복 방출 없음 | `spec:305-311` | ✅ (Mutation B) |
| D3 · D4 | 좌/우 오버런 클램프(0·0.5 방출 금지) | `spec:313-328` | ✅ (Mutation A) |
| T5(c) D5 | `editable=false` → 핸들러 미부착 | `spec:330-337` | ✅ |
| D6 · D7 | 축 게이트 | `spec:339-357` | ⚠️ **D7만 유효. D6는 축 항을 격리 못함 → L1** |
| — | termination 거부 | `spec:359-363` | ✅ (Mutation E) / 이름의 "네이티브 스크롤 차단"은 미단언 → L3 |
| — | release 후 dedup 초기화 | `spec:365-373` | ✅ |
| AC8 | `stars-row` testID가 `^star-` 개수 단언 무영향 | `spec:375-378` + `spec:24`·`spec:69` | ✅ |
| AC9 | `npm test` + `tsc --noEmit` green | 직접 실행(§1) | ✅ |
| AC10 | `MuklogEditor` diff 0 | git status | ✅ |
| AC11 | 마이그레이션 0 · Edge Function 0 | git status | ✅ |
| T7 | `architecture.md:85` 정정 | 마이그레이션 대조(경계면 8) | ✅ |
| T8 | 디바이스 스모크 체크리스트 | dev-notes §5 (S1~S8) | ✅ 문서화 완료 |

---

## 9. 미검증 (자동 테스트 범위 밖 — 사용자 판정 필요)

`docs/testing-strategy.md`의 "네이티브 동작은 디바이스 스모크" 경계에 따라 아래는 **통과로 처리하지 않는다**.

- **실제 responder 협상** — 캡처가 자식 `Pressable`에서 responder를 실제로 뺏는지, 그때 `Pressable`이 press를 취소해
  `onPress`(탭 값)가 이중 방출되지 않는지. → dev-notes §5 **S5**.
- **`ScrollView`와의 네이티브 경합** — 세로 스와이프 시 스크롤 유지, 드래그 획득 후 세로로 꺾어도 유지. → **S3 · S4**.
  **L1이 미수정 상태라면 S3의 자동 방어선이 0이므로 S3는 특히 주의 깊게 볼 것.**
- **별 사이 gap에서 시작한 제스처** — L2의 실기기 재현 여부. → dev-notes §5 **S6**의 판정 범위를
  "별 영역 밖"에서 "**별 사이 2px gap 포함**"으로 확장해 확인할 것을 권고한다.
- **드래그 부드러움·값 튐·멀티터치** → **S1 · S2 · S7**.
- **표시 전용 화면 회귀**(카드 탭·리스트 스크롤) → **S8**. 자동 테스트 D5는 "핸들러 미부착"까지만 보장한다.
- 라이브 DB 왕복(저장된 별점이 트리거를 통과하는지) — 이번 변경이 값 집합을 바꾸지 않아 회귀 위험은 낮지만, 실기기 저장 1회로 확인 권고.

---

## 10. 담당자별 조치 요약

| 이슈 | 담당 | 조치 |
|------|------|------|
| L1 — 축 우세 판정 미검증 | `dev-rating-drag` | ✅ **완료** — D6-b 신설(§11) |
| L2 — stale 기준점 재사용 | `dev-rating-drag` | ✅ **완료** — 제스처 신원 대조 + null 초기화 + L2-P1/P2 회귀(§11) |
| L3 — 네이티브 블록 미단언·과대 표현 | `dev-rating-drag` | ✅ **완료** — 테스트 분리 + 주석·dev-notes 정정(§11) |
| L4 — dev-notes §4.1 문장 | `dev-rating-drag` | ✅ **완료** — 양쪽 경로 파일:라인 명시(§11) |
| N1 — 멀티터치 동작이 plan §6과 달라짐 | `dev-rating-drag` | ✅ **완료** — dev-notes §6·plan §6 정정 + 스모크 **S9 신설**(§11-2) |
| N2 — 신원 게이트 fallback 경로 무테스트 | `dev-rating-drag` | ✅ **판정: 무결함** — 도달 불가 방어 코드, 조치 없음(§11-2) |
| N3 — mutation ↔ 커밋 워크트리 경합 | `team-lead` | 프로세스 권고 — 커밋을 qa 재검증 완료 이후로 직렬화(§11-2) |
| L5 — 헤더 주석 경로 | `dev-rating-drag` | ✅ **완료** — 양 파일 헤더 경로 정정 |
| 비주얼 회귀 확인 | `qa-visual` | 본 리포트 범위 밖 |

---

## 11. 재검증 라운드 (2라운드)

`dev-rating-drag`의 L1~L4 수정본을 **보고 내용에 의존하지 않고 뮤테이션으로 직접 재현**해 확인했다.
검증용 임시 변형·probe 파일은 전부 원복·삭제했고, 원복 후 `npm test` 195 suites / **1873 tests green**,
`npm run typecheck` 0 error, `supabase/` 변경 0, `MuklogEditor` 변경 0을 재확인했다. Stars.spec은 59 → **63 tests**.

### 11-1. 뮤테이션 재현 결과 (전부 dev 보고와 일치)

| Mutation | 변경 | 결과 | 판정 |
|----------|------|------|------|
| D′ | 캡처 게이트에서 `&& Math.abs(dx) > Math.abs(dy)` 삭제 | **D6-b만 red** (62 passed / 1 failed) | ✅ **L1 해소** — 축 규칙이 격리됐다 |
| F | 신원 대조(`touchStart` 비교) 3줄만 삭제 | **L2-P2만 red** | ✅ 신원 대조가 load-bearing |
| G | 신원 대조 삭제 + `dragStartPageRef` 초기값을 `{x:0,y:0}`로(= 1라운드 버그 상태) | **L2-P1·L2-P2 모두 red** | ✅ **L2 해소** — 1라운드 P1/P2가 회귀로 고정됨 |

- **L1**: D6가 `'임계 미달 이동은 responder를 탈취하지 않는다'`로 정정되고, D6-b(`dx=20` 임계 통과 / `dy=60` 세로 우세 → `false`)가 신설돼
  1라운드에 지적한 "D6이 축 규칙을 격리하지 못함"이 해소됐다(`Stars.spec.tsx:373-384`).
- **L2**: `resolveActiveTouchStart`(`Stars.tsx:95-101`)로 press-in 기록과 게이트 대조가 **같은 출처(touchBank)** 를 보게 했고,
  `dragStartPageRef`를 `PagePoint | null`로 바꿔 null 초기화 + release/terminate에서 비운다(`Stars.tsx:133, 171-178`).
  `onPanResponderMove`에도 `if (!start) return;` 방어가 들어갔다(`Stars.tsx:154-155`).
- **권장안 대비 변경에 대한 판단 — 타당하다.** 1라운드 권장안은 press-in의 `nativeEvent.pageX`와 이동 이벤트의 `touchBank.startPageX`를 비교했는데,
  dev가 양쪽 모두 `touchBank`에서 읽도록 바꾼 것이 **더 안전하다**. `Pressable`의 `onPressIn`은 responder grant 시점에 발생해
  이론상 터치 시작 시점과 미세하게 어긋날 수 있는데, `touchBank.startPageX`는 **터치 시작 시점에 고정된 값**이라 그 흔들림이 없다.
  같은 이유로 `onPanResponderMove`의 dx 기준점도 더 안정적이 됐다(드래그 정확도에 유리).
- **L3**: 테스트가 둘로 분리돼 termination 거부와 grant 반환값을 각각 단언한다(`Stars.spec.tsx:413-425`).
  `row.props.onShouldBlockNativeResponder === undefined` + `onResponderGrant(evt) === true`로, 1라운드에 실측한 RN 동작을 그대로 고정했다.
  코드 주석(`Stars.tsx:167-168`)도 "추가 가드가 아니라 기본 동작의 고정"으로 정정됐다.
- **L4**: spec 주석(`Stars.spec.tsx:228-231`)에 early-return 가드가 양쪽 경로에 있음이 명시됐다.

### 11-2. 재검증에서 새로 확인한 사항 (신규 결함 아님 — 문서화 권고)

**N1 — 멀티터치 동작이 plan §6 서술과 달라졌다.** `resolveActiveTouchStart`가 `numberActiveTouches !== 1`이면 `null`을 반환하므로,
**손가락이 2개면 캡처 게이트가 열리지 않는다.** probe로 실측 확인: 같은 터치가 이어져도 활성 터치 2개 → `false`, 1개 → `true`.
plan §6은 "멀티터치: 마지막 터치 기준, 값이 튀어도 릴리스 시 마지막 값으로 확정 — 허용"이라고 적었는데, 실제 동작은
**"두 손가락으로는 드래그를 시작할 수 없다(이미 시작된 드래그는 유지된다 — `onPanResponderMove`에는 터치 수 검사가 없다)"** 이다.
값 튐이 사라지는 쪽이라 **동작으로는 개선**이므로 코드 수정은 불필요하고, 문서만 실제 동작에 맞추면 된다.

**→ 반영 완료(확인함).** `dev-notes.md:115-121`이 §6 제약을 실제 동작으로 갱신했고, `plan.md:295`는 구 문구를 취소선 처리하고
실제 동작을 병기했다. **스모크는 S7 수정이 아니라 S9 신설로 갔는데, 이 판단이 더 낫다** — S7("빠르게 여러 번 왕복")은
한 손가락 dedup 시나리오라 두 손가락 케이스를 같은 행에 넣으면 사용자가 ☐를 칠 때 통과 기준이 모호해진다.
`dev-notes.md:100`의 S9는 "두 손가락 → 드래그 미시작 / 한 손가락으로 바꾸면 정상"에 더해
**"한 손가락 드래그 중 손가락 추가 시에는 유지된다"** 는 구분까지 담고 있어, 내가 §11-2에서 지적한 두 층위가 정확히 반영됐다.

**N3 — 작업 트리 경합(near-miss). 코드 결함 아님, 프로세스 이슈.**
`dev-rating-drag`가 L5를 반영하는 동안 qa의 mutation 마커(`MUTATION-D`·`MUTATION-F`)가 같은 파일에서 관측됐다.
편집 지점이 겹치지 않아 서로 덮어쓰진 않았지만, 그 구간에 dev가 돌린 테스트는 **qa의 뮤테이션을 측정한 것**이라 무의미했다(dev가 원복 확인 후 재실행).
더 중요한 건 **커밋과의 경합**이다 — `feat/rating-drag`의 `306ccc7`이 qa의 재검증 뮤테이션과 겹쳤다.
커밋된 blob을 직접 검사한 결과 **깨끗하다**(아래 §11-3). 다만 커밋이 뮤테이션 직전에 난 덕분이지 설계로 막은 게 아니다 —
타이밍이 조금만 달랐으면 축 우세 가드가 `void dy;`로 제거된 채 브랜치에 실렸을 것이다.
**조치 권고:** dev 수정·커밋과 qa mutation 재검증을 직렬화하고(리더가 순서 보장), **커밋은 qa 재검증 완료 보고 이후**에 한다.
또는 qa를 `isolation: "worktree"`로 스폰한다. 프로젝트 메모리에 기록했다.

**N2 — 신원 게이트의 fallback 경로에 테스트가 없다.** `recordDragStart`는 `resolveActiveTouchStart({ evt }) ?? { x: nativeEvent.pageX, y: nativeEvent.pageY }`로
이력이 없을 때 이벤트 좌표로 대체하는데(`Stars.tsx:196-199`), spec의 `responderEvent`는 항상 `touchHistory`를 채우므로 **이 분기는 한 번도 실행되지 않는다.**
실제 RN의 responder 이벤트는 항상 `touchHistory`를 싣기 때문에 정상 경로에서는 도달하지 않는 방어 코드이고, 도달하더라도
"press-in 시점의 `nativeEvent.pageX` == 그 터치의 시작 pageX"가 성립하는 한 게이트 대조는 통과한다. 따라서 **결함으로 분류하지 않는다.**
다만 dev가 지적한 대로 이 설계의 유일한 실기기 실패 모드가 **"드래그가 조용히 활성화되지 않음"** 이고 자동 테스트로는 잡히지 않으므로,
**디바이스 스모크 S1을 이번 라운드 최우선으로 둔다**(dev-notes에 이미 반영됨). S1이 실패하면 좌표 대조 대신
press-in 플래그 + `onPressOut` 해제 방식으로 전환하는 대안이 dev-notes에 준비돼 있다.

### 11-3. 최종 상태 검증 (3라운드 — L5 반영 + 커밋 이후)

경합 구간이 있었으므로 **커밋된 내용까지 직접 검사**했다.

| 검사 | 결과 |
|------|------|
| `grep -rn "MUTATION" src/` | **0건** (작업 트리) |
| `git show 306ccc7:src/components/Stars/Stars.tsx \| grep MUTATION` | **0건** (커밋된 blob) |
| 커밋된 축 우세 판정 | `:151` `Math.abs(dx) > DRAG_ACTIVATE_DX && Math.abs(dx) > Math.abs(dy)` ✅ |
| 커밋된 신원 대조 | `:146` `!start \|\| !touchStart \|\| touchStart.x !== start.x \|\| touchStart.y !== start.y` ✅ |
| 커밋된 null 초기화 | `:133` `useRef<PagePoint \| null>(null)` ✅ |
| 커밋 대상 파일 | `Stars.tsx` · `Stars.spec.tsx` · `architecture.md` **3개만** — `supabase/` 0, `MuklogEditor` 0 ✅ |
| 임시 probe 파일 잔존 | 0 (`src/components/Stars/`에 `index.ts`·`Stars.tsx`·`Stars.spec.tsx`만) |
| L5 헤더 경로 | `Stars.tsx:1`·`Stars.spec.tsx:1` 모두 `src/components/Stars/…`로 정정됨 ✅ |
| `npm test` (최종) | **195 suites / 1873 tests green** |
| `npm run typecheck` (최종) | **0 error** |
| 뮤테이션 재확인(최종 상태) | 축 항 삭제 → **D6-b만 red** (62 passed / 1 failed) → 원복 후 green ✅ |

Stars.spec 최종 63 tests — D6(임계) / D6-b(축) / D7 / L2-P1 / L2-P2 / termination 거부 / grant 네이티브 차단이 모두 개별 존재한다.
**작업 트리와 커밋 내용이 일치하며(`git status` clean), 위 수치는 그 내용으로 측정한 것이다.**
