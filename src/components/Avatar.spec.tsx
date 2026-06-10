// src/components/Avatar.spec.tsx
// 공용 Avatar — url 유무 분기 렌더 (plan §5-1, T8 / P4).
import React from 'react';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('url이 있으면 Image를 그 uri로 렌더한다 (P4)', () => {
    renderWithTheme(<Avatar url="https://x/avatars/u1/a.jpg" nickname="민수" />);
    const image = screen.getByTestId('avatar-image');
    expect(image.props.source).toEqual({ uri: 'https://x/avatars/u1/a.jpg' });
  });

  it('url이 없으면 닉네임 이니셜 플레이스홀더를 렌더한다', () => {
    renderWithTheme(<Avatar url={null} nickname="민수" />);
    expect(screen.queryByTestId('avatar-image')).toBeNull();
    expect(screen.getByTestId('avatar-placeholder')).toBeTruthy();
    expect(screen.getByText('민')).toBeTruthy();
  });

  it('url도 닉네임도 없으면 플레이스홀더만(이니셜 없음) 렌더한다 (빈 상태)', () => {
    renderWithTheme(<Avatar url={null} nickname={null} />);
    expect(screen.queryByTestId('avatar-image')).toBeNull();
    expect(screen.getByTestId('avatar-placeholder')).toBeTruthy();
  });

  it('이니셜은 trim 후 첫 글자를 대문자로 쓴다', () => {
    renderWithTheme(<Avatar url={null} nickname="  alice " />);
    expect(screen.getByText('A')).toBeTruthy();
  });
});
