# Sprint: 별점 드래그 수정 (rating-drag)

> 작성: planner-rating-drag. 선행 스프린트 `sprint-20260720-half-star-rating`(0.5 단위 도입)의 후속.
> **1 스프린트 = 1 기능** — 이번 스프린트는 "별점 입력 제스처 확장" 하나만 다룬다.

## 0. 현황 정찰 (구현 전 확인된 사실)

| 항목 | 현재 상태 | 출처 |
|------|-----------|------|
| 별점 컴포넌트 | `src/components/Stars/Stars.tsx` — 표시(꽉/반/빈) + `editable` 입력 | 소스 |
| 입력 방식 | **탭 전용**. 별을 좌/우 반으로 나눈 `Pressable` 2개(`editOverlay` = absoluteFill + `flex:1` 2분할). 별1만 클램프(최소 1.0)로 단일 풀사이즈 `Pressable` | Stars.tsx:78-113 |
| 레이아웃 | row `gap: 2`, 각 별 셀 `padding: 2`, 아이콘 `size` | Stars.tsx:119-125 |
| `editable` 사용처 | **`MuklogEditor` 단 1곳** (`<Stars value={rating} size={32} editable onChange={setRating} />`) | MuklogEditor.tsx:564 |
| 표시 전용 사용처 | `MuklogCard`(14) · `MuklogDetailScreen`(STARS_SIZE) · `SelectedSpotCard`(13) — **`editable` 미사용 → 이번 변경 무영향** | grep |
| 스크롤 컨테이너 | `MuklogEditor`는 세로 `ScrollView`(`keyboardShouldPersistTaps="handled"`) 내부. 별점 행은 그 안 | MuklogEditor.tsx:437 |
| 데이터 계약 | `rating`: `1.0~5.0`, 0.5 단위, 0/null = 미평가. DB `numeric(2,1)` + 트리거 검증(마이그레이션 `20260720120000_rating_half_step.sql` 적용됨) | 선행 plan |
| 제스처 선례 | `Sheet.tsx` — `useRef(PanResponder.create({...})).current` + 임계 4px + 축 우세 판정 + 순수 판정 유틸(`shouldDismissSheet`)을 **컴포넌트 파일에서 export → 같은 spec에서 단위 테스트** | Sheet.tsx:38-86, Sheet.spec.tsx:16-31 |
| 사용 가능한 제스처 수단 | RN 내장 `PanResponder`(추가 설치 0), `react-native-gesture-handler`(이미 의존성 + `GestureHandlerRootView` 마운트됨) | package.json, App.tsx:81 |

### 설계 문서와의 불일치 (planner 지적)

`docs/design/architecture.md:85`이 아직 `rating smallint -- 1~5`로 남아 있다. 선행 스프린트에서
`numeric(2,1)`(0.5 단위)로 바뀌었으므로 **문서가 stale**하다. 이번 스프린트에서 문서 한 줄만 정정한다(T7).
그 외에는 architecture.md와 어긋나는 지점 없음.

---

## 1. 기능 한줄 정의

먹로그 에디터에서 **별 위를 손가락으로 좌우로 쓸면(드래그) 별점이 0.5 단위로 연속 변경**되고, 손을 떼면 그 값이 확정된다. 기존 탭 입력은 그대로 동작한다.

## 2. 범위

**In-scope**
- `Stars` 컴포넌트 `editable` 모드에 **수평 드래그 입력** 추가 (RN 내장 `PanResponder`).
- 드래그 위치 → 별점 매핑을 **순수 유틸**로 분리하고 단위 테스트로 고정.
- 드래그 값은 **탭 영역 판정과 완전히 동일한 기준**(같은 x → 같은 값)으로 스냅(0.5 단위, 1.0~5.0 클램프).
- 세로 `ScrollView` 안에서의 축 충돌 처리(수평 의도일 때만 제스처 탈취, 잡은 뒤에는 양보 금지).
- 기존 탭·접근성(라벨 `별점 n점`, `accessibilityRole="button"`) **무회귀**.
- architecture.md `rating` 컬럼 타입 표기 정정(문서 1줄).

