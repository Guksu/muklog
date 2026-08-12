# QA 리포트 — 비주얼 (sprint-20260812-rating-drag)

**검증자:** qa-visual · **일자:** 2026-08-12 · **판정: 통과 (비주얼 회귀 0)**

**임무의 성격:** 이 스프린트는 `plan.md:173-175`에서 **퍼블리싱 범위 없음(비주얼 불변)** 으로 기획됐고 `ui-spec.md`가 없다.
따라서 통상의 "킷 신규 시안 ↔ RN 대조"가 아니라 **"렌더 픽셀이 정말 변하지 않았는가"** 회귀 확인이 검증 대상이다.
비교 기준선은 `git HEAD`(6fefee6)의 `Stars.tsx`이며, 정답지는 킷 `.claude/skills/ui-design/templates/muklog/mk-ui.jsx:32`(`Stars`)와 그 호출부 4곳이다.

**검증 범위:** `src/components/Stars/Stars.tsx`(유일한 비주얼 관련 변경 파일) + 사용처 4곳 + 킷 대조.
`git status` 기준 `src/` 변경은 `Stars.tsx`·`Stars.spec.tsx` **2개뿐**이며, 사용처 4개 파일은 **모두 무변경**이다.

---

## 1. 통과

### 1-1. 지오메트리 상수 도입 — 리터럴 값 완전 동일 (회귀 0)

`styles`의 리터럴이 상수 참조로 바뀌었으나 **값이 1:1로 같다**. 렌더 결과에 차이가 없다.

| 스타일 | HEAD (이전) | 현재 | 상수 정의 | 판정 |
|---|---|---|---|---|
| `styles.row.gap` | `2` | `STAR_GAP` | `Stars.tsx:29` = `2` | 동일 |
| `styles.starEditable.padding` | `2` | `STAR_CELL_PADDING` | `Stars.tsx:31` = `2` | 동일 |
| `halfClip` / `editOverlay` / `editHalf` | 변경 없음 | 변경 없음 | — | 동일 |

- 나머지 지오메트리 상수(`STAR_COUNT`·`RATING_MIN/MAX/STEP`·`DRAG_ACTIVATE_DX`)는 **좌표→별점 매핑 전용**이며 어떤 `style`에도 들어가지 않는다(`Stars.tsx:27-37`). 렌더 무영향.
- `resolveCellWidth`/`resolvePitch`/`resolveRatingAtX`/`resolveStarOriginX`는 순수 계산 함수로 JSX를 만들지 않는다.
- **실측 확인:** `Stars.spec.tsx:123-132`가 렌더된 `stars-row`의 `gap`과 editable 셀의 `padding`이 각각 상수(=2)와 일치함을 단언하며, 59/59 통과(`npx jest src/components/Stars`).

### 1-2. 킷 대조 — 크기·색·간격·반 별 렌더 모두 이전과 동일

킷 `mk-ui.jsx:32-47`(`Stars`)과 현재 RN을 같이 열어 대조:

| 축 | 킷 | RN 현재 | 판정 |
|---|---|---|---|
| 기본 크기 | `size = 15` (mk-ui:32) | `size = 15` (Stars.tsx:97) | 일치 |
| 채움색 | `#FFB23E` (mk-ui:42) | `color="starFill"` → `tokens.ts:36` `#FFB23E` | 일치(토큰 경유) |
| 빈 별색 | `var(--line-strong)` (mk-ui:42) | `color="lineStrong"` → `tokens.ts:52` `rgba(112,115,124,0.52)` = 킷 `tokens/figma-variables.css:261` | 일치(토큰 경유) |
| 셀 padding | `editable ? 2 : 0` (mk-ui:39) | editable만 `styles.starEditable` padding 2, 표시 전용은 무스타일 `View`(Stars.tsx:197) | 일치 |
| 별 5개·순서 | `[1,2,3,4,5]` (mk-ui:35) | `STAR_POSITIONS` (Stars.tsx:23) | 일치 |
| 반 별 | 킷은 이진 채움(반 별 없음) | 빈 별 위 좌측 절반 클리핑 오버레이(Stars.tsx:164-172) | **근사 허용**(§3) — 이번 스프린트 무변경 |

사용처별 `size` prop도 킷 호출부와 일치하며 이번 스프린트에 손대지 않았다:

