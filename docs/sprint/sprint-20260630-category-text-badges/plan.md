# Sprint: category-text-badges (2026-06-30)

## 단일 기능
ui-design 킷 2026-06-30 델타 **§2-2 — 작은 칩/배지에서 카테고리 이모지 제거, 라벨 텍스트만**. 작은 칩/배지에서 이모지가 짤려 보이는 문제 해소.

> 출처: `HANDOFF-2026-06-30.md §2-2`. (§2-1 FoodCover 이모지 커버는 RN에 이미 구현됨 — 유지.)

## 스코프 (라벨만 노출로 변경)
1. **카테고리 필터 칩** `MuklogList.tsx:132` — `emoji={categoryEmoji({ key })}` prop 제거 → 라벨만.
2. **맛집 카드 배지** `MuklogCard.tsx:78` — `{chipEmoji} {chipLabel}` → `{chipLabel}`. `chipEmoji` 파생(41) 제거.
3. **맛집 상세 카테고리 배지** `MuklogDetailScreen.tsx:374` — `{chipEmoji} {chipLabel}` → `{chipLabel}`. `chipEmoji` 파생(221) 제거.
4. 위 3파일에서 unused가 된 `categoryEmoji` import 정리(tsc·lint).

## 유지 (변경 금지)
- **FoodCover 이모지 커버** (카드·상세 큰 커버) — 킷 §2-1대로 유지.
- **지도 핀**(NearbySpotCard 등) 카테고리 글리프 — 킷 §2-2 명시 "핀 글리프라 별개, 유지".
- `Chip` 프리미티브의 `emoji` prop 자체는 보존(다른 소비처 가능성 — grep로 확인 후, 카테고리 칩이 유일 소비처면 dead prop 제거 검토. 제거 시 spec/소비처 동기화).
- 인앱 액센트색·레이아웃·기타 카피 불변.

## TDD 영향 (spec 먼저 갱신)
- `MuklogCard.spec.tsx:34,37` — `'🍝 파스타·양식'` → `'파스타·양식'`(라벨만). 테스트 설명 "(emoji+label)" → "(label)".
- `MuklogCard.spec.tsx:41-49` — "이모지 세로 클리핑 방지 lineHeight" 테스트는 **이모지 제거로 목적 소멸** → 제거(또는 라벨 기준으로 무의미). 클리핑 헤드룸 주석/스타일은 정리.
- `MuklogList.spec.tsx` — testID 기반(`chip-cafe` 등)이라 이모지 미assert. 회귀 없음(확인).
- `MuklogDetailScreen.spec.tsx` — 이모지 assert 없음(확인). 회귀 없음.

## 인수조건 (테스트)
- AC1. 카테고리 필터 칩이 라벨만 렌더(이모지 없음). `chip-{key}` testID·선택 동작 불변.
- AC2. 맛집 카드 배지가 라벨만(이모지 없음). `muklog-card-chip` 존재·hasChip 분기 불변.
- AC3. 맛집 상세 카테고리 배지가 라벨만(이모지 없음).
- AC4. **FoodCover 이모지 커버는 그대로**(카드·상세 커버 회귀 0). 지도 핀 글리프 그대로.
- AC5. `npm test` 전체 통과 + `npx tsc --noEmit` 0 에러. unused import·dead style 없음.

## 완료 기준
- AC1~5 + qa-report-visual(킷 §2-2 충실도: 칩/배지 라벨만 / 커버·핀 유지) PASS + qa-report-logic PASS.
- 순수 프리젠테이션 — 네이티브 재빌드 불필요(Metro 리로드로 반영). DB·계약 변경 없음.

## 데이터 계약
- 변경 없음. category 값·categories.ts SSOT 불변(emoji 필드는 FoodCover가 계속 사용).
