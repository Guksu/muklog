# qa-report-visual — memo-max-height

**대상 스프린트:** `sprint-20260812-memo-max-height`
**검증자:** qa-visual · **일자:** 2026-08-12
**특이사항:** 이 스프린트는 **ui-spec.md가 없다**(plan §5-1 판정: 신규 비주얼 패턴 0, 킷 실수치 그대로 → developer 단독). 따라서 검증 출발점을 ui-spec 매핑 대신 **킷 `lk.textarea` 원문 ↔ RN 스타일 체인 직접 대조**로 잡았다.

**판정: 비주얼 통과 (조건부)** — 이번 스프린트가 번역한 수치는 **킷과 100% 일치**하고 메모 외 요소는 **렌더 대조로 픽셀 불변 입증**. 다만 아래 §4 디바이스 스모크 3건이 미검증이라 "비주얼 완료"는 스모크 후 확정한다.

---

## 0. 검증 방법

| 축 | 방법 |
|----|------|
| 킷 대조 | 킷 `mk-log.jsx:452`(`rows={4}`) · `:644-645`(`lk.textarea`) ↔ `MuklogEditor.tsx` 메모 `TextInput` 스타일 체인 4겹 + `tokens.ts:239` 동시 열람 |
| 높이 등가 | 킷 CSS box model(border-box) 총높이 ↔ RN `memoBoxHeight` 산출값 수식 대조 |
| 회귀 | `git show HEAD:...MuklogEditor.tsx` 복원본과 현재본을 **같은 props로 나란히 렌더** → 트리 전 노드를 `StyleSheet.flatten` 직렬화해 diff (작성·편집 2모드) |
| 토큰 | `makeTypography` 패턴 일관성 · raw hex/리터럴 이중화 grep |

---

## 1. 통과 ✅

### 1-1. 킷 수치 번역 — 전 항목 일치

킷 `lk.textarea`(`mk-log.jsx:644-645`) + `rows={4}`(`:452`) ↔ RN:

| 킷 값 | 킷 위치 | RN 값 | RN 위치 | 판정 |
|-------|---------|-------|---------|------|
| `font: "500 15px/1.6"` | `mk-log.jsx:645` | `fontSize 15 / lineHeight 24 / SUIT-Medium` | `tokens.ts:239` `typography.memoInput` | ✅ `Math.round(15×1.6)=24` 정확. weight 500→Medium은 `tokens.ts:223` 매핑 규약 준수 |
| `rows={4}` | `mk-log.jsx:452` | `MEMO_INPUT_LINES = 4` | `memoBoxHeight.ts:8` | ✅ |
| `resize: "none"` | `mk-log.jsx:645` | `minHeight === maxHeight` | `MuklogEditor.tsx:392-393` | ✅ 고정 박스 = 킷 "늘어나지 않음"의 정확한 RN 번역 |
| `padding: "14px 16px"` | `mk-log.jsx:644` | `paddingVertical 14 / paddingHorizontal 16` (`spacing[14]`·`spacing[16]`) | `MuklogEditor.tsx:401-402` | ✅ 4px 그리드 토큰 경유 |
| `color: var(--mk-ink)` | `mk-log.jsx:645` | `theme.color.fg` → `#2A2422` | `MuklogEditor.tsx:396` | ✅ 킷 `index.html:24 --mk-ink: #2A2422`와 실값 동일 |
| `background: var(--mk-card)` | `mk-log.jsx:645` | `theme.color.surface` → `#FFFFFF` | `MuklogEditor.tsx:397` | ✅ 킷 `index.html:23 --mk-card: #FFFFFF` 동일 |
| `border: ... var(--line)` (색) | `mk-log.jsx:644` | `theme.color.hairline` → `rgba(112,115,124,0.22)` | `MuklogEditor.tsx:398` | ✅ 킷 `tokens/aliases.css:40 --line → --line-normal-normal` = `rgba(112,115,124,0.22)` 실값 동일 (**폭은 §2-1 참조**) |
| placeholder 문구 | `mk-log.jsx:453` | `"무엇을 먹었고 어땠는지 그날의 기록을 남겨보세요"` | `MuklogEditor.tsx:596` | ✅ 한 글자까지 동일 |

### 1-2. 고정 4줄 높이가 킷 `rows=4` 렌더와 등가인가 — ✅ 수식 일치