**Out-of-scope** (이번엔 일부러 안 함)
- 신규 네이티브 모듈/의존성 추가 (**햅틱 피드백 `expo-haptics` 포함 — Dev Client 재빌드 회피**).
- `react-native-gesture-handler`의 `Gesture.Pan()` 도입 (RN 내장 `PanResponder`로 충분 + `Sheet` 선례 일치. §3 결정 근거).
- 비주얼/애니메이션 변경 (별 크기·색·간격·반 별 클리핑 방식 전부 그대로).
- 표시 전용 사용처(`MuklogCard`·`MuklogDetailScreen`·`SelectedSpotCard`) 변경.
- 접근성 `adjustable` 롤 + increment/decrement 액션(스크린리더용 별도 조정 제스처) — 후속 후보.
- 별점 0(미평가)으로 되돌리는 제스처(드래그로 별점 지우기). 현행처럼 최소 1.0 클램프 유지.
- DB/RLS/Edge Function/마이그레이션 — **이 기능의 변경량은 0이어야 한다.**

## 3. 데이터 · API 계약

- **테이블/컬럼 변경: 없음.** `muklogs.rating numeric(2,1)` 기존 계약 그대로 사용.
- **RLS/트리거/RPC 변경: 없음.**
- **네트워크 호출: 없음.** 드래그는 로컬 상태(`MuklogEditor`의 `rating`)만 바꾸고, 저장은 기존 저장 버튼 경로를 탄다.

### 3-1. 컴포넌트 계약 — `Stars` (props 시그니처 불변)

```ts
export type StarsProps = {
  value?: number | null;   // 1~5, 0.5 단위. 0/null/undefined = 미평가
  size?: number;           // 기본 15, 에디터는 32
  editable?: boolean;      // true면 탭 + 드래그 입력
  onChange?: (value: number) => void; // 항상 0.5 배수, 1 ≤ value ≤ 5
};
```

**props 변경 없음** — 사용처(`MuklogEditor`)의 배선 수정은 **0**이어야 한다. 드래그는 순수하게 `Stars` 내부 기능이다.

### 3-2. 지오메트리 상수 (단일 출처 = `Stars.tsx`에서 export)

스타일과 매핑 유틸이 **같은 숫자**를 봐야 하므로 상수를 export해 양쪽이 쓴다(하드코딩 중복 금지).

```ts
export const STAR_COUNT = 5;
export const STAR_GAP = 2;          // row gap (styles.row.gap과 동일 출처)
export const STAR_CELL_PADDING = 2; // styles.starEditable.padding과 동일 출처
export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const RATING_STEP = 0.5;
export const DRAG_ACTIVATE_DX = 4;  // Sheet.tsx의 4px 임계와 동일 감각
```

셀 폭 `cellWidth = size + 2 * STAR_CELL_PADDING`, 별 간 피치 `pitch = cellWidth + STAR_GAP`.
`size = 32`(에디터) 기준: `cellWidth = 36`, `pitch = 38`, 행 전체 폭 `= 5*36 + 4*2 = 188`.

### 3-3. 순수 유틸 계약 (`Stars.tsx`에서 export, `Stars.spec.tsx`에서 단위 테스트)

> **배치 근거:** `Sheet.tsx`가 `shouldDismissSheet`를 컴포넌트 파일에서 export하고 `Sheet.spec.tsx`에서
> 단위 테스트하는 선례를 그대로 따른다(신규 파일/폴더 없음, 컨벤션 "한 파일 = 한 대표 심볼"의 기존 운용과 동일).

