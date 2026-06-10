// src/navigation/ProfileHeaderButton.spec.tsx
// 헤더 진입점 — Routes.Profile 상수 + 버튼 onPress→navigate(Profile) (plan §5-1, T11 / P8).
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import { ProfileHeaderButton } from './ProfileHeaderButton';
import { Routes } from './routes';

beforeEach(() => {
  mockNavigate.mockReset();
});

describe('Routes.Profile', () => {
  it("라우트 상수가 'Profile'로 정의된다 (P8 단일 출처)", () => {
    expect(Routes.Profile).toBe('Profile');
  });
});

describe('ProfileHeaderButton', () => {
  it('누르면 Profile 라우트로 이동한다', () => {
    renderWithTheme(<ProfileHeaderButton />);
    fireEvent.press(screen.getByLabelText('프로필'));
    expect(mockNavigate).toHaveBeenCalledWith(Routes.Profile);
  });
});