킷(브라우저, `box-sizing: border-box`)의 textarea 총높이:
```
content 24×4 = 96  +  padding 14×2 = 28  +  border 1.5×2 = 3   →  127px
```
RN `memoBoxHeight`(`memoBoxHeight.ts:28`) = `lineHeight×lines + paddingVertical×2 + borderWidth×2`:
```
96 + 28 + hairline×2  →  @2x 125 / @3x 124.67 / Android(1) 126
```
**수식 구조는 킷과 완전히 동일하고, 항끼리도 일치한다.** 총합 2.0~2.3px 차이는 **전부 border 폭(1.5 vs hairline) 한 항에서만** 나오며, 이는 §2-1의 **기존 이슈**(이번 스프린트가 만든 것 아님)다. border를 킷대로 1.5로 고치면 산출값은 정확히 **127**이 되어 킷과 픽셀 일치한다 — 즉 **공식은 이미 옳고, 남은 것은 border 항의 입력값뿐**이다.

`96`(구 `minHeight`)은 padding 제외 시 content 68px ≈ 2.8줄이었으므로, 이번 변경은 킷 근거 없는 임의값을 킷 계약으로 되돌린 **정정**이다.

### 1-3. 비주얼 개선(부수 효과) — 메모 입력 타이포가 처음으로 킷 정합됨

렌더 대조에서 확인: **변경 전 메모 `TextInput`에는 `fontSize`/`lineHeight`/`fontFamily`가 하나도 없었다**(스타일 체인 `styles.input`+`styles.memo`+`fieldInput` 어디에도 없음) → 플랫폼 기본 폰트로 렌더 중이었다. 이번에 `memoInput` 토큰이 적용되며 **메모 입력이 킷 `500 15px/1.6`으로 처음 정합**됐다. 높이 계약의 전제였지만 결과적으로 **독립적인 비주얼 충실도 개선**이다.

### 1-4. 회귀 — 메모 외 전 요소 픽셀 불변 ✅ (렌더 대조로 입증)

`git show HEAD:src/features/muklog/MuklogEditor/MuklogEditor.tsx` 복원본과 현재본을 동일 props로 나란히 렌더 → 트리 전 노드를 `[경로|타입|flatten style|props]`로 직렬화해 비교.

| 모드 | 노드 수 | 차이 노드 |
|------|---------|-----------|
| 작성(빈 폼) | 동일 | **1개 — 메모 TextInput뿐** (index 70) |
| 편집(초기값·사진 1장) | 동일 | **1개 — 메모 TextInput뿐** (index 74) |

즉 **장소 검색 버튼·카테고리 칩 8종·별점 행·사진 그리드·방문일 행·SubBar/저장 액션·메모 힌트가 모두 바이트 단위로 불변**이다. 유일한 차이 노드의 before/after:
```
before: borderWidth 0.5, minHeight 96, textAlignVertical top, color #2A2422, bg #FFFFFF,
        borderColor rgba(112,115,124,0.22), borderRadius 14, padding 16/14   · numberOfLines=4
after : (동일) + fontSize 15, lineHeight 24, fontFamily SUIT-Medium, minHeight 125, maxHeight 125
        · numberOfLines 제거
```
변경이 정확히 의도한 4개 축(타이포 3 + 높이 2)에만 국한됐고 부수 변경 0.
**임시 파일(`__qaBefore.tsx`·`__qaVisualRegression.spec.tsx`·스크래치패드 사본) 삭제 완료 — `git status` 잔재 0 확인.**

### 1-5. 토큰 체계 일관성 ✅

- `memoInput`은 `makeTypography({ size, ratio, family })` 패턴을 그대로 사용(`tokens.ts:239`) — 주변 27개 역할 토큰과 형태·주석 규약(킷 라인 근거 표기) 동일.
- **raw hex 0건** — `MuklogEditor.tsx`·`memoBoxHeight.ts` grep 결과 hex 리터럴 없음.
- **수치 이중화 0건** — 화면은 `memoBoxHeight(...)`를 실제 호출하고 `125`를 하드코딩하지 않는다(`MuklogEditor.tsx:386-394`). 테스트도 토큰에서 기대값을 재계산한다(`MuklogEditor.spec.tsx` S1).
- `memoBody`(lh 26, 상세 표시) ↔ `memoInput`(lh 24, 입력)의 분리가 킷 근거(`mk-log:177` 1.7 vs `:645` 1.6)와 일치하고, `tokens.spec.ts` U7이 `memoBody` 불변을 고정한다.
- 검증 중 실행한 테스트: `MuklogEditor`·`memoBoxHeight`·`tokens` 3 스위트 **132 tests green**.