```ts
/** 별점 행(row) 로컬 x좌표 → 별점. 탭 영역 판정과 동일 기준. 반환은 항상 0.5 배수, 1~5 클램프. */
export const resolveRatingAtX = ({ x, size }: { x: number; size: number }): number;

/** editable 별의 좌/우 반 영역(별1은 셀 전체)의 행 로컬 좌측 x. press-in 기준점 계산용. */
export const resolveStarOriginX = ({
  index,      // 0-based 별 인덱스
  isRightHalf,// 우측 반 영역이면 true (별1 단일 Pressable은 false)
  size,
}: { index: number; isRightHalf: boolean; size: number }): number;
```

**`resolveRatingAtX` 알고리즘 (개발자가 추측하지 않도록 명시)**

```
cellWidth = size + 2 * STAR_CELL_PADDING
pitch     = cellWidth + STAR_GAP
index     = clamp(floor(x / pitch), 0, STAR_COUNT - 1)
within    = x - index * pitch
raw       = index + (within < cellWidth / 2 ? 0.5 : 1)
return clamp(raw, RATING_MIN, RATING_MAX)
```

`resolveStarOriginX` = `index * pitch + (isRightHalf ? cellWidth / 2 : 0)`.

**검증 표 (size=32 → cellWidth 36, pitch 38)** — 이 표가 곧 단위 테스트 케이스다.

| x | 기대값 | 근거 |
|---|--------|------|
| 0 | 1 | 별1 좌측 → 0.5지만 계약 최소 1.0으로 클램프(선행 스프린트 리더 결정 승계) |
| 17 | 1 | 별1 좌반 |
| 20 | 1 | 별1 우반 |
| 38 | 1.5 | 별2 좌측 끝 — **탭 영역과 동일** |
| 55 | 1.5 | 별2 좌반 |
| 56 | 2 | 별2 우반 시작(`within = 18 = cellWidth/2`) |
| 74 | 2 | 별2와 별3 사이 gap → 왼쪽 별을 꽉 채움 |
| 76 | 2.5 | 별3 좌측 끝 |
| 187 | 5 | 별5 우반 |
| 1000 | 5 | 우측 오버런 클램프 |
| −50 | 1 | 좌측 오버런 클램프 |

**왜 "채움(fill) 기준"이 아니라 "탭 영역 기준"인가 (결정 + 기각안)**
- 기각안: `value = ceil(x / pitch * 2) / 2` (손가락 위치까지 채우는 방식). 이 경우 별2 좌측 끝(x=38)에서
  드래그는 1.0, 탭은 1.5를 준다 → **같은 픽셀에서 탭과 드래그의 결과가 달라진다.**
- 채택: 탭 영역 판정을 드래그에도 그대로 사용 → 탭 무회귀가 정의상 보장되고, QA 판정도 단일 기준.

### 3-4. 제스처 계약 (`PanResponder` 배선)

**수단 결정: RN 내장 `PanResponder`.** 이유 — (a) 신규 의존성 0, (b) `Sheet.tsx`에 동일 패턴 선례가 있어
코드 일관성, (c) 필요한 건 responder 협상뿐이라 gesture-handler의 워크릿/네이티브 이점이 불필요.

좌표는 **`gestureState`가 아니라 `evt.nativeEvent.pageX`** 로 계산한다(합성 이벤트로 테스트 가능하고,
responder가 부모로 넘어온 뒤에도 `locationX` 기준계가 흔들리지 않는다).

1. **기준점 기록 (press-in)**: 각 반쪽 `Pressable`(별1은 단일 `Pressable`)에 `onPressIn` 추가 —
   `dragStartXRef.current = resolveStarOriginX({ index, isRightHalf, size }) + evt.nativeEvent.locationX`,
   `dragStartPageRef.current = { x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY }`.
   **`onPressIn`은 값을 방출하지 않는다** — 탭 확정은 기존대로 `onPress`(무회귀 + 스크린리더 활성화 경로 보존).
