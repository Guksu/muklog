// src/features/map/components/CategoryFilterBar.spec.tsx
// 지도 카테고리 필터 칩 바 — 킷 mk-log.jsx:113-118 카테고리 필터 재현(리스트 필터 패턴을 지도 오버레이로).
//   "전체"(리셋) + MUKLOG_CATEGORY_KEYS 고정 칩(단일 선택). 기존 Chip 프리미티브·categoryLabel 재사용.
//   데이터/필터 로직은 developer(MapTabScreen) — selected/onSelect만 노출.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { MUKLOG_CATEGORY_KEYS } from '@/features/muklog/categories';
import { renderWithTheme } from '@/test/renderWithTheme';

import { CategoryFilterBar } from './CategoryFilterBar';

describe('CategoryFilterBar', () => {
  it('"전체" + 고정 카테고리(MUKLOG_CATEGORY_KEYS) 칩을 렌더한다', () => {
    renderWithTheme(<CategoryFilterBar selected={null} onSelect={() => {}} />);
    expect(screen.getByTestId('filter-chip-all')).toBeTruthy();
    MUKLOG_CATEGORY_KEYS.forEach((key) => {
      expect(screen.getByTestId(`filter-chip-${key}`)).toBeTruthy();
    });
  });

  it('selected=null이면 "전체" 칩이 선택 상태다', () => {
    renderWithTheme(<CategoryFilterBar selected={null} onSelect={() => {}} />);
    expect(screen.getByTestId('filter-chip-all').props.accessibilityState.selected).toBe(true);
    // 카테고리 칩은 비선택.
    expect(screen.getByTestId('filter-chip-cafe').props.accessibilityState.selected).toBe(false);
  });

  it('selected=key이면 그 카테고리 칩만 선택 상태다(단일 선택)', () => {
    renderWithTheme(<CategoryFilterBar selected="cafe" onSelect={() => {}} />);
    expect(screen.getByTestId('filter-chip-cafe').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('filter-chip-all').props.accessibilityState.selected).toBe(false);
  });

  it('카테고리 칩을 탭하면 그 key로 onSelect를 호출한다', () => {
    const onSelect = jest.fn();
    renderWithTheme(<CategoryFilterBar selected={null} onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId('filter-chip-cafe'));
    expect(onSelect).toHaveBeenCalledWith({ category: 'cafe' });
  });

  it('"전체" 칩을 탭하면 category=null로 onSelect를 호출한다(리셋)', () => {
    const onSelect = jest.fn();
    renderWithTheme(<CategoryFilterBar selected="cafe" onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId('filter-chip-all'));
    expect(onSelect).toHaveBeenCalledWith({ category: null });
  });

  it('칩 라벨은 categoryLabel(8종)과 "전체"를 쓴다', () => {
    renderWithTheme(<CategoryFilterBar selected={null} onSelect={() => {}} />);
    expect(screen.getByText('전체')).toBeTruthy();
    expect(screen.getByText('카페·디저트')).toBeTruthy();
  });
});
