// src/components/InviteCodeCard.spec.tsx
// 초대코드 카드 — 코드 표시 + 복사(expo-clipboard) + "복사됨" 피드백 (plan §6.2 / §5 T5, AC1·AC2·C10).
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(true) }));
import * as Clipboard from 'expo-clipboard';

import { IconName } from './Icon';
import { InviteCodeCard } from './InviteCodeCard';

const setStringAsync = Clipboard.setStringAsync as jest.Mock;

beforeEach(() => {
  setStringAsync.mockClear();
  setStringAsync.mockResolvedValue(true);
});

describe('InviteCodeCard', () => {
  it('전달된 code를 표시한다 (AC1)', () => {
    renderWithTheme(<InviteCodeCard code="ABCDEF" />);
    expect(screen.getByText('ABCDEF')).toBeTruthy();
  });

  it('복사 버튼 탭 시 Clipboard.setStringAsync를 그 코드로 호출한다 (AC2·C10)', async () => {
    renderWithTheme(<InviteCodeCard code="ABCDEF" />);
    fireEvent.press(screen.getByLabelText('초대코드 복사'));
    await waitFor(() => {
      expect(setStringAsync).toHaveBeenCalledWith('ABCDEF');
    });
  });

  it('복사 성공 후 "복사됨" 피드백을 노출한다 (AC2)', async () => {
    renderWithTheme(<InviteCodeCard code="ABCDEF" />);
    expect(screen.queryByText('복사됨')).toBeNull();
    fireEvent.press(screen.getByLabelText('초대코드 복사'));
    await waitFor(() => {
      expect(screen.getByText('복사됨')).toBeTruthy();
    });
  });

  it('복사 버튼에 link 아이콘(leftIcon)을 표시한다 (킷 mk-home InviteCodeCard 정합)', () => {
    renderWithTheme(<InviteCodeCard code="ABCDEF" />);
    expect(screen.getByTestId(`icon-${IconName.Link}`)).toBeTruthy();
  });
});
