# QA Report — Visual (map-wish-pins)

> 검증자: qa-visual · 방법: visual-qa 스킬(킷 templates/muklog ↔ RN 3축 교차검증)
> 디자인 단일 출처: `.claude/skills/ui-design/templates/muklog/mk-*.jsx`
> 대상: `mapWishPin` 토큰 · `.mk-pin--wish`(mapHtml) · `WishSpotCard`(신설) · `MapLegend` 3칩
> 결과 요약: **비주얼 충실도 통과(컴포넌트 + 최종 조립 재검 완료)** — 불일치 0(하드페일) / 근사 허용 4 / 미검증 0 / 디바이스 스모크 이월 3

킷에 위시 전용 시안이 없어 ui-spec이 킷 기존 패턴을 조합한 스펙임 → 조합 근거의 킷 라인 인용 정확성 + 킷 톤(웜 앰버·헤어라인·radius·SUIT) 정합을 중점 검증.

---

## 1. 통과 (킷 ↔ RN 일치)

### 1.1 위시 핀 색 토큰 `mapWishPin`
- RN `tokens.ts:73,136` `mapWishPin = #FFB23E` ↔ 킷 Stars 채움색 `#FFB23E`(`mk-ui.jsx:42` `color={n<=value ? "#FFB23E" : ...}`). **값 정확 일치.** ✅
- ui-spec §1.2 근거(킷 warm 앰버 = starFill, blue/gray와 3-way 구분) 인용 정확. 전용 토큰 분리(값=starFill, 의미 분리 — `calendarSun` 선례, `tokens.ts:71,80`) 확인. ✅
- 라이트=다크 공통(지도 마커 톤 고정, `mapNearbyPin` 동일 패턴) — 다크 미러도 동일 값. ✅

### 1.2 mapHtml `.mk-pin--wish` + stacking
- `mapHtml.ts:39` `.mk-pin--wish { border-color: #FFB23E; }` — RN 토큰과 **동일 hex**(단일 출처, 이중 기입 사유 `mapHtml.ts:36-37`에 기록). nearby `#B6ABA0`(:35), base primary. ✅
- `pinZIndex(kind, active)` = active 5 / saved 3 / wish 2 / nearby 1(`mapHtml.ts:72,122,194`) — ui-spec §1.4 표 및 킷 active zIndex 5(`mk-home.jsx:350`)와 정합. ✅
- `kind→className` 3분기(`mapHtml.ts:105-106`): saved→`mk-pin` / nearby→`mk-pin mk-pin--nearby` / wish→`mk-pin mk-pin--wish`. base 셸(크기·라운드·배경) 공유, border만 분기 — ui-spec §2 정합. ✅

### 1.3 WishSpotCard — SelectedSpotCard 셸 미러
`WishSpotCard.tsx` ↔ `SelectedSpotCard.tsx` 나란히 대조(킷 `mk-home.jsx:375-388` 스팟 카드 셸):

| 요소 | SelectedSpotCard | WishSpotCard | 판정 |
|---|---|---|---|
| 카드 셸 | surface·radius.card 상단·pad 14/20/16·shadow.md | 동일(`WishSpotCard.tsx:61-69`) | ✅ 100% |
| row gap | spacing[12] | spacing[12](`:71`) | ✅ |
| FoodCover | 54/14/26 | 54/14/26(`:38-40,72-78`) | ✅ |
| 가게명 | cardTitle/fg/1줄 | 동일(`:80-82`) | ✅ |
| 메타 `· {라벨} · {area}` | null-safe buildMeta | 동일 규칙(`:46-49,83-92`) | ✅ |
| 별점(Stars) | 있음 | **없음** | ✅ 제거(미방문, ui-spec §3.1) |
| heart | 있음 | **없음** | ✅ 제거(먹로그 아님) |
| 거리·액션 | — | **없음** | ✅ 최소 카드(plan §4.1) |

→ 제외 항목(별점·heart·거리·액션)이 전부 ui-spec §3.1 근거대로. 세 카드(Selected/Nearby/Wish) 셸 100% 공유로 시각 일관. ✅

### 1.4 카드↔핀 이모지 단일 출처 메커니즘 (§3.2)
- `WishSpotCard`는 `coverEmoji`를 주입받아 FoodCover에 `emoji` 오버라이드로 전달(`:72-78`).
- `FoodCover.tsx:56` `emojiOverride || categoryEmoji(...) || cafe` — 오버라이드가 category 폴백(☕)보다 **우선**. 확인. ✅
- → developer가 핀(`wishToMapMarkers`)과 동일한 `categoryEmoji`(+🍽️ 폴백) 결과를 카드 `coverEmoji`에 넘기면 카드 글리프==핀 글리프(null 포함). **컴포넌트 측 메커니즘 정합.** (실제 동일 값 주입은 developer T7 — §3 재검 대상)

### 1.5 MapLegend — 3칩
킷 `mk-home.jsx:394-399` Legend ↔ RN `MapLegend.tsx`.

| 항목 | 킷 | RN | 판정 |
|---|---|---|---|
| 칩 순서 | (킷 2칩) | 맛집(primary)→가고 싶은 곳(mapWishPin)→주변(mapNearbyPin) | ✅ stacking 우선순위(맛집>위시>주변)와 동일 배열(ui-spec §4.1) |
| 칩 패딩 | 5×10(`:396`) | 5×10(`MapLegend.tsx:59`) | ✅ |
| dot | 9×9 radius999 | 9×9 radius4.5(`:61`) | ✅ |
| 칩 radius | 999 | radius.full(`:33`) | ✅ |
| gap | 8(칩 사이) | spacing[8](`:48`), dot-라벨 gap spacing[6](`:34`) | ✅ |
| 위시 dot 색 | (신설) | `mapWishPin` 앰버 — 핀과 단일 출처(`:20,37`) | ✅ |
| 위시 라벨 | 킷 위시 보이스 "가보고 싶은 곳"(`mk-extra:195`) | "가고 싶은 곳"(맛집/주변과 평행한 짧은 명사구 축약) | ✅ 톤 정합 |
| 텍스트 색 | `--mk-ink2` | `fgWeak`(=warm.ink2=mk-ink2) | ✅ 매핑 일치 |

