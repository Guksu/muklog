# Dev Notes — sprint-20260630-category-text-badges

## 데이터·로직 배선: 없음
순수 프리젠테이션 변경(킷 §2-2 칩/배지 텍스트화). developer 단계 불필요 — 리더가 직접 구현 후 qa-visual 독립 검증.

- DB·RPC·Edge Function·RLS·네비게이션: 변경 없음.
- `categories.ts` SSOT(`emoji` 필드 포함): 불변 — FoodCover·지도 핀이 계속 소비.

## 변경 파일
- `src/features/muklog/MuklogList.tsx` — 필터 칩 `emoji` prop 미전달, unused `categoryEmoji` import 제거.
- `src/features/muklog/MuklogCard.tsx` — 배지 `{chipLabel}`만, `chipEmoji` 파생·import 제거.
- `src/navigation/screens/MuklogDetailScreen.tsx` — 배지 `{chipLabel}`만, `chipEmoji` 파생·import 제거.
- spec: `MuklogCard.spec.tsx`(이모지→라벨 기대값 + 이모지 부재 단언, 클리핑 테스트 제거), `MuklogList.spec.tsx`(칩 존재를 testID로 스코프).

## 유지(변경 금지) 확인
- `FoodCover` 이모지 커버, `pinsToMapMarkers`/`NearbySpotCard` 지도 글리프, `Chip` 프리미티브 `emoji` prop(타 소비처 보존).

## 빌드
네이티브 자산·설정 무변경 → **재빌드 불필요**, Metro 리로드로 반영.