2. **탈취 게이트**: row `View`에 `panHandlers` 스프레드.
   `onMoveShouldSetPanResponderCapture: (evt) => |dx| > DRAG_ACTIVATE_DX && |dx| > |dy|`
   (dx/dy는 `pageX/pageY − dragStartPageRef`). 캡처 단계라 자식 `Pressable`에서 responder를 가져올 수 있고,
   임계 미달이면 자식이 계속 responder → 평범한 탭은 그대로 `onPress`로 끝난다.
3. **이동**: `onPanResponderMove: (evt) => { const next = resolveRatingAtX({ x: dragStartXRef.current + dx, size }); if (next !== lastEmittedRef.current) { lastEmittedRef.current = next; onChangeRef.current?.(next); } }`
   — **값이 바뀔 때만 방출**(불필요 리렌더 억제).
4. **양보 금지**: `onPanResponderTerminationRequest: () => false` (드래그 도중 `ScrollView`에 responder를 뺏기지 않음),
   `onShouldBlockNativeResponder: () => true` (Android 네이티브 스크롤 차단).
5. **정리**: `onPanResponderRelease` / `onPanResponderTerminate`에서 `lastEmittedRef.current = null`.
   릴리스 시 추가 방출은 없다(마지막 move 값이 곧 확정값).
6. **생성 1회**: `useRef(PanResponder.create({...})).current` (Sheet 선례). 핸들러가 읽는 최신 props는
   `sizeRef` / `onChangeRef`로 전달 — `useCallback`/`useMemo` 금지(컨벤션).
7. **`editable=false`면 `panHandlers`를 스프레드하지 않는다** (표시 전용 사용처 무영향). 훅 순서 보존을 위해
   `PanResponder.create` 자체는 조건 없이 호출한다.

### 3-5. 테스트용 접점

- row `View`에 `testID="stars-row"` 추가.
  **주의:** 기존 spec의 `getAllByTestId(/^star-/)`(정확히 5개)와 충돌하지 않는다(`stars-row`는 `star-` 접두 불일치).
  이 무회귀는 AC8로 명시 검증한다.

## 4. 화면 · UX

- **퍼블리싱 범위: 없음(비주얼 불변).** 킷 `templates/muklog` 시안 대비 렌더 결과가 바뀌지 않는다 —
  별 크기·간격·색(`starFill #FFB23E` / `lineStrong`)·반 별 클리핑 방식·`ratingRow` 레이아웃 전부 그대로.
  **ui-publisher 작업 불필요.** (qa-visual은 "변경 없음" 회귀 확인만)
- 유일한 사용자 체감 변화: 별 위에서 손가락을 좌우로 쓸면 값이 따라온다.
- 상태: 드래그 중 별점 보조 텍스트(`MuklogEditor`의 `rating.toFixed(1)`)가 실시간으로 갱신된다
  (기존 배선을 그대로 타므로 추가 작업 없음). 미평가(0) 상태에서 드래그 시작 → 첫 스텝에서 "어땠어요?" → "n.0"으로 전환.
- 로딩/빈/에러 상태: 해당 없음(로컬 상태 전용, 네트워크 없음).
- 토큰: 신규 사용 지점 없음.

## 5. 작업 목록 (각 인수조건 포함)

- [ ] **T1. 지오메트리 상수 export + 스타일 단일 출처화** — `STAR_GAP`·`STAR_CELL_PADDING` 등을 `Stars.tsx`에서 export하고 `styles.row.gap`/`styles.starEditable.padding`이 그 상수를 참조.
  인수조건: 상수 값을 바꾸면 스타일과 매핑이 함께 바뀐다(하드코딩 중복 0).
  테스트: `Stars.spec.tsx` — `STAR_GAP === 2`, `STAR_CELL_PADDING === 2` 및 렌더된 row 스타일의 `gap`이 상수와 일치.

