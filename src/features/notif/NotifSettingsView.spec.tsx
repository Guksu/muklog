// src/features/notif/NotifSettingsView.spec.tsx
// 알림 설정 화면(프리젠테이셔널) — 킷 mk-extra:128-175. 마스터/로그별 토글·dim 분기·빈/로딩·콜백 검증.
//   데이터(영속·로그목록·displayLogName)는 props 주입 — 여기선 비주얼 골격 + 콜백만 검증(developer가 배선).
import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { NotifSettingsView, type NotifLogItem } from './NotifSettingsView';

// 노브 슬라이드 Animated 타이머 제어(act 경고 방지).
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

const logItem = (over?: Partial<NotifLogItem>): NotifLogItem => ({
  roomId: 'r1',
  name: '연남동 부부',
  memberCount: 2,
  enabled: true,
  meUserId: 'u-me',
  partnerUserId: 'u-partner',
  ...over,
});

const baseProps = {
  master: true,
  onToggleMaster: jest.fn(),
  logs: [logItem()],
  onToggleLog: jest.fn(),
  onBack: jest.fn(),
};

const renderView = (over?: Partial<React.ComponentProps<typeof NotifSettingsView>>) =>
  renderWithTheme(<NotifSettingsView {...baseProps} {...over} />);

beforeEach(() => jest.clearAllMocks());

describe('NotifSettingsView — 헤더/마스터', () => {
  it('SubBar 타이틀 "알림 설정"을 렌더한다', () => {
    renderView();
    expect(screen.getByText('알림 설정')).toBeTruthy();
  });

  it('뒤로 버튼 탭 시 onBack을 호출한다', () => {
    const onBack = jest.fn();
    renderView({ onBack });
    fireEvent.press(screen.getByLabelText('뒤로 가기'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('마스터 토글 제목/부제 카피를 렌더한다(킷 mk-extra:143-144)', () => {
    renderView();
    expect(screen.getByText('새 먹로그 알림')).toBeTruthy();
    expect(screen.getByText('참여한 로그에 새 기록이 올라오면 알려드려요')).toBeTruthy();
  });

  it('마스터 스위치 상태가 master 값을 반영한다', () => {
    renderView({ master: false });
    expect(screen.getByLabelText('새 먹로그 알림').props.accessibilityState.checked).toBe(false);
  });

  it('마스터 스위치 탭 시 onToggleMaster({enabled:!master})를 호출한다', () => {
    const onToggleMaster = jest.fn();
    renderView({ master: false, onToggleMaster });
    fireEvent.press(screen.getByLabelText('새 먹로그 알림'));
    expect(onToggleMaster).toHaveBeenCalledWith({ enabled: true });
  });

  it('안내 카피를 렌더한다(킷 mk-extra:168-170)', () => {
    renderView();
    expect(
      screen.getByText('알림은 기기 설정에서도 켜져 있어야 받을 수 있어요.'),
    ).toBeTruthy();
  });
});

describe('NotifSettingsView — 로그별', () => {
  it('"로그별 알림" 섹션 라벨을 렌더한다', () => {
    renderView();
    expect(screen.getByText('로그별 알림')).toBeTruthy();
  });

  it('로그 2건이면 로그명과 스위치 2개를 렌더한다', () => {
    renderView({
      logs: [
        logItem({ roomId: 'r1', name: '연남동 부부' }),
        logItem({ roomId: 'r2', name: '성수 데이트', memberCount: 1, partnerUserId: null }),
      ],
    });
    expect(screen.getByText('연남동 부부')).toBeTruthy();
    expect(screen.getByText('성수 데이트')).toBeTruthy();
    expect(screen.getByLabelText('연남동 부부 알림')).toBeTruthy();
    expect(screen.getByLabelText('성수 데이트 알림')).toBeTruthy();
  });

  it('솔로(memberCount 1)는 아바타 1개, 커플(2)은 아바타 2개를 렌더한다', () => {
    const { rerender } = renderView({
      logs: [logItem({ memberCount: 1, partnerUserId: null })],
    });
    expect(screen.getAllByTestId(/^avatar-/)).toHaveLength(1);

    rerender(
      <NotifSettingsView {...baseProps} logs={[logItem({ memberCount: 2 })]} />,
    );
    expect(screen.getAllByTestId(/^avatar-/)).toHaveLength(2);
  });

  it('로그별 스위치 상태가 item.enabled를 반영한다', () => {
    renderView({ logs: [logItem({ roomId: 'r1', name: 'A', enabled: false })] });
    expect(screen.getByLabelText('A 알림').props.accessibilityState.checked).toBe(false);
  });

  it('로그별 스위치 탭 시 onToggleLog({roomId, enabled})를 호출한다', () => {
    const onToggleLog = jest.fn();
    renderView({
      logs: [logItem({ roomId: 'r9', name: 'B', enabled: false })],
      onToggleLog,
    });
    fireEvent.press(screen.getByLabelText('B 알림'));
    expect(onToggleLog).toHaveBeenCalledWith({ roomId: 'r9', enabled: true });
  });
});

describe('NotifSettingsView — 마스터 게이트(D2)', () => {
  it('마스터 off면 로그별 스위치가 disabled다', () => {
    renderView({ master: false, logs: [logItem({ roomId: 'r1', name: 'A' })] });
    expect(screen.getByLabelText('A 알림').props.accessibilityState.disabled).toBe(true);
  });

  it('마스터 off면 로그별 스위치 탭이 onToggleLog를 호출하지 않는다', () => {
    const onToggleLog = jest.fn();
    renderView({ master: false, logs: [logItem({ roomId: 'r1', name: 'A' })], onToggleLog });
    fireEvent.press(screen.getByLabelText('A 알림'));
    expect(onToggleLog).not.toHaveBeenCalled();
  });
});

describe('NotifSettingsView — 빈/로딩(D6, T8)', () => {
  it('로그 0건이면 빈 안내를 렌더한다', () => {
    renderView({ logs: [] });
    expect(screen.getByText('아직 참여한 로그가 없어요')).toBeTruthy();
    expect(screen.queryByTestId('mk-switch')).toBeTruthy(); // 마스터 스위치는 존재
  });

  it('로그 0건이어도 마스터 토글은 동작한다', () => {
    const onToggleMaster = jest.fn();
    renderView({ logs: [], master: true, onToggleMaster });
    fireEvent.press(screen.getByLabelText('새 먹로그 알림'));
    expect(onToggleMaster).toHaveBeenCalledWith({ enabled: false });
  });

  it('isLogsLoading면 로딩 표시를 렌더하고 빈 안내는 숨긴다', () => {
    renderView({ logs: [], isLogsLoading: true });
    expect(screen.getByTestId('notif-logs-loading')).toBeTruthy();
    expect(screen.queryByText('아직 참여한 로그가 없어요')).toBeNull();
  });
});
