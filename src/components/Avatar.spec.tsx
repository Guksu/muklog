// src/components/Avatar.spec.tsx
// 공용 Avatar — 킷 MkAvatar 정합(A5 / plan §3.3): url→userId디폴트→이니셜→익명🙂 우선순위 + 결정성.
import React from 'react';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';
import { defaultAvatar } from '@/features/profile/avatarDefault';

import { Avatar } from './Avatar';

describe('Avatar — 표시 우선순위(§3.3)', () => {
  it('1) url이 있으면 Image를 그 uri로 렌더한다(최우선)', () => {
    renderWithTheme(<Avatar url="https://x/avatars/u1/a.jpg" userId="u1" nickname="민지" />);
    expect(screen.getByTestId('avatar-image').props.source).toEqual({
      uri: 'https://x/avatars/u1/a.jpg',
    });
  });

  it('2) url無+userId 있으면 결정적 디폴트 이모지+컬러(color26 배경 / color55 ring)', () => {
    const { emoji, color } = defaultAvatar({ userId: 'u1' });
    renderWithTheme(<Avatar url={null} userId="u1" nickname="민지" />);
    const node = screen.getByTestId('avatar-default');
    expect(screen.getByText(emoji)).toBeTruthy();
    expect(flatStyle(node).backgroundColor).toBe(`${color}26`);
    expect(flatStyle(node).borderColor).toBe(`${color}55`);
  });

  it('3) url無+userId無+nickname 있으면 이니셜 폴백', () => {
    renderWithTheme(<Avatar url={null} userId={null} nickname="민수" />);
    expect(screen.queryByTestId('avatar-image')).toBeNull();
    expect(screen.queryByTestId('avatar-default')).toBeNull();
    expect(screen.getByTestId('avatar-placeholder')).toBeTruthy();
    expect(screen.getByText('민')).toBeTruthy();
  });

  it('4) 셋 다 없으면 익명 🙂', () => {
    renderWithTheme(<Avatar url={null} userId={null} nickname={null} />);
    expect(screen.getByTestId('avatar-anonymous')).toBeTruthy();
    expect(screen.getByText('🙂')).toBeTruthy();
  });

  it('결정성: 같은 userId는 항상 같은 이모지를 렌더한다', () => {
    const { emoji } = defaultAvatar({ userId: 'stable-77' });
    renderWithTheme(<Avatar url={null} userId="stable-77" />);
    expect(screen.getByText(emoji)).toBeTruthy();
  });

  it('ring=false면 디폴트 아바타 보더를 끈다', () => {
    renderWithTheme(<Avatar url={null} userId="u1" ring={false} />);
    expect(flatStyle(screen.getByTestId('avatar-default')).borderWidth).toBe(0);
  });

  it('닉네임은 접근성 라벨로 노출된다', () => {
    renderWithTheme(<Avatar url={null} userId="u1" nickname="민지" />);
    expect(screen.getByLabelText('민지 아바타')).toBeTruthy();
  });
});

const flatStyle = (node: { props: { style: unknown } }) =>
  Object.assign({}, ...[].concat(node.props.style as never).filter(Boolean)) as Record<string, unknown>;