| 화면 | 킷 | RN | 판정 |
|---|---|---|---|
| 지도 선택 스팟 카드 | `size={13}` (mk-home.jsx:382) | `SelectedSpotCard.tsx:75` `size={13}` | 일치·무변경 |
| 먹로그 카드 | `size={14}` (mk-log.jsx:199) | `MuklogCard.tsx:124` `size={14}` | 일치·무변경 |
| 먹로그 상세 | `size={18}` (mk-log.jsx:258) | `MuklogDetailScreen.tsx:93` `STARS_SIZE = 18` → :387 | 일치·무변경 |
| 에디터(편집) | `size={32} editable` (mk-log.jsx:445) | `MuklogEditor.tsx:564` `size={32} editable` | 크기·editable 일치 (간격은 §4-1 이월 관찰) |

### 1-3. 사용처 전수 — props·스타일 전달 무변경

`grep -rn "<Stars" src/` 결과 **편집 1곳 + 표시 전용 3곳**으로 계획과 일치하며, 4개 파일 모두 `git status`상 미변경이다.
`Stars`는 어떤 사용처에도 `style` prop을 받지 않으므로(`StarsProps`에 `style` 없음, Stars.tsx:86-95) 외부 스타일 주입 경로 자체가 없다.
에디터 컨테이너 `ratingRow`(`MuklogEditor.tsx:640` `gap: 12`)도 무변경 — 킷 `mk-log.jsx:444`의 `gap: 12`와 계속 일치.

**실측:** 사용처 4곳을 포함한 12개 스위트 109 테스트 통과(`npx jest src/features/muklog/MuklogCard src/features/map/components src/features/muklog/MuklogEditor`). 렌더 트리 회귀 없음.

### 1-4. 드래그가 비주얼 요소를 추가하지 않음 (plan 요구사항)

계획상 드래그는 **하이라이트·크기 변화 등 어떤 시각 요소도 추가하면 안 된다.** 코드 전수 확인 결과 위반 없음:

- `panResponder.panHandlers`는 이벤트 핸들러 prop만 스프레드한다(`Stars.tsx:189`). `style`·`transform`·`opacity` 관여 0.
- 추가된 `onPressIn`(`:213`, `:228`, `:235`)은 `recordDragStart`로 **ref에 좌표만 기록**하고 상태를 바꾸지 않는다 → 리렌더·시각 변화 없음.
- `Pressable`의 `style`은 정적 객체(`styles.starEditable`/`styles.editHalf`)이며 **함수형 style(pressed 분기)이 아니다.** RN `Pressable`은 `TouchableOpacity`와 달리 기본 눌림 투명도가 없고, `android_ripple` 미지정이라 Android 리플도 없다.
- `styles`에 신규 항목 추가 0(diff 확인). 하이라이트·그림자·elevation 도입 없음.
- 드래그로 바뀌는 유일한 화면 요소는 기존 배선을 그대로 타는 별 채움 상태와 에디터 보조 텍스트(`rating.toFixed(1)`)뿐 — `plan.md:176-178`이 명시한 의도된 동작.

### 1-5. `testID="stars-row"` 무해 확인

- `testID`는 RN에서 접근성/테스트 식별자로만 쓰이고 **레이아웃·페인트에 영향이 없다**(`Stars.tsx:187`).
- 기존 `getAllByTestId(/^star-/)`(정확히 5개) 셀렉터와 충돌하지 않는다 — `stars-row`는 `star-` 접두사와 불일치(`stars-` ≠ `star-`). `star-` testID를 조회하는 스펙 4곳(`WishSpotCard`·`SelectedSpotCard`·`NearbySpotCard`·`MuklogCard`) 전부 통과.
- 별 셀의 기존 `testID={`star-${state}`}` 값·부여 위치는 무변경.

### 1-6. 토큰 정합

- `Stars.tsx` raw hex/rgb **0건** — 유일한 `#FFB23E` 출현은 3행 주석(킷 출처 표기)이고 코드가 아니다. 색은 전부 `color="starFill"`/`color="lineStrong"` 토큰 경유.
- 이번 변경으로 추가된 신규 색·radius·그림자 **없음**. 헤어라인 보더 규칙 위반 없음(`elevation`/`shadow*` 미사용).
- 스페이싱: 새 상수(2px)는 킷 `mk-ui.jsx:32,39`의 `gap`·`padding` 실값을 그대로 옮긴 것이라 4px 그리드 예외가 아니라 **킷 실값 준수**다(킷이 우선).

---

## 2. 불일치

