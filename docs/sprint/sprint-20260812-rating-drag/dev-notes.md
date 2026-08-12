# Dev Notes — 별점 드래그 수정 (rating-drag)

> 작성: dev-rating-drag. 단일 출처 = `plan.md`. 구현 범위는 `Stars` 컴포넌트 1개 + 문서 1줄.

## 1. 변경 파일 (3개)

| 파일 | 변경 | 내용 |
|------|------|------|
| `src/components/Stars/Stars.tsx` | +175 / −4 | 지오메트리 상수 export, 순수 유틸 2종, `PanResponder` 배선(제스처 신원 게이트 포함), `onPressIn` 기준점 기록, row `testID` |
| `src/components/Stars/Stars.spec.tsx` | +330 / −2 | U1~U8 · D1~D7 · D6-b · L2-P1/P2 · T1 · AC8 테스트 추가 (**기존 12케이스는 한 줄도 수정 없음**) |
| `docs/design/architecture.md:85` | +1 / −1 | `rating smallint -- 1~5` → `rating numeric(2,1) -- 1~5, 0.5 단위 half-star (옵션). 트리거 RATING_OUT_OF_RANGE로 2차 검증` (T7) |

**변경하지 않은 것 (AC10·AC11 충족)**
- `src/features/muklog/MuklogEditor/MuklogEditor.tsx` — **diff 0줄**. `<Stars value={rating} size={32} editable onChange={setRating} />` 그대로. props 계약 불변이 증명됨.
- `supabase/migrations/` 신규 0개, `supabase/functions/` 변경 0줄. DB·RLS·Edge Function·네트워크 호출 **전부 0**.
- 스타일 값 불변 — `gap`/`padding`이 리터럴 `2`에서 상수 `STAR_GAP`/`STAR_CELL_PADDING`(둘 다 값 2)로 바뀌었을 뿐, 렌더 결과는 픽셀 단위로 동일. 색·크기·반 별 클리핑·`editOverlay` 구조 미변경.
- 신규 의존성 0 (RN 내장 `PanResponder`). **Dev Client 재빌드 불필요.**

## 2. 공개 계약 (`src/components/Stars/Stars.tsx` export)

```ts
// 지오메트리·데이터 계약 상수 — 스타일과 매핑 유틸의 단일 출처
export const STAR_COUNT = 5;
export const STAR_GAP = 2;          // styles.row.gap이 이 상수를 참조
export const STAR_CELL_PADDING = 2; // styles.starEditable.padding이 이 상수를 참조
export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const RATING_STEP = 0.5;
export const DRAG_ACTIVATE_DX = 4;

export const resolveRatingAtX = ({ x, size }: { x: number; size: number }) => number;
export const resolveStarOriginX = (
  { index, isRightHalf, size }: { index: number; isRightHalf: boolean; size: number },
) => number;
```

`StarsProps`(`value`/`size`/`editable`/`onChange`) **시그니처 불변**.

**`resolveRatingAtX` 보장(테스트로 고정)** — 반환값은 항상 0.5의 배수이고 `1 ≤ v ≤ 5`이며, x에 대해 단조 비감소. 어떤 x(±1e6 포함)에도 예외를 던지지 않는다. `size=32` → `cellWidth 36`, `pitch 38`; `size=15`(기본) → `cellWidth 19`, `pitch 21`.

## 3. 생산자 ↔ 소비자 매핑 (qa-logic 교차검증용)

