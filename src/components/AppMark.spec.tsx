// src/components/AppMark.spec.tsx
// 브랜드 마크(로고 프리미티브) — 킷 mk-auth.jsx:8-26 AppMark(「먹 핀」) 정합. (brand-coral §1)
//   코럴 스퀘어클(그라데이션 rect) + 흰 위치핀 + 핀 안 "먹" 글자. 포크/스푼 요소 없음. bg/tint/size/radius props.
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

  it('bg=false면 배경 rect를 렌더하지 않는다(모노 사용, AC2)', () => {
    renderWithTheme(<AppMark size={96} bg={false} />);
    expect(screen.queryByTestId('app-mark-bg')).toBeNull();
  });

  // ── 「먹 핀」 전환 (brand-coral §1, AC1) ──
  it('위치핀과 "먹" 글자를 렌더한다(핀+글자 구성)', () => {
    renderWithTheme(<AppMark size={108} />);
    expect(screen.getByTestId('app-mark-pin')).toBeTruthy();
    expect(screen.getByTestId('app-mark-glyph')).toBeTruthy();
    expect(screen.getByText('먹')).toBeTruthy();
  });

  it('bg=false에서도 핀+글자는 렌더된다(모노, 배경만 제거, AC2)', () => {
    renderWithTheme(<AppMark size={96} bg={false} />);
    expect(screen.getByTestId('app-mark-pin')).toBeTruthy();
    expect(screen.getByTestId('app-mark-glyph')).toBeTruthy();
  });

  it('스퀘어클 코너 반경 rx 기본값 = 변의 22.5%(viewBox 좌표 22.5)다(킷 mk-auth:18)', () => {
    renderWithTheme(<AppMark size={100} />);
    const rect = screen.getByTestId('app-mark-bg');
    expect(rect.props.rx).toBe(22.5);
  });

  it('radius prop을 주면 viewBox 좌표로 환산한다(radius/size×100)', () => {
    renderWithTheme(<AppMark size={108} radius={27} />);
    const rect = screen.getByTestId('app-mark-bg');
    // 27/108×100 = 25.
    expect(rect.props.rx).toBe(25);
  });
});
