// src/features/map/components/CategoryFilterBar.tsx
// 지도 카테고리 필터 칩 바 — 킷 mk-log.jsx:113-118 카테고리 필터 재현 (map-category-filter, plan §4.4·T5).
//   킷: <div flex gap:7 overflowX:auto padding:0 20 14>{ CHIP "전체" + cats.map(CHIP label) }</div>.
//   RN 번역: 가로 ScrollView + 공용 Chip 프리미티브(=MkChip 재현). MuklogList 필터 칩 행과 동일 idiom.
//   차이(plan §3④): 리스트는 present-only(muklogCategoriesInUse)지만 지도는 nearby churn 회피 위해
//     MUKLOG_CATEGORY_KEYS **고정 8종(+전체)**. 라벨만(킷 filter도 label-only, 이모지 없음 — MuklogList 필터 일관).
//   단일 선택: selected(key|null). null="전체"(리셋). 필터/데이터/배치(오버레이 위치)는 developer·부모 소유 —
//     이 컴포넌트는 칩 행(프리젠테이션) + onSelect만. 위치(absolute top)는 부모가 배치(MapLegend 선례).
//   지도 위 가독성: 각 Chip이 surface(불투명 흰) 배경 + 헤어라인이라 맵 타일 위에서 개별 가독(킷 범례 칩 접근 동일)
//     → 바 배경 스크림 없이 칩만 띄운다(경량, 킷 정합). 필요 시 부모가 스크림 추가(ui-spec §4 근사 메모).
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components';
import {
  categoryLabel,
  MUKLOG_CATEGORY_KEYS,
  type MuklogCategoryKey,
} from '@/features/muklog/categories';
import { useTheme } from '@/theme';

export type CategoryFilterBarProps = {
  /** 선택된 카테고리 key(단일). null="전체"(필터 미적용). 상태 소유는 부모(MapTabScreen). */
  selected: MuklogCategoryKey | null;
  /** 칩 탭 콜백. "전체"→{category:null}, 카테고리→{category:key}. 필터 배선은 developer. */
  onSelect: (args: { category: MuklogCategoryKey | null }) => void;
};

export const CategoryFilterBar = ({ selected, onSelect }: CategoryFilterBarProps) => {
  const theme = useTheme();

  return (
    <ScrollView
      testID="category-filter-bar"
      horizontal
      showsHorizontalScrollIndicator={false}
      // 킷 mk-log:115 gap 7 / padding 0 20 14 — contentContainer paddingHorizontal 20로 첫 칩 들여쓰기 + edge 스크롤.
      contentContainerStyle={[
        styles.row,
        { gap: theme.spacing[7], paddingHorizontal: theme.spacing[20] },
      ]}
    >
      <Chip
        testID="filter-chip-all"
        label="전체"
        selected={selected === null}
        onPress={() => onSelect({ category: null })}
      />
      {MUKLOG_CATEGORY_KEYS.map((key) => (
        <Chip
          key={key}
          testID={`filter-chip-${key}`}
          label={categoryLabel({ key })}
          selected={selected === key}
          onPress={() => onSelect({ category: key })}
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  // 칩 세로 중앙 정렬(gap은 인라인 토큰) — MuklogList 필터 행과 동일.
  row: { flexDirection: 'row', alignItems: 'center' },
});