- [ ] **T2. `resolveRatingAtX` 순수 유틸 구현** — §3-3 알고리즘.
  인수조건: §3-3 검증 표 11행이 전부 일치하고, 반환값은 항상 0.5의 배수이며 `1 ≤ v ≤ 5`.
  테스트: `Stars.spec.tsx` > `describe('resolveRatingAtX')` — 표 전 항목 + 무작위 x 100개에 대한 불변식(0.5 배수·범위·단조 비감소).

- [ ] **T3. `resolveStarOriginX` 순수 유틸 구현.**
  인수조건: `size=32`에서 `{index:0,isRightHalf:false}→0`, `{0,true}→18`, `{1,false}→38`, `{1,true}→56`, `{4,true}→170`.
  테스트: `Stars.spec.tsx` > `describe('resolveStarOriginX')` — 위 5케이스 + `resolveRatingAtX(originX)`가 그 영역의 탭 값과 일치한다는 **교차 불변식**(탭↔드래그 동일 기준 증명).

- [ ] **T4. press-in 기준점 기록 배선** — 각 반쪽/별1 `Pressable`에 `onPressIn` 추가.
  인수조건: `onPressIn`만 발생하고 릴리스가 없으면 `onChange`는 호출되지 않는다(값 방출 없음).
  테스트: `fireEvent(el, 'pressIn', evt)` 후 `expect(onChange).not.toHaveBeenCalled()`.

- [ ] **T5. row `PanResponder` 배선 + 드래그 방출** — §3-4의 1~7 전부.
  인수조건: (a) 수평 드래그로 값이 0.5 단위로 갱신된다, (b) 같은 값이 연속되면 `onChange`가 중복 호출되지 않는다, (c) `editable=false`면 row에 responder 핸들러가 없다.
  테스트: §5-1의 D1~D5.

- [ ] **T6. 탭·접근성 무회귀 확인** — 기존 `Stars.spec.tsx` 12케이스 전부 유지(수정 금지, 추가만).
  인수조건: `npm test` 전체 green, `getAllByTestId(/^star-/)`는 여전히 정확히 5, 라벨 `별점 3.5점`/`별점 4점` 존재 및 `fireEvent.press` → `onChange` 호출.
  테스트: 기존 spec + AC8.

- [ ] **T7. 설계 문서 정정(문서 전용)** — `docs/design/architecture.md:85` `rating smallint -- 1~5` →
  `rating numeric(2,1) -- 1~5, 0.5 단위 (옵션)`.
  인수조건: DB 스키마(적용된 마이그레이션)와 문서 표기가 일치한다. **SQL 변경 없음.**
  테스트: 해당 없음(문서). qa-logic이 마이그레이션 파일과 대조 확인.

- [ ] **T8. 디바이스 스모크 체크리스트 작성 + 실행 요청** — dev-notes.md에 §5-2 목록을 그대로 남긴다.
  인수조건: 실기기에서 §5-2의 S1~S6를 사용자가 판정할 수 있는 형태로 문서화.
  테스트: 해당 없음(수동).

## 5-1. 테스트 케이스 (TDD)

> **테스트 경계 (docs/testing-strategy.md 준수)**
> - ✅ **단위 필수**: 순수 유틸 `resolveRatingAtX` / `resolveStarOriginX` — 매핑 정확도의 **1차 방어선**. 여기서 전부 고정한다.
> - ✅ **컴포넌트(모킹)**: `Stars`의 responder **배선**을 RNTL `fireEvent`로 검증(합성 이벤트). 아래 D1~D5.
> - ❌ **단위 대상 아님 → 디바이스 스모크**: 실제 터치 협상·관성·부드러움·`ScrollView` 네이티브 경합(§5-2).

### 유틸 (정상 · 경계 · 실패)

