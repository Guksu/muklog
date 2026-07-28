# QA Report — Visual (expo-updates OTA / T7 `OtaReadyDialog`)

> 담당: qa-visual · 범위: **T7 `src/features/ota/OtaReadyDialog/` 비주얼 충실도만**.
> 로직·경계면·배선·테스트는 qa-logic 소관(`qa-report-logic.md`).
> 대조 기준: 킷 `templates/muklog`에 OTA 시안이 **없으므로**(킷 전수 grep 0건 — `ui-spec.md §1` 재확인 완료),
> **선례 `src/features/appVersion/UpdateSuggestModal/UpdateSuggestModal.tsx`** + 그 상위 킷 원본 `mk-extra.jsx RenameDialog(24-64)`.

## 판정: **통과** (불일치 0 · 근사 허용 4(전부 승계) · 정보 3(**전부 반영 완료**) · 미검증 3(라이브 이월))

> **재검증 1회차(ui-publisher 반영분) 완료** — §4의 문서 지적 3건이 모두 `ui-spec.md`에 반영된 것을 실측 확인했다(§4 각 항목의 "재검증" 줄 참고). 코드는 무변경이므로 §1~§3의 비주얼 판정은 그대로 유효하다.

---

## 0. 검증 방법

3개 파일을 동시에 열어 라인 단위로 대조했다.

| 층 | 파일 | 역할 |
|---|---|---|
| 킷 원본 | `.claude/skills/ui-design/templates/muklog/mk-extra.jsx:24-64` | `RenameDialog` — 셸의 최종 정답지 |
| 1·2차 파생 | `src/components/RenameDialog/RenameDialog.tsx` · `src/features/appVersion/UpdateSuggestModal/UpdateSuggestModal.tsx` | 승계 사슬 |
| 3차 파생(검증 대상) | `src/features/ota/OtaReadyDialog/OtaReadyDialog.tsx` | 본 스프린트 산출물 |

킷 값은 RN 토큰 정의(`src/theme/tokens/tokens.ts`)까지 되짚어 **실값**으로 확인했다(토큰을 "썼는가"가 아니라 "맞는 토큰인가").

---

## 1. 통과 — 킷 실값 ↔ RN 토큰 실값 대조

킷 CSS 변수의 원값(`templates/muklog/index.html:17-25`, `tokens/aliases.css:42`)까지 풀어서 확인했다. **전 항목 일치.**

| 요소 | 킷(mk-extra.jsx) | 킷 실값 | RN 토큰 | 토큰 실값 | `OtaReadyDialog.tsx` |
|---|---|---|---|---|---|
| 딤 배경 | `:33` `rgba(20,12,8,.34)` | 웜 잉크 34% | `color.fg` + `opacity 0.34` | `#2A2422` + .34 | `:16`, `:52` |
| 카드 폭 | `:36` `84% / max 320` | — | `DIALOG_LAYOUT` | `'84%'` / `320` | `:19-20`, `:39`, `:121` |
| 카드 배경 | `:36` `var(--mk-card)` | `#FFFFFF` | `color.surface` | `palette.white` | `:40` |
| 카드 radius | `:36` `20` | 20 | `radius.sheet` | `20` (`tokens.ts:179`) | `:41` |
| 카드 그림자 | `:37` `0 20px 50px rgba(0,0,0,.28)` | — | `shadow.dialog` | `#000`/.28/r50/y20 (`tokens.ts:199`) | `:60` |
| overflow | `:36` `hidden` | — | — | — | `:121` |
| 본문 패딩 | `:39` `20px 18px 16px` | 20/18/16 | `spacing[20/18/16]` | 20/18/16 (`tokens.ts:174`) | `:66-68` |
| 제목 타이포 | `:40` `800 17.5px/1.3` | — | `typography.dialogTitle` | 17.5 · ×1.3 · SUIT-Bold | `:72` |
| 제목 색 | `:40` `var(--mk-ink)` | `#2A2422` | `color.fg` | `palette.warm.ink` | `:72` |
| 본문 타이포 | `:41` `500 12.5px/1.5` | — | `typography.dialogSubtitle` | 12.5 · ×1.5 · SUIT-Medium | `:76` |
| 본문 색 | `:41` `var(--text-alternative)` | 뉴트럴 보조 | `color.fgMuted` | `palette.neutral[70]` | `:77` |
| 제목↔본문 간격 | `:41` `margin 6px 0 0` | 6 | `spacing[6]` | 6 | `:78` |
| 버튼 행 상단선 | `:56` `borderTop 1px var(--line-alt)` | rgba(112,115,124,**0.08**) | `hairlineWidth` + `color.hairlineAlt` | `rgba(112,115,124,0.08)` (`tokens.ts:19,108`) | `:86`, `:124` |
| 버튼 패딩 | `:57,59` `padding 14` | 14 | `DIALOG_LAYOUT.buttonPadding` | 14 | `:21`, `:127` |
| 좌 버튼 타이포·색 | `:57` `600 16px` `var(--mk-ink2)` | `#5C5550` | `dialogInput` / `color.fgWeak` | 16 · SUIT-SemiBold / `warm.ink2 #5C5550` | `:94` |
| 중앙 분할선 | `:58` `width 1` `var(--line-alt)` | — | `dividerWidth 1` / `hairlineAlt` | 1 / .08 | `:22`, `:98`, `:131` |
| 우 버튼 타이포·색 | `:59` `800 16px` `var(--mk-accent-strong)` | **`#1F4FE0`** | `button` / `color.accentStrong` | SUIT-Bold 16 / `#1F4FE0` (`tokens.ts:16`) | `:106` |
| 프레스 피드백 | (웹 tap-highlight) | — | `opacity 0.6` | — | `:132` |

