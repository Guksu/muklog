# QA Visual — map-tab-nearby 슬라이스 2 (비주얼 충실도)

> 검증자: qa-visual. 디자인 단일 출처: 킷 `templates/muklog/mk-home.jsx` `MapScreen`(선택 카드 287-301 · 범례 281-283,306-312 · Pin 313-324).
> 방법: visual-qa 스킬 적용, 킷 JSX ↔ RN 소스 동시 대조(3축: 레이아웃·구조 / 비주얼·토큰 / 텍스트·카피). 로직·데이터·경계면은 qa-logic 담당 — 본 보고 제외.
> 범위: NearbySpotCard 충실도 / nearby 핀 색 정합 / 범례 불변 / 카피 / 플레이풀 예외 오탐 금지.

## 종합 판정: **비주얼 통과** (불일치 0, 근사 허용 2)

---

## 1. NearbySpotCard 충실도 — 통과

킷 선택 카드 셸(mk-home:288-301)을 SelectedSpotCard와 동일하게 재사용하고 필드만 축소. 두 파일을 동시 대조한 결과 셸 정합.

| 축 | 킷 라인 | RN | 판정 |
|----|--------|-----|------|
| 컨테이너 surface·padding(14/20/16)·상단 radius.card·shadow.md | mk-home:288 | NearbySpotCard.tsx:56-67 | ✅ SelectedSpotCard.tsx:48-59와 글자단위 동일 셸 |
| row `flexDirection:row` gap 13≈spacing[12] align center | mk-home:289 | NearbySpotCard.tsx:69, styles.row:98 | ✅ 동일 |
| FoodCover 54×54 / radius 14 / emojiSize 26 | mk-home:290 | NearbySpotCard.tsx:31-33,70-75 | ✅ 동일 상수 |
| placeName cardTitle(700/17, 킷 700/16 근사) numberOfLines 1 | mk-home:292 | NearbySpotCard.tsx:77-79 | ✅ tokens.ts:152 cardTitle=17 |
| 메타 "{categoryName} · {거리}" meta/fgMuted, marginTop 4 | mk-home:295(변형) | NearbySpotCard.tsx:36-47,80-89 | ✅ 거리 결측 시 카테고리명만(buildMeta 빈 조각 제거) |
| 별점(Stars) 부재 | mk-home:294(제거) | NearbySpotCard 전체 — Stars import·렌더 없음 | ✅ 의도된 필드 축소(ui-spec §1.2) |
| heart 부재 | mk-home:298(제거) | NearbySpotCard 전체 — Icon Heart 없음 | ✅ 의도된 필드 축소 |
| FoodCover cafe 폴백(킷 `CAT[cat]||CAT.cafe`) | — | FoodCover.tsx:48-49 `categoryEmoji||cafe.emoji` | ✅ nearby categoryName(자유 text) 폴백 정합 |

- **raw hex 0건**: `grep -rni "#[0-9a-f]" src/features/map/components/` 결과 유일 매치는 MapLegend.tsx:3(주석 내 킷값 기록) — **코드 내 raw hex 없음**. 색 전부 `theme.color`/`color` prop 토큰 경유.
- **거리 유/무 렌더**: distanceText 주입 시 "음식점 > 한식 > 칼국수 · 320m", undefined 시 카테고리명만(spec 28-34 단언과 일치).

SelectedSpotCard 대비 차이: NearbySpotCard는 metaRow 대신 단일 meta 라인(Stars 슬롯 제거)이라 `styles.metaRow` 없이 body 직속 meta — 셸·간격은 보존되며 의도된 축소. 적합.

## 2. nearby 핀 색 정합 (핵심) — 통과