---

## 2. 불일치 (킷↔RN) — 모두 **기존 이슈**, 이번 스프린트 유발 0

### 2-1. 메모 입력 보더 폭·라운드가 킷과 다름 (기존, plan §3 범위 밖)

| 항목 | 킷 | RN | 차이 |
|------|-----|-----|------|
| border 폭 | `1.5px` — `mk-log.jsx:644` | `StyleSheet.hairlineWidth`(0.33~1) — `MuklogEditor.tsx:652` `styles.input` | 1.0~1.17px/변 |
| radius | `16` — `mk-log.jsx:644` | `theme.radius.control` = **14** — `MuklogEditor.tsx:400` | 2px |

**이번 스프린트 유발 아님**(렌더 대조에서 before/after 동일: `borderWidth 0.5`·`borderRadius 14`). plan §3·dev-notes §범위밖에 "전 입력 공통 이슈 → 별도 퍼블리싱 스프린트"로 이미 기록돼 있어 **기록·라우팅만** 한다.

다만 **동일 폼 안에서 시각적으로 드러나는 조합**이라 우선순위를 낮게 보지 않길 권한다: 바로 아래 "방문일" 행(`MuklogEditor.tsx:670-678` `styles.dateRow`)과 장소 검색 버튼(`:658` `styles.searchBtn`)은 **킷대로 `borderWidth: 1.5` + `borderRadius: 16`을 리터럴로 갖고 있다.** 즉 세로로 인접한 세 컨트롤 중 **메모 박스만 테두리가 얇고 덜 둥글다**. 수정 시 §1-2대로 높이도 127로 킷 일치하게 되므로, **`fieldInput.borderRadius: 16` + `styles.input.borderWidth: 1.5`** 로 맞추는 것이 두 이슈를 한 번에 해소한다(→ **ui-publisher**).

### 2-2. 폴백 장소명 입력만 타이포 토큰 부재 (기존이나 **비대칭이 새로 생김**)

`MuklogEditor.tsx:514-523`의 폴백 장소명 `TextInput`(placeSearch 미주입 방어 경로)은 여전히 `style={[styles.input, fieldInput]}` — **타이포 토큰이 없어 플랫폼 기본 폰트로 렌더**된다. 킷은 이 입력도 `500 15px`다.

변경 전에는 메모·장소 입력이 **둘 다** 기본 폰트라 서로 일관됐지만, 이번에 메모만 킷 정합되면서 **폴백 경로가 홀로 어긋난 상태**가 됐다. plan §3이 "메모 외 입력 타이포 정합"을 명시적으로 범위 밖으로 뒀으므로 **결함이 아닌 이월 항목**으로 기록한다 — §2-1과 같은 퍼블리싱 스프린트에서 `theme.typography.memoInput`(또는 동등 입력 토큰) 적용 권장(→ **ui-publisher**).

### 2-3. [저위험·내구성] 높이 인자가 실제 적용값을 **참조**하지 않고 **복제**한다

`MuklogEditor.tsx:385` 주석은 인자가 "스타일에 실제 적용되는 값과 같은 출처"라고 하지만, 실제로는 같은 **토큰을 각각 따로 적어 넣은 복제**다:

- `memoBoxHeight({ paddingVertical: theme.spacing[14] })`(`:390`) ↔ 적용값 `fieldInput.paddingVertical: theme.spacing[14]`(`:402`)
- `memoBoxHeight({ borderWidth: StyleSheet.hairlineWidth })`(`:391`) ↔ 적용값 `styles.input.borderWidth: StyleSheet.hairlineWidth`(`:652`)

따라서 **§2-1을 고쳐 `styles.input.borderWidth`를 1.5로 바꾸면, 높이 인자는 hairline인 채로 남아 박스가 킷보다 2px 짧아진다 — 테스트도 같은 복제를 공유하므로(`MuklogEditor.spec.tsx` S1의 `expectedHeight`) green을 유지한 채 조용히 어긋난다.** 이번 스프린트에서는 두 값이 실제로 같아 **현재 결함은 없다**.

권장(→ **ui-publisher**, §2-1 수정 시 동반): `fieldInput` 정의를 `memoBoxSize` 위로 올리고 인자를 `paddingVertical: fieldInput.paddingVertical`, `borderWidth: StyleSheet.flatten(styles.input).borderWidth`로 바꿔 **참조**로 만들면 보더 수정이 높이에 자동 전파된다.