### ui-spec §2 매핑표 실측 검증
`ui-spec.md §2`가 주장하는 **18개 행의 좌우 라인 번호를 전수 대조**했다 — **17행 정확, 1행 off-by-one**(§4-1).
`UpdateSuggestModal`과 `OtaReadyDialog`의 셸 값은 **상수·스타일·토큰 전부 문자 단위로 동일**하다(diff = props 타입 / testID / 문구 / 조건 분기 4종뿐).

### 레이아웃·구조 (축 ①)
- 계층 순서 동일: `Modal` → 딤 `Pressable`(absoluteFill) → `wrap` View(`pointerEvents="box-none"`) → 카드 `Pressable` → 본문 View + 버튼 행. `UpdateSuggestModal:53-63` ↔ `OtaReadyDialog:45-55`.
- `Modal` props 정합 — `visible transparent animationType="none" onRequestClose={onDismiss}`. `UpdateSuggestModal:53` ↔ `OtaReadyDialog:45`.
- 정중앙 배치 `flex:1 / center / center`. 킷 `RenameDialog`의 `paddingTop: ESP+70`(키보드 회피)을 **뺀 것이 맞다** — OTA 다이얼로그에는 입력이 없다. `RenameDialog.tsx:138`(오프셋 있음) ↔ `UpdateSuggestModal:143` = `OtaReadyDialog:120`(없음). 선례와 동일한 판단.
- **safe-area 비의존** — `useSafeAreaInsets` 미사용이 정상. 화면 전체 오버레이 + 수직 정중앙이라 inset 보정 대상이 없다(`RenameDialog`만 상단 정렬이라 `insets.top`이 필요했다). 이중 적용·누락 모두 없음.
- 버튼 행 `flex:1` 2등분 + 1px 분할선 = 킷 `mk-extra:56-60` 구조 그대로.
- **조건 분기 제거가 의도된 차이**임을 확인 — `UpdateSuggestModal:93-133`의 `storeUrl` 유무 2분기가 `OtaReadyDialog`엔 없고 항상 2버튼(`:86-110`). 사유는 `ui-spec §5-1`에 기록됨(번들이 이미 로컬에 있어 실패 모드 없음). **타당**.

### 비주얼·토큰 (축 ②)
- **raw hex / rgba 리터럴 0건.** `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\("` → `OtaReadyDialog/` 전체에서 매치 1건이며 **주석**(`:15` 킷 원값 출처 표기)뿐. 스타일 코드에 색 리터럴 없음. plan §5 T7 인수조건 ⑤ 충족.
- 매직 넘버 없음 — 4px 그리드 밖 수치(84% / 320 / 14 / 1)는 전부 `DIALOG_LAYOUT` 상수로 명명(`:18-23`), 선례와 동일한 처리(`Button.BUTTON_SIZE` 선례).
- **그림자 사용은 규칙 위반이 아니다.** "그림자 대신 헤어라인"은 카드/리스트 규칙이고, 킷 `RenameDialog`는 이 다이얼로그에 한해 명시적으로 `box-shadow 0 20px 50px`(`mk-extra:37`)를 쓴다. **킷이 우선** → `shadow.dialog` 사용이 정답. 동시에 버튼 행 구분선은 그림자가 아닌 **헤어라인**(`:86`)으로 정확히 처리됨.
- 브랜드 컬러: primary 버튼이 `accentStrong`(`#1F4FE0` — 킷 `--mk-accent-strong`)이고 `#3366FF`(`--mk-accent`)가 아닌 것이 **맞다**. 킷 `mk-extra:59`의 저장 버튼도 `--mk-accent-strong`이다.
- 폰트 패밀리: SUIT 계열만 사용(`dialogTitle` Bold / `dialogSubtitle` Medium / `dialogInput` SemiBold / `button` Bold) — 앱 SSOT(`fonts.ts:11-14`)에 실재하는 4종.

