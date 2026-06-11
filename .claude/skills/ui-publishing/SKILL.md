---
name: ui-publishing
description: "muklog UI 퍼블리싱 가이드. 디자인 킷 ui_kits/muklog(웹 JSX)을 React Native로 정확히 번역하는 규칙 — 토큰 매핑·공용 프리미티브(FoodCover/MkChip/MemberBadge 등)·웹→RN 변환·비주얼 충실도 체크리스트. ui-publisher 에이전트가 사용. UI 퍼블리싱/디자인 정합/킷 번역/불일치 수정 작업 시 적용."
---

# muklog UI Publishing — 킷→RN 번역 가이드

**디자인 단일 출처:** 킷 `ui_kits/muklog` = `.claude/skills/ui-design/ui_kits/muklog/`.
- `mk-ui.jsx` — 공용 프리미티브(Icon·Stars·FoodCover·MkAvatar·MkButton·MkIconBtn·MkChip·MemberBadge·Sheet·MkTabBar·fmtDate·sinceLabel).
- `mk-home.jsx` — 홈 레벨 화면(로그 리스트·지도·+시트·입장·생성).
- `mk-log.jsx` — 로그 레벨 화면(맛집 리스트·상세·작성/편집·프로필).
- `mk-data.js` — 데이터 모델·카테고리(CAT) 그라데이션 실값.
- `index.html` — `--mk-*` CSS 변수 실값(색·radius).

**대원칙:** 킷은 웹(CSS/인라인 JSX)이다. RN에서는 **토큰·패턴을 `src/theme`/`src/components`로 번역**해 적용한다(CSS 직접 사용 금지). 비주얼은 킷과 픽셀 단위로 맞추되, 코드는 `docs/code-convention.md`를 100% 따른다.

## 0. 시작 절차
1. 작업 화면/컴포넌트에 대응하는 **킷 함수를 먼저 읽는다**(`mk-*.jsx`의 해당 함수 라인). 추측 금지.
2. `index.html`에서 사용된 `--mk-*` 변수 실값을 확인하고 `src/theme/tokens.ts`와 대조한다.
3. ui-spec.md에 **킷 라인 ↔ RN 매핑**을 적고 구현한다.

## 1. 토큰 매핑 (킷 `--mk-*` → `src/theme/tokens.ts`)

| 킷 CSS 변수 | 실값 | RN 토큰(useTheme().color/…) |
|---|---|---|
| `--mk-accent` | `#3366FF` | `color.primary` |
| `--mk-accent-weak` | `#EAF0FF` | `color.primaryWeak` |
| `--mk-accent-strong` | `#1F4FE0` | `color.accentStrong` |
| `--mk-accent-line` | `#BFD0FF` | `color.accentLine` |
| `--mk-accent-shadow` | `rgba(51,102,255,.30)` | `color.accentShadow` |
| `--mk-ink` | `#2A2422` | `color.fg` |
| `--mk-ink2` | `#5C5550` | `color.fgWeak` |
| `--mk-bg` | 배경(웜) | `color.bg` |
| `--mk-card` | 카드면 | `color.surface` |
| `--line` / `--line-alt` | 헤어라인 | `color.hairline` / `color.hairlineAlt` |
| `--line-strong` | 옅은 회색(빈 별) | `color.borderStrong` |
| `--text-alternative` | 보조 텍스트 | `color.fgMuted` |
| `--text-assistive` | 비활성 텍스트 | `color.fgAssistive` |
| `--mk-radius-btn` | `14` | `radius.control` |
| `--mk-radius-card` | `22` | `radius.card` |
| (시트 상단) | `20`/`26` | `radius.sheet`(20) / Sheet 상단 26 |

