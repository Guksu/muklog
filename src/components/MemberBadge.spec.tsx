// src/components/MemberBadge.spec.tsx
// 멤버 배지(혼자/둘이) — 킷 mk-ui.jsx:138-152 MemberBadge 정합 (A4).
import React from 'react';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';
import { themes } from '@/theme';

import { MemberBadge } from './MemberBadge';

const lightColor = themes.light.color;

describe('MemberBadge', () => {
  it('memberCount>=2면 💑 둘이 + primaryWeak/accentStrong이다', () => {
    renderWithTheme(<MemberBadge memberCount={2} />);
    expect(screen.getByText('둘이')).toBeTruthy();
    expect(screen.getByText('💑')).toBeTruthy();
    expect(flatBg(screen.getByTestId('member-badge'))).toBe(lightColor.primaryWeak);
    expect(screen.getByText('둘이').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: lightColor.accentStrong })]),
    );
  });

  it('memberCount<2면 🙋 혼자 + surfaceAlt/fgWeak이다', () => {
    renderWithTheme(<MemberBadge memberCount={1} />);
    expect(screen.getByText('혼자')).toBeTruthy();
    expect(screen.getByText('🙋')).toBeTruthy();
    expect(flatBg(screen.getByTestId('member-badge'))).toBe(lightColor.surfaceAlt);
    expect(screen.getByText('혼자').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: lightColor.fgWeak })]),
    );
  });

  it('memberCount=3 등 2 이상은 모두 커플 톤이다(엣지: 비정상값 안전)', () => {
    renderWithTheme(<MemberBadge memberCount={3} />);
    expect(screen.getByText('둘이')).toBeTruthy();
  });
});

const flatStyle = (node: { props: { style: unknown } }) =>
  Object.assign({}, ...[].concat(node.props.style as never).filter(Boolean)) as Record<string, unknown>;
const flatBg = (node: { props: { style: unknown } }) => flatStyle(node).backgroundColor;