| # | 생산자 | 소비자 | 실제 배선 위치 | 확인 결과 |
|---|--------|--------|----------------|-----------|
| 1 | `resolveRatingAtX` | `onPanResponderMove` | `Stars.tsx` — `resolveRatingAtX({ x: dragStartXRef.current + dx, size: sizeRef.current })`, `dx = evt.nativeEvent.pageX − dragStartPageRef.current.x` | size는 `sizeRef`(매 렌더 갱신)로 최신값 사용. `gestureState` 미사용 — `pageX`만 씀 |
| 2 | 탭 영역 분할(`editOverlay` flex 2분할 + 별1 단일 `Pressable`) | `resolveStarOriginX` | 두 경로 모두 `STAR_GAP`·`STAR_CELL_PADDING` 상수만 참조. 리터럴 중복 0 | U8 교차 불변식으로 "모든 탭 영역에서 드래그값 == 탭 방출값" 자동 검증 |
| 3 | `Stars.onChange` | `MuklogEditor.setRating` → `rating.toFixed(1)` | `MuklogEditor.tsx:564` (미변경) | 유틸이 0.5 배수·1~5만 반환하므로 NaN·0·5.5 유입 불가. 부동소수 오차 없음(정수 + 0.5는 이진 정확값) |
| 4 | `Stars.onChange` | `validate.ts`(0.5 단위 검증) → DB 트리거 `RATING_OUT_OF_RANGE` | 드래그가 만들 수 있는 값 집합 = {1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5} — 탭과 동일 집합 | 새로 통과해야 할 값이 없음(탭이 이미 방출하던 9개와 완전 동일) |
| 5 | row `panHandlers` | `MuklogEditor`의 세로 `ScrollView` | `onMoveShouldSetPanResponderCapture`: ①press-in으로 기준점을 기록한 그 터치인지 대조 → ②`\|dx\| > 4 && \|dx\| > \|dy\|`. 획득 후 `onPanResponderTerminationRequest: () => false` | D6(임계)·D6-b(축 우세)·D7·L2-P1/P2로 게이트 자동 검증. 실제 네이티브 경합은 S3·S4 스모크 |
| 5-b | `onPressIn`의 기준점 기록 | 캡처 게이트의 신원 대조 | 양쪽 모두 `resolveActiveTouchStart`(= `touchHistory.touchBank[indexOfSingleActiveTouch].startPageX/Y`)에서 읽는다 | 출처가 같아 값이 정확히 일치. `touchHistory`가 없으면 `nativeEvent.pageX/pageY`로 대체 |
| 6 | 신규 `testID="stars-row"` | 기존 `getAllByTestId(/^star-/)` 단언 | `stars-row`는 `star-` 접두와 불일치(`stars-` ≠ `star-`) | AC8 통과 — editable/비editable 모두 정확히 5개 |
| 7 | `editable` 분기 | 표시 전용 3곳(`MuklogCard`·`MuklogDetailScreen`·`SelectedSpotCard`) | `{...(editable ? panResponder.panHandlers : {})}` | D5로 검증 — `editable=false`면 `onResponderMove`·`onMoveShouldSetResponderCapture` 모두 `undefined`. 카드 탭 회귀 0 |
| 8 | `architecture.md:85` | `20260720120000_rating_half_step.sql` | 마이그레이션의 `numeric(2,1)` + `RATING_OUT_OF_RANGE` 트리거와 문서 표기 일치 | T7 반영 완료. SQL 변경 0 |

## 4. 테스트 결과

```
npm test        → 195 suites / 1873 tests, 전부 green
npm run typecheck → 0 error
Stars.spec.tsx  → 63 tests (기존 12 + 신규 51)
```

신규 커버리지: U1(검증 표 11행) · U2(4) · U3(5) · U4(4) · U5 · U6(무작위 100개 불변식) · U7(size=15 독립성) · U8(교차 불변식) · T1(상수 3) · T4 · D1~D7 · D6-b(축 우세 격리) · L2-P1/P2(제스처 신원) · termination 거부 · grant 반환값 · release 후 dedup 초기화 · AC8.

### 뮤테이션 검증 (테스트가 실제로 규칙을 격리하는지 확인)

테스트 이름이 주장하는 규칙을 그 테스트가 정말 방어하는지, 소스를 일부러 깨뜨려 확인했다(전부 원복 후 재실행 green).

| 뮤테이션 | 기대 | 결과 |
|----------|------|------|
| `&& Math.abs(dx) > Math.abs(dy)` 삭제 | 축 우세 테스트만 red | **D6-b만 red** — 축 규칙이 격리됨 |
| 캡처 게이트의 신원 대조 삭제 | 신원 테스트 red | **L2-P2 red** (P1은 `dragStartPageRef` null 초기화가 잡음) |
| 신원 대조 삭제 + 기준점 `{x:0,y:0}` 초기화(= 원래 버그 상태) | P1·P2 모두 red | **L2-P1·L2-P2 red** — 두 probe 모두 회귀로 고정됨 |

