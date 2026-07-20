# ui-spec — half-star-rating (Stars 0.5 단위)

> 담당: ui-publisher. 디자인 단일 출처: 킷 `.claude/skills/ui-design/templates/muklog/mk-ui.jsx` Stars(라인 31~47).
> 대상 파일: `src/components/Stars/Stars.tsx` (+ `Stars.spec.tsx`). 소비처 파일은 미수정(비주얼 껍데기만 담당).

## 1. 킷 근거 ↔ RN 매핑

| 킷(mk-ui.jsx Stars) | 라인 | RN(Stars.tsx) |
|---|---|---|
| `[1,2,3,4,5].map((n) => ...)` 별 5개 | 35 | `STAR_POSITIONS = [1,2,3,4,5]` map |
| 채움 판정 `n <= value` | 41 | `resolveState({position})`: `position <= filled` ⇒ Filled |
| 채운 별 `star-fill` + `#FFB23E` | 41–42 | `Icon StarFill` + `color="starFill"`(토큰=#FFB23E) |
| 빈 별 `star` + `var(--line-strong)` | 41–42 | `Icon Star` + `color="lineStrong"`(토큰=rgba(112,115,124,0.52)) |
| gap 2, alignItems center | 34 | `styles.row { flexDirection:'row', alignItems:'center', gap:2 }` |
| editable 시 `padding:2` 탭영역 | 39 | `styles.starEditable { padding:2 }` |
| `size` 기본 15 | 32 | `size = 15` |

토큰 변경/추가: **없음**(`starFill`·`lineStrong` 기존 토큰 그대로 사용, raw hex 0).

## 2. 반 별 근사 방식 · 사유

**킷 제약:** 킷 Stars는 이진 채움(`n <= value ? "star-fill" : "star"`)만 지원 — 반 별 글리프/패턴이 킷에 없음.

**근사(오케스트레이터 §RN 근사 허용):** 반 별 위치는 **빈 별(`star`, lineStrong) 위에 좌측 절반만 클리핑한 채운 별(`star-fill`, starFill)을 절대배치로 오버레이**해 근사.
- 구현: `View {width:size,height:size}` 안에 빈 별 Icon + `View {position:'absolute',left:0,top:0,width:size/2,height:size,overflow:'hidden'}` 안에 채운 별 Icon.
- RN에는 웹 `clip-path`/SVG 부분 채움이 없어, `overflow:'hidden'` 컨테이너 폭을 `size/2`로 잡아 좌측 절반만 노출하는 방식이 가장 단순·안정적. size(13/14/15/32) 무관하게 `size/2`로 스케일 → 소비처 4곳 모두 깨지지 않음.
- 판정 규칙: `position - 0.5 <= filled < position` ⇒ Half. 정수 value는 Half가 절대 발생하지 않아 기존 정수 표시와 픽셀 동일(회귀 0).

## 3. 입력(editable) — 좌/우 반 탭

**별2~5**: 각 별 위에 `StyleSheet.absoluteFillObject + flexDirection:'row'` 오버레이를 깔고 `flex:1` Pressable 2개(좌/우)로 분할.
- 좌측 반 탭 → `onChange(max(1, position - 0.5))`, 접근성 라벨 `별점 {leftValue}점`(예: 별4 좌측 = `별점 3.5점`).
- 우측 반 탭 → `onChange(position)`, 라벨 `별점 {position}점`(예: `별점 4점`).

**별1(특례)**: 클램프로 좌/우 방출값이 둘 다 1이므로 **반 분할 없이 단일 풀사이즈 Pressable**(라벨 `별점 1점`, `onChange(1)`)로 렌더. 동일 라벨 인접 버튼 2개(접근성 결함 + `getByLabelText` 다중매칭)를 방지 — MuklogEditor.spec `getByLabelText('별점 1점')` 회귀 해소.

- 기존 `onChange(number)` 시그니처 유지 — MuklogEditor `onChange={setRating}` 배선 변경 불필요.

## 4. props 계약 (developer용)

```ts
type StarsProps = {
  value?: number | null;   // 별점(1~5, 0.5 단위 소수 허용, 예 3.5). 0/null/undefined = 미평가(모두 빈 별)
  size?: number;           // 별 한 변 px, 기본 15
  editable?: boolean;      // true면 좌/우 반 탭 입력
  onChange?: (value: number) => void; // 좌측 반→position-0.5, 우측 반→position
};
```

**소비처 4곳(미수정, 자동 호환):**
| 파일 | 사용 | size |
|---|---|---|
| `SelectedSpotCard.tsx:75` | `<Stars value={rating} size={13} />` | 13 |
| `MuklogCard.tsx:124` | `<Stars value={muklog.rating} size={14} />` | 14 |
| `MuklogDetailScreen.tsx:387` | `<Stars value={muklog.rating} size={STARS_SIZE} />` | (STARS_SIZE) |
| `MuklogEditor.tsx:564` | `<Stars value={rating} size={32} editable onChange={setRating} />` | 32 |

`value`가 이제 0.5 단위 소수(3.5 등)를 받아도 표시·입력 모두 정상. developer는 별도 배선 변경 없이 `rating`이 numeric(2,1)로 오면 그대로 전달.

## 5. 결정: 별1 좌측 탭 클램프 (리더 결정, 반영 완료)

- **Stars 입력 단에서 클램프**: 좌측 반 탭 방출값을 `Math.max(1, position - 0.5)`로 처리 → 별1 좌측 탭은 0.5가 아니라 **1**을 방출(별1은 좌/우 모두 1). 접근성 라벨도 방출값과 일치.
- **사유**: 데이터 계약 최소 1.0(0.5는 `RATING_OUT_OF_RANGE` 거부)을 위반하는 값을 프레젠테이션이 방출하면 전 소비처(MuklogEditor 등)가 각자 방어해야 하는 footgun이 됨. 계약 위반값을 컴포넌트 경계에서 차단하는 편이 안전. 별2~5의 좌측(1.5·2.5·3.5·4.5)은 계약 유효값이라 그대로 방출.
- **별1 렌더 특례(§3)**: 좌/우 방출값이 동일(1)해 반 분할하면 `별점 1점` 라벨 버튼 2개가 인접 → 접근성 결함 + `getByLabelText` 다중매칭(MuklogEditor.spec 회귀). 따라서 별1은 **단일 풀사이즈 Pressable**로 렌더(`leftValue === position` 분기). 별2~5는 좌/우 분할 유지.
- 반영: `Stars.tsx` `leftValue = Math.max(1, position - 0.5)` + `if (leftValue === position)` 단일 Pressable 분기. 테스트 `Stars.spec.tsx`에 "별1 단일 탭 영역(라벨 유일) → onChange(1)·not onChange(0.5)" 케이스.

## 6. 검증 결과

- `npx jest src/components/Stars` → 11 passed(AC2 표시 3.5=꽉3+반1+빈1, 정수 회귀, 반 별 오버레이, AC3 좌/우 탭 onChange 3.5/4, 기존 8건 회귀 0).
- `npx tsc --noEmit` → 통과(에러 0).
