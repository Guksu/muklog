// src/components/AppMark.spec.tsx
// 브랜드 마크(로고 프리미티브) — 킷 mk-auth.jsx:8-37 AppMark 정합.
//   블루 스퀘어클(그라데이션 rect) + 흰 위치핀 + 포크/스푼. bg/tint/size/radius props.
import React from 'react';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { AppMark } from './AppMark';

describe('AppMark', () => {
  it('기본 렌더 시 크래시 없이 svg 트리를 만든다(testID 존재, plan ①)', () => {
    renderWithTheme(<AppMark size={108} />);
    expect(screen.getByTestId('app-mark')).toBeTruthy();
  });

  it('size를 Svg width/height에 전달한다', () => {
    renderWithTheme(<AppMark size={120} />);
    const svg = screen.getByTestId('app-mark');
    expect(svg.props.width).toBe(120);
    expect(svg.props.height).toBe(120);
  });

  it('bg=true(기본)면 그라데이션 배경 rect를 렌더한다', () => {
    renderWithTheme(<AppMark size={96} />);
    expect(screen.getByTestId('app-mark-bg')).toBeTruthy();
  });

  it('bg=false면 배경 rect를 렌더하지 않는다(모노 사용)', () => {
    renderWithTheme(<AppMark size={96} bg={false} />);
    expect(screen.queryByTestId('app-mark-bg')).toBeNull();
  });
});