MapLegend는 `MapTabScreen.tsx:273`에 렌더됨 → 3칩 실제 표시.

### 1.6 토큰 경유
`WishSpotCard`·`MapLegend` 스타일 코드에 raw hex 0(grep 매치는 전부 주석의 토큰 참조 설명). 색·radius·spacing 전부 `theme/` 경유. tokens.ts hex(토큰 정의)·mapHtml hex(WebView 격리 HTML)는 문서화된 단일 출처 예외. ✅

---

## 2. 최종 조립 재검 (완료 — 통과)

developer 배선 완료 후 `MapTabScreen.tsx`를 ui-spec §6 골격과 재대조:

- **kind 3분기**: `selected.kind` = Saved→SelectedSpotCard / Nearby→NearbySpotCard / Wish→WishSpotCard(`MapTabScreen.tsx:203-247,349-356`). ui-spec §6 정합. ✅
- **WishSpotCard 주입**: `{ placeName, category, coverEmoji, area }`(`:350-354`) — ui-spec §3.3 props 계약대로. ✅
- **카드↔핀 이모지 단일 출처(실제 값 정합)**: 핀 `wishToMapMarkers.ts:36` `emoji: wishPinEmoji({ category })` ↔ 카드 `MapTabScreen.tsx:353` `coverEmoji={wishPinEmoji({ category: selectedWish.category })}` — **양쪽이 동일 `wishPinEmoji` 함수 호출**(`wishToMapMarkers.ts:17`, `categoryEmoji || 🍽️ 폴백`). null/미지 category도 양쪽 🍽️로 수렴 → 카드 글리프==핀 글리프. FoodCover가 override 우선(§1.4)이므로 카드는 항상 이 값 표시. **§3.2 드리프트 방지 값 레벨 확인.** ✅
- 배선이 WishSpotCard 비주얼 props를 변경하지 않음(비주얼 임의 변경 0). ✅

→ 이전 "미검증"(엔드투엔드 조립 + 글리프 단일출처) 항목 해소. 통과.

---

## 3. 근사 허용 (RN/웹 한계 — 사유 기록 확인됨)

| 항목 | 킷 | RN 근사 | 사유(기록 위치) |
|---|---|---|---|
| 3.1 범례 칩 배경 | `rgba(255,255,255,.85)` + `backdrop-blur(6px)` | `surface` 불투명 | RN blur 미지원 — `MapLegend.tsx:5`(슬라이스1 기존 기록) |
| 3.2 범례 텍스트 | 700/11 | `caption` 12/Medium | 웨이트·크기 근사 — `MapLegend.tsx:6`(슬라이스1 기존) |
| 3.3 카드 그림자 | `box-shadow: 0 -8px 24px` | `shadow.md` | 지도 위 floating 카드(헤어라인 아닌 상향 그림자) — `SelectedSpotCard.tsx:6-7` |
| 3.4 `mapWishPin` 값 | (신설) | `#FFB23E`(=starFill) | 값=별점색이나 의미 분리 전용 토큰 — `tokens.ts:71,135`(calendarSun 선례) |

전부 ui-spec/컴포넌트 주석에 사유 기록 존재 → 근사 허용 통과.

---

## 4. 디바이스 스모크 이월 (렌더 픽셀 확인 필요 — [[qa-layout-blind-spot]])

코드/토큰상 정합은 확인됐으나, 실기기 렌더로만 확정 가능한 항목(리더 지시대로 이월 기록):

1. **위시 핀 색 판별성** — 앰버(#FFB23E) 핀이 실기기에서 blue(맛집)·gray(주변)와 즉시 구분되는지(ui-spec §7-1).
2. **3-way stacking** — 좌표 근접 시 saved > wish > nearby 순 겹침(zIndex 코드 정합 확인됨, 실제 카카오 오버레이 겹침은 실기기).
3. **MapLegend 3칩 협폭 오버플로** — 375px에서 ~226px 여유(no-wrap)지만 초협폭 기기(≤320px)에서 칩이 지도를 가리거나 잘리는지(ui-spec §4.1 근사 기록).

→ 통과/불통 판정 유보, 디바이스 스모크로 이관. qa-logic/디바이스 QA와 공유.

---

## 5. 결론
- 이번 스프린트 신설/수정 **컴포넌트·토큰·핀 스타일 + 최종 조립(kind 3분기·단일출처 주입)의 비주얼 충실도 통과**(하드페일 0, 미검증 0). 킷 라인 인용 정확, 조합이 킷 웜 톤과 정합.
- 카드↔핀 이모지 단일 출처가 값 레벨에서 확인됨(양쪽 동일 `wishPinEmoji`, null 포함 수렴).
- 디바이스 스모크 3건(핀 3색 판별성·3-way stacking 겹침·범례 협폭 오버플로)은 렌더 픽셀 확인 이월 — 코드/토큰 정합은 확인됨. 실기기 스모크는 qa-logic/디바이스 QA와 공유.
- **비주얼 완료.** (디바이스 스모크 3건은 실기기 확인 잔여로 명시)