**규칙:** raw hex/숫자 색 하드코딩 금지 — 위 토큰만. 킷에 있는데 토큰에 없으면 **토큰을 추가**(예: 카테고리 그라데이션, 맵 회색 핀)하고 tokens.spec.ts에 검증을 더한다. 별점 채운 색은 킷 `#FFB23E`(현 `warning` #FF9200과 다름 — 정합 필요 시 토큰/전용 색 확인).

## 2. 웹 CSS → RN 변환 규칙

| 킷(웹) | RN 번역 |
|---|---|
| `font: "700 17px/1.3 var(--font-sans)"` | `typography.cardTitle` 등 역할 토큰. **weight는 fontFamily로**(800/700→Bold, 600→SemiBold, 500→Medium, `src/theme/fonts.ts`). lineHeight=size×ratio 절대값. |
| `box-shadow`(카드 소프트) | **헤어라인 보더 우선**(원티드 규칙). 떠 있는 레이어(FAB·시트·선택카드)만 `shadow.*`. 컬러 그림자는 RN 미지원 → `shadow` 근사 + 사유 기록. |
| `linear-gradient(...)` | `expo-linear-gradient`의 `<LinearGradient colors={[...]} start/end>`. CAT 그라데이션 각도 140deg ≈ `start={{x:0,y:0}} end={{x:1,y:1}}`. |
| `backdrop-filter: blur` | RN 미지원 → 반투명 배경색 근사(`rgba(...)`) 또는 `expo-blur` 필요 시. 사유 기록. |
| `position:absolute; left:'46%'` | RN 절대배치 + `%`/계산. 지도 핀 좌표 정규화는 킷 `px()` 로직 그대로 이식. |
| `aspectRatio:"16/10"` | RN `aspectRatio: 16/10`(숫자). **킷 비율 그대로**(MuklogCard 커버=16/10). |
| `:hover`/`transition` | RN `Pressable` press 상태/`Animated`. 과한 애니메이션 지양(컨벤션). |
| `gap` | RN View `gap`(지원) 또는 마진. 킷의 7·12 등 정확값 유지(필요하면 spacing 토큰에 추가). |
| `letterSpacing:".18em"` | `letterSpacing: em×fontSize`(px). 코드 26px×.18≈4. |
| `dangerouslySetInnerHTML` 아이콘 | `react-native-svg` 기반 `Icon` 컴포넌트(currentColor=color prop). |
| 이모지 `fontSize` | RN `<Text style={{fontSize}}>` — 이모지 크기 킷 실값 유지(워드마크 19, 빈상태 64 등). |

## 3. 공용 프리미티브 — 킷 `mk-ui.jsx` ↔ `src/components/`

킷의 프리미티브는 모두 RN 컴포넌트로 존재해야 한다. **화면에서 인라인 중복 금지** — 프리미티브로 추출해 재사용한다.

| 킷 프리미티브 | 사양(킷 기준) | RN 컴포넌트 |
|---|---|---|
| `FoodCover` | 카테고리 그라데이션 배경 + 대표 이모지 + drop-shadow. radius·emojiSize props. | `FoodCover.tsx`(카테고리→그라데이션 맵, `expo-linear-gradient`) |
| `MkChip` | 선택 시 `primary`+흰글자 / 미선택 `surface`+`fgWeak`, radius full, 8×13 pad, 600/13.5, emoji 옵션. | `Chip.tsx` |
| `MemberBadge` | members≥2 → 💑 "둘이"(primaryWeak+accentStrong) / <2 → 🙋 "혼자"(fill+fgMuted), 700/11.5. | `Badge`에 `MemberBadge` 변형 또는 `MemberBadge.tsx` |
| `MkButton` | variant **primary/soft/ghost**, size lg/md/sm, leftIcon, full. soft=primaryWeak+accentStrong, ghost=투명+fgWeak. | `Button.tsx`(variant 확장) |
| `MkAvatar` | `person.color`+26 배경 + inset ring(color+55), 이모지 50%. **muklog: avatarUrl 있으면 이미지, 없으면 이모지+컬러(디폴트).** | `Avatar.tsx`(이미지/이모지 폴백 + color 동적) |
| `MkIconBtn` | 40×40 원형, badge 도트(accent), color/bg props. | `IconButton.tsx`(헤더 버튼 공용화) |
| `Stars` | 채움 `#FFB23E` / 빈 `line-strong`, editable 토글, size/gap. | `Stars.tsx` |
| `Sheet` | 상단 26 radius, 핸들바, 딤 `rgba(20,12,8,.32)`, 타이틀. | `Sheet.tsx` |
| `MkTabBar` | 먹로그(bubble)·지도(location) 2탭, active=primary. | `HomeTabs.tsx`(RN Navigation tabBar) |

**FoodCover가 가장 중요한 누락 위험.** `mk-data.js` CAT의 8종 그라데이션 실값을 `categories.ts`에 `grad`(또는 RN용 `colors:[from,to]`)로 옮기고, FoodCover가 카테고리로 그라데이션을 고른다. 단색 `primaryWeak` 폴백은 킷 위반.

## 4. 화면 골격 — 데이터 자리 비우기

화면은 킷 레이아웃대로 짓되 **데이터는 props로 노출**해 developer가 채운다.
- 예: `LogCard`는 `{ log }` prop을 받고, 미리보기 사진 스트립은 `log.muklogs.slice(0,4)`를 `FoodCover`로, 부족분은 점선 빈칸. "맛집 N곳 기록했어요"는 `log.spots`.
- 헤더 워드마크는 화면별 고정 텍스트("먹로그"/"지도"), 아바타 겹침은 me/partner props.
- 빈상태(🍜/🎉/💌 등)·문구·CTA는 킷 그대로.
- ui-spec.md에 각 컴포넌트의 **props 계약**(이름·타입·킷 데이터 출처)을 적어 developer에게 넘긴다.

## 5. 비주얼 충실도 체크리스트 (모듈 완성마다 self-check → qa에 인계)

- [ ] 킷 대응 함수의 **구조 요소**가 모두 있는가(누락 0): 헤더·배지·미리보기·필터칩·FAB·빈상태·시트 등.
- [ ] 색은 전부 토큰 경유인가(raw hex/숫자 0). 킷 `--mk-*` 실값과 일치하는가.
- [ ] radius(카드 22·컨트롤 14·시트 20/26), 폰트 size/weight(family), 간격(킷 실값)이 일치하는가.
- [ ] 그림자 vs 헤어라인 구분이 맞는가(카드=헤어라인, 떠있는 것만 그림자).
- [ ] 카테고리 그라데이션 커버(FoodCover)가 카테고리별로 다르게 나오는가.
- [ ] 프리미티브로 추출됐는가(화면 인라인 중복 0).
- [ ] RN 미재현 항목은 근사+사유가 ui-spec.md에 기록됐는가.
- [ ] 관련 `npm test` 통과 + `tsc --noEmit` 통과.

## 6. 스택 연계
- 코드 패턴·컨벤션 세부는 `rn-supabase-dev` 스킬과 `docs/code-convention.md`를 공유한다(중복 작성 금지).
- 원티드 디자인 시스템 일반 규칙·아이콘·토큰 원천은 `ui-design` 스킬. **단 muklog는 `ui_kits/muklog` 변형이 우선**(이모지/음식커버 허용).
- 데이터·훅·네비게이션 배선은 developer 영역 — 넘기지 않는다.