| ID | 케이스 | 기대 |
|----|--------|------|
| U1 | §3-3 검증 표 11행 | 표대로 |
| U2 | 경계: `x = pitch*k` (k=1..4) | `k + 0.5` (탭의 좌반 시작과 동일) |
| U3 | 경계: `x = index*pitch + cellWidth/2` | `index + 1` (우반 시작) |
| U4 | 경계: gap 구간 `x = index*pitch + cellWidth + 1` | `index + 1` (왼쪽 별 꽉) |
| U5 | 실패/방어: `x = -1000`, `x = 1e6` | 각각 1, 5 (예외 없이 클램프) |
| U6 | 불변식: 임의 x 100개 | `v*2`가 정수, `1 ≤ v ≤ 5`, x 증가 시 v 비감소 |
| U7 | size 독립성: `size=15`(기본)에서도 U1~U4의 상대 위치가 동일 | pitch=21 기준으로 동일 규칙 |
| U8 | 교차 불변식: 모든 (index, isRightHalf) 영역에 대해 `resolveRatingAtX({ x: resolveStarOriginX(...) + 1, size })`가 그 영역의 탭 방출값과 같다 | 탭↔드래그 기준 동일 |

### 컴포넌트 — 드래그 배선 (D)

합성 responder 이벤트를 쓴다(테스트 헬퍼를 spec 안에 둔다):
```ts
const responderEvent = ({ pageX, pageY = 0, locationX = 0 }) => ({
  nativeEvent: { pageX, pageY, locationX, touches: [], changedTouches: [] },
  touchHistory: { numberActiveTouches: 1, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: 0, touchBank: [] },
});
```

| ID | 케이스 | 기대 |
|----|--------|------|
| D1 | `editable`, size=32. 별1 좌영역에 `pressIn`(locationX 5, pageX 100) → row에 `responderMove`(pageX 176) | `onChange(2.5)` — 기준점 `x0 = originX 0 + locationX 5 = 5`, `dx = 76` → `x = 81` → `index = floor(81/38) = 2`, `within = 5 < 18` → `2 + 0.5` |
| D2 | 같은 드래그를 연속 2회(동일 위치) | `onChange` 총 1회(중복 방출 없음) |
| D3 | 드래그로 오른쪽 끝을 크게 넘김(pageX +1000) | `onChange(5)`, 예외 없음 |
| D4 | 드래그로 왼쪽 끝을 크게 넘김(pageX −1000) | `onChange(1)` (0/0.5 방출 금지) |
| D5 | `editable=false`에서 `stars-row`에 `responderMove` | 핸들러 부재 → `onChange` 미호출, 예외 없음 |
| D6 | 축 게이트: `onMoveShouldSetPanResponderCapture`에 `dx=2, dy=40` 이벤트 | `false` 반환(세로 스크롤 양보) |
| D7 | 축 게이트: `dx=30, dy=5` | `true` 반환(수평 드래그 탈취) |

> **폴백 규칙(중요):** D1~D5는 `PanResponder` 내부가 합성 이벤트를 요구해 취약할 수 있다.
> 합성 이벤트로 3회 이상 안정화에 실패하면 **D1~D5를 "핸들러 프리젠스 + 게이트(D6·D7) 검증"으로 축소**하고,
> 실제 값 갱신은 §5-2 디바이스 스모크로 이관한다(testing-strategy: "제스처는 단위 대상 아님" 허용 범위).
> **단, U1~U8(순수 유틸)은 어떤 경우에도 축소 금지** — 매핑 정확성의 유일한 자동 방어선이다.
> 축소 시 사유를 dev-notes.md에 기록한다.

### 회귀 (AC)

- **AC8**: 기존 `Stars.spec.tsx` 12케이스 전부 통과 + `getAllByTestId(/^star-/)`가 정확히 5개(신규 `stars-row` testID 미충돌).
- **AC9**: `npm test` 전체 green, `npx tsc --noEmit` 통과.
- **AC10**: `MuklogEditor` 소스 diff 0줄(별점 관련) — `Stars` props 계약 불변 증명.
- **AC11**: `supabase/migrations/` 신규 파일 0개, `supabase/functions/` 변경 0줄.