### 텍스트·카피 (축 ③)
- `ui-spec §4` 확정 카피와 **전문 일치**(오탈자·어미·줄바꿈 위치 포함):
  - 제목 `:73` `개선사항을 받아뒀어요`
  - 본문 `:80-81` `앱을 다시 켜면 저절로 적용돼요.\n지금 적용하면 화면이 새로고침되니, 작성 중인 내용은 저장해 주세요.`
    - JSX 소스의 2줄 분할(`:80` 끝 "작성 중인" / `:81` 시작 "내용은")은 **prettier 줄바꿈**이며, JSX 텍스트 규칙상 공백 1개로 접합되어 렌더 문자열은 의도대로 나온다. `{'\n'}`는 첫 문장 뒤 1개뿐 — ui-spec §4 주석과 일치.
  - 좌 `:95` `나중에` / 우 `:107` `지금 적용`
- **해요체 전수 확인** — 받아뒀어요 / 적용돼요 / 저장해 주세요. 명령형·느낌표·과장 없음.
- **스토어 축과의 혼동 방지 — 통과(핵심 확인 항목).** `OtaReadyDialog` 사용자 노출 문자열에 **"새 버전"·"버전"·"업데이트" 단어가 0건**. `UpdateSuggestModal:81,88,115`("새 버전이 나왔어요" / "지금 업데이트할까요?" / "업데이트")와 명사·동사·버튼 라벨이 전부 분리된다. "나왔어요(가지러 감)" ↔ "받아뒀어요(이미 있음)"의 대비가 두 축의 무게 차이를 정확히 전달한다.
- **plan §5 T7 인수조건 ⑥/⑦ 충족** — 본문 `:81`에 "작성 중인 내용은 저장해 주세요" 포함. 원인("화면이 새로고침되니") → 행동("저장해 주세요") 순서로 실행 가능한 안내다.
- **버튼 위계 방향이 선례와 동일** — 좌=약한 축(`dialogInput` SemiBold + `fgWeak` 웜그레이), 우=primary(`button` Bold + `accentStrong` 블루). `UpdateSuggestModal:102/114` ↔ `OtaReadyDialog:94/106`. 킷 `mk-extra:57/59`(취소 `--mk-ink2` / 저장 `--mk-accent-strong`)와 같은 방향.
- 접근성 라벨 3종(`닫기`/`나중에`/`지금 적용`)이 시각 라벨과 일치(`:50,90,102`).
- **이모지 없음이 정답** — muklog 플레이풀 예외는 콘텐츠 영역(FoodCover·빈상태)에 적용되고, 킷의 시스템 다이얼로그(`RenameDialog`)에도 이모지가 없다. 오탐으로 잡지 않음.

---

## 2. 근사 허용 (전부 선례 승계 — 신규 근사 0건)

`ui-spec §2 "RN 미재현 항목"`에 기록된 사유를 확인했고 타당하다. **이 스프린트가 새로 만든 근사는 없다.**