### 테스트 경계 결정 — D1~D5 유지(축소 없음), 단 호출 방식 1건 조정

plan §5-1의 폴백 규칙(합성 이벤트 3회 실패 시 축소)은 **발동하지 않았다.** D1~D7 전부 실제 값 갱신까지 검증한다. 다만 합성 이벤트 배선에서 두 가지를 plan의 예시 헬퍼와 다르게 잡아야 동작했고, 그 사유를 남긴다.

1. **`touchHistory`를 실제 형태로 채워야 한다.** plan 예시의 `mostRecentTimeStamp: 0` + 빈 `touchBank`는 두 지점에서 막힌다 — (a) RN `PanResponder`의 `onResponderMove`(PanResponder.js:513-519)와 `onMoveShouldSetResponderCapture`(:447-453)에 **똑같은 early-return 가드**가 있어(`gestureState._accountsForMovesUpTo === touchHistory.mostRecentTimeStamp`) 타임스탬프가 매 이벤트 증가해야 하고, (b) `numberActiveTouches === 1`이면 `TouchHistoryMath`가 `touchBank[indexOfSingleActiveTouch]`를 역참조하므로 빈 배열이면 `TypeError`가 난다. → spec의 `responderEvent` 헬퍼가 증가하는 타임스탬프와 1개짜리 `touchBank` 엔트리를 생성한다. 헬퍼는 `startPageX/startPageY`도 받아 "이 터치가 어디서 시작했는지"를 표현한다(제스처 신원 판정용).

2. **드래그 이동은 `fireEvent(row, 'responderMove', …)` 대신 `row.props.onResponderMove(…)`로 호출한다.** RNTL의 `isEventEnabled`는 대상 View의 `onStartShouldSetResponder`/`onMoveShouldSetResponder`가 **`false`를 반환하면 이벤트를 비활성으로 보고 건너뛴다.** 우리 row는 캡처 단계(`onMoveShouldSetPanResponderCapture`)로만 responder를 가져오므로 그 둘이 정의상 `false`고, 따라서 `fireEvent`로는 핸들러가 영원히 호출되지 않는다(제스처 전용 View에 대한 RNTL 한계). row에 **실제로 붙은 props를 직접 호출**하는 방식은 `panHandlers` 래퍼와 우리 config를 모두 통과하므로 검증 강도는 동일하다. `pressIn`은 `fireEvent` 그대로 사용(Pressable 경로 정상).
   - 이 방식이 실제 배선을 검증한다는 근거: D1은 press-in 기준점이 기록돼야만 `2.5`가 나온다(기록 실패 시 `5`). 즉 `onPressIn` → `dragStartXRef` → `onPanResponderMove` 전 구간이 통과해야 green이다.

**단위 대상 아님(계획대로 스모크 이관)**: 실제 터치 협상·`ScrollView`와의 네이티브 경합·드래그 부드러움·멀티터치. 아래 §5.

## 5. 이월 — 디바이스 스모크 체크리스트 (사용자 판정 필요)

실기기(먹로그 작성/수정 화면)에서 확인한다. **자동 테스트로 덮이지 않는 항목이므로 이 목록이 유일한 방어선이다.**

| ID | 시나리오 | 통과 기준 | 결과 |
|----|----------|-----------|------|
| S1 | 별 위를 좌→우로 천천히 쓸기 | 값이 0.5 단위로 끊김 없이 따라오고, 손가락 위치와 채워진 별 경계가 어긋나 보이지 않는다. 보조 텍스트(`n.0`)도 실시간 갱신 | ☐ |
| S2 | 우→좌로 쓸어 내리기 | 값이 감소하고 **최소 1.0에서 멈춘다**(0으로 안 떨어짐) | ☐ |
| S3 | 별 위에서 **세로로 스와이프** | 별점이 바뀌지 않고 **페이지가 스크롤된다** | ☐ |
| S4 | 수평 드래그 시작 후 손가락을 위/아래로 꺾기 | 드래그가 유지되고(스크롤에 뺏기지 않음) 값이 계속 갱신된다 | ☐ |
| S5 | 별을 짧게 탭 | 기존과 동일하게 해당 반쪽 값이 들어간다(드래그 오작동 없음) | ☐ |
| S6 | 별 영역 밖(좌/우 여백)·**별과 별 사이 틈**에서 시작해 별 위로 드래그 | 별점이 변하지 않는다(제스처는 별 위 press-in에서만 시작) | ☐ |
| S7 | 빠르게 여러 번 왕복 | 값 튐·렌더 끊김 없음(방출 dedup 확인) | ☐ |
| S8 | **표시 전용 회귀** — 먹로그 리스트 카드·상세·지도 선택 카드에서 별 위를 탭/스와이프 | 카드 탭·리스트 스크롤이 평소대로 동작(별이 제스처를 가로채지 않음) | ☐ |
| S9 | **두 손가락**으로 별 위를 좌우로 쓸기 | **드래그가 시작되지 않는다**(별점 불변 — 신원 게이트가 활성 터치 1개만 통과, qa-logic N1 확인). 한 손가락으로 바꾸면 정상 동작. 한 손가락 드래그 중 손가락 추가 시 마지막 터치 기준·릴리스 시 마지막 값 확정(§6 참고) | ☐ |

