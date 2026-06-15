// src/components/Icon.spec.tsx
// 공용 Icon — name 으로 SVG 글리프 렌더, color 토큰 해석, size 적용 (AC-7). (plan §6 B, T6)
//   react-native-svg 는 모킹(testing-strategy: 외부 SDK = 모킹). SvgXml 에 넘어가는 props 를 단언.
import React from 'react';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { Icon, IconName } from './Icon';

describe('Icon', () => {
  it('name 에 해당하는 SVG 노드를 testID(icon-<name>)로 렌더한다', () => {
    renderWithTheme(<Icon name={IconName.Plus} />);
    expect(screen.getByTestId('icon-plus')).toBeTruthy();
  });

  it('color 토큰을 해석해 currentColor 로 전달한다', () => {
    renderWithTheme(<Icon name={IconName.Plus} color="primary" />);
    const node = screen.getByTestId('icon-plus');
    // primary = #3366FF. SvgXml 의 color prop 으로 전달(자식 currentColor 상속).
    expect(node.props.color).toBe('#3366FF');
  });

  it('size 를 width/height 로 적용한다(기본 24)', () => {
    renderWithTheme(<Icon name={IconName.ChevronRight} size={16} />);
    const node = screen.getByTestId('icon-chevron-right');
    expect(node.props.width).toBe(16);
    expect(node.props.height).toBe(16);
  });

  it('color 미지정 시 기본 fg 토큰(웜 잉크 #2A2422)을 쓴다', () => {
    renderWithTheme(<Icon name={IconName.Person} />);
    const node = screen.getByTestId('icon-person');
    expect(node.props.color).toBe('#2A2422');
  });

  it('calendar 글리프(먹로그 상세 InfoRow 방문일)를 렌더한다', () => {
    renderWithTheme(<Icon name={IconName.Calendar} />);
    expect(screen.getByTestId('icon-calendar')).toBeTruthy();
  });

  it('search 글리프(장소검색 돋보기, muklog-place)를 렌더한다', () => {
    renderWithTheme(<Icon name={IconName.Search} />);
    expect(screen.getByTestId('icon-search')).toBeTruthy();
  });

  it('pencil 글리프(로그 이름 편집, log-name)를 렌더한다', () => {
    renderWithTheme(<Icon name={IconName.Pencil} />);
    expect(screen.getByTestId('icon-pencil')).toBeTruthy();
  });
});
