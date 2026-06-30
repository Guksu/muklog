# QA Report — Visual (sprint-20260630-category-text-badges)

검증자: qa-visual · 날짜: 2026-06-30
디자인 단일 출처: 킷 `templates/muklog` (`HANDOFF-2026-06-30.md §2-2`, `mk-log.jsx`, `mk-ui.jsx`)
방법: 킷 JSX ↔ RN 동시 열람 3축(레이아웃 / 비주얼·토큰 / 텍스트) 교차검증 + grep 전수.

## 최종 판정: **PASS**

이번 델타(작은 칩/배지 텍스트화)의 3개 변경 대상이 모두 킷 §2-2를 정확히 재현했고, 유지 대상(FoodCover 커버·지도 핀 글리프)에 회귀가 없음을 킷 라인↔RN 파일:라인으로 확인. 미해결 없음.

---

## 1. 변경 대상 — 칩/배지 텍스트화 (킷 §2-2)

### AC1. 카테고리 필터 칩 — 라벨만
- 킷 `mk-log.jsx:116-117` — `<CHIP2 …>전체</CHIP2>`, `<CHIP2 …>{CATM[c].label}</CHIP2>`. CHIP2(MkChip)에 `icon`/`iconColor` prop 없음 → children = 라벨 텍스트 단독.
- RN `MuklogList.tsx:121-135` — `<Chip label="전체" …/>`, `<Chip label={categoryLabel({ key })} …/>`. **`emoji` prop 미전달** → 라벨만. 킷과 일치.
- `categoryEmoji` import: `MuklogList.tsx`에 부재(grep 확인, import는 `categoryLabel`만 — line 21). dead import 0.
- **PASS** — 칩 셀렉트 색·radius·보더 불변(아래 §3 토큰축 참조), testID `chip-all`/`chip-{key}` 보존.

### AC2. 맛집 카드 배지 — 라벨만
- 킷 `mk-log.jsx:188-190` — 커버 위 좌상단 배지 = `{CATM[m.cat].label}` 단독(이모지 없음). 글래스 흰 배경.
- RN `MuklogCard.tsx:76-78` — `<Text variant="badge" color="fgWeak" style={styles.chipText}>{chipLabel}</Text>` 단독. `chipEmoji` 파생 제거 확인(grep `chipEmoji` → 전무).
- `MuklogCard.tsx:41` — `chipLabel = categoryLabel(...)`만. `categoryEmoji` import 부재(line 21 import는 `categoryLabel`).
- `hasChip`(42)·`muklog-card-chip` testID 분기 불변.
- **PASS**.

### AC3. 맛집 상세 카테고리 배지 — 라벨만
- 킷 `mk-log.jsx:253-255` — 본문 카테고리 칩 = `{CATM[m.cat].label}` 단독. 배경 `var(--mk-accent-weak)`, 글자 `var(--mk-accent-strong)`.
- RN `MuklogDetailScreen.tsx:373-375` — `<Text variant="badge" color="accentStrong" style={styles.chipText}>{chipLabel}</Text>` 단독. `chipEmoji` 파생 제거 확인.
- `MuklogDetailScreen.tsx:221` — `chipLabel = categoryLabel(...)`만. `categoryEmoji` import 부재(line 34 import는 `categoryLabel`).
- **PASS**.

---

## 2. 유지 대상 회귀 확인 (충실도 핵심 — 킷 §2-1 / §2-2 단서)

### FoodCover 이모지 커버 (킷 §2-1 = 커버는 이모지 유지)
- `FoodCover.tsx:56,68` — `emoji = emojiOverride || categoryEmoji({ key: category }) || cafe폴백` → `<Text fontSize={emojiSize}>{emoji}</Text>` 그대로. 변경 없음.
- 소비처 회귀 0:
  - `MuklogCard.tsx:129` — coverUri 없을 때 `<FoodCover category emojiSize={56}>` 폴백 커버 유지(킷 `mk-log.jsx:187` emojiSize 56 일치).
  - `MuklogDetailScreen.tsx:295-301` — 사진 0장 폴백 `<FoodCover emojiSize={92}>` 유지(킷 `mk-log.jsx:230` emojiSize 92 일치).
- **PASS — 회귀 없음.** 커버 큰 이모지는 그대로 노출.

