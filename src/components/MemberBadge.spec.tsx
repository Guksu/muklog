// src/components/MemberBadge.spec.tsx
// 멤버 배지(혼자/N명) — 킷 mk-ui.jsx:143-155 MemberBadge 정합 (AC4).
//   이모지 없음(신 사양). 1명→"혼자", 2명 이상→"N명".
import React from 'react';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';
import { themes } from '@/theme';

import { MemberBadge } from './MemberBadge';

const lightColor = themes.light.color;

describe('MemberBadge', () => {
  it('memberCount<=1이면 "혼자" + surfaceAlt/fgWeak이다', () => {
    renderWithTheme(<MemberBadge memberCount={1} />);
    expect(screen.getByText('혼자')).toBeTruthy();
    expect(flatBg(screen.getByTestId('member-badge'))).toBe(lightColor.surfaceAlt);
    expect(screen.getByText('혼자').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: lightColor.fgWeak })]),
    );
  });

  it('memberCount>=2면 "N명" + primaryWeak/accentStrong이다', () => {
    renderWithTheme(<MemberBadge memberCount={2} />);
    expect(screen.getByText('2명')).toBeTruthy();
    expect(flatBg(screen.getByTestId('member-badge'))).toBe(lightColor.primaryWeak);
    expect(screen.getByText('2명').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: lightColor.accentStrong })]),
    );
  });

  it('memberCount 3·5는 각각 "3명"·"5명"으로 렌더한다', () => {
    renderWithTheme(<MemberBadge memberCount={3} />);
    expect(screen.getByText('3명')).toBeTruthy();
    screen.unmount();
    renderWithTheme(<MemberBadge memberCount={5} />);
    expect(screen.getByText('5명')).toBeTruthy();
  });

  it('이모지(💑·🙋)를 렌더하지 않는다(신 사양: 텍스트만)', () => {
    renderWithTheme(<MemberBadge memberCount={2} />);
    expect(screen.queryByText('💑')).toBeNull();
    expect(screen.queryByText('🙋')).toBeNull();
  });
});

const flatStyle = (node: { props: { style: unknown } }) =>
  Object.assign({}, ...[].concat(node.props.style as never).filter(Boolean)) as Record<string, unknown>;
const flatBg = (node: { props: { style: unknown } }) => flatStyle(node).backgroundColor;
