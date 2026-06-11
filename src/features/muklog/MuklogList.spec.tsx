// src/features/muklog/MuklogList.spec.tsx
// LogScreen 맛집 섹션 — loading/error/empty/ready 분기 + 섹션 헤더 "우리 맛집 N" + FAB→시트 오픈 + 저장→refresh
//   (plan §6.1 / §5 T10, AC1·AC2·AC11·AC12). useMuklogs/MuklogEntrySheet 모킹으로 섹션 동작만 검증.
import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { type Muklog } from './types';

const mockUseMuklogs = jest.fn();
const refresh = jest.fn();
jest.mock('./useMuklogs', () => ({ useMuklogs: () => mockUseMuklogs() }));

// 시트는 visible/onSaved만 검증(내부는 자체 spec) → 가벼운 더블로 대체.
jest.mock('./MuklogEntrySheet', () => {
  const { Pressable, Text } = require('react-native');
  return {
    MuklogEntrySheet: ({ visible, onSaved }: { visible: boolean; onSaved: () => void }) =>
      visible ? (
        <Pressable accessibilityLabel="시트-저장" onPress={onSaved}>
          <Text>시트 열림</Text>
        </Pressable>
      ) : null,
  };
});

import { MuklogList } from './MuklogList';

const muklog = (over?: Partial<Muklog>): Muklog => ({
  id: 'm1',
  roomId: 'r1',
  placeName: '트라토리아 보나',
  category: 'pasta',
  area: '연남동',
  memo: '맛있었다',
  rating: 5,
  visitedAt: '2026-02-14',
  createdBy: 'me-uid',
  createdAt: '2026-02-14T00:00:00.000Z',
  ...over,
});

const renderList = () => renderWithTheme(<MuklogList roomId="r1" meId="me-uid" />);

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMuklogs.mockReturnValue({ state: { status: 'loading' }, refresh });
});

describe('MuklogList', () => {
  it('loading이면 로더를 표시한다', () => {
    mockUseMuklogs.mockReturnValue({ state: { status: 'loading' }, refresh });
    renderList();
    expect(screen.getByTestId('muklog-list-loading')).toBeTruthy();
  });

  it('error면 메시지 + 다시 시도 버튼을 표시한다 (AC11)', () => {
    mockUseMuklogs.mockReturnValue({
      state: { status: 'error', message: '맛집 목록을 불러오지 못했어요. 다시 시도해 주세요.' },
      refresh,
    });
    renderList();
    expect(screen.getByText('맛집 목록을 불러오지 못했어요. 다시 시도해 주세요.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('다시 시도'));
    expect(refresh).toHaveBeenCalled();
  });

  it('빈 목록이면 빈 상태 문구를 표시한다 (AC1)', () => {
    mockUseMuklogs.mockReturnValue({ state: { status: 'ready', muklogs: [] }, refresh });
    renderList();
    expect(screen.getByText('아직 기록한 맛집이 없어요')).toBeTruthy();
    expect(screen.getByText('우리 맛집 0')).toBeTruthy();
  });

  it('ready면 섹션 헤더 "우리 맛집 N"과 카드 N개를 표시한다', () => {
    mockUseMuklogs.mockReturnValue({
      state: { status: 'ready', muklogs: [muklog({ id: 'm1' }), muklog({ id: 'm2', placeName: '어니언' })] },
      refresh,
    });
    renderList();
    expect(screen.getByText('우리 맛집 2')).toBeTruthy();
    expect(screen.getByText('트라토리아 보나')).toBeTruthy();
    expect(screen.getByText('어니언')).toBeTruthy();
  });

  it('FAB 탭 시 입력 시트를 연다', () => {
    mockUseMuklogs.mockReturnValue({ state: { status: 'ready', muklogs: [] }, refresh });
    renderList();
    expect(screen.queryByText('시트 열림')).toBeNull();
    fireEvent.press(screen.getByLabelText('새 먹로그'));
    expect(screen.getByText('시트 열림')).toBeTruthy();
  });

  it('저장 성공 시 refresh를 호출하고 시트를 닫는다 (AC12)', async () => {
    mockUseMuklogs.mockReturnValue({ state: { status: 'ready', muklogs: [] }, refresh });
    renderList();
    fireEvent.press(screen.getByLabelText('새 먹로그'));

    await act(async () => {
      fireEvent.press(screen.getByLabelText('시트-저장'));
    });

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('시트 열림')).toBeNull();
  });
});