> S8은 plan §5-2에 없던 항목이지만 §7-7(표시 전용 사용처 회귀)을 실기기에서 확인하려면 필요해 추가했다. 자동 테스트 D5가 "핸들러 미부착"까지는 보장한다.

> **S1이 이번 라운드에서 가장 중요하다.** 제스처 신원 게이트(§3-5b)는 press-in 때 기록한 터치 시작 좌표와
> 이동 이벤트의 `touchBank.startPageX/Y`가 **정확히 일치할 때만** 드래그를 활성화한다. 두 값을 같은 출처
> (`touchHistory`)에서 읽으므로 구조상 일치해야 하지만, 실기기에서만 드러날 수 있는 유일한 실패 모드는
> "드래그가 아예 활성화되지 않음"이다(값이 안 따라옴). S1이 실패하면 이 게이트가 원인이니 즉시 알려달라 —
> 그 경우 신원 판정을 좌표 대조 대신 press-in 플래그 + `onPressOut` 해제 방식으로 바꾼다.

## 6. 알려진 제약 (의도된 것)

- **드래그로 미평가(0/null)로 되돌릴 수 없다.** 최소 1.0 클램프는 선행 스프린트 데이터 계약 결정 승계(plan Out-of-scope).
- **별1 좌측 절반도 1.0**(0.5 아님). 동일 사유.
- **스크린리더 사용자에게 드래그는 불가** — 탭 경로(`onPress` + `accessibilityRole="button"` + 라벨)가 유일 입력이고 그대로 보존했다. `onPressIn`은 값을 방출하지 않으므로 활성화 흐름이 깨지지 않는다. `adjustable` 롤 + increment/decrement 액션은 후속 후보(plan Out-of-scope).
- **멀티터치로는 드래그가 시작되지 않는다 — ⚠️ plan §6 서술과 다르다(의도된 변경, 리더·planner 확인 필요).**
  plan §6은 "멀티터치는 `PanResponder`가 마지막 터치 기준. 값이 튀어도 릴리스 시 마지막 값으로 확정 — 허용"이라고 적었지만,
  L2 수정으로 넣은 제스처 신원 게이트가 활성 터치 1개일 때만 통과시키므로(`resolveActiveTouchStart`가
  `numberActiveTouches !== 1`이면 `null`) **손가락 2개로는 드래그가 아예 시작되지 않는다**(qa-logic이 probe로 실측).
  이미 시작된 드래그는 유지된다 — `onPanResponderMove`에는 터치 수 검사가 없다.
  **값 튐이 사라지는 방향이라 동작으로는 개선**이고 qa-logic도 코드 유지에 동의했으므로 코드는 그대로 두고 문서만 갱신했다.
  실기기 확인은 S9. plan.md도 planner가 §6(`plan.md:295`)에 정정 표기를 반영했다(구 문구 취소선 + 실제 동작 병기).
- 햅틱 피드백 없음 — `expo-haptics` 도입 시 Dev Client 재빌드가 필요해 의도적으로 제외.

## 7. qa-logic 지적 반영 (L1~L5 · N1~N2)

`qa-report-logic.md`의 5건(L1~L5)을 전부 반영했고, 재검증에서 나온 문서 보완 2건(N1·N2)까지 처리했다.
**재검증 결과: 로직 통과** — qa-logic이 뮤테이션 3종을 직접 재현해 §4 표와 동일함을 확인했다.