## 5-2. 디바이스 스모크 (수동 — 실기기, 사용자 판정)

| ID | 시나리오 | 통과 기준 |
|----|----------|-----------|
| S1 | 에디터에서 별 위를 좌→우로 천천히 쓸기 | 값이 0.5 단위로 끊김 없이 따라오고, 손가락 위치와 채워진 별 경계가 어긋나 보이지 않는다 |
| S2 | 우→좌로 쓸어 내리기 | 값이 감소하고 최소 1.0에서 멈춘다(0으로 안 떨어짐) |
| S3 | **별 위에서 세로로 스와이프** | 별점이 바뀌지 않고 **페이지가 스크롤된다** |
| S4 | 별 위에서 수평 드래그 시작 후 손가락을 위/아래로 꺾기 | 드래그가 유지되고(스크롤로 뺏기지 않음) 값이 계속 갱신된다 |
| S5 | 별을 짧게 탭 | 기존과 동일하게 해당 반쪽 값이 들어간다(드래그 오작동 없음) |
| S6 | 별 영역 밖(좌/우 여백)에서 시작해 별 위로 드래그 | 별점이 변하지 않는다(제스처는 별 위 press-in에서만 시작) |
| S7 | 빠르게 여러 번 왕복 | 값 튐·렌더 끊김 없음(방출 dedup 확인) |

## 6. 엣지케이스

**입력 경계**
- 좌측 오버런(x < 0) / 우측 오버런(x > 행 폭) → 1 / 5로 클램프, 예외 없음.
- 별과 별 사이 gap(2px)에 손가락이 있을 때 → 왼쪽 별을 꽉 채운 값(정의된 동작, U4).
- 별1 좌측 절반 → **0.5가 아니라 1.0**(데이터 계약 최소값. 선행 스프린트 결정 승계, 회귀 금지).
- 드래그로 미평가(0/null) 복귀는 불가 — 의도된 제약(Out-of-scope에 명시).

**제스처 충돌**
- 세로 `ScrollView` vs 수평 드래그: 캡처 게이트(`|dx| > 4 && |dx| > |dy|`)로 판정. 세로 우세면 스크롤 양보.
- 드래그를 잡은 뒤 `ScrollView`가 responder를 요구 → `onPanResponderTerminationRequest: () => false`로 거부.
- Android 네이티브 스크롤 → `onShouldBlockNativeResponder: () => true`.
- 키보드가 올라온 상태(메모 입력 후 별점 드래그): `keyboardShouldPersistTaps="handled"`와 무관하게 동작해야 함(S1 재확인).
- 멀티터치(두 손가락): ~~`PanResponder`는 마지막 터치 기준. 값이 튀어도 릴리스 시 마지막 값으로 확정 — 허용(스모크 관찰만).~~ **(구현에서 개선됨, qa-logic N1 확인 2026-08-12)** 캡처 게이트가 활성 터치 1개일 때만 통과하므로 **멀티터치로는 드래그가 시작되지 않는다**(값 튐 자체가 제거). 이미 시작된 드래그에 손가락이 추가되면 마지막 터치 기준·릴리스 시 마지막 값 확정 — 허용(스모크 관찰만, dev-notes §6).
- 드래그 도중 화면 전환/터미네이트 → `onPanResponderTerminate`에서 상태 정리, 마지막 방출값 유지.

**동시성(커플 2명)**
- 별점은 저장 전 로컬 상태이므로 드래그 자체에 동시성 이슈 없음. 저장 시 기존 먹로그 수정 경로(마지막 저장 우선)를 그대로 따르며 **이번 변경으로 달라지는 것 없음**.

**권한/네트워크**
- 네트워크 호출·권한 요청 없음. 오프라인에서도 드래그는 정상 동작하고, 저장 실패는 기존 에디터 에러 경로가 처리.