| # | 킷 | RN 근사 | 사유 | 판정 |
|---|---|---|---|---|
| A1 | `rgba(20,12,8,.34)` (`mk-extra:33`) | `color.fg`(#2A2422) + `opacity 0.34` (`:52`) | RN `Modal` 자식에 CSS rgba 직접 불가 → 색+불투명도 분리. `RenameDialog`·`UpdateSuggestModal` 동일 | 허용 |
| A2 | `box-shadow 0 20px 50px rgba(0,0,0,.28)` (`mk-extra:37`) | `shadow.dialog` (`:60`) | RN `shadowRadius` ≠ CSS blur. 토큰 정의 주석(`tokens.ts:197-199`)에 사유 기록됨 | 허용 |
| A3 | 상단 구분선 `1px` (`mk-extra:56`) | `StyleSheet.hairlineWidth` (`:124`) | 디바이스 픽셀비 대응이 더 정확. 좌우 분할선은 킷과 동일하게 정확히 1px(`:131`) | 허용 |
| A4 | 웨이트 `800`(제목·저장) / 행간 `/1`(버튼) | `SUIT-Bold`(700) / `ratio 1.2` | **앱 전역 승계 근사**: SUIT는 Regular/Medium/SemiBold/Bold 4종만 번들(`fonts.ts:11-14`) → 800 표현 불가. 버튼 행간은 한글 글리프 클리핑 회피로 1.2 상향(다른 역할 토큰과 동일 처리) | 허용 |

> A4는 `RenameDialog`부터 이어진 앱 전역 근사라 이 스프린트 이슈가 아니다. 다만 `ui-spec §2 "RN 미재현 항목"`에 A4 항목이 빠져 있다 → §4-2 참고(문서 보강, 코드 변경 불요).

---

## 3. 불일치

**없음.** 셸 수치 회귀 0건, 토큰 우회 0건, 카피 불일치 0건.

---

## 4. 정보 / 문서 보강 (코드 변경 불요) — **3건 전부 반영 완료**

### 4-1. [정보·낮음] `ui-spec.md §2` 본문 행 라인 범위 off-by-one — **해소**
- **위치**: `ui-spec.md:46` — "본문 | `:83-89` | **`:75-81`**"
- **실제**: `OtaReadyDialog.tsx`의 본문 `<Text>`는 **`:75-82`**(닫는 `</Text>`가 82행). 카피가 길어 prettier가 한 줄 더 감싸면서 생긴 차이이며, `UpdateSuggestModal` 쪽 `:83-89`는 정확하다.
- **영향**: 비주얼 영향 0. 다음 스프린트가 이 표로 재검증할 때만 혼선.
- **수정 방법**: `ui-spec.md:46`의 `:75-81` → `:75-82`.
- **재검증(반영 확인)**: `ui-spec.md:46`이 `` `:75-82` ``로 정정됨. 소스 실측도 재확인 — `OtaReadyDialog.tsx:75` `<Text` 시작 → `:80-81` 카피 2줄 → `:82` `</Text>`.

### 4-2. [정보·낮음] `ui-spec.md §2` "RN 미재현 항목"에 웨이트 근사(A4) 누락 — **해소**
- **위치**: `ui-spec.md:55-58` — "신규 근사 0건" 목록에 딤·그림자·헤어라인 3건만 기재.
- **사실**: 킷 `mk-extra:40,59`의 `800` 웨이트는 SUIT 번들에 800이 없어 `SUIT-Bold`로 근사된다. 승계 근사라 "신규 0건"이라는 결론 자체는 맞지만, §2 표가 `dialogTitle`을 "800/17.5, SUIT-Bold"로 병기해 두어 800이 실제 렌더된다는 오해를 줄 수 있다.
- **수정 방법**: §2 "RN 미재현 항목"에 1줄 추가 — "킷 `800` → `SUIT-Bold`(700). SUIT 번들에 ExtraBold 부재, 앱 전역 승계 근사".
- **재검증(반영 확인)**: `ui-spec.md:59`에 추가됨. §2 표의 "800/17.5"가 **킷 원값 표기**이고 실제 렌더는 Bold(700)임이 명시됐고, 근거 라인은 `fonts.ts:10-15`(`fontMap` 블록 전체)로 적혔다 — 내가 처음 인용한 `:11-14`(4개 항목 줄)보다 이쪽이 정확하다. **"신규 근사 0건" 결론 유지가 맞다**(앱 전역 승계 근사이므로).

### 4-3. [정보·조건부 이월] 다크 테마에서 딤 반전 — **현재 발현 불가 · 추적 이관 완료**
- `color.fg`는 다크에서 `palette.neutral[99]`(거의 흰색, `tokens.ts:160`)로 반전되므로, 다크가 켜지면 딤이 **흰 스크림**이 된다.
- **현재 영향 0**: `ThemeProvider.tsx:16` `scheme = 'light'` 고정 + `app.json:8` `"userInterfaceStyle": "light"`. 다크 토글 UI는 후속 스프린트로 명시돼 있다(`ThemeProvider.tsx:3`).
- `RenameDialog`·`UpdateSuggestModal`·`OtaReadyDialog` **3곳이 동일 패턴**이므로 이 스프린트에서 단독 수정하면 오히려 셸 정합이 깨진다. → **다크 토글 스프린트에서 3곳 동시 재검토** 항목으로만 기록.
- **재검증(반영 확인)**: `ui-spec.md:156`에 "후속 2(다크 토글 스프린트 항목)"로 이관됨(전용 딤 토큰 신설 후보 포함). 이 리포트와 ui-spec 양쪽에 남아 추적이 끊기지 않는다.

---

## 5. 미검증 (라이브 이월 — 통과로 처리하지 않음)

jsdom은 레이아웃을 계산하지 않는다(메모리 `qa-layout-blind-spot`: 캘린더 토요일 열 wrap 선례). 아래는 **실기기 스모크로만** 확정된다.

| ID | 항목 | 확인 방법 | 왜 지금 못 하나 |
|----|------|-----------|-----------------|
| **V1** | 본문 3줄이 카드(84%/max320 − 좌우 18 = 최대 284px) 안에서 잘리지 않고, 둘째 문장이 의도대로 2줄 자연 줄바꿈 | 실기기에서 다이얼로그 노출 후 육안 | 소형 기기(SE 320pt → 카드 269px)에서 4줄로 늘 수 있음. 고정 높이가 없어 잘림 위험은 낮으나 실측 필요 |
| **V2** | 딤 위 카드가 수직·수평 정중앙, 스토어 모달보다 1~2줄 높은 카드가 어색하지 않음 | 실기기 육안 | RN Modal 실제 레이아웃 |
| **V3** | Android에서 딤이 상태바 영역까지 덮는지(`Modal`에 `statusBarTranslucent` 미지정 — `UpdateSuggestModal`·`RenameDialog` 동일) | Android 실기기 | 네이티브 Modal 창 동작. **선례 2곳과 동일하므로 회귀는 아님**. 문제로 판명되면 3곳 동시 수정 대상 |

> V1~V3은 어느 것도 이번 산출물 고유 위험이 아니다(셸이 이미 프로덕션에서 도는 `UpdateSuggestModal`과 동일). V1만 카피 길이 차이로 이번에 새로 생긴 관찰 지점이다.

---

## 6. plan §5 T7 인수조건 대사표

| # | 인수조건 | 판정 | 근거 |
|---|---|---|---|
| ① | `UpdateSuggestModal` 셸(딤+중앙 카드+상단 hairline 2버튼 행) 정합 | **통과** | §1 전 항목 일치, 셸 상수·스타일 문자 단위 동일 |
| ② | 입력 없음, 2버튼("나중에" │ "지금 적용" primary) | **통과** | `:86-110`, 조건 분기 없이 항상 2버튼 |
| ③ | 콜백 1회 배선 | **qa-logic 소관** | 비주얼 측면(버튼 2개·위계·라벨)만 확인 |
| ④ | `visible:false` 미렌더 | **통과** | `:36` `if (!visible) return null;` |
| ⑤ | raw hex 0(토큰만) · 해요체 · 헤어라인 · radius 킷 톤 | **통과** | grep 0건 · §축③ · `:86,124` · `radius.sheet` 20 |
| ⑥ | 본문에 "작성 중인 내용 저장" 안내 | **통과** | `:81` |

> ⑤의 plan 문구 **"브랜드 코럴"은 plan.md:302의 오기**로 판단한다. muklog 브랜드 컬러는 파랑(킷 `index.html:17-18` `--mk-accent #3366FF` / `--mk-accent-strong #1F4FE0`, CLAUDE.md 브랜드 규칙)이고 킷 어디에도 코럴 액센트가 없다. 구현이 `accentStrong`(#1F4FE0)을 쓴 것이 **킷 정합이며 정답** — 구현을 통과 처리하고, plan 문구 정정을 sprint-planner에 정보 전달.

---

## 7. 결론

**T7 `OtaReadyDialog` 비주얼 충실도 — 통과.** 킷 비종속 신설이지만 선례 승계 사슬(킷 `RenameDialog` → `RenameDialog.tsx` → `UpdateSuggestModal` → `OtaReadyDialog`)이 끊긴 지점이 없고, 셸 수치가 킷 원값까지 되짚어 전부 일치한다. 카피는 스토어 축과 명확히 구분되며 인수조건 ⑥/⑦(작성 중 내용 저장 안내)을 충족한다.

- **ui-publisher 조치**: **완료**(재검증 1회차). §4-1(라인 정정)·§4-2(웨이트 근사 명시)·§4-3(다크 딤 후속 이관) 전부 `ui-spec.md`에 반영 확인. 코드 무변경이라 재테스트 불요 — 비주얼 수정 요청은 처음부터 **0건**이었다.
- **sprint-planner 정보 전달**: `plan.md:302` "브랜드 코럴" → "브랜드 블루" 정정 권장.
- **라이브 이월**: V1(본문 3줄 렌더) · V2(정중앙) · V3(Android 딤 상태바) — 실기기 스모크 전까지 "비주얼 100% 완료"로 표기하지 않는다.