| # | 지적 | 반영 |
|---|------|------|
| L1 (중) | 축 우세 판정 `\|dx\| > \|dy\|`가 테스트로 안 덮임 — D6가 `dx=2`라 4px 임계에서 먼저 탈락 | **D6-b 신설**(`dx=20`으로 임계는 통과, `dy=60`으로 세로 우세). D6는 "임계 미달"로 이름을 정정해 둘을 분리. 뮤테이션으로 격리 확인(§4) |
| L2 (중) | press-in 없이 시작한 제스처가 stale 기준점으로 값 방출(별 사이 gap 2px×4) | 캡처 게이트에 **제스처 신원 대조** 추가 — press-in 때 기록한 터치 시작 좌표와 이동 이벤트의 터치 시작 좌표가 다르면 잡지 않는다. 기준점을 `null` 초기화하고 release/terminate에서 비운다. QA 권장안에서 한 가지를 바꿨다: 양쪽 좌표를 **모두 `touchHistory.touchBank`에서** 읽는다(`resolveActiveTouchStart`). 권장안대로 press-in의 `nativeEvent.pageX`와 `touchBank.startPageX`를 비교하면 두 값이 실기기에서 어긋날 경우 드래그가 조용히 안 되는 위험이 있어, 출처를 통일해 구조적으로 일치시켰다. P1·P2를 회귀 테스트로 고정(뮤테이션 확인) |
| L3 (하) | `onShouldBlockNativeResponder: () => true`는 RN 기본값과 동일하고 `panHandlers` 프롭이 아님 — dev-notes의 "추가 가드" 서술이 과대, 테스트명 후반이 미단언 | 코드는 의도 명시로 유지하되 주석을 사실대로 고쳤다("추가 가드가 아니라 기본 동작의 고정", 값 전달 경로는 `onResponderGrant` 반환값). 테스트를 둘로 쪼개 termination 거부와 `onResponderGrant(...) === true`를 각각 단언 |
| L4 (하) | `mostRecentTimeStamp` early-return이 `onMoveShouldSetResponderCapture`에도 있음 | §4-1 문장과 spec 주석에 양쪽 모두 명시(파일:라인 포함) |
| L5 (하, nit) | 파일 헤더 주석 경로가 실제와 다름(선행 스프린트 이월) | `Stars.tsx:1`·`Stars.spec.tsx:1`을 `src/components/Stars/…`로 정정 |
| N1 (재검증, 문서) | 멀티터치 동작이 plan §6 서술과 달라짐 — 신원 게이트가 활성 터치 1개일 때만 통과시켜 **두 손가락으로는 드래그가 시작되지 않음**(qa-logic probe 실측) | 동작은 개선 방향이라 **코드 유지**. §6 제약을 실제 동작으로 갱신하고 스모크 **S9 신설**(두 손가락 → 드래그 미시작). planner도 `plan.md:295`에 정정 표기 반영 |
| N2 (재검증, 무결함) | `recordDragStart`의 `?? { x: nativeEvent.pageX, … }` fallback이 무테스트 | 실제 RN responder 이벤트는 항상 `touchHistory`를 실으므로 도달하지 않는 방어 코드. qa-logic이 결함 미분류·테스트 미요구로 판정 → **조치 없음**(코드 유지) |

> **작업 트리 경합 주의(기록용).** L5 반영 중 `Stars.tsx`에서 `// MUTATION-D`(축 우세 판정 제거) → `// MUTATION-F`
> (신원 대조 제거) 마커가 연달아 관측됐다. qa-logic의 재검증 뮤테이션이 **공유 작업 트리에서 진행 중**이었기
> 때문이고, 곧 원복돼 최종 소스는 정상이다(마커 0, 축 우세 판정·신원 대조 모두 제자리). 다만 이 구간의
> 테스트 결과는 상대의 뮤테이션을 측정했을 수 있으므로 **원복 확인 후 전 스위트를 다시 돌려** 최종 수치를 얻었다.
> 앞으로 같은 파일에 뮤테이션 실험과 수정이 겹칠 때는 사전에 서로 알리는 편이 안전하다.