---

## 3. 근사 허용 ✅

| 항목 | 킷 | RN | 사유 |
|------|-----|-----|------|
| hairline 폭의 플랫폼 변주 | 고정 `1.5px` | `hairlineWidth` = @2x 0.5 / @3x 0.33 / Android 1 | RN은 물리 1px을 픽셀비로 환산한다. 높이 계약이 **상수 125가 아니라 수식**이라 변주를 흡수하고(`memoBoxHeight.spec.ts` U2가 Android 126을 고정) 4줄 표시에는 영향 없음 |
| placeholder 색 | 킷 미지정(브라우저 기본) | `theme.color.fgMuted` = `#9B9B9B` | 킷 `lk.textarea`에 placeholder 색 규칙이 **없어** 대조 기준 자체가 없다. 기존 토큰 유지·이번 변경 없음(렌더 대조 확인) → 통과 |
| 내부 스크롤 표현 | textarea 네이티브 스크롤바 | RN `TextInput` 기본 `scrollEnabled` | 플랫폼 네이티브 표현 차이(RN에 CSS 스크롤바 없음). 킷 의도(초과분을 박스 안에서 소비)는 동일 |

---

## 4. 미검증 — 디바이스 스모크 필요 ⚠️ (통과 처리 아님)

RNTL은 **레이아웃을 계산하지 않는다**(flatten 스타일만 검증). "4줄이 실제로 온전히 보이는가"는 정적으로 확정할 수 없다. 메모리 *qa-layout-blind-spot*(캘린더 토요일 열 wrap 선례)이 정확히 이 사각지대다.

1. **[iOS] 4번째 줄 클리핑** — multiline `TextInput`에 명시 `lineHeight`를 주면 iOS는 `NSParagraphStyle`의 min/maxLineHeight로 적용하며 첫 줄 ascent 처리에서 수 px가 더 먹힐 수 있다. 정확히 4줄 입력 시 4번째 줄 받침·디센더가 잘리는지 확인 필요.
2. **[Android] `includeFontPadding` 미해제** — 메모 `TextInput`에 `includeFontPadding: false`가 **없다**. Android는 기본 true라 텍스트 블록 상·하에 폰트 패딩이 추가되어, content 96px 고정 박스에서 4번째 줄이 밀려 나갈 수 있다. **이 코드베이스는 같은 증상을 이미 겪어 `includeFontPadding: false`로 해결한 선례가 둘 있다**(`MuklogDetailScreen.tsx:620` `ratingText`, `AppMark.tsx:117`) — 고정 높이 박스는 정확히 그 패턴이 필요한 자리다. 스모크에서 클리핑이 보이면 **추측 수정 말고 관측 후** 동일 패턴 적용 권장.
3. **[iOS·Android] 내부 스크롤 제스처** — 고정 박스 안을 드래그할 때 `TextInput` 내부가 스크롤되는지, 부모 `ScrollView`(`styles.scroll`)가 가로채는지. 가로채면 "초과분을 내부 스크롤로 흡수"라는 킷 등가가 사용자 관점에서 깨진다.

3건 모두 dev-notes §5 체크리스트에 이미 올라와 있다(중복 제기 아님, **미해소 확인**). 위 3건이 확인되기 전에는 **"비주얼 완료" 표시하지 않는다.**

---

## 5. 라우팅 요약

| # | 대상 | 항목 | 성격 |
|---|------|------|------|
| 2-1 | **ui-publisher** | 메모 입력 border `1.5`·radius `16` 킷 정합(방문일·검색 버튼과 동일 폼 내 불일치, 수정 시 높이도 킷 127 일치) | 기존 이슈·별도 스프린트 |
| 2-2 | **ui-publisher** | 폴백 장소명 입력 타이포 토큰 부재(메모만 정합돼 비대칭 발생) | 기존 이슈·이월 |
| 2-3 | **ui-publisher** | 2-1 수정 시 `memoBoxHeight` 인자를 복제→참조로 전환(조용한 desync 예방) | 예방적 |
| 4 | **사용자/디바이스 스모크** | iOS 4줄 클리핑 · Android `includeFontPadding` · 내부 스크롤 제스처 | 미검증 |

**이번 스프린트 자체의 비주얼 결함: 0건.** 킷 수치 번역은 전 항목 정확하고, 메모 외 요소는 렌더 대조로 픽셀 불변이 입증됐다.
