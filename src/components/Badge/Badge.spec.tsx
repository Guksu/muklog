// src/components/Badge.spec.tsx
// 공용 Badge — pill 라벨, tone(primary/neutral), 이모지 없음 (AC-9 근거). (plan §5-7, T10)
import React from 'react';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { Badge } from './Badge';

describe('Badge', () => {
  it('label 텍스트를 렌더한다', () => {
    renderWithTheme(<Badge label="둘이" />);
    expect(screen.getByText('둘이')).toBeTruthy();
  });

  it('pill(full) radius 로 렌더한다', () => {
    renderWithTheme(<Badge label="둘이" testID="badge" />);
    const style = screen.getByTestId('badge').props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
    expect(flat.borderRadius).toBe(9999);
  });

  it('primary tone 이면 muklog accent-weak(#EAF0FF) 배경을 쓴다(기본)', () => {
    renderWithTheme(<Badge label="둘이" testID="badge" tone="primary" />);
    const style = screen.getByTestId('badge').props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
    expect(flat.backgroundColor).toBe('#EAF0FF');
  });

  it('label 에 이모지가 들어가지 않는다(브랜드 규칙: 호출부 책임이나 기본값 점검)', () => {
    renderWithTheme(<Badge label="혼자" />);
    expect(screen.getByText('혼자')).toBeTruthy();
  });
});