### 지도 핀 글리프 (킷 §2-2 = 핀 글리프 별개, 유지)
- `pinsToMapMarkers.ts:21,26` — `categoryEmoji({ key })` 사용, 빈 key는 `PIN_FALLBACK_EMOJI`. 미변경.
- `nearbyCategoryEmoji.ts` — 주변 전용 이모지 매핑 그대로.
- `NearbySpotCard.tsx:89-92` — `emoji={coverEmoji}` FoodCover 오버라이드(54×54/radius14/emojiSize26, 킷 `mk-home:290` 정합) 그대로.
- **PASS — 회귀 없음.** 핀·주변 카드 글리프 유지.

### Chip 프리미티브 `emoji` prop 보존 (plan §유지)
- `Chip.tsx:21,42,62` — `emoji?` prop·렌더 분기·스타일 보존. 카테고리 칩이 더 이상 소비하지 않지만 prop은 dead-removal하지 않고 유지(plan 결정). `Chip.spec.tsx:16`이 여전히 emoji 경로를 검증 → 프리미티브 계약 안정.
- **PASS** — 프리미티브 비주얼 계약 불변.

---

## 3. 3축 점검

### ① 레이아웃·구조
- 필터 칩 행: `MuklogList.tsx:111-136` 가로 스크롤·gap7·edge-bleed(marginH -20) 불변. 칩 내부는 `Chip.tsx:53-60` flexDirection row·alignItems center — 이모지 제거 후 라벨 단독에서도 세로 중앙 정렬 자연. 헤드룸 잔재 어색함 없음.
- 카드 배지: `MuklogCard.tsx:69-72` top/left12·padV6·padH10 불변. `chipText: { lineHeight: 16 }`(line 206) — badge fontSize 12 대비 헤드룸. 이모지 없는 라벨 단독에서도 16 lineHeight는 fontSize 12를 충분히 담아 클리핑/과잉 공백 없음(라벨 폰트 자연 행간 내).
- 상세 배지: `MuklogDetailScreen.tsx:367-369` padV6·padH12·gap4 + `categoryChip` alignSelf flex-start·row 불변. `chipText lineHeight 16`(line 620) 동일하게 무해.
- **PASS.** (참고: 칩/배지의 `gap`(Chip 5 / 상세 4)은 이제 단일 자식이라 시각적 영향 없음 — 무해 잔재, 수정 불요.)

### ② 비주얼·토큰
- 칩 selected: `Chip.tsx:29` `primary` 배경 + `primaryFg` 텍스트(`:44`), 보더 0(`:31`). unselected: `surface` + `fgWeak` + 헤어라인 `hairline`. 킷 `mk-ui.jsx:120-136` 정합 불변.
- 카드 배지 배경 = `theme.color.surface`(`MuklogCard.tsx:67`), radius full. 킷 글래스(rgba .82+blur) RN 근사 — 코드 주석에 사유 기록(line 66). **근사 허용**.
- 상세 배지 배경 = `primaryWeak`(`MuklogDetailScreen.tsx:365`), 글자 `accentStrong`(`:373`). 킷 `--mk-accent-weak`/`--mk-accent-strong` 정합 불변.
- raw hex: 3개 대상 파일 grep `#[0-9a-fA-F]{3,6}` → **0건**. 토큰 경유 100%.
- **PASS.**

### ③ 텍스트
- 칩/배지 모두 라벨 텍스트만(이모지 0). grep `chipEmoji` 전무, `categoryEmoji` import 3개 파일 모두 부재.
- 라벨 문자열은 `categoryLabel({ key })`(categories.ts SSOT) 경유 — 칩/카드/상세 동일 소스. 킷 `CATM[c].label`와 동일 SSOT 의미.
- 기타 카피(섹션 헤더 "우리 맛집 N", 빈 상태, 작성자 라벨, 상세 메뉴/삭제) 불변.
- **PASS.**

---

## 4. 근사 허용 (사유 기록 확인)
- 카드 배지 글래스(흰 .82 + blur6) → 불투명 `surface`: `MuklogCard.tsx:66` 주석 사유 기록. RN blur 미지원. **허용.**
- 상세 글래스 바·인디케이터 blur → `scrimStrong` 근사: 본 델타 무관(기존). **허용.**

## 5. 미검증
- 없음. (순수 프리젠테이션 변경 — 디바이스 렌더 없이 킷↔RN 정합으로 충분. 단, 라벨 단독 칩의 실제 세로 중앙 정렬은 코드상 row+center로 보장되나, 한글 라벨 행간 미세 클리핑은 디바이스 스모크로 최종 확인 권장 — 차단 사유 아님, FYI.)

## 6. ui-publisher 라우팅
- 불일치 0건 → 수정 요청 없음.