**없음.** 이번 스프린트 변경으로 발생한 킷↔RN 비주얼 불일치 0건.

---

## 3. 근사 허용

| 항목 | 내용 | 사유 |
|---|---|---|
| 반 별 렌더 | 킷 `Stars`는 이진 채움(`n <= value`)만 지원(mk-ui.jsx:41) → RN은 빈 별 위에 좌측 절반 클리핑한 채운 별을 겹쳐 근사(Stars.tsx:164-172) | 0.5 단위 별점 도입 스프린트에서 승인된 기존 근사(`Stars.tsx:5-6` 주석에 사유 기록). **이번 스프린트 무변경** |

---

## 4. 이월 관찰 (이번 스프린트 원인 아님 — 별건 처리 권고)

### 4-1. 에디터 별 간격: 킷 `gap=4` ↔ RN `gap=2`

- **킷:** `mk-log.jsx:445` — `<ST2 value={rating} size={32} gap={4} editable onChange={setRating} />` (에디터에서만 `gap`을 기본 2에서 **4로 오버라이드**)
- **RN:** `Stars`에 `gap` prop이 없어 모든 사용처가 `STAR_GAP = 2` 고정(`Stars.tsx:29`, `:248`) → 에디터 별 사이가 킷보다 **간격당 2px 좁다**(5별 전체 폭 188 vs 킷 196).
- **표시 전용 3곳은 킷도 기본 `gap=2`라 일치** — 불일치는 에디터 1곳 한정.
- **회귀 아님:** HEAD 시점에도 `gap: 2` 하드코딩이었고 이번 변경은 같은 값을 상수로 옮겼을 뿐이다. 과거 ui-spec/QA 문서 어디에도 이 `gap={4}`가 "근사+사유"로 기록돼 있지 않아(검색 결과 0건) **미포착 상태로 이월된 기존 불일치**로 판단한다.
- **수정 시 주의(중요):** 이번 스프린트로 `STAR_GAP`이 **스타일과 드래그 좌표 매핑의 공통 단일 출처**가 됐다(`resolveRatingAtX`가 pitch 계산에 사용). 따라서
  - `STAR_GAP`을 4로 바꾸면 **표시 전용 3곳까지 킷과 어긋난다**(킷 기본은 2) → 금지.
  - 올바른 수정은 `gap` prop을 추가하고 **`resolveRatingAtX`/`resolveStarOriginX`에도 같은 `gap`을 인자로 넘기는 것**이다. `style`만 바꾸고 매핑을 두면 드래그 값이 렌더 위치와 어긋나 이번 기능이 깨진다.
  - 별건 스프린트에서 `ui-publisher`(스타일) + `developer`(매핑 인자화)가 함께 처리할 사안이라, 비주얼 불변이 요구된 이번 스프린트에서는 수정하지 않는 것이 맞다.

---

## 5. 미검증

| 항목 | 사유 |
|---|---|
| 실기기/시뮬레이터 렌더 픽셀 대조 | 이번 변경은 스타일 리터럴이 값 동일한 상수 참조로 바뀐 것뿐이라 렌더 산출물이 정의상 동일하고, RNTL 실측(`gap`·`padding` 단언)으로 대체 검증했다. 디바이스 스모크가 필요한 신규 레이아웃 요소는 추가되지 않았다. 단, **드래그 조작감**(임계·ScrollView 양보)은 성격상 디바이스 확인 대상이며 이는 qa-logic/디바이스 스모크 범위다 |

---

## 6. 결론

**비주얼 완료 — 통과.** `plan.md`가 선언한 "퍼블리싱 범위 없음(비주얼 불변)"이 실제로 지켜졌다.
스타일 변경은 `gap: 2 → STAR_GAP(=2)`, `padding: 2 → STAR_CELL_PADDING(=2)` 두 건이며 **값이 동일해 렌더 픽셀 변화가 없고**, 드래그 인터랙션은 어떤 시각 요소도 추가하지 않았으며, `testID` 추가는 렌더 무영향이다. 킷 `templates/muklog` 대비 크기·색(#FFB23E/line-strong)·간격·반 별 렌더가 이전과 동일하게 유지된다.
`ui-publisher`에게 라우팅할 **이번 스프린트발 수정 요청 없음**. §4-1(에디터 `gap=4`)은 이번 스프린트 이전부터 존재한 별건으로, 수정 시 드래그 매핑 동반 변경이 필요함을 함께 남긴다.