**접근성**
- 스크린리더 사용자는 드래그를 못 하므로 **탭 경로가 유일한 입력** → `onPress` 기반 확정을 반드시 유지(라벨/롤 변경 금지).
- `onPressIn`으로 값을 방출하면 스크린리더 활성화 흐름이 깨질 수 있으므로 **금지**(§3-4 1번).

**표시 전용 사용처**
- `editable`이 없는 3곳은 `panHandlers` 미스프레드 → 카드/상세/지도 카드의 터치 동작(카드 탭)이 별에 가로채이지 않아야 한다(AC/스모크로 확인).

## 7. QA 교차검증 경계면 (qa-logic이 양쪽을 같이 읽을 쌍)

| # | 생산자 | 소비자 | 확인 포인트 |
|---|--------|--------|-------------|
| 1 | `resolveRatingAtX`(유틸) | `onPanResponderMove`(컴포넌트) | 전달 x가 `dragStartX + dx`인지, size가 최신 props인지(`sizeRef`) |
| 2 | 탭 영역 분할(`editOverlay` flex 2분할 + 별1 단일) | `resolveStarOriginX` | 두 기준이 **동일 지오메트리 상수**를 참조하는지(하드코딩 중복 0) |
| 3 | `Stars.onChange` | `MuklogEditor.setRating` → `rating.toFixed(1)` 표시 | 항상 0.5 배수·1~5만 흘러가는지(NaN·0·5.5 유입 0) |
| 4 | `Stars.onChange` | `validate.ts`(rating 0.5 단위 검증) → DB 트리거 `RATING_OUT_OF_RANGE` | 드래그가 만들 수 있는 모든 값이 검증을 통과하는지(부동소수 오차로 3.4999가 새지 않는지) |
| 5 | row `panHandlers` | `MuklogEditor`의 `ScrollView` | 축 게이트·termination 거부가 세로 스크롤을 죽이지 않는지 |
| 6 | 신규 `testID="stars-row"` | 기존 `getAllByTestId(/^star-/)` 단언 | 개수 5 유지(정규식 충돌 없음) |
| 7 | `editable` 분기 | 표시 전용 3개 사용처 | responder 핸들러가 붙지 않는지(카드 탭 회귀 0) |
| 8 | `architecture.md:85` | `20260720120000_rating_half_step.sql` | 문서 표기와 실제 컬럼 타입 일치(T7) |

**qa-visual 범위**: 비주얼 변경 없음 확인만 — 별 크기/간격/색/반 별 렌더가 킷 `templates/muklog` 대비 이전과 동일한지(회귀 스캔). 신규 시안 대조 작업 없음.

## 8. 비용 가드레일 체크

- **Kakao 호출**: 없음 (디바운스/캐싱 해당 없음).
- **이미지/스토리지**: 없음.
- **Supabase 호출**: 없음 — 드래그는 로컬 상태만 변경. 저장은 기존 1회 mutation 경로 그대로. **호출량 증가 0.**
- **AWS**: 미사용(불변).
- **번들/빌드 비용**: **신규 의존성 0** → Dev Client 재빌드 불필요. RN 내장 `PanResponder`만 사용.
- **렌더 비용**: 드래그 중 `onChange`는 값이 바뀔 때만 방출(최대 9스텝) → 리렌더 폭주 없음.

## 9. 종료 기준

1. `npm test` 전체 green (U1~U8 + D 케이스(또는 축소 시 사유 기록) + 기존 12케이스).
2. `npx tsc --noEmit` 통과.
3. `qa-report-logic.md` 통과 (§7 경계면 8쌍 전부 확인).
4. `qa-report-visual.md` 통과 ("비주얼 불변" 회귀 확인).
5. 디바이스 스모크 §5-2 S1~S7은 **사용자 판정** — dev-notes.md에 체크리스트로 남긴다.
6. DB 반영·git 작업은 이번 스프린트에 없음(마이그레이션 0). git은 사용자 전담.