| 출처 | 값 | 비교 |
|------|----|----|
| 킷 Pin(mk-home:314) saved 분기 | `var(--mk-accent)` | = `#3366FF`(primary) |
| 킷 Pin(mk-home:314) nearby 분기 | `#B6ABA0` | 웜그레이 |
| RN tokens.ts:55 `mapNearbyPin` | `#B6ABA0` | 킷과 글자단위 일치 ✅ |
| mapHtml.ts:33 `.mk-pin--nearby { border-color: #B6ABA0; }` | `#B6ABA0` | tokens.ts `mapNearbyPin`과 글자단위 일치 ✅ |
| mapHtml.ts:30 saved border | `#3366FF` | 킷 --mk-accent / primary 일치 ✅ |
| mapHtml.ts:73 분기 | `m.saved ? 'mk-pin' : 'mk-pin mk-pin--nearby'` | saved/nearby 시각 구분 정합 ✅ |

- **단일 출처 정합 강제 확인**: 지도 핀 HTML hex(`#B6ABA0`) = 범례 dot 토큰(`mapNearbyPin = #B6ABA0`) = 킷 Pin(`#B6ABA0`) — 3자 일치. 사용자에게 범례 dot과 지도 nearby 핀이 동일 웜그레이로 보임(시각 정합).
- saved=`#3366FF`와 명확히 구분.

## 3. 범례 불변 — 통과

- MapLegend.tsx:16-19 2칩 = `primary`("우리 맛집") / `mapNearbyPin`("주변 음식점"), 킷 mk-home:282-283 정합. slice1 대비 컴포넌트·색 변경 0.
- slice2에서 nearby 핀이 실제로 채워지며 범례 dot(`mapNearbyPin` 토큰) ↔ 지도 nearby 핀(HTML `#B6ABA0`) 색 정합 — §2에서 값 일치 확인됨.

## 4. 카피 — 통과

- 메타 구분자 "· "(킷 mk-home:295 패턴), 거리 표기 "{n}m"/"{km}km"는 developer `formatDistance` 산출 문자열을 받음(ui-spec §1.3 — 컴포넌트는 포맷 안 함). 카드 자체에 하드코딩 카피 없음 → 모호어/번역 손실 없음. ui-spec §4 권고값 정합.
- 빈/로딩/에러 카피: nearby 상태는 하단 카드와 무관(ui-spec §4.3) — 카드 레벨 상태 카피 없음, 검증 대상 외.

## 5. 플레이풀 예외 — 오탐 없음

FoodCover 음식 이모지/cafe 그라데이션 폴백은 킷 허용 디자인 기준(CLAUDE.md·visual-qa 스킬). 위반으로 잡지 않음.

---

## 근사 허용 (RN 한계 — ui-spec §6 사유 기록 확인됨)

| 항목 | 킷 | RN 근사 | 사유(기록 위치) |
|------|----|---------|------|
| nearby 핀 색 토큰화 | `#B6ABA0`(킷 Pin) | mapHtml.ts hex 직박힘(`mapNearbyPin` 미러) | WebView HTML이 RN 토큰 시스템 밖. slice1 선례(`#3366FF`도 직박힘). 값 일치 강제 확인됨 — ui-spec §2.3. **허용** |
| 선택 카드 상향 그림자 | `box-shadow:0 -8px 24px`(mk-home:288) | shadow.md + 상단 radius.card | RN iOS 음수 offset 그림자 약함. SelectedSpotCard slice1과 동일 근사 — ui-spec §6. **허용** |

(cardTitle 700/16→17, meta 500/12.5→13 정수 근사는 slice1에서 이미 승인된 토큰값 — 본 슬라이스 신규 이슈 아님.)

## 미검증 (사유)

- 실 디바이스 렌더(WebView 핀 실제 묘화·카드 floating 위치): 정적 소스 대조 범위 밖. 코드·토큰·HTML 색값 정합은 전부 통과. 디바이스 스모크는 qa-logic/디바이스 검증 몫.

---

## ui-publisher 수정 요청

**없음.** NearbySpotCard 셸·필드 축소·핀 색·범례·카피 전 항목이 킷과 정합하며, 근사 2건 모두 ui-spec §6에 사유 기록됨. 비주얼 완료.
